import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Store } from './store.mjs';
import { ApiError, canonical, ensure, envelope } from './contract.mjs';
import { OwnerSessions } from './owner-auth.mjs';
import { SYNTHETIC_CONTEXT } from './fixture.mjs';

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

function readerLocalHtml(bytes) {
  // Fixed private-scope wording only; no source literal, locator or visitor text is interpolated.
  return bytes.toString('utf8')
    .replace('Atelier local — démonstration fictive', 'Atelier privé local — Monbezon non relu')
    .replace('Atelier local · démonstration fictive', 'Passage réel non relu · essai privé local')
    .replace('Un seul passage entièrement inventé. Toutes les décisions sont simulées : <strong>aucune lecture historique n’est validée ici.</strong>',
      'Passage réel non relu, chargé depuis un paquet vérifié pour un essai privé. Toutes les décisions restent simulées : <strong>aucune lecture historique ni identité de Val n’est validée ici.</strong>')
    .replace('Chargement du passage fictif…', 'Chargement du passage réel non relu…')
    .replace('Motif de cette variante fictive', 'Motif de la proposition sur ce passage non relu')
    .replace('Révisions du texte fictif', 'Révisions locales du passage non relu')
    .replace('Service local uniquement · aucune archive réelle, aucune mémoire historique, aucune publication.',
      'Essai privé local · droits publics en attente · décisions simulées · aucune source originale modifiée · aucune publication.');
}

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

export function createLocalServer({ store, ownerSecret, ownerSessions, httpsProxyOrigin, proposalLimit = 60, now = () => Date.now() }) {
  if (!ownerSessions) validateOwnerSecret(ownerSecret);
  if (httpsProxyOrigin) {
    let parsed;
    try { parsed = new URL(httpsProxyOrigin); } catch { /* bounded diagnostic below */ }
    ensure(parsed?.protocol === 'https:' && parsed.origin === httpsProxyOrigin && !parsed.username && !parsed.password
      && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) && ownerSessions?.secure === true,
    422, 'https_configuration_required', 'The hosted pilot requires a canonical HTTPS origin and Secure owner cookies.');
  }
  let proposalAttempts = [];
  const server = createServer(async (request, response) => {
    const wrap = data => envelope(data, store.context);
    const send = (status, body, headers = {}) => {
      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        ...securityHeaders,
        ...(httpsProxyOrigin ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
        ...headers,
      });
      response.end(`${canonical(body)}\n`);
    };
    try {
      const port = server.address().port;
      const hosts = port === 80 ? ['127.0.0.1', '127.0.0.1:80'] : [`127.0.0.1:${port}`];
      const origin = httpsProxyOrigin ?? loopbackOrigin(port);
      const trustedProxy = ['127.0.0.1', '::ffff:127.0.0.1', '::1'].includes(request.socket.remoteAddress)
        && request.headers['x-forwarded-proto'] === 'https';
      ensure((httpsProxyOrigin ? trustedProxy && request.headers.host === new URL(origin).host : hosts.includes(request.headers.host))
        && (request.headers.origin === undefined || request.headers.origin === origin),
        403, 'local_clients_only', 'Host, transport and any Origin must match this exact service.');
      if (httpsProxyOrigin && request.method === 'POST') ensure(request.headers.origin === origin,
        403, 'same_origin_required', 'Hosted mutations require the exact HTTPS Origin.');
      const explicitPassageRoute = `/demo/?passage=${encodeURIComponent(store.passage.passage_id)}`;
      const asset = demoAssets.get(request.url === explicitPassageRoute ? '/demo/' : request.url);
      if (request.method === 'GET' && asset) {
        const [file, contentType] = asset;
        const bytes = readFileSync(new URL(`./ui/${file}`, import.meta.url));
        response.writeHead(200, { ...securityHeaders, ...(httpsProxyOrigin ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}), 'Content-Type': contentType });
        return response.end(file === 'index.html' && store.context.dataKind === 'historical-local' ? readerLocalHtml(bytes) : bytes);
      }
      if (request.method === 'GET' && request.url === '/v1/health') {
        return send(200, wrap({ status: 'ready', auth_mode: ownerSessions ? 'local_owner_session' : 'local_test_secret',
          ...(httpsProxyOrigin ? { deployment_mode: 'prepared_https_proxy' } : {}), identity_verified: false, passage_id: store.passage.passage_id }));
      }
      const requireOwner = (csrf = false) => {
        if (ownerSessions) {
          if (csrf) ensure(request.headers.origin === origin, 403, 'same_origin_required', 'Owner actions require the exact local Origin.');
          return ownerSessions.fromRequest(request, { csrf });
        }
        ensure(ownerAuthorized(request, ownerSecret), 403, 'owner_test_required', 'A server-verified local test owner credential is required.');
      };
      if (ownerSessions && request.url.startsWith('/v1/auth/')) {
        // Browser session endpoints always require explicit exact Origin; direct clients supply it too.
        if (request.method === 'POST') ensure(request.headers.origin === origin, 403, 'same_origin_required', 'Session mutations require the exact local Origin.');
        if (request.method === 'POST' && request.url === '/v1/auth/login') {
          const { token, session } = await ownerSessions.login(await readBody(request));
          return send(200, wrap({ authenticated: true, identity_verified: false, csrf_token: session.csrf }), { 'Set-Cookie': ownerSessions.cookie(token) });
        }
        if (request.method === 'GET' && request.url === '/v1/auth/session') {
          const session = ownerSessions.fromRequest(request, { required: false });
          return send(200, wrap({ authenticated: Boolean(session), identity_verified: false, ...(session ? { csrf_token: session.csrf } : {}) }));
        }
        if (request.method === 'POST' && request.url === '/v1/auth/logout') {
          ownerSessions.logout(request);
          return send(200, wrap({ authenticated: false, identity_verified: false }), { 'Set-Cookie': ownerSessions.cookie() });
        }
      }
      if (ownerSessions && request.method === 'GET' && request.url === '/v1/owner/history') {
        requireOwner();
        return send(200, await store.history());
      }
      if (request.method === 'GET' && request.url === `/v1/passages/${encodeURIComponent(store.passage.passage_id)}`) {
        const history = await store.history();
        if (!ownerSessions) return send(200, history);
        // Visitor proposals and editorial reasons stay in the owner queue, even after acceptance.
        return send(200, wrap({ passage: history.passage, current_revision: history.current_revision, revisions: history.revisions }));
      }
      if (request.method === 'GET' && request.url === '/v1/export') {
        requireOwner();
        return send(200, await store.exportSnapshot());
      }
      if (request.method === 'POST' && ['/v1/proposals', '/v1/decisions'].includes(request.url)) {
        const scope = request.url === '/v1/proposals' ? 'proposal' : 'decision';
        if (scope === 'decision') {
          requireOwner(Boolean(ownerSessions));
        }
        if (httpsProxyOrigin && scope === 'proposal') {
          proposalAttempts = proposalAttempts.filter(time => time > now() - 60000);
          ensure(proposalAttempts.length < proposalLimit, 429, 'proposal_throttled', 'Wait before submitting another proposal.');
          proposalAttempts.push(now());
        }
        const payload = await readBody(request);
        // A session may expire/rotate while the request body is arriving.
        if (scope === 'decision' && ownerSessions) requireOwner(true);
        const result = await store.mutate(scope, request.headers['idempotency-key'], payload);
        return send(result.status, result.body);
      }
      throw new ApiError(404, 'route_not_found', 'Unknown v1 route.');
    } catch (error) {
      const known = error instanceof ApiError;
      send(known ? error.status : 500, wrap({ error: {
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

export async function startOwnerService({ name, port = 8789, sessionOptions, context = SYNTHETIC_CONTEXT } = {}) {
  ensure(Number.isInteger(port) && port >= 0 && port <= 65535, 422, 'invalid_port', 'Port must be an integer from 0 to 65535.');
  // Credential enrollment is a separate, explicit operator action. No secret in process arguments.
  const ownerSessions = new OwnerSessions(name, sessionOptions);
  const store = new Store(name, { context });
  const server = createLocalServer({ store, ownerSessions });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) { store.close(); throw error; }
  return { server, store, ownerSessions, url: `http://127.0.0.1:${server.address().port}` };
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
