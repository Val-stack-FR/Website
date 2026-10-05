import { ApiError, canonical, ensure, exactFields } from '../contract.mjs';
import { readJson } from '../hosted/serverless/handler.mjs';
import { SharedSessions } from '../hosted/serverless/sessions.mjs';
import { loopbackOrigin } from './config.mjs';

const cookieName = 'archive_d8_fixture_owner';
export class FixtureLoopbackSessions extends SharedSessions {
  cookie(value = '') {
    return `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/api/archive/fixture; Max-Age=${value ? Math.floor(this.absoluteMs / 1000) : 0}`;
  }
  requestToken(request) {
    const values = (request.headers.cookie ?? '').split(';').map(v => v.trim())
      .filter(v => v.startsWith(cookieName + '=')).map(v => v.slice(cookieName.length + 1));
    return values.length === 1 && /^[a-f0-9]{64}$/.test(values[0]) ? values[0] : undefined;
  }
}
const security = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" };
const methods = new Map([['health','GET'],['passage','GET'],['corrections','POST'],
  ['auth/login','POST'],['auth/session','GET'],['auth/logout','POST'],['auth/revoke-all','POST'],
  ['owner/corrections','GET'],['owner/decisions','POST'],['owner/export','GET']]);

// Dedicated HTTP loopback handler. The D5/Vercel HTTPS handler remains frozen.
// Mount this exact Node handler at the same origin, or proxy only these two prefixes.
export function createIntegratedHandler({ stores, fixtureSessions, reserveProposal, origin }) {
  const publicUrl = loopbackOrigin(origin);
  return async function handler(request, response) {
    let profile, store;
    const send = (status, data, extra = {}) => {
      response.writeHead(status, { ...security, ...extra });
      response.end(canonical({ ...data, api_version: store?.context.apiVersion ?? 'archive-corrections/integrated-loopback-v1',
        integration_api_version: 'archive-corrections/integrated-loopback-v1', data_kind: store?.context.dataKind ?? 'private-loopback',
        profile: profile ?? null, simulation: true, identity_verified: false, human_validation_enabled: false,
        reading_confirmed: false, publication_enabled: false }) + '\n');
    };
    try {
      ensure(['127.0.0.1','::ffff:127.0.0.1','::1'].includes(request.socket?.remoteAddress),
        403, 'loopback_only', 'D8 accepts local requests only.');
      const raw = request.rawHeaders;
      ensure(Array.isArray(raw) && raw.length % 2 === 0 && raw.every(v => typeof v === 'string'), 400, 'ambiguous_headers', 'Complete Node request headers required.');
      const counts = new Map();
      for (let i = 0; i < raw.length; i += 2) counts.set(raw[i].toLowerCase(), (counts.get(raw[i].toLowerCase()) ?? 0) + 1);
      ensure(counts.get('host') === 1 && ['origin','cookie','x-csrf-token','idempotency-key','content-type','content-length'].every(h => (counts.get(h) ?? 0) <= 1),
        400, 'ambiguous_headers', 'Authority, session and mutation headers must be unambiguous.');
      ensure(request.headers.host === publicUrl.host && (request.headers.origin === undefined || request.headers.origin === origin),
        403, 'same_origin_required', 'Host and any Origin must match the configured reader origin exactly.');
      ensure(!['authorization','x-owner-role','x-actor-role'].some(h => h in request.headers), 403, 'client_role_refused', 'No client role or Bearer authority is accepted.');
      if (request.method === 'POST') ensure(request.headers.origin === origin, 403, 'same_origin_required', 'Mutations require the exact reader Origin.');
      const match = /^\/api\/archive\/(preview|fixture)\/(.+)$/.exec(request.url ?? '');
      ensure(match, 404, 'route_not_found', 'Unknown integrated archive route.');
      profile = match[1]; store = stores[profile];
      const prefix = `/api/archive/${profile}/`, url = new URL(request.url, origin), route = url.pathname.slice(prefix.length);
      ensure(methods.has(route), 404, 'route_not_found', 'Unknown integrated archive route.');
      ensure(request.method === methods.get(route), 405, 'method_not_allowed', 'Use the documented method.');
      if (route === 'passage') ensure(request.url === prefix + 'passage?passage_id=' + encodeURIComponent(store.passage.passage_id), 404, 'passage_not_found', 'Use the exact selected passage.');
      else ensure(request.url === prefix + route, 404, 'route_not_found', 'This route takes no query parameters.');
      if (route === 'health') return send(200, { status: 'ready', passage_id: store.passage.passage_id,
        auth_mode: profile === 'fixture' ? 'sql_test_session' : 'human_validation_disabled',
        decision_test_enabled: profile === 'fixture' });
      if (route === 'passage') {
        const { passage, current_revision, revisions } = await store.history();
        return send(200, { passage, current_revision, revisions, decisions_enabled: profile === 'fixture' });
      }
      if (route === 'corrections') {
        await reserveProposal(profile);
        const result = await store.mutate('proposal', request.headers['idempotency-key'], await readJson(request));
        return send(result.status, result.body);
      }
      // Hard server-side boundary: no historical decision, login or export route
      // can be enabled by payload, cookie, header, proxy or client feature flag.
      if (profile === 'preview') {
        if (route === 'auth/session') return send(200, { authenticated: false });
        ensure(false, 403, 'human_validation_disabled', 'Historical validation and owner authority are disabled in this preview.');
      }
      if (route === 'auth/login') {
        const { token, ...result } = await fixtureSessions.login(await readJson(request));
        return send(200, result, { 'Set-Cookie': fixtureSessions.cookie(token) });
      }
      if (route === 'auth/session') return send(200, await fixtureSessions.session(request));
      if (['auth/logout','auth/revoke-all'].includes(route)) {
        exactFields(await readJson(request), []); await fixtureSessions.revoke(request, route.endsWith('revoke-all'));
        return send(200, { authenticated: false }, { 'Set-Cookie': fixtureSessions.cookie() });
      }
      if (route === 'owner/decisions') {
        const result = await store.decide(request, request.headers['idempotency-key'], await readJson(request), fixtureSessions);
        return send(result.status, result.body);
      }
      const { snapshot, history } = await store.privateHistory(request, fixtureSessions);
      if (route === 'owner/export') return send(200, { snapshot });
      const decided = new Set(history.decisions.map(d => d.proposal_id));
      return send(200, { passage: history.passage, current_revision: history.current_revision,
        proposals: history.proposals.filter(p => !decided.has(p.proposal_id)), decisions: history.decisions });
    } catch (error) {
      const known = error instanceof ApiError;
      send(known ? error.status : 500, { error: { code: known ? error.code : 'internal_error',
        message: known ? error.message : 'The operation failed without a partial editorial commit.' } },
        known && error.code === 'ambiguous_headers' ? { Connection: 'close' } : {});
    }
  };
}
