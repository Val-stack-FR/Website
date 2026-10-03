import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const assetRoutes = new Map([
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/css/archives.css', ['css/archives.css', 'text/css; charset=utf-8']],
  ['/js/archives-reader.js', ['js/archives-reader.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml; charset=utf-8']]
]);
const htmlRoutes = new Set(['/', '/archives/', '/archives/index.html']);
const isInside = (root, candidate) => {
  const part = relative(root, candidate);
  return part !== '' && !isAbsolute(part) && part !== '..' && !part.startsWith('..' + sep);
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };

// Local verification only: every asset and source is explicitly selected.
export async function createArchivePreview({ htmlPath, assetsRoot, corpusRoot, mediaManifestPath, preflightPath }) {
  if (!corpusRoot) fail('PHD_CORPUS_ROOT is required.');
  const root = await realpath(corpusRoot);
  const assets = await realpath(assetsRoot);
  const html = await readFile(htmlPath);
  const manifest = JSON.parse(await readFile(mediaManifestPath, 'utf8'));
  const preflight = JSON.parse(await readFile(preflightPath, 'utf8'));
  if (preflight.passed !== true) fail('The corpus preflight has not passed.');
  if (preflight.corpus_root_accessible !== true || preflight.corpus_root_reference !== 'env:PHD_CORPUS_ROOT' ||
      !/^[a-f0-9]{64}$/.test(preflight.input_manifest_sha256)) {
    fail('Invalid preflight corpus configuration or evidence.');
  }
  if (manifest.manifest_version !== 'atelier-tuce-local-media/1.0.0' ||
      manifest.corpus_root_reference !== 'env:PHD_CORPUS_ROOT' || manifest.access_tier !== 'project' ||
      manifest.publication_status !== 'not-published' || !Array.isArray(manifest.objects)) {
    fail('Invalid media allowlist.');
  }
  const media = manifest.objects.filter(item => item.media_type === 'image/jpeg');
  if (media.length < 1 || media.length > 4) fail('MVP allows one to four selected images.');
  const files = new Map();
  const viewIds = new Set();
  for (const item of media) {
    if (!item.view_id || viewIds.has(item.view_id)) fail('Missing or duplicate view ID.');
    viewIds.add(item.view_id);
    if (typeof item.approved_review_id !== 'string' || !item.approved_review_id.startsWith('review:')) {
      fail('A preserved approved link is required.');
    }
    if (item.bytes_verified !== true || item.source_reading_status !== 'unreviewed') {
      fail('Each selected image needs a verified allowlist entry with its unreviewed source state preserved.');
    }
    if (item.media_type !== 'image/jpeg' || !/^[a-f0-9]{64}$/.test(item.sha256)) {
      fail('Only SHA-256 verified JPEGs are allowed in this MVP.');
    }
    if (!Number.isSafeInteger(item.byte_size) || item.byte_size < 1) fail('Invalid declared byte size.');
    if (typeof item.relative_path !== 'string' || isAbsolute(item.relative_path) ||
        /^[A-Za-z]:/.test(item.relative_path) || item.relative_path.includes('\0') ||
        item.relative_path.split(/[\\/]/).some(part => part === '..')) fail('Unsafe source path.');
    const candidate = resolve(root, item.relative_path);
    if (!isInside(root, candidate)) fail('Source is outside the configured corpus.');
    const file = await realpath(candidate);
    if (!isInside(root, file)) fail('Source resolves outside the configured corpus.');
    const bytes = await readFile(file);
    if (sha256(bytes) !== item.sha256) fail('The selected source hash has changed.');
    if (bytes.length !== item.byte_size) fail('The selected source differs from its declared byte size.');
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) fail('Selected file is not a JPEG.');
    if (files.has(item.sha256)) fail('Duplicate content requires a separate explicit mapping.');
    files.set(item.sha256, { file, contentType: 'image/jpeg', size: bytes.length });
  }
  const staticFiles = new Map();
  for (const [url, [name, contentType]] of assetRoutes) {
    const file = await realpath(resolve(assets, name));
    if (!isInside(assets, file)) fail('Asset resolves outside the checkout.');
    const info = await stat(file);
    if (!info.isFile()) fail('Asset is not a file.');
    staticFiles.set(url, { file, contentType, size: info.size });
  }
  const server = createServer((request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      response.writeHead(405).end('Method not allowed');
      return;
    }
    let pathname;
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.search) { response.writeHead(404).end('Not found'); return; }
      pathname = decodeURIComponent(url.pathname);
    } catch { response.writeHead(400).end('Invalid URL'); return; }
    if (htmlRoutes.has(pathname)) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length });
      response.end(request.method === 'HEAD' ? undefined : html);
      return;
    }
    const match = /^\/__archive_media\/([a-f0-9]{64})$/.exec(pathname);
    const entry = match ? files.get(match[1]) : staticFiles.get(pathname);
    if (!entry) { response.writeHead(404).end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': entry.contentType, 'Content-Length': entry.size });
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = createReadStream(entry.file);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  });
  return {
    server,
    async listen(port = 0) {
      await new Promise((accept, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => { server.off('error', reject); accept(); });
      });
      return 'http://127.0.0.1:' + server.address().port + '/archives/';
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: {
        html: { type: 'string' }, 'media-manifest': { type: 'string' },
        preflight: { type: 'string' }, port: { type: 'string', default: '8766' }
      }
    });
    if (!values.html || !values['media-manifest'] || !values.preflight) {
      fail('Required: --html, --media-manifest, --preflight.');
    }
    const port = Number(values.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535) fail('Invalid port.');
    const preview = await createArchivePreview({
      htmlPath: values.html, mediaManifestPath: values['media-manifest'], preflightPath: values.preflight,
      assetsRoot: fileURLToPath(new URL('../..', import.meta.url)), corpusRoot: process.env.PHD_CORPUS_ROOT
    });
    console.log(await preview.listen(port));
  } catch (error) { console.error('Preview refused: ' + error.message); process.exitCode = 1; }
}
