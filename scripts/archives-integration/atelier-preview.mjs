import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { guardRequest, loopbackBase, permittedSourceRoute, readBounded } from './media-preview.mjs';
import { loadLexicalSearch, renderLexicalSearch } from './lexical-search.mjs';
import { renderAtelierStatusboard } from './atelier-statusboard.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const READ_PAGES = new Set(['/archives/revisions/', '/archives/versions/']);
const DERIVATIVE = /^\/__archive_draft_derivative\/[a-f0-9]{64}$/u;
const RELEASE = /^\/archives\/media-releases\/[a-f0-9]{32}\/media\/[a-f0-9]{64}\.jpg$/u;
const STYLE_ROUTE = '/assets/archives-integration-lexical.css';
const GLOBAL_STYLE = '/assets/archives-integration-navigation.css';

export function permittedAtelierRoute(url) {
  if (/^\/__archive(?:_draft)?_media\//u.test(url.pathname)) return false;
  return permittedSourceRoute(url) || READ_PAGES.has(url.pathname) || (!url.search && (DERIVATIVE.test(url.pathname) || RELEASE.test(url.pathname)));
}

export function addAtelierNavigation(html, { corrections = false } = {}) {
  const navigation = '<nav class="atelier-navigation" aria-label="Navigation de l’atelier"><a href="/archives/">Actes</a><a href="/archives/catalogue/">Catalogue</a><a href="/archives/recherche/">Fiches du mémoire</a><a href="/archives/reperes/">Repères dans les textes</a><a href="/archives/formes-brouillons/">Lectures à revoir</a><a href="/archives/avancement/">Avancement</a>' + (corrections ? '<a href="/archives/corrections/">Proposer une correction</a>' : '') + '</nav>';
  ensure(!html.includes('class="atelier-navigation"') && /<body(?:\s[^>]*)?>/iu.test(html) && html.includes('</head>'), 'Invalid upstream page shell.');
  let result = html.replace('</head>', `<link rel="stylesheet" href="${GLOBAL_STYLE}"></head>`).replace(/<body(?:\s[^>]*)?>/iu, value => value + navigation);
  if (corrections) result = result.replaceAll('http://127.0.0.1:8789/demo/?passage=text%3Aatelier-494756c2009be577ad11a5eb0a662d38', '/archives/corrections/');
  return result;
}

// Reader bytes remain in the sealed upstream. This mount adds navigation and a
// separately pinned lexical index; correction state belongs to its own adapter.
export async function createAtelierPreview({ readerOrigin, readerSha256, lexicalDirectory, origin = 'http://127.0.0.1:8810', corrections = null }) {
  const base = loopbackBase(readerOrigin), own = loopbackBase(origin);
  ensure(base !== own && /^[a-f0-9]{64}$/u.test(readerSha256), 'Explicit distinct origins and a reader pin are required.');
  if (corrections) ensure(corrections.origin === own && typeof corrections.isRoute === 'function' && typeof corrections.handle === 'function', 'Correction mount contract drift.');
  const lexical = await loadLexicalSearch(lexicalDirectory);
  const local = dirname(fileURLToPath(import.meta.url));
  const lexicalCss = await readFile(resolve(local, 'lexical-search.css'));
  const navigationCss = Buffer.from('.atelier-navigation{display:flex;flex-wrap:wrap;gap:12px 20px;padding:14px 24px;background:#103c2c;color:#fff;font:14px/1.5 system-ui,sans-serif}.atelier-navigation a{color:inherit;text-underline-offset:.2em}.atelier-navigation a:focus-visible{outline:3px solid #e2ba27;outline-offset:3px}@media(max-width:600px){.atelier-navigation{padding:12px 16px;gap:10px 16px}}');
  const upstream = async url => {
    const response = await fetch(base + url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    ensure(![301, 302, 303, 307, 308].includes(response.status), 'Upstream redirects are refused.');
    return { response, bytes: await readBounded(response) };
  };
  const initial = await upstream('/archives/');
  ensure(initial.response.status === 200 && digest(initial.bytes) === readerSha256, 'Unaccepted upstream reader.');
  const server = createServer({ maxHeaderSize: 8192 }, async (request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    const send = (status, type, bytes) => { response.writeHead(status, { 'Content-Type': type, 'Content-Length': bytes.length }); response.end(request.method === 'HEAD' ? undefined : bytes); };
    try {
      // The correction adapter validates real request headers, body and CSRF.
      // No proxy rewrites or fabricated authentication headers enter this mount.
      const raw = request.url;
      if (corrections && typeof raw === 'string' && raw.length <= 8192 && raw.startsWith('/') && !raw.startsWith('//')) {
        const path = raw.split('?')[0];
        const parsed = new URL(raw, own);
        if (path === parsed.pathname && corrections.isRoute(parsed.pathname)) {
          await corrections.handle(request, response);
          return;
        }
      }
      const guarded = guardRequest(request, own);
      if (guarded.status) { response.setHeader('Connection', 'close'); if (guarded.status === 405) response.setHeader('Allow', 'GET, HEAD'); send(guarded.status, 'text/plain; charset=utf-8', Buffer.from('Request refused')); return; }
      const url = guarded.url;
      if (url.pathname === '/' && !url.search) { response.writeHead(302, { Location: '/archives/' }).end(); return; }
      if ([STYLE_ROUTE, GLOBAL_STYLE].includes(url.pathname) && !url.search) { send(200, 'text/css; charset=utf-8', url.pathname === STYLE_ROUTE ? lexicalCss : navigationCss); return; }
      if (url.pathname === '/archives/avancement/' && !url.search) {
        const html = renderAtelierStatusboard({ readerSha256, correctionsMounted: Boolean(corrections) });
        send(200, 'text/html; charset=utf-8', Buffer.from(addAtelierNavigation(html, { corrections: Boolean(corrections) }))); return;
      }
      if (url.pathname === '/archives/reperes/') {
        let html;
        try { html = renderLexicalSearch(lexical, url.searchParams); } catch { send(400, 'text/plain; charset=utf-8', Buffer.from('Invalid search')); return; }
        send(200, 'text/html; charset=utf-8', Buffer.from(addAtelierNavigation(html, { corrections: Boolean(corrections) }))); return;
      }
      if (!permittedAtelierRoute(url)) { send(404, 'text/plain; charset=utf-8', Buffer.from('Not found')); return; }
      const result = await upstream(url.pathname + url.search);
      const type = result.response.headers.get('content-type') ?? 'application/octet-stream';
      let bytes = result.bytes;
      if (result.response.status === 200 && type.startsWith('text/html')) bytes = Buffer.from(addAtelierNavigation(bytes.toString('utf8'), { corrections: Boolean(corrections) }));
      send(result.response.status, type, bytes);
    } catch { if (!response.headersSent) send(502, 'text/plain; charset=utf-8', Buffer.from('Atelier temporarily unavailable')); else response.destroy(); }
  });
  return { server, origin: own, lexical, readerSha256, async listen() {
    await new Promise((accept, reject) => { server.once('error', reject); server.listen(Number(new URL(own).port), '127.0.0.1', () => { server.off('error', reject); accept(); }); });
    return own + '/archives/';
  }, async close() { server.closeAllConnections(); await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept())); } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { reader: { type: 'string' }, 'reader-sha256': { type: 'string' }, lexical: { type: 'string' }, origin: { type: 'string', default: 'http://127.0.0.1:8810' } } });
    ensure(values.reader && values['reader-sha256'] && values.lexical, 'Missing atelier inputs.');
    const app = await createAtelierPreview({ readerOrigin: values.reader, readerSha256: values['reader-sha256'], lexicalDirectory: values.lexical, origin: values.origin });
    console.log(await app.listen());
  } catch { console.error('Atelier preview refused: explicit configuration and accepted inputs are required.'); process.exitCode = 1; }
}
