import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const CHECKSUMS = '92b828d488bbaef5e895d079f5a68e7a5b2b9ac52f58bdf07bc6f3c3aa67f1d6';
const SOURCES = new Map([
  ['object:path-d409e2fd87b2f1ae2c423d684945dbfd79ef5d68b7e2e5bbfc0f2cf05692c02f', '9d5a034f86206015b0e0e1f2d857a0ae2875c97a5bab8f401f1de5f665f89e5c'],
  ['object:path-f267507433bfe08263609008088be73fff45465987b1d374d8ca8ccc42535c14', '82f590739d54c8c74dab7435323fdc3b9375e38422ec63a9166fd9f8d6be59c9']
]);
const PAGES = new Set(['/archives/', '/archives/index.html', '/archives/catalogue/',
  '/archives/recherche/', '/archives/avancement/', '/archives/formes/',
  '/archives/formes-brouillons/', '/archives/textes/', '/archives/texte/']);
const DATA = new Set(['/__catalogue_data', '/__catalogue_hierarchy', '/__draft_review_data']);
const check = (value, message) => { if (!value) throw new Error(message); };

export function loopbackBase(value) {
  const url = new URL(value);
  check(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port &&
    url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash,
  'A literal loopback reader origin is required.');
  return url.origin;
}

export function permittedSourceRoute(url) {
  return PAGES.has(url.pathname) || DATA.has(url.pathname) ||
    (!url.search && (['/styles.css', '/favicon.svg'].includes(url.pathname) ||
      /^\/(?:css|js|assets)\/archives[-a-z0-9]*\.(?:css|js)$/.test(url.pathname) ||
      /^\/__archive(?:_draft)?_media\/[a-f0-9]{64}$/.test(url.pathname)));
}

export function guardRequest(request, origin) {
  if (!['GET', 'HEAD'].includes(request.method)) return { status: 405 };
  const counts = new Map();
  if (!Array.isArray(request.rawHeaders) || request.rawHeaders.length % 2) return { status: 400 };
  for (let i = 0; i < request.rawHeaders.length; i += 2) {
    const name = request.rawHeaders[i].toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.get('host') !== 1 || ['origin', 'sec-fetch-site'].some(name => (counts.get(name) ?? 0) > 1)) return { status: 400 };
  if (['content-length', 'transfer-encoding', 'expect'].some(name => counts.has(name) || request.headers[name] !== undefined)) return { status: 400 };
  const own = new URL(origin);
  if (request.headers.host !== own.host ||
      (request.headers.origin && request.headers.origin !== own.origin) ||
      request.headers['sec-fetch-site'] === 'cross-site') return { status: 403 };
  const raw = request.url;
  if (typeof raw !== 'string' || raw.length > 8192 || !raw.startsWith('/') || raw.startsWith('//')) return { status: 400 };
  const rawPath = raw.split('?')[0];
  if (rawPath.includes('\\') || /%2f|%5c|%00/i.test(rawPath)) return { status: 400 };
  let decoded;
  try { decoded = decodeURIComponent(rawPath); } catch { return { status: 400 }; }
  if (decoded.split('/').some(part => part === '..' || part === '.') || /[\u0000-\u001f:]/.test(decoded)) return { status: 400 };
  const url = new URL(raw, own.origin);
  if (url.search.length > 4096) return { status: 400 };
  return { url };
}

export function rewriteMediaUrls(html, rewrites) {
  let result = html;
  for (const [source, derivative] of rewrites) result = result.split(source).join(derivative);
  return result;
}

export async function readBounded(response, limit = 32 * 1024 * 1024) {
  check(Number.isInteger(limit) && limit > 0, 'Invalid response limit.');
  const declared = response.headers.get('content-length');
  check(declared === null || /^\d+$/.test(declared) && Number(declared) <= limit, 'Upstream response exceeds limit.');
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = []; let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      check(total <= limit, 'Upstream response exceeds limit.');
      chunks.push(Buffer.from(item.value));
    }
  } catch (error) { await reader.cancel(); throw error; }
  return Buffer.concat(chunks, total);
}

export async function loadMediaBundle(directory) {
  const root = await realpath(resolve(directory));
  const files = new Map();
  async function visit(relative = '') {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      check(!entry.isSymbolicLink() && (entry.isFile() || entry.isDirectory()), 'Bundle links refused.');
      check((await lstat(join(root, name))).isSymbolicLink() === false &&
        await realpath(join(root, name)) === join(root, name), 'Bundle reparse point refused.');
      if (entry.isDirectory()) { check(name === 'media', 'Unexpected bundle directory.'); await visit(name); }
      else { check(files.size < 7, 'Unexpected bundle file.'); files.set(name, await readFile(join(root, name))); }
    }
  }
  await visit();
  check(files.size === 7 && digest(files.get('checksums.json') ?? Buffer.alloc(0)) === CHECKSUMS, 'Unreviewed media bundle.');
  const checksums = JSON.parse(files.get('checksums.json'));
  check(Object.keys(checksums).length === 6 && [...files.keys()].every(name => name === 'checksums.json' || checksums[name]), 'Closed checksums required.');
  for (const [name, expected] of Object.entries(checksums)) check(files.has(name) && digest(files.get(name)) === expected, 'Media bundle hash drift.');
  const allowlist = JSON.parse(files.get('media-allowlist.json'));
  const overlay = JSON.parse(files.get('reader-overlay.json'));
  check(allowlist.files.length === 7 && new Set(allowlist.files).size === 7 && allowlist.files.every(name => files.has(name)), 'Closed media allowlist required.');
  check(overlay.candidate_id === 'candidate:atelier-47958c7faa376f7e4729edd9babe9b40' &&
    overlay.media.length === 2 && overlay.publication.activated === false &&
    overlay.publication.approved_for_publication === false && overlay.publication.rights_review === 'pending', 'Private two-photo profile required.');
  const routes = new Map(), rewrites = new Map();
  for (const item of overlay.media) {
    const source = SOURCES.get(item.view_id);
    check(source && item.source_digital_object_id === item.view_id && item.derivative_of_ids.length === 1 &&
      item.derivative_of_ids[0] === item.view_id && item.rights_status === 'unknown' &&
      item.orientation.raster_transform === 'none' && item.orientation.reference_frame === 'native-coded-raster' &&
      item.dimensions.width === 3968 && item.dimensions.height === 2976, 'Source/repere binding drift.');
    check(/^\/archives\/media-releases\/[a-f0-9]{32}\/media\/[a-f0-9]{64}\.jpg$/.test(item.media_url) &&
      item.media_path === `media/${item.sha256}.jpg` && files.get(item.media_path)?.length === item.byte_size &&
      digest(files.get(item.media_path)) === item.sha256 && !routes.has(item.media_url), 'Derivative binding drift.');
    routes.set(item.media_url, files.get(item.media_path));
    rewrites.set(`/__archive_media/${source}`, item.media_url);
  }
  check(routes.size === 2 && rewrites.size === 2, 'Exactly two distinct bindings required.');
  return { routes, rewrites, overlay, checksumSha256: CHECKSUMS };
}

export async function createIntegratedPreview({ baseUrl, mediaDirectory }) {
  const base = loopbackBase(baseUrl), media = await loadMediaBundle(mediaDirectory);
  async function upstream(url) {
    const response = await fetch(base + url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    check(![301, 302, 303, 307, 308].includes(response.status), 'Upstream redirect refused.');
    return { response, bytes: await readBounded(response) };
  }
  const probe = await upstream('/archives/');
  check(probe.response.status === 200 && [...media.rewrites.keys()].every(url => probe.bytes.includes(url)), 'Reader differs from selected source views.');
  let origin;
  const server = createServer({ maxHeaderSize: 8192 }, async (request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    const guarded = guardRequest(request, origin);
    if (guarded.status) { response.setHeader('Connection', 'close'); if (guarded.status === 405) response.setHeader('Allow', 'GET, HEAD'); response.writeHead(guarded.status).end(request.method === 'HEAD' ? undefined : 'Request refused'); return; }
    const url = guarded.url;
    if (url.pathname === '/' && !url.search) { response.writeHead(302, { Location: '/archives/' }).end(); return; }
    if (media.routes.has(url.pathname) && !url.search) {
      const bytes = media.routes.get(url.pathname);
      response.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes); return;
    }
    if (media.rewrites.has(url.pathname) && !url.search) { response.writeHead(302, { Location: media.rewrites.get(url.pathname) }).end(); return; }
    if (url.pathname === '/__integrated_media_provenance' && !url.search) {
      const bytes = Buffer.from(JSON.stringify(media.overlay));
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bytes.length }); response.end(request.method === 'HEAD' ? undefined : bytes); return;
    }
    if (!permittedSourceRoute(url)) { response.writeHead(404).end(request.method === 'HEAD' ? undefined : 'Not found'); return; }
    try {
      const result = await upstream(url.pathname + url.search);
      const type = result.response.headers.get('content-type') ?? 'application/octet-stream';
      const bytes = type.startsWith('text/html') && result.response.status === 200
        ? Buffer.from(rewriteMediaUrls(result.bytes.toString('utf8'), media.rewrites)) : result.bytes;
      response.writeHead(result.response.status, { 'Content-Type': type, 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end(request.method === 'HEAD' ? undefined : 'Reader temporarily unavailable'); }
  });
  return { server, media, async listen(port = 0) {
    await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); accept(); }); });
    origin = `http://127.0.0.1:${server.address().port}`; return origin + '/archives/';
  }, async close() { server.closeAllConnections(); await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept())); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { base: { type: 'string' }, media: { type: 'string' }, port: { type: 'string', default: '8795' } } });
    check(values.base && values.media && /^\d{1,5}$/.test(values.port) && +values.port > 0 && +values.port <= 65535, 'Required: --base <loopback origin> --media <reviewed candidate> --port <port>.');
    const app = await createIntegratedPreview({ baseUrl: values.base, mediaDirectory: values.media });
    console.log(await app.listen(+values.port));
  } catch { console.error('Integrated preview refused: configuration, bundle or reader binding invalid.'); process.exitCode = 1; }
}
