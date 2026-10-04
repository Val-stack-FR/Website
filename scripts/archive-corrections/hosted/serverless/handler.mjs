import { ApiError, canonical, ensure } from '../../contract.mjs';

export const API_VERSION = 'archive-corrections/serverless-v1';
const prefix = '/api/archive';
const headers = {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000',
  'Content-Security-Policy': "default-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
};
const routes = new Map([
  [`${prefix}/health`, 'GET'], [`${prefix}/passage`, 'GET'], [`${prefix}/corrections`, 'POST'],
  [`${prefix}/auth/login`, 'POST'], [`${prefix}/auth/session`, 'GET'], [`${prefix}/auth/logout`, 'POST'],
  [`${prefix}/auth/revoke-all`, 'POST'], [`${prefix}/owner/corrections`, 'GET'],
  [`${prefix}/owner/decisions`, 'POST'], [`${prefix}/owner/export`, 'GET'],
]);

export function validateOrigin(origin) {
  let url; try { url = new URL(origin); } catch { /* bounded diagnostic */ }
  ensure(url?.protocol === 'https:' && url.origin === origin && !url.username && !url.password
    && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
  503, 'https_configuration_required', 'Set the exact canonical HTTPS public origin for this function.');
  return url;
}

export async function readJson(request) {
  ensure(request.headers['content-type']?.split(';')[0].trim().toLowerCase() === 'application/json',
    415, 'json_required', 'Content-Type must be application/json.');
  const length = request.headers['content-length'];
  ensure(length === undefined || typeof length === 'string' && /^\d+$/.test(length), 400, 'invalid_length', 'Invalid Content-Length.');
  ensure(length === undefined || Number(length) <= 32768, 413, 'body_too_large', 'JSON body exceeds 32 KiB.');
  if ('body' in request) {
    // Vercel computes this helper through a getter; malformed JSON throws here.
    let body; try { body = request.body; } catch { throw new ApiError(400, 'invalid_json', 'Body must contain valid JSON.'); }
    let bytes; try { bytes = JSON.stringify(body); } catch { throw new ApiError(400, 'invalid_json', 'Body must contain valid JSON.'); }
    ensure(typeof bytes === 'string', 400, 'invalid_json', 'A JSON body is required.');
    ensure(Buffer.byteLength(bytes) <= 32768, 413, 'body_too_large', 'JSON body exceeds 32 KiB.');
    return body;
  }
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size <= 32768) chunks.push(chunk); }
  ensure(size <= 32768, 413, 'body_too_large', 'JSON body exceeds 32 KiB.');
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ApiError(400, 'invalid_json', 'Body must contain valid JSON.'); }
}

export function createHandler({ store, sessions, origin }) {
  const publicUrl = validateOrigin(origin);
  const wrap = data => ({ ...data, api_version: API_VERSION, data_kind: store.context.dataKind, simulation: true, identity_verified: false });
  let readiness;
  const ready = () => readiness ??= store.initialize({ seed: false }).catch(error => { readiness = undefined; throw error; });
  return async function handler(request, response) {
    const send = (status, body, extra = {}) => {
      response.writeHead(status, { ...headers, ...extra }); response.end(canonical(wrap(body)) + '\n');
    };
    try {
      // IncomingMessage retains duplicates that Node's headers object can hide.
      const raw = request.rawHeaders;
      ensure(Array.isArray(raw) && raw.length % 2 === 0
        && raw.every(value => typeof value === 'string'),
      400, 'ambiguous_headers', 'A complete Node request header list is required.');
      const counts = new Map();
      for (let index = 0; index < raw.length; index += 2) {
        const name = raw[index].toLowerCase();
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      ensure(counts.get('host') === 1
        && ['origin', 'x-forwarded-proto'].every(name => (counts.get(name) ?? 0) <= 1),
      400, 'ambiguous_headers', 'Host, Origin and transport headers must be unambiguous.');
      ensure(request.headers.host === publicUrl.host && request.headers['x-forwarded-proto'] === 'https'
        && (request.headers.origin === undefined || request.headers.origin === origin),
      403, 'same_origin_required', 'Host, HTTPS transport and any Origin must match this exact function.');
      ensure(typeof request.url === 'string' && request.url.startsWith('/api/archive/'), 404, 'route_not_found', 'Unknown archive route.');
      const url = new URL(request.url, origin);
      const method = routes.get(url.pathname);
      ensure(method, 404, 'route_not_found', 'Unknown archive route.');
      ensure(request.method === method, 405, 'method_not_allowed', 'This route requires its documented method.');
      if (request.method === 'POST') ensure(request.headers.origin === origin, 403, 'same_origin_required', 'Mutations require the exact HTTPS Origin.');
      if (url.pathname === `${prefix}/passage`) {
        ensure(request.url === `${prefix}/passage?passage_id=${encodeURIComponent(store.passage.passage_id)}`,
          404, 'passage_not_found', 'Use the exact selected passage ID.');
      } else if (url.pathname === `${prefix}/owner/corrections`) {
        ensure(request.url === url.pathname || request.url === url.pathname + '?status=pending', 404, 'route_not_found', 'Only the pending queue query is supported.');
      } else ensure(request.url === url.pathname, 404, 'route_not_found', 'This route takes no query parameters.');
      await ready();
      if (url.pathname === `${prefix}/health`) return send(200, { status: 'ready', auth_mode: 'shared_postgres_session', passage_id: store.passage.passage_id });
      if (url.pathname === `${prefix}/passage`) {
        const { passage, current_revision, revisions } = await store.history();
        return send(200, { passage, current_revision, revisions });
      }
      if (url.pathname === `${prefix}/auth/login`) {
        const { token, ...result } = await sessions.login(await readJson(request));
        return send(200, result, { 'Set-Cookie': sessions.cookie(token) });
      }
      if (url.pathname === `${prefix}/auth/session`) return send(200, await sessions.session(request));
      if ([`${prefix}/auth/logout`, `${prefix}/auth/revoke-all`].includes(url.pathname)) {
        // Empty JSON object is intentional; exact contract prevents accidental payload intent.
        const body = await readJson(request);
        ensure(body && typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0, 422, 'invalid_fields', 'Use an empty JSON object for revocation.');
        await sessions.revoke(request, url.pathname.endsWith('/revoke-all'));
        return send(200, { authenticated: false }, { 'Set-Cookie': sessions.cookie() });
      }
      if (url.pathname === `${prefix}/corrections`) {
        await sessions.reserve('proposal');
        const result = await store.mutate('proposal', request.headers['idempotency-key'], await readJson(request));
        return send(result.status, result.body);
      }
      if (url.pathname === `${prefix}/owner/decisions`) {
        const result = await store.decide(request, request.headers['idempotency-key'], await readJson(request), sessions);
        return send(result.status, result.body);
      }
      const { snapshot, history } = await store.privateHistory(request, sessions);
      if (url.pathname === `${prefix}/owner/export`) {
        ensure(Buffer.byteLength(canonical(snapshot)) <= 2 * 1024 * 1024, 413, 'snapshot_too_large', 'This pilot snapshot exceeds its restore limit.');
        return send(200, { snapshot });
      }
      const decided = new Set(history.decisions.map(value => value.proposal_id));
      return send(200, { passage: history.passage, current_revision: history.current_revision,
        proposals: history.proposals.filter(value => !decided.has(value.proposal_id)), decisions: history.decisions });
    } catch (error) {
      const known = error instanceof ApiError;
      send(known ? error.status : 500, { error: { code: known ? error.code : 'internal_error',
        message: known ? error.message : 'The operation failed without a partial editorial commit.' } },
      known && error.code === 'ambiguous_headers' ? { Connection: 'close' } : {});
    }
  };
}
