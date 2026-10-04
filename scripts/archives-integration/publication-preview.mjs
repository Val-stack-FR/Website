import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { guardRequest, loopbackBase } from './media-preview.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const ensure = (value, message) => { if (!value) throw new Error(message); };
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

export async function createPublicationPreview({ manifestPath, manifestSha256, origin = 'http://127.0.0.1:8820', readonly = null, draftHandler = null }) {
  const own = loopbackBase(origin), root = await realpath(dirname(manifestPath));
  const bytes = await readFile(manifestPath);
  ensure(digest(bytes) === manifestSha256, 'Snapshot manifest changed.');
  const manifest = JSON.parse(bytes);
  ensure(manifest.format === 'archives-publication-snapshot/1' && manifest.deployment_executed === false && manifest.counts.selected_derivatives === 19 && Array.isArray(manifest.routes) && manifest.routes.length <= 300, 'Unaccepted snapshot.');
  const files = new Map();
  for (const row of manifest.routes) {
    const target = resolve(root, 'site/dist', row.file), part = relative(resolve(root, 'site/dist'), target);
    ensure(part && !part.startsWith('..' + sep) && part !== '..' && !part.startsWith(sep) && await realpath(target) === target && !files.has(row.route), 'Unsafe artifact file.');
    const value = await readFile(target);
    ensure(digest(value) === row.sha256 && value.length === row.size_bytes, 'Captured artifact changed.');
    files.set(row.route, { ...row, bytes: value });
    if (row.route.startsWith('/archives/texte/?')) files.set('/' + row.file.replace(/index\.html$/u, ''), { ...row, bytes: value });
  }
  const server = createServer({ maxHeaderSize: 8192 }, async (request, response) => {
    response.setHeader('Content-Security-Policy', CSP);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    const send = (status, type, value) => { const content = Buffer.from(value); response.writeHead(status, { 'Content-Type': type, 'Content-Length': content.length }); response.end(request.method === 'HEAD' ? undefined : content); };
    try {
      const guard = guardRequest(request, own);
      if (guard.status) { if (guard.status === 405) response.setHeader('Allow', 'GET, HEAD'); send(guard.status, 'text/plain; charset=utf-8', 'Request refused'); return; }
      const url = guard.url;
      if (readonly && await readonly(request, response, url)) return;
      if (draftHandler && await draftHandler(request, response, url)) return;
      const route = url.pathname + url.search, entry = files.get(route);
      if (entry) { send(200, entry.content_type, entry.bytes); return; }
      if (url.pathname.startsWith('/api/archive/')) { send(503, 'application/json; charset=utf-8', JSON.stringify({ error: { code: 'runtime_configuration_pending', message: 'Le raccord de la base hébergée reste à configurer.' }, simulation: true, human_validation_enabled: false, publication_enabled: false })); return; }
      send(404, 'text/plain; charset=utf-8', 'Not found');
    } catch { if (!response.headersSent) send(503, 'text/plain; charset=utf-8', 'Candidate unavailable'); else response.destroy(); }
  });
  return { server, async listen() { await new Promise((accept, reject) => { server.once('error', reject); server.listen(Number(new URL(own).port), '127.0.0.1', accept); }); return own + '/archives/'; }, async close() { server.closeAllConnections(); await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept())); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { manifest: { type: 'string' }, 'manifest-sha256': { type: 'string' }, origin: { type: 'string', default: 'http://127.0.0.1:8820' } } });
  const app = await createPublicationPreview({ manifestPath: resolve(values.manifest), manifestSha256: values['manifest-sha256'], origin: values.origin });
  console.log(await app.listen());
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await app.close(); console.log('Candidate preview stopped.'); process.stdin.pause(); };
  process.stdin.setEncoding('utf8'); process.stdin.on('data', value => { if (value.trim() === 'stop') void stop(); });
  process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());
}
