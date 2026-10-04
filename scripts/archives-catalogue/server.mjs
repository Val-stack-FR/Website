import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { prepareCatalogue, queryCatalogue } from './contract.mjs';
import { renderCataloguePage } from './render-page.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(HERE, '..', '..');
const CSP = "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const DATA_PARAMETERS = new Set(['query', 'collection_scope', 'collection_type', 'status', 'priority', 'page', 'page_size']);

const responseBytes = value => Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
const jsonBytes = value => Buffer.from(`${JSON.stringify(value)}\n`, 'utf8');

const send = (request, response, status, contentType, body) => {
  const bytes = responseBytes(body);
  response.writeHead(status, { 'Content-Type': contentType, 'Content-Length': bytes.length });
  response.end(request.method === 'HEAD' ? undefined : bytes);
};

const safeJson = bytes => {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error('Catalogue input is not valid JSON.'); }
};

export function parseDataRequest(url) {
  if (url.search.length > 1024) throw new Error('Query string is too long.');
  const parameters = {};
  for (const [key, value] of url.searchParams) {
    if (!DATA_PARAMETERS.has(key)) throw new Error(`Unsupported query parameter: ${key}`);
    if (Object.hasOwn(parameters, key)) throw new Error(`Duplicate query parameter: ${key}`);
    parameters[key] = value;
  }
  return parameters;
}

export async function createCataloguePreview({ cataloguePath }) {
  if (!cataloguePath) throw new Error('cataloguePath is required.');
  const inputBytes = await readFile(cataloguePath);
  const inputSha256 = createHash('sha256').update(inputBytes).digest('hex');
  const model = prepareCatalogue(safeJson(inputBytes), { inputSha256 });
  const [styles, favicon, catalogueStyles, catalogueScript] = await Promise.all([
    readFile(resolve(REPOSITORY_ROOT, 'styles.css')),
    readFile(resolve(REPOSITORY_ROOT, 'favicon.svg')),
    readFile(resolve(HERE, 'catalogue.css')),
    readFile(resolve(HERE, 'catalogue.js'))
  ]);
  const page = Buffer.from(renderCataloguePage(), 'utf8');
  const assets = new Map([
    ['/styles.css', ['text/css; charset=utf-8', styles]],
    ['/favicon.svg', ['image/svg+xml; charset=utf-8', favicon]],
    ['/assets/archives-catalogue.css', ['text/css; charset=utf-8', catalogueStyles]],
    ['/assets/archives-catalogue.js', ['text/javascript; charset=utf-8', catalogueScript]]
  ]);
  const pages = new Map([
    ['/archives/catalogue/', page],
    ['/archives/catalogue/index.html', page]
  ]);

  const server = createServer((request, response) => {
    response.setHeader('Content-Security-Policy', CSP);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      send(request, response, 405, 'text/plain; charset=utf-8', 'Method not allowed');
      return;
    }
    let url;
    try { url = new URL(request.url, 'http://127.0.0.1'); }
    catch { send(request, response, 400, 'text/plain; charset=utf-8', 'Invalid URL'); return; }
    if (url.username || url.password) { send(request, response, 400, 'text/plain; charset=utf-8', 'Invalid URL'); return; }
    const pageBody = pages.get(url.pathname);
    if (pageBody) {
      if (url.search) { send(request, response, 404, 'text/plain; charset=utf-8', 'Not found'); return; }
      send(request, response, 200, 'text/html; charset=utf-8', pageBody);
      return;
    }
    if (url.pathname === '/__catalogue_data') {
      try {
        const result = queryCatalogue(model, parseDataRequest(url));
        send(request, response, 200, 'application/json; charset=utf-8', jsonBytes(result));
      } catch (error) {
        send(request, response, 400, 'application/json; charset=utf-8', jsonBytes({ error: error.message }));
      }
      return;
    }
    const asset = assets.get(url.pathname);
    if (asset && !url.search) {
      send(request, response, 200, asset[0], asset[1]);
      return;
    }
    send(request, response, 404, 'text/plain; charset=utf-8', 'Not found');
  });

  return {
    server,
    model,
    async listen(port = 8767) {
      if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
      await new Promise((accept, reject) => {
        const onError = error => { server.off('listening', onListening); reject(error); };
        const onListening = () => { server.off('error', onError); accept(); };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, '127.0.0.1');
      });
      const address = server.address();
      return `http://127.0.0.1:${address.port}/archives/catalogue/`;
    },
    async close() {
      if (!server.listening) return;
      await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept()));
    }
  };
}

async function main() {
  try {
    const { values } = parseArgs({
      strict: true,
      allowPositionals: false,
      options: { catalogue: { type: 'string' }, port: { type: 'string', default: '8767' } }
    });
    if (!values.catalogue) throw new Error('Required: --catalogue <catalogue.json>.');
    const port = Number(values.port);
    if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
    const preview = await createCataloguePreview({ cataloguePath: resolve(values.catalogue) });
    console.log(await preview.listen(port));
  } catch (error) {
    console.error(`Catalogue preview refused: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();

