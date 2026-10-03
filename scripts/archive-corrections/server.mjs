import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Store } from './store.mjs';
import { PASSAGE } from './fixture.mjs';
import { ApiError, canonical, ensure, envelope } from './contract.mjs';

export const SECRET_ENV = 'ARCHIVE_CORRECTIONS_OWNER_TEST_SECRET';
export const loopbackOrigin = port => new URL(`http://127.0.0.1:${port}`).origin;
const demoAssets = new Map([
  ['/demo/', ['index.html', 'text/html; charset=utf-8']],
  ['/demo/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/demo/app.mjs', ['app.mjs', 'text/javascript; charset=utf-8']],
  ['/demo/state.mjs', ['state.mjs', 'text/javascript; charset=utf-8']],
  ['/demo/render.mjs', ['render.mjs', 'text/javascript; charset=utf-8']],
]);
const securityHeaders = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

function validateOwnerSecret(ownerSecret) {
  ensure(typeof ownerSecret === 'string' && /^[\x21-\x7e]{32,256}$/.test(ownerSecret),
    500, 'owner_secret_required', `Set a 32–256 character local test secret in ${SECRET_ENV}.`);
}

function ownerAuthorized(request, secret) {
  const actual = Buffer.from(request.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function readBody(request) {
  ensure(request.headers['content-type']?.split(';')[0].trim().toLowerCase() === 'application/json',
    415, 'json_required', 'Content-Type must be application/json.');
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size <= 32768) chunks.push(chunk);
  }
  ensure(size <= 32768, 413, 'body_too_large', 'JSON body exceeds 32 KiB.');
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'invalid_json', 'Body must contain valid JSON.'); }
}

export function createLocalServer({ store, ownerSecret }) {
  validateOwnerSecret(ownerSecret);
  const server = createServer(async (request, response) => {
    const send = (status, body) => {
      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        ...securityHeaders,
      });
      response.end(`${canonical(body)}\n`);
    };
    try {
      const port = server.address().port;
      const hosts = port === 80 ? ['127.0.0.1', '127.0.0.1:80'] : [`127.0.0.1:${port}`];
      const origin = loopbackOrigin(port);
      ensure(hosts.includes(request.headers.host)
        && (request.headers.origin === undefined || request.headers.origin === origin),
        403, 'local_clients_only', 'Host and any Origin must match this exact loopback service.');
      const asset = demoAssets.get(request.url);
      if (request.method === 'GET' && asset) {
        const [file, contentType] = asset;
        const bytes = readFileSync(new URL(`./ui/${file}`, import.meta.url));
        response.writeHead(200, { ...securityHeaders, 'Content-Type': contentType });
        return response.end(bytes);
      }
      if (request.method === 'GET' && request.url === '/v1/health') {
        return send(200, envelope({ status: 'ready', auth_mode: 'local_test_secret' }));
      }
      if (request.method === 'GET' && request.url === `/v1/passages/${PASSAGE.passage_id}`) {
        return send(200, store.history());
      }
      if (request.method === 'GET' && request.url === '/v1/export') {
        ensure(ownerAuthorized(request, ownerSecret), 403, 'owner_test_required', 'A server-verified local test owner credential is required.');
        return send(200, store.exportSnapshot());
      }
      if (request.method === 'POST' && ['/v1/proposals', '/v1/decisions'].includes(request.url)) {
        const scope = request.url === '/v1/proposals' ? 'proposal' : 'decision';
        if (scope === 'decision') {
          ensure(ownerAuthorized(request, ownerSecret), 403, 'owner_test_required', 'A server-verified local test owner credential is required.');
        }
        const payload = await readBody(request);
        const result = store.mutate(scope, request.headers['idempotency-key'], payload);
        return send(result.status, result.body);
      }
      throw new ApiError(404, 'route_not_found', 'Unknown v1 route.');
    } catch (error) {
      const known = error instanceof ApiError;
      send(known ? error.status : 500, envelope({ error: {
        code: known ? error.code : 'internal_error',
        message: known ? error.message : 'The mutation failed; no partial changes were committed.',
      } }));
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 30;
  return server;
}

export async function startLocalService({ name = 'demo', port = 8787, ownerSecret = process.env[SECRET_ENV] } = {}) {
  ensure(Number.isInteger(port) && port >= 0 && port <= 65535, 422, 'invalid_port', 'Port must be an integer from 0 to 65535.');
  // Validate credentials before any database creation; never print or persist the secret.
  validateOwnerSecret(ownerSecret);
  const store = new Store(name);
  const activeServer = createLocalServer({ store, ownerSecret });
  try {
    await new Promise((resolve, reject) => {
      activeServer.once('error', reject);
      activeServer.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) {
    store.close();
    throw error;
  }
  return { server: activeServer, store, url: `http://127.0.0.1:${activeServer.address().port}` };
}

async function main() {
  const [name = 'demo', portValue = '8787', ...extra] = process.argv.slice(2);
  ensure(extra.length === 0 && /^\d{1,5}$/.test(portValue), 422, 'usage', 'Usage: node server.mjs [store-name] [port]');
  const service = await startLocalService({ name, port: Number(portValue) });
  process.stdout.write(`${canonical(envelope({ url: service.url, auth_mode: 'local_test_secret' }))}\n`);
  const close = () => {
    service.server.close(() => { service.store.close(); process.exit(0); });
    service.server.closeIdleConnections();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Fail closed with bounded diagnostics; SQL internals, environment and credentials stay private.
    process.stderr.write(`${error instanceof ApiError ? error.message : 'Local service could not start.'}\n`);
    process.exitCode = 1;
  });
}
