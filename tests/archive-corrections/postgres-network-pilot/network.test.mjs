import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { fork } from 'node:child_process';
import { request } from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { config, Pool, poolOptions, tracedDriver, twoTcpClients, writeNew, sha } from '../../../scripts/archive-corrections/hosted/postgres-network-pilot/common.mjs';
import { ServerlessStore, MIGRATION_HASHES } from '../../../scripts/archive-corrections/hosted/serverless/store.mjs';
import { enrollSharedOwner } from '../../../scripts/archive-corrections/hosted/serverless/sessions.mjs';
import { canonical } from '../../../scripts/archive-corrections/contract.mjs';
import { SYNTHETIC_CONTEXT as context } from '../../../scripts/archive-corrections/fixture.mjs';
import { validateSnapshot } from '../../../scripts/archive-corrections/snapshot-validation.mjs';

const configFile = process.env.D6_PILOT_CONFIG_FILE;
if (!configFile) throw new Error('Explicit private D6 configuration required; no production environment lookup.');
const value = config(configFile);
const host = new URL(value.origin).host;
const report = { version: 'd6-network-proof/v1', simulation: true, identity_verified: false,
  transport: 'real-postgresql-tcp-loopback-without-tls', historical_data: false, stages: [] };
const completed = (stage, evidence) => report.stages.push({ stage, passed: true, ...evidence });
const proposal = (text, base = context.initialRevision.text_revision) => ({ passage_id: context.passage.passage_id,
  base_revision: base, replacement_text: text, reason: 'D6 : jetons entièrement inventés.', evidence_refs: context.passage.evidence_refs, simulation: true });
const decision = p => ({ proposal_id: p.proposal_id, base_revision: p.base_revision, outcome: 'accept',
  reason: 'Décision de fixture D6, aucune identité humaine.', evidence_refs: p.evidence_refs, simulation: true });
const pools = [], workers = [], operatorEvents = [];
function makePool(database, label) {
  const pool = new Pool(poolOptions(value, database, label));
  pool.on('error', () => {}); pools.push(pool); return pool;
}
async function createDatabase(admin, name) {
  assert.match(name, /^[a-z][a-z0-9_]{2,40}$/);
  assert.equal((await admin.query('SELECT count(*)::int AS count FROM pg_database WHERE datname=$1', [name])).rows[0].count, 0);
  await admin.query('CREATE DATABASE ' + name);
}
async function startWorker(label) {
  const child = fork(join(value.repository, 'scripts/archive-corrections/hosted/postgres-network-pilot/handler-worker.mjs'),
    [configFile, label], { silent: true, windowsHide: true });
  const worker = { child, label }; workers.push(worker);
  // Never copy arbitrary process diagnostics or HTTP bodies into evidence logs.
  child.stdout.resume(); child.stderr.resume();
  const ready = await Promise.race([once(child, 'message').then(([message]) => message),
    once(child, 'exit').then(() => { throw new Error('Fixture worker exited before readiness.'); }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Fixture worker readiness timeout.')), 15000); timer.unref(); })]);
  assert.equal(ready.ready, true, 'Local fixture worker failed to start.');
  Object.assign(worker, ready); return worker;
}
function call(worker, path, { method = 'GET', body, key, cookie, csrf } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: worker.port, path, method, timeout: 12000,
      headers: { Host: host, Origin: value.origin, 'X-Forwarded-Proto': 'https',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}), ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}) } }, response => {
      let bytes = ''; response.on('data', chunk => { bytes += chunk; });
      response.on('end', () => { try { resolve({ status: response.statusCode, body: JSON.parse(bytes), headers: response.headers }); }
        catch { reject(new Error('Fixture HTTP response was not JSON.')); } });
    });
    req.on('timeout', () => req.destroy(new Error('Fixture HTTP timeout.')));
    req.on('error', () => reject(new Error('Fixture loopback HTTP request failed.')));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
async function login(worker) {
  const result = await call(worker, '/api/archive/auth/login', { method: 'POST', body: { passphrase: value.owner_passphrase } });
  assert.equal(result.status, 200); assert.equal(result.body.identity_verified, false); assert.equal(result.body.simulation, true);
  return { cookie: result.headers['set-cookie'][0].split(';')[0], csrf: result.body.csrf_token };
}
async function stopWorkers() {
  for (const worker of workers) {
    if (worker.child.exitCode !== null) continue;
    const exit = once(worker.child, 'exit');
    worker.child.send({ action: 'stop' });
    const timeout = setTimeout(() => { worker.child.kill(); }, 8000);
    await exit; clearTimeout(timeout);
  }
}

test('D6 real PostgreSQL loopback gate then two independent Node handlers and shared SQL concurrency', async t => {
  t.after(async () => {
    await stopWorkers(); await Promise.all(pools.map(pool => pool.end()));
    writeNew(join(value.run_directory, 'operator-transactions.json'), { simulation: true, events: operatorEvents });
    writeNew(join(value.run_directory, 'network-proof.json'), { ...report, stages_passed: report.stages.length });
  });
  const admin = makePool('postgres', 'bootstrap');
  await createDatabase(admin, value.gate_database);
  const gatePool = makePool(value.gate_database, 'gate');
  const gateDriver = tracedDriver(gatePool, 'gate', operatorEvents);
  const gateStore = new ServerlessStore(gateDriver, { schema: value.schema });
  assert.equal((await gatePool.query("SELECT count(*)::int AS count FROM pg_namespace WHERE nspname LIKE 'archive_corrections_%'")).rows[0].count, 0);
  const migration = await gateStore.migrate();
  assert.equal(migration.applied, true); assert.deepEqual(migration.hashes, MIGRATION_HASHES);
  const clients = await twoTcpClients(gatePool);
  assert.notEqual(clients[0].backend_pid, clients[1].backend_pid);
  assert.notEqual(clients[0].client_port, clients[1].client_port);
  for (const client of clients) {
    assert.equal(client.server_address, '127.0.0.1'); assert.equal(client.client_address, '127.0.0.1');
    assert.equal(client.server_port, value.port); assert.match(client.server_version, /^PostgreSQL 18\.6\b/);
  }
  await gatePool.query('CREATE TABLE public.d6_rollback_probe(marker text NOT NULL)');
  await assert.rejects(gateDriver.transaction(async tx => {
    await tx.query('INSERT INTO public.d6_rollback_probe VALUES ($1)', ['invented-rollback-marker']);
    // Separate network backend cannot see the uncommitted insertion.
    assert.equal((await gatePool.query('SELECT count(*)::int AS count FROM public.d6_rollback_probe')).rows[0].count, 0);
    await tx.query('SELECT 1 / 0');
  }), error => error.code === '22012');
  assert.equal((await gatePool.query('SELECT count(*)::int AS count FROM public.d6_rollback_probe')).rows[0].count, 0);
  assert.equal((await gatePool.query('SELECT 1 AS usable')).rows[0].usable, 1);
  assert.ok(operatorEvents.some(e => e.pool === 'gate' && e.event === 'ROLLBACK'));
  completed('initial-gate', { migration, clients, rollback_sqlstate: '22012', rows_after_rollback: 0 });
  writeNew(join(value.run_directory, 'gate-proof.json'), { ...report.stages[0], no_handler_started_before_gate: true });

  // Only after the full gate succeeds: a second empty DB and restricted role.
  await createDatabase(admin, value.main_database);
  const mainPool = makePool(value.main_database, 'operator');
  const store = new ServerlessStore(tracedDriver(mainPool, 'operator', operatorEvents), { schema: value.schema });
  await store.migrate(); await store.initialize(); await enrollSharedOwner(store, value.owner_passphrase);
  await admin.query(`CREATE ROLE archive_corrections_app LOGIN PASSWORD '${value.runtime_password}'`);
  const grants = readFileSync(join(value.repository, 'scripts/archive-corrections/hosted/serverless/migrations/runtime-grants.sql'), 'utf8');
  await mainPool.query(grants.replaceAll('__SCHEMA__', value.schema));
  const A = await startWorker('A'), B = await startWorker('B');
  assert.notEqual(A.node_pid, B.node_pid);
  const poolPids = [...A.postgres_clients, ...B.postgres_clients].map(c => c.backend_pid);
  assert.equal(new Set(poolPids).size, 4);
  for (const client of [...A.postgres_clients, ...B.postgres_clients]) {
    assert.equal(client.server_address, '127.0.0.1'); assert.equal(client.client_address, '127.0.0.1');
    assert.equal(client.role, 'archive_corrections_app');
  }
  completed('independent-workers', { A: { node_pid: A.node_pid, port: A.port, clients: A.postgres_clients },
    B: { node_pid: B.node_pid, port: B.port, clients: B.postgres_clients } });
  let owner, acceptedPayload, snapshot;

  await t.test('a session created by A is recognized by independent B from SQL', async () => {
    owner = await login(A);
    const answers = await Promise.all([call(A, '/api/archive/auth/session', owner), call(B, '/api/archive/auth/session', owner)]);
    for (const answer of answers) { assert.equal(answer.status, 200); assert.equal(answer.body.authenticated, true);
      assert.equal(answer.body.csrf_token === owner.csrf, true); assert.equal(answer.body.identity_verified, false); }
    completed('shared-session', { statuses: answers.map(r => r.status), authenticated: true, raw_tokens_logged: false });
  });
  await t.test('concurrent decisions serialize across pools; one commits and stale revision rolls back', async () => {
    const proposals = await Promise.all([A, B].map((w, i) => call(w, '/api/archive/corrections', {
      method: 'POST', key: 'd6-proposal-' + i, body: proposal('Variante fictive D6 numéro ' + i + '.') })));
    for (const answer of proposals) assert.equal(answer.status, 201);
    const before = await store.exportSnapshot();
    const invalid = await call(B, '/api/archive/owner/decisions', { method: 'POST', key: 'd6-invalid-csrf',
      body: decision(proposals[0].body.proposal), cookie: owner.cookie, csrf: '0'.repeat(64) });
    assert.equal(invalid.status, 403); assert.equal(canonical(await store.exportSnapshot()) === canonical(before), true);
    const payloads = proposals.map(r => decision(r.body.proposal));
    const answers = await Promise.all([A, B].map((w, i) => call(w, '/api/archive/owner/decisions', {
      method: 'POST', key: 'd6-race-' + i, body: payloads[i], ...owner })));
    assert.deepEqual(answers.map(r => r.status).sort(), [201, 409]);
    const winner = answers.findIndex(r => r.status === 201);
    acceptedPayload = { payload: payloads[winner], key: 'd6-race-' + winner };
    const after = await store.exportSnapshot();
    assert.equal(after.revisions.length, 2); assert.equal(after.decisions.length, 1); validateSnapshot(after);
    const replay = await Promise.all([A, B].map(w => call(w, '/api/archive/owner/decisions', {
      method: 'POST', body: acceptedPayload.payload, key: acceptedPayload.key, ...owner })));
    for (const answer of replay) { assert.equal(answer.status, 200); assert.equal(answer.body.replayed, true); }
    assert.equal(replay[0].body.decision.decision_id === replay[1].body.decision.decision_id, true);
    assert.equal(canonical(await store.exportSnapshot()) === canonical(after), true);
    completed('optimistic-concurrency-and-replay', { concurrent_statuses: answers.map(r => r.status), replay_statuses: replay.map(r => r.status), revisions: 2,
      decisions: 1, decision_id: after.decisions[0].decision_id, invalid_csrf_status: invalid.status });
    const exported = await call(B, '/api/archive/owner/export', owner);
    assert.equal(exported.status, 200); assert.equal(exported.body.identity_verified, false);
    snapshot = exported.body.snapshot; validateSnapshot(snapshot);
    writeNew(join(value.run_directory, 'editorial-export.json'), snapshot);
  });
  await t.test('logout through B and revoke-all through A are visible to both workers', async () => {
    assert.equal((await call(B, '/api/archive/auth/logout', { method: 'POST', body: {}, ...owner })).status, 200);
    for (const worker of [A, B]) assert.equal((await call(worker, '/api/archive/auth/session', owner)).body.authenticated, false);
    owner = await login(B);
    assert.equal((await call(A, '/api/archive/auth/session', owner)).body.authenticated, true);
    assert.equal((await call(A, '/api/archive/auth/revoke-all', { method: 'POST', body: {}, ...owner })).status, 200);
    for (const worker of [A, B]) assert.equal((await call(worker, '/api/archive/auth/session', owner)).body.authenticated, false);
    completed('shared-revocations', { logout_cross_worker: true, revoke_all_cross_worker: true, identity_verified: false });
  });
  await t.test('five-per-minute login limit is shared under six concurrent requests across A/B', async () => {
    const answers = await Promise.all(Array.from({ length: 6 }, (_, i) => call(i % 2 ? B : A, '/api/archive/auth/login', {
      method: 'POST', body: { passphrase: randomBytes(32).toString('hex') } })));
    // Two earlier successful fixture logins already consumed two reservations.
    assert.deepEqual(answers.map(r => r.status).sort(), [403, 403, 403, 429, 429, 429]);
    const count = (await mainPool.query(`SELECT count(*)::int AS count FROM ${store.table('rate_events')} WHERE bucket='login'`)).rows[0].count;
    assert.equal(count, 5);
    completed('shared-rate-limit', { concurrent_statuses: answers.map(r => r.status), committed_reservations: count, configured_limit: 5 });
  });
  await t.test('editorial backup restores into a third new database with IDs intact and no active access', async () => {
    assert.ok(snapshot); await createDatabase(admin, value.restore_database);
    const restoredPool = makePool(value.restore_database, 'restore');
    const restored = new ServerlessStore(tracedDriver(restoredPool, 'restore', operatorEvents), { schema: value.schema });
    assert.equal((await restored.migrate()).applied, true);
    await restored.restore(snapshot); await restored.verifyUnchanged(snapshot);
    const exported = await restored.exportSnapshot(); validateSnapshot(exported);
    assert.equal(canonical(exported) === canonical(snapshot), true);
    for (const table of ['owner_credentials', 'owner_sessions', 'session_revocations', 'owner_events', 'rate_events'])
      assert.equal((await restoredPool.query(`SELECT count(*)::int AS count FROM ${restored.table(table)}`)).rows[0].count, 0);
    writeNew(join(value.run_directory, 'restored-editorial-export.json'), exported);
    completed('restore-new-database', { database: value.restore_database, snapshot_sha256: snapshot.sha256,
      ids_preserved: true, auth_rows_restored: 0, canonical_bytes_equal: true });
  });
  await stopWorkers();
  await t.test('actual transaction traces bind session authorization and decision commit to one TCP client', async () => {
    const events = ['A', 'B'].flatMap(label => JSON.parse(readFileSync(join(value.run_directory, 'worker-' + label + '-transactions.json'), 'utf8')).events);
    const committed = events.filter(e => e.event === 'decision-insert');
    assert.equal(committed.length, 1);
    const insert = committed[0], transaction = events.filter(e => e.transaction === insert.transaction);
    assert.equal(new Set(transaction.map(e => e.backend_pid)).size, 1);
    assert.ok(transaction.some(e => e.event === 'session-authorize'));
    assert.ok(transaction.some(e => e.event === 'revision-insert'));
    assert.ok(transaction.some(e => e.event === 'COMMIT'));
    assert.ok(events.some(e => e.event === 'ROLLBACK'));
    completed('same-tcp-transaction-authorization', { pool: insert.pool, transaction: insert.transaction,
      backend_pid: insert.backend_pid, authorization_and_decision_same_client: true, rollback_observed: true });
  });
  report.passed = true;
  report.editorial_file_sha256 = sha(readFileSync(join(value.run_directory, 'editorial-export.json')));
});
