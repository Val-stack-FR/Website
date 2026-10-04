import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { guardRequest, loopbackBase } from './media-preview.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (value, message) => { if (!value) throw new Error(message); };
const type = name => name.endsWith('.html') ? 'text/html; charset=utf-8' : name.endsWith('.css') ? 'text/css; charset=utf-8' : /\.(?:mjs|js)$/u.test(name) ? 'text/javascript; charset=utf-8' : name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.png') ? 'image/png' : name.endsWith('.json') ? 'application/json; charset=utf-8' : name.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'application/octet-stream';

export async function createAssembledPreview({ sitePath, origin = 'http://127.0.0.1:8821' }) {
  const site = await realpath(sitePath), own = loopbackBase(origin);
  const assembly = JSON.parse(await readFile(resolve(dirname(site), 'assembly.json')));
  ensure(assembly.format === 'archives-publication-assembly/1' && assembly.counts.texts === 166 && assembly.counts.selected_photos === 19 && Object.keys(assembly.files).length < 500, 'Assembled candidate required.');
  const staticFiles = new Map();
  for (const [name, pin] of Object.entries(assembly.files)) {
    const file = resolve(site, name), part = relative(site, file);
    ensure(!part.split(sep).includes('..') && await realpath(file) === file, 'Assembly file escaped.');
    const bytes = await readFile(file);
    ensure(bytes.length === pin.size_bytes && hash(bytes) === pin.sha256, 'Assembled file changed.');
    if (name.startsWith('dist/')) {
      const route = '/' + name.slice(5), entry = { bytes, type: type(name) };
      staticFiles.set(route, entry); if (route.endsWith('/index.html')) staticFiles.set(route.slice(0, -10), entry);
    }
  }
  const config = JSON.parse(await readFile(resolve(site, 'vercel.json'))), rewrites = new Map(config.rewrites.map(rule => [rule.source, rule.destination]));
  const functions = new Map();
  for (const destination of rewrites.values()) if (destination.startsWith('/api/archives/')) {
    ensure(assembly.files[destination.slice(1) + '.mjs'], 'Unselected API module.');
    functions.set(destination, (await import(pathToFileURL(resolve(site, destination.slice(1) + '.mjs')).href)).default);
  }
  const server = createServer({ maxHeaderSize: 8192 }, async (request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    response.setHeader('X-Content-Type-Options', 'nosniff'); response.setHeader('Cache-Control', 'no-store');
    const send = (status, mime, bytes) => { response.writeHead(status, { 'Content-Type': mime, 'Content-Length': bytes.length }); response.end(request.method === 'HEAD' ? undefined : bytes); };
    try {
      const guard = guardRequest(request, own);
      if (guard.status) { if (guard.status === 405) response.setHeader('Allow', 'GET, HEAD'); send(guard.status, 'text/plain; charset=utf-8', Buffer.from('Request refused')); return; }
      const url = guard.url, destination = rewrites.get(url.pathname);
      if (destination && functions.has(destination)) { await functions.get(destination)(request, response); return; }
      const entry = staticFiles.get(destination ?? url.pathname);
      if (entry && !url.search) { send(200, entry.type, entry.bytes); return; }
      if (url.pathname.startsWith('/api/archive/')) { send(503, 'application/json; charset=utf-8', Buffer.from(JSON.stringify({ error: { code: 'runtime_configuration_pending', message: 'Le service hébergé reste à configurer.' }, human_validation_enabled: false }))); return; }
      send(404, 'text/plain; charset=utf-8', Buffer.from('Not found'));
    } catch { if (!response.headersSent) send(503, 'text/plain; charset=utf-8', Buffer.from('Candidate temporarily unavailable')); else response.destroy(); }
  });
  return { server, async listen() { await new Promise((accept, reject) => { server.once('error', reject); server.listen(Number(new URL(own).port), '127.0.0.1', accept); }); return own + '/archives/'; }, async close() { server.closeAllConnections(); await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept())); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { site: { type: 'string' }, origin: { type: 'string', default: 'http://127.0.0.1:8821' } } });
  const app = await createAssembledPreview({ sitePath: resolve(values.site), origin: values.origin }); console.log(await app.listen());
  let stopping = false; const stop = async () => { if (stopping) return; stopping = true; await app.close(); process.stdin.pause(); console.log('Assembled preview stopped.'); };
  process.stdin.setEncoding('utf8'); process.stdin.on('data', value => { if (value.trim() === 'stop') void stop(); }); process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());
}
