import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { request } from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { config, strictDriver, tlsProof, observeTransactions, writeNew } from './common.mjs';
import { ServerlessStore } from '../serverless/store.mjs';
import { enrollSharedOwner } from '../serverless/sessions.mjs';
import { canonical } from '../../contract.mjs';
import { SYNTHETIC_CONTEXT as context } from '../../fixture.mjs';
import { validateSnapshot } from '../../snapshot-validation.mjs';

const file = process.env.D7_PILOT_CONFIG_FILE;
if (!file) throw new Error('Explicit new D7 private configuration required.');
const value = config(file);
const gate = JSON.parse(readFileSync(join(value.run_directory, 'gate-proof.json'), 'utf8'));
if (gate.passed !== true) throw new Error('Strict TLS gate must pass before application bootstrap.');
const events = [], drivers = [], workers = [];
observeTransactions(events, 'operator');
const report = { version: 'd7-tls-pilot-proof/v1', simulation: true, identity_verified: false,
  historical_data: false, transport: 'verified-postgresql-tls-loopback', stages: [] };
function driver() { const d = strictDriver(value, value.main_database); drivers.push(d); return d; }
async function start(label) {
  const child = fork(join(value.repository, 'scripts/archive-corrections/hosted/postgres-tls-pilot/worker.mjs'),
    [file, label], { silent: true, windowsHide: true });
  const worker = { child, label }; workers.push(worker);
  child.stdout.resume(); child.stderr.resume();
  const ready = await Promise.race([once(child, 'message').then(([message]) => message),
    once(child, 'exit').then(() => { throw new Error('Owned worker exited before readiness.'); }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Owned worker timeout.')), 15000); timer.unref(); })]);
  assert.equal(ready.ready, true); Object.assign(worker, ready); return worker;
}
function call(worker, path, { method = 'GET', body, key, cookie, csrf } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: worker.port, path, method, timeout: 10000,
      headers: { Host: new URL(value.origin).host, Origin: value.origin, 'X-Forwarded-Proto': 'https',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}), ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}) } }, response => {
      let bytes = ''; response.on('data', chunk => { bytes += chunk; });
      response.on('end', () => { try { resolve({ status: response.statusCode, body: JSON.parse(bytes), headers: response.headers }); }
        catch { reject(new Error('Fixture response must be JSON.')); } });
    });
    req.on('timeout', () => req.destroy(new Error('Fixture loopback timeout.')));
    req.on('error', () => reject(new Error('Fixture loopback request failed.')));
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
async function stop() {
  for (const worker of workers) {
    if (worker.child.exitCode !== null) continue;
    const exit = once(worker.child, 'exit');
    worker.child.send({ action: 'stop' });
    const timer = setTimeout(() => worker.child.kill(), 8000);
    await exit; clearTimeout(timer);
    assert.equal(worker.child.exitCode, 0);
  }
}

test('D7 strict default D5 driver over real local PostgreSQL TLS; minimal two-process edit and restore', async t => {
  t.after(async () => {
    try { await stop(); } finally {
      await Promise.all(drivers.map(d => d.close()));
      writeNew(join(value.run_directory, 'operator-transactions.json'), { simulation: true, events });
      writeNew(join(value.run_directory, 'owned-workers.json'), { simulation: true,
        workers: workers.map(w => ({ label: w.label, node_pid: w.child.pid, exit_code: w.child.exitCode })) });
      writeNew(join(value.run_directory, 'tls-pilot-proof.json'), report);
    }
  });
  const operator = driver(), store = new ServerlessStore(operator, { schema: value.schema });
  const bootstrapTls = await tlsProof(operator); assert.equal(bootstrapTls.ssl, true);
  const migration = await store.migrate(); assert.equal(migration.applied, true);
  await store.initialize(); await enrollSharedOwner(store, value.owner_passphrase);
  await operator.transaction(tx => tx.query(`CREATE ROLE archive_corrections_app LOGIN PASSWORD '${value.runtime_password}'`));
  const grants = readFileSync(join(value.repository, 'scripts/archive-corrections/hosted/serverless/migrations/runtime-grants.sql'), 'utf8');
  await operator.transaction(tx => tx.exec(grants.replaceAll('__SCHEMA__', value.schema)));
  const A = await start('A'), B = await start('B');
  let snapshot;
  await t.test('two owned Node processes use distinct real TLS backends with restricted roles', async () => {
    assert.notEqual(A.node_pid, B.node_pid); assert.notEqual(A.port, B.port);
    assert.notEqual(A.postgres_tls.backend_pid, B.postgres_tls.backend_pid);
    for (const w of [A, B]) {
      assert.equal(w.postgres_tls.ssl, true); assert.equal(w.postgres_tls.role, 'archive_corrections_app');
      assert.equal(w.postgres_tls.server_address, '127.0.0.1'); assert.equal(w.postgres_tls.server_port, value.port);
    }
    report.stages.push({ stage: 'two-independent-tls-workers', passed: true, bootstrap_tls: bootstrapTls,
      A: { node_pid: A.node_pid, http_port: A.port, postgres_tls: A.postgres_tls },
      B: { node_pid: B.node_pid, http_port: B.port, postgres_tls: B.postgres_tls } });
  });
  await t.test('invented proposal through A, authorized decision and export through B', async () => {
    const login = await call(A, '/api/archive/auth/login', { method: 'POST', body: { passphrase: value.owner_passphrase } });
    assert.equal(login.status, 200); assert.equal(login.body.identity_verified, false);
    const owner = { cookie: login.headers['set-cookie'][0].split(';')[0], csrf: login.body.csrf_token };
    const proposal = await call(A, '/api/archive/corrections', { method: 'POST', key: 'd7-invented-proposal',
      body: { passage_id: context.passage.passage_id, base_revision: context.initialRevision.text_revision,
        replacement_text: 'Variante entièrement fictive D7 TLS.', reason: 'Fixture D7 TLS.',
        evidence_refs: context.passage.evidence_refs, simulation: true } });
    assert.equal(proposal.status, 201);
    const p = proposal.body.proposal;
    const decision = await call(B, '/api/archive/owner/decisions', { method: 'POST', key: 'd7-invented-decision', ...owner,
      body: { proposal_id: p.proposal_id, base_revision: p.base_revision, outcome: 'accept',
        reason: 'Acceptation fictive D7.', evidence_refs: p.evidence_refs, simulation: true } });
    assert.equal(decision.status, 201);
    const exported = await call(B, '/api/archive/owner/export', owner);
    assert.equal(exported.status, 200); assert.equal(exported.body.identity_verified, false);
    snapshot = exported.body.snapshot; validateSnapshot(snapshot);
    assert.equal(snapshot.decisions.length, 1); assert.equal(snapshot.revisions.length, 2);
    writeNew(join(value.run_directory, 'editorial-export.json'), snapshot);
    report.stages.push({ stage: 'minimal-invented-edit', passed: true, proposal_status: proposal.status,
      decision_status: decision.status, export_status: exported.status, proposal_id: p.proposal_id,
      decision_id: snapshot.decisions[0].decision_id, snapshot_sha256: snapshot.sha256, identity_verified: false });
  });
  await t.test('strict TLS restore into a fresh isolated schema preserves IDs and transaction authorization', async () => {
    const restoredDriver = driver(); const restoreTls = await tlsProof(restoredDriver); assert.equal(restoreTls.ssl, true);
    const restored = new ServerlessStore(restoredDriver, { schema: value.restore_schema });
    assert.equal((await restored.migrate()).applied, true);
    await restored.restore(snapshot); await restored.verifyUnchanged(snapshot);
    const after = await restored.exportSnapshot(); assert.equal(canonical(after) === canonical(snapshot), true);
    for (const table of ['owner_credentials','owner_sessions','session_revocations','owner_events','rate_events'])
      assert.equal((await restoredDriver.transaction(tx => tx.query(`SELECT count(*)::int AS count FROM ${restored.table(table)}`))).rows[0].count, 0);
    writeNew(join(value.run_directory, 'restored-editorial-export.json'), after);
    await stop();
    const traces = ['A','B'].flatMap(label => JSON.parse(readFileSync(join(value.run_directory, 'worker-' + label + '-transactions.json'), 'utf8')).events);
    const inserts = traces.filter(e => e.event === 'decision-insert'); assert.equal(inserts.length, 1);
    const tx = traces.filter(e => e.transaction === inserts[0].transaction);
    assert.equal(new Set(tx.map(e => e.backend_pid)).size, 1);
    for (const event of ['BEGIN','session-authorize','revision-insert','decision-insert','COMMIT']) assert.ok(tx.some(e => e.event === event));
    for (const e of tx) { assert.equal(e.tls_authorized, true); assert.equal(e.tls_encrypted, true); }
    report.stages.push({ stage: 'minimal-tls-restore-and-transaction', passed: true, restore_tls: restoreTls,
      restore_target: 'new-isolated-empty-schema-in-new-local-cluster', ids_preserved: true, canonical_bytes_equal: true,
      auth_rows_restored: 0, decision_transaction: tx });
  });
  report.passed = true;
});
