import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pgliteDriver } from '../../../scripts/archive-corrections/hosted/drivers.mjs';
import { ServerlessStore, MIGRATION_HASHES } from '../../../scripts/archive-corrections/hosted/serverless/store.mjs';
import { SharedSessions, enrollSharedOwner, COOKIE_NAME } from '../../../scripts/archive-corrections/hosted/serverless/sessions.mjs';
import { createHandler, readJson } from '../../../scripts/archive-corrections/hosted/serverless/handler.mjs';
import { configuredHandler } from '../../../scripts/archive-corrections/hosted/serverless/function.mjs';
import { createNetworkDriver, sharedPoolDriver } from '../../../scripts/archive-corrections/hosted/serverless/network.mjs';
import { storePaths } from '../../../scripts/archive-corrections/runtime.mjs';
import { canonical } from '../../../scripts/archive-corrections/contract.mjs';
import { SYNTHETIC_CONTEXT as context } from '../../../scripts/archive-corrections/fixture.mjs';
import { validateSnapshot } from '../../../scripts/archive-corrections/snapshot-validation.mjs';

const origin = 'https://archive-d5.example.test';
const host = new URL(origin).host;
const secret = () => randomBytes(32).toString('hex');
const publicPath = `/api/archive/passage?passage_id=${encodeURIComponent(context.passage.passage_id)}`;
const proposal = text => ({ passage_id: context.passage.passage_id, base_revision: context.initialRevision.text_revision,
  replacement_text: text, reason: 'Variante fictive D5.', evidence_refs: context.passage.evidence_refs, simulation: true });
const decision = value => ({ proposal_id: value.proposal_id, base_revision: value.base_revision, outcome: 'accept',
  reason: 'Décision simulée D5.', evidence_refs: value.evidence_refs, simulation: true });
async function serve(handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
async function stop(service) { await new Promise(resolve => { service.server.close(resolve); service.server.closeIdleConnections(); }); }
async function call(service, path, { method = 'GET', body, key, cookie, csrf, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(service.url + path, { method, headers: { Host: host, Origin: origin, 'X-Forwarded-Proto': 'https',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}),
      ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers } }, response => {
      let text = ''; response.on('data', bytes => { text += bytes; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(text), headers: response.headers }));
    });
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
async function login(service, passphrase) {
  const result = await call(service, '/api/archive/auth/login', { method: 'POST', body: { passphrase } });
  assert.equal(result.status, 200);
  return { cookie: result.headers['set-cookie'][0].split(';')[0], csrf: result.body.csrf_token, result };
}

test('D5 two independent handlers share PostgreSQL sessions, decisions, revocations and exact editorial restoration', async t => {
  const name = `d5-${randomUUID()}`;
  const directory = storePaths(name, true).directory;
  const driver = await pgliteDriver(join(directory, 'pgdata'));
  const storeA = new ServerlessStore(driver); const storeB = new ServerlessStore(driver);
  const key = secret(), passphrase = secret();
  const sessionsA = new SharedSessions(storeA, key, { loginLimit: 20 });
  const sessionsB = new SharedSessions(storeB, key, { loginLimit: 20 });
  let A, B, C;
  t.after(async () => { for (const service of [A, B, C]) if (service) await stop(service); await driver.close(); });
  assert.equal((await storeA.migrate()).applied, true);
  assert.equal((await storeB.migrate()).applied, false);
  await storeA.initialize();
  assert.equal((await enrollSharedOwner(storeA, passphrase)).identity_verified, false);
  await assert.rejects(enrollSharedOwner(storeA, secret()), error => error.code === 'owner_already_enrolled');
  A = await serve(createHandler({ store: storeA, sessions: sessionsA, origin }));
  B = await serve(createHandler({ store: storeB, sessions: sessionsB, origin }));
  let owner, first, second, before;
  let currentPhrase = passphrase;

  await t.test('A creates a Secure session; B and a cold handler C verify it from SQL with the same CSRF', async () => {
    assert.equal((await call(B, '/api/archive/auth/session')).body.authenticated, false);
    owner = await login(A, passphrase);
    assert.match(owner.result.headers['set-cookie'][0], /^__Host-archive_owner_session_d5=[a-f0-9]{64}; Secure; HttpOnly; SameSite=Strict; Path=\/; Max-Age=28800$/);
    assert.equal(owner.result.body.identity_verified, false); assert.equal(owner.result.body.simulation, true);
    const verified = await call(B, '/api/archive/auth/session', owner);
    assert.equal(verified.body.authenticated, true); assert.equal(verified.body.csrf_token === owner.csrf, true);
    const storeC = new ServerlessStore(driver);
    C = await serve(createHandler({ store: storeC, sessions: new SharedSessions(storeC, key), origin }));
    assert.equal((await call(C, '/api/archive/auth/session', owner)).body.authenticated, true);
    const persisted = await driver.transaction(tx => tx.query(`SELECT * FROM ${storeA.table('owner_sessions')}`), { readOnly: true });
    const bytes = canonical(persisted.rows);
    assert.equal(bytes.includes(owner.cookie.split('=')[1]) || bytes.includes(owner.csrf) || bytes.includes(key), false);
    assert.equal(Object.hasOwn(sessionsA, 'sessions') || Object.hasOwn(sessionsB, 'sessions'), false);
  });

  await t.test('explicit routes refuse spoofed Host/Origin/transport, query aliases, unsupported methods and anonymous owner actions', async () => {
    for (const headers of [{ Host: 'foreign.example' }, { Origin: 'https://foreign.example' }, { 'X-Forwarded-Proto': 'http' }]) {
      assert.equal((await call(A, '/api/archive/health', { headers })).status, 403);
    }
    assert.equal((await call(A, '/api/archive/auth/login', { method: 'POST', body: { passphrase }, headers: { Origin: '' } })).status, 403);
    for (const path of ['/v1/health', '/api/archive/unknown', publicPath + '&extra=1', publicPath + '&passage_id=unknown', '/api/archive/health?x=1']) {
      assert.equal((await call(A, path)).status, 404);
    }
    assert.equal((await call(A, '/api/archive/corrections')).status, 405);
    assert.equal((await call(B, '/api/archive/owner/corrections?status=pending')).status, 403);
    assert.equal((await call(B, '/api/archive/owner/export')).status, 403);
    assert.equal((await call(B, '/api/archive/owner/export', { headers: { Authorization: `Bearer ${passphrase}`, 'X-Actor-Role': 'owner' } })).status, 403);
    const read = await call(B, publicPath);
    assert.deepEqual(read.body.current_revision, context.initialRevision);
    assert.equal(Object.hasOwn(read.body, 'proposals') || Object.hasOwn(read.body, 'decisions'), false);
  });

  await t.test('two proposals stay unpublished; owner permission and CSRF are rechecked inside the decision transaction', async () => {
    first = (await call(A, '/api/archive/corrections', { method: 'POST', body: proposal('<script>Variante fictive inerte</script>'), key: 'd5-proposal-first' })).body.proposal;
    second = (await call(B, '/api/archive/corrections', { method: 'POST', body: proposal('Autre variante fictive D5.'), key: 'd5-proposal-second' })).body.proposal;
    assert.ok(first && second);
    assert.deepEqual((await call(B, publicPath)).body.current_revision, context.initialRevision);
    assert.equal((await call(B, '/api/archive/owner/corrections?status=pending', owner)).body.proposals.length, 2);
    for (const auth of [{}, { cookie: owner.cookie }, { cookie: owner.cookie, csrf: secret() }]) {
      assert.equal((await call(B, '/api/archive/owner/decisions', { method: 'POST', body: decision(first), key: 'd5-refused-decision', ...auth })).status, 403);
    }
    const initial = await storeA.exportSnapshot();
    await driver.transaction(tx => tx.exec(`CREATE FUNCTION ${storeA.schema}.test_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test fault'; END; $$;
      CREATE TRIGGER test_fault BEFORE INSERT ON ${storeA.table('decisions')} FOR EACH STATEMENT EXECUTE FUNCTION ${storeA.schema}.test_fault();`));
    const failed = await call(B, '/api/archive/owner/decisions', { method: 'POST', body: decision(first), key: 'd5-atomic-first', ...owner });
    assert.equal(failed.status, 500); assert.equal(canonical(failed.body).includes('test fault'), false);
    assert.deepEqual(await storeA.exportSnapshot(), initial);
    await driver.transaction(tx => tx.exec(`DROP TRIGGER test_fault ON ${storeA.table('decisions')}; DROP FUNCTION ${storeA.schema}.test_fault();`));
    const accepted = await Promise.all([
      call(A, '/api/archive/owner/decisions', { method: 'POST', body: decision(first), key: 'd5-atomic-first', ...owner }),
      call(B, '/api/archive/owner/decisions', { method: 'POST', body: decision(second), key: 'd5-atomic-second', ...owner }),
    ]);
    assert.deepEqual(accepted.map(result => result.status).sort(), [201, 409]);
    const index = accepted.findIndex(result => result.status === 201);
    const replay = await call(B, '/api/archive/owner/decisions', { method: 'POST', body: decision([first, second][index]), key: `d5-atomic-${index === 0 ? 'first' : 'second'}`, ...owner });
    assert.equal(replay.status, 200); assert.equal(replay.body.decision.decision_id, accepted[index].body.decision.decision_id);
    before = (await call(A, '/api/archive/owner/export', owner)).body.snapshot;
    validateSnapshot(before);
    assert.equal(before.revisions.length, 2); assert.equal(before.proposals.length, 2); assert.equal(before.decisions.length, 1);
    assert.equal([key, passphrase, owner.csrf, owner.cookie.split('=')[1]].some(value => canonical(before).includes(value)), false);
  });

  await t.test('logout/revoke-all by A are refused by B/C; offline rotation by A invalidates the former credential and sessions in B', async () => {
    assert.equal((await call(A, '/api/archive/auth/logout', { method: 'POST', body: {}, ...owner })).status, 200);
    assert.equal((await call(B, '/api/archive/owner/export', owner)).status, 403);
    assert.equal((await call(C, '/api/archive/auth/session', owner)).body.authenticated, false);
    owner = await login(A, passphrase); const extra = await login(B, passphrase);
    assert.equal((await call(A, '/api/archive/auth/revoke-all', { method: 'POST', body: {}, ...owner })).status, 200);
    assert.equal((await call(B, '/api/archive/owner/export', extra)).status, 403);
    owner = await login(B, passphrase);
    const replacement = secret(); await enrollSharedOwner(storeA, replacement, { rotate: true }); currentPhrase = replacement;
    assert.equal((await call(B, '/api/archive/owner/export', owner)).status, 403);
    assert.equal((await call(B, '/api/archive/auth/login', { method: 'POST', body: { passphrase } })).status, 403);
    owner = await login(B, replacement);
    assert.equal((await call(A, '/api/archive/owner/export', owner)).status, 200);
    const wrong = new SharedSessions(storeA, secret());
    assert.equal((await wrong.session({ headers: { cookie: owner.cookie } })).authenticated, false);
    assert.deepEqual(await storeA.exportSnapshot(), before);
  });

  await t.test('database-clock idle/absolute expiry is honored by B without a local session cache', async () => {
    const tokenHash = createHash('sha256').update(owner.cookie.split('=')[1]).digest('hex');
    await driver.transaction(tx => tx.query(`UPDATE ${storeA.table('owner_sessions')} SET created_ms=created_ms-$2,touched_ms=touched_ms-$2 WHERE token_hash=$1`, [tokenHash, 9 * 60 * 60 * 1000]));
    assert.equal((await call(B, '/api/archive/owner/export', owner)).status, 403);
    owner = await login(A, currentPhrase);
    const idleHash = createHash('sha256').update(owner.cookie.split('=')[1]).digest('hex');
    await driver.transaction(tx => tx.query(`UPDATE ${storeA.table('owner_sessions')} SET created_ms=created_ms-$2,touched_ms=touched_ms-$2 WHERE token_hash=$1`, [idleHash, 31 * 60 * 1000]));
    assert.equal((await call(B, '/api/archive/owner/export', owner)).status, 403);
    assert.deepEqual(await storeA.exportSnapshot(), before);
  });

  await t.test('editorial export/restore preserves IDs/hash and excludes shared auth; restoration needs a new enrollment', async () => {
    const path = join(directory, 'editorial-export.json'); writeFileSync(path, canonical(before) + '\n', { flag: 'wx', mode: 0o600 });
    const target = new ServerlessStore(driver, { schema: 'archive_corrections_d5_restored' });
    await target.migrate(); await target.restore(JSON.parse(readFileSync(path, 'utf8')));
    assert.deepEqual(await target.exportSnapshot(), before);
    const credentials = await driver.transaction(tx => tx.query(`SELECT * FROM ${target.table('owner_credentials')}`), { readOnly: true });
    assert.equal(credentials.rows.length, 0);
    const restoredSessions = new SharedSessions(target, key);
    await assert.rejects(restoredSessions.session({ headers: { cookie: owner.cookie } }), error => error.code === 'owner_not_enrolled');
    const malformed = { ...before, sha256: '0'.repeat(64) };
    await assert.rejects(target.restore(malformed), error => error.code === 'invalid_snapshot');
    await assert.rejects(target.restore(before), error => error.code === 'store_exists');
    const output = join(directory, 'editorial-restored.json'); writeFileSync(output, canonical(await target.exportSnapshot()) + '\n', { flag: 'wx', mode: 0o600 });
    assert.equal(readFileSync(path, 'utf8'), readFileSync(output, 'utf8'));
    t.diagnostic(`D5 independent handlers A/B/C, SQL shared state and exact snapshot retained in ${name}; PGlite single connection, no network pool or hosted TLS proof.`);
  });

  await t.test('shared reservation throttles attempts made by both instances; migration/auth audit remain append-only', async () => {
    const limiterStore = new ServerlessStore(driver, { schema: 'archive_corrections_d5_limits' });
    await limiterStore.migrate(); await limiterStore.initialize(); await enrollSharedOwner(limiterStore, secret());
    const L1 = new SharedSessions(limiterStore, key, { loginLimit: 2, proposalLimit: 1 });
    const L2 = new SharedSessions(limiterStore, key, { loginLimit: 2, proposalLimit: 1 });
    const attempts = await Promise.allSettled([L1, L2, L1, L2].map(value => value.login({ passphrase: secret() })));
    assert.equal(attempts.filter(value => value.reason?.code === 'invalid_credential').length, 2);
    assert.equal(attempts.filter(value => value.reason?.code === 'login_throttled').length, 2);
    await L1.reserve('proposal'); await assert.rejects(L2.reserve('proposal'), error => error.code === 'proposal_throttled');
    for (const table of ['owner_events', 'session_revocations', 'rate_events', 'migrations']) {
      await assert.rejects(driver.transaction(tx => tx.query(`DELETE FROM ${storeA.table(table)}`)), error => error.code === '55000');
    }
    assert.deepEqual(await storeA.exportSnapshot(), before);
    assert.equal(MIGRATION_HASHES[1], '7d0c5cac493c4d36898b32d092ba3d552e870e8a2e2c028e84de36e4e6ecedf2');
  });
});

test('Vercel parsed body and raw body contract enforce JSON/size without logging credentials', async () => {
  const headers = { 'content-type': 'application/json' };
  assert.deepEqual(await readJson({ headers, body: { a: 1 } }), { a: 1 });
  await assert.rejects(readJson({ headers: { ...headers, 'content-length': '40000' }, body: {} }), error => error.code === 'body_too_large');
  await assert.rejects(readJson({ headers, get body() { throw new Error('test parser'); } }), error => error.code === 'invalid_json');
  await assert.rejects(readJson({ headers, body: { value: 'x'.repeat(33000) } }), error => error.code === 'body_too_large');
  await assert.rejects(readJson({ headers: { 'content-type': 'text/plain' }, body: {} }), error => error.code === 'json_required');
});

test('network pool is attached once and a whole transaction uses one acquired client; missing configuration fails before network', async () => {
  const calls = []; let attached = 0, config;
  const client = { query: async sql => { calls.push(sql); return { rows: [] }; }, release: error => { calls.push(error ? 'discard' : 'release'); } };
  class Pool {
    constructor(value) { config = value; }
    on() {} async connect() { return client; } async end() {}
  }
  const driver = createNetworkDriver('postgresql://test:test@db.example.test/test', { PoolClass: Pool, attach: () => { attached += 1; } });
  assert.equal(attached, 1); assert.equal(config.ssl.rejectUnauthorized, true); assert.equal(config.max, 2);
  await driver.transaction(async tx => { await tx.query('SELECT fixture'); });
  assert.deepEqual(calls, ['BEGIN', 'SELECT fixture', 'COMMIT', 'release']);
  calls.length = 0;
  await assert.rejects(driver.transaction(async tx => { await tx.query('SELECT fixture'); throw new Error('fixture'); }));
  assert.deepEqual(calls, ['BEGIN', 'SELECT fixture', 'ROLLBACK', 'release']);
  assert.throws(() => configuredHandler({ ARCHIVE_CORRECTIONS_PUBLIC_ORIGIN: origin }), error => error.code === 'session_key_required');
  assert.throws(() => new ServerlessStore(undefined, { schema: 'archive_corrections_pilot' }), error => error.code === 'd5_schema_required');
  assert.throws(() => createNetworkDriver('postgresql://test:test@db.example.test/test?sslmode=disable', { PoolClass: Pool }), error => error.code === 'database_configuration_required');
});
