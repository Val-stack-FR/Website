import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { request as httpRequest } from 'node:http';
import { PostgresStore } from '../../scripts/archive-corrections/hosted/postgres-store.mjs';
import { pgliteDriver, postgresDriver, poolDriver } from '../../scripts/archive-corrections/hosted/drivers.mjs';
import { startHostedService, OWNER_NAME } from '../../scripts/archive-corrections/hosted/service.mjs';
import { enrollOwner } from '../../scripts/archive-corrections/owner-auth.mjs';
import { storePaths } from '../../scripts/archive-corrections/runtime.mjs';
import { Store, restoreSnapshot } from '../../scripts/archive-corrections/store.mjs';
import { canonical } from '../../scripts/archive-corrections/contract.mjs';
import { SYNTHETIC_CONTEXT as context } from '../../scripts/archive-corrections/fixture.mjs';

const origin = 'https://corrections.example.test';
const host = new URL(origin).host;
const phrase = () => randomBytes(32).toString('hex');
const payload = replacement_text => ({ passage_id: context.passage.passage_id, base_revision: context.initialRevision.text_revision,
  replacement_text, reason: 'Test entièrement fictif.', evidence_refs: context.passage.evidence_refs, simulation: true });
const decision = (proposal, outcome = 'accept') => ({ proposal_id: proposal.proposal_id, base_revision: proposal.base_revision,
  outcome, reason: 'Décision technique fictive.', evidence_refs: proposal.evidence_refs, simulation: true });
async function request(service, path, { method = 'GET', body, key, cookie, csrf, headers = {} } = {}) {
  const requestHeaders = {
    Host: host, Origin: origin, 'X-Forwarded-Proto': 'https',
    ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}),
    ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers,
  };
  // Undici normalizes Host; raw HTTP represents the reverse proxy's actual forwarded request.
  return new Promise((resolve, reject) => {
    const req = httpRequest(service.url + path, { method, headers: requestHeaders }, response => {
      let text = ''; response.on('data', bytes => { text += bytes; });
      response.on('end', () => resolve({ status: response.statusCode,
        body: response.headers['content-type']?.includes('application/json') ? JSON.parse(text) : text,
        headers: new Headers(Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value])) }));
    });
    req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined);
  });
}
async function login(service, passphrase) {
  const result = await request(service, '/v1/auth/login', { method: 'POST', body: { passphrase } });
  assert.equal(result.status, 200);
  return { cookie: result.headers.get('set-cookie').split(';')[0], csrf: result.body.csrf_token, result };
}
async function stop(service) {
  await new Promise(resolve => { service.server.close(resolve); service.server.closeIdleConnections(); });
}

test('PostgreSQL SQL executed on persistent PGlite: migration, owner boundary, two proposals, conflict, rollback and restoration', async t => {
  const name = `hosted-${randomUUID()}`;
  const directory = storePaths(name, true).directory;
  const credentialRoot = join(directory, 'auth'); mkdirSync(credentialRoot);
  const passphrase = phrase();
  await enrollOwner(OWNER_NAME, passphrase, { credentialRoot });
  const driver = await pgliteDriver(join(directory, 'pgdata'));
  const store = new PostgresStore(driver);
  t.after(() => store.close());
  let service;
  t.after(async () => { if (service) await stop(service); });
  assert.equal((await store.migrate()).applied, true);
  assert.equal((await store.migrate()).applied, false);
  service = await startHostedService({ store, credentialRoot, origin, port: 0 });
  const publicPath = `/v1/passages/${encodeURIComponent(context.passage.passage_id)}`;
  const initial = await store.exportSnapshot();
  let first, second, owner, before;

  await t.test('HTTPS proxy boundary refuses insecure/spoofed origin and anonymous owner access; read-only UI remains inert', async () => {
    for (const headers of [{ Host: 'evil.example' }, { Origin: 'http://corrections.example.test' },
      { Origin: 'https://foreign.example' }, { 'X-Forwarded-Proto': 'http' }, { 'X-Forwarded-Proto': '' }]) {
      assert.equal((await request(service, '/v1/health', { headers })).status, 403);
    }
    assert.equal((await request(service, '/v1/owner/history')).status, 403);
    const ui = await request(service, '/demo/');
    assert.equal(ui.status, 200);
    assert.match(ui.body, /passage entièrement inventé/i);
    assert.equal((await request(service, '/v1/auth/login', { method: 'POST', body: { passphrase }, headers: { Origin: '' } })).status, 403);
    assert.equal((await request(service, '/v1/auth/login', { method: 'POST', body: { passphrase: phrase() } })).status, 403);
    assert.deepEqual(await store.exportSnapshot(), initial);
  });

  await t.test('two anonymous proposals retain r1 and the private queue; replay preserves ID', async () => {
    first = (await request(service, '/v1/proposals', { method: 'POST', body: payload('<script>Variante inerte</script>'), key: 'hosted-first-proposal' })).body.proposal;
    second = (await request(service, '/v1/proposals', { method: 'POST', body: payload('Deuxième variante fictive.'), key: 'hosted-second-proposal' })).body.proposal;
    assert.ok(first && second);
    const current = (await request(service, publicPath)).body;
    assert.equal(Object.hasOwn(current, 'proposals'), false);
    assert.deepEqual(current.current_revision, context.initialRevision);
    assert.equal((await request(service, '/v1/proposals', { method: 'POST', body: payload('Refus sans Origin.'), key: 'hosted-no-origin', headers: { Origin: '' } })).status, 403);
    const replay = await request(service, '/v1/proposals', { method: 'POST', body: payload('<script>Variante inerte</script>'), key: 'hosted-first-proposal' });
    assert.equal(replay.status, 200); assert.deepEqual(replay.body.proposal, first);
    assert.equal((await request(service, '/v1/proposals', { method: 'POST', body: payload('Autre payload.'), key: 'hosted-first-proposal' })).status, 409);
  });

  await t.test('Secure __Host cookie, exact CSRF and server authority; concurrent simulated decisions yield 201/409', async () => {
    owner = await login(service, passphrase);
    assert.match(owner.result.headers.get('set-cookie'), /^__Host-archive_owner_session=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/; Max-Age=28800; Secure$/);
    assert.match(owner.result.headers.get('strict-transport-security'), /max-age=31536000/);
    assert.equal(owner.result.body.identity_verified, false);
    for (const auth of [{}, { cookie: owner.cookie }, { cookie: owner.cookie, csrf: phrase() }, { headers: { Authorization: `Bearer ${passphrase}`, 'X-Actor-Role': 'owner' } }]) {
      assert.equal((await request(service, '/v1/decisions', { method: 'POST', body: decision(first), key: 'hosted-refused-decision', ...auth })).status, 403);
    }
    assert.equal((await request(service, '/v1/owner/history', owner)).body.proposals.length, 2);
    const responses = await Promise.all([first, second].map((value, i) => request(service, '/v1/decisions', { method: 'POST', body: decision(value), key: `hosted-decision-${i}`, ...owner })));
    assert.deepEqual(responses.map(value => value.status).sort(), [201, 409]);
    const index = responses.findIndex(value => value.status === 201);
    assert.equal((await request(service, '/v1/decisions', { method: 'POST', body: decision([first, second][index]), key: `hosted-decision-${index}`, ...owner })).status, 200);
    before = (await request(service, '/v1/export', owner)).body;
    assert.equal(before.revisions.length, 2); assert.equal(before.decisions.length, 1); assert.equal(before.proposals.length, 2);
    assert.equal([passphrase, owner.csrf, owner.cookie].some(secret => canonical(before).includes(secret)), false);
  });

  await t.test('SQL failure after revision INSERT rolls back revision, decision and idempotency together', async () => {
    const next = { ...payload('Rollback fictif.'), base_revision: before.revisions.at(-1).text_revision };
    const proposed = (await request(service, '/v1/proposals', { method: 'POST', body: next, key: 'hosted-rollback-proposal' })).body.proposal;
    const previous = await store.exportSnapshot();
    await driver.transaction(tx => tx.exec(`CREATE FUNCTION ${store.schema}.fail_decision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture fault'; END; $$;
      CREATE TRIGGER test_failure BEFORE INSERT ON ${store.schema}.decisions FOR EACH STATEMENT EXECUTE FUNCTION ${store.schema}.fail_decision();`));
    const failed = await request(service, '/v1/decisions', { method: 'POST', body: decision(proposed), key: 'hosted-rollback-decision', ...owner });
    assert.equal(failed.status, 500); assert.equal(JSON.stringify(failed.body).includes('fixture fault'), false);
    assert.deepEqual(await store.exportSnapshot(), previous);
    await driver.transaction(tx => tx.exec(`DROP TRIGGER test_failure ON ${store.schema}.decisions; DROP FUNCTION ${store.schema}.fail_decision();`));
    assert.equal((await request(service, '/v1/decisions', { method: 'POST', body: decision(proposed, 'reject'), key: 'hosted-rollback-decision', ...owner })).status, 201);
    before = await store.exportSnapshot();
    assert.equal(before.revisions.length, 2); assert.equal(before.decisions.length, 2);
  });

  await t.test('append-only triggers deny UPDATE/DELETE/TRUNCATE; credential rotation and logout revoke sessions', async () => {
    for (const sql of [`UPDATE ${store.schema}.revisions SET entity_json='{}'`, `DELETE FROM ${store.schema}.requests`, `TRUNCATE ${store.schema}.proposals CASCADE`]) {
      await assert.rejects(driver.transaction(tx => tx.query(sql)), error => error.code === '55000');
    }
    assert.deepEqual(await store.exportSnapshot(), before);
    await assert.rejects(driver.transaction(tx => store.insertRevision(tx, { ...context.initialRevision,
      text_revision: `${context.passage.passage_id}:r999`, revision_number: 999, decision_id: `decision_${randomUUID()}` })), error => error.code === '23503');
    const incompatible = new PostgresStore(driver, { context: { ...context, passage: { ...context.passage, title: 'Autre fixture' } } });
    await assert.rejects(incompatible.initialize(), error => error.code === 'passage_mismatch');
    assert.deepEqual(await store.exportSnapshot(), before);
    const replacement = phrase();
    await enrollOwner(OWNER_NAME, replacement, { credentialRoot, rotate: true });
    assert.equal((await request(service, '/v1/export', owner)).status, 403);
    assert.equal((await request(service, '/v1/auth/login', { method: 'POST', body: { passphrase } })).status, 403);
    owner = await login(service, replacement);
    assert.equal((await request(service, '/v1/auth/logout', { method: 'POST', ...owner })).status, 200);
    assert.equal((await request(service, '/v1/export', owner)).status, 403);
  });

  await t.test('PostgreSQL logical backup restores exactly to a fresh schema and to SQLite; no auth is included', async () => {
    const snapshotFile = join(directory, 'postgres-export.json');
    writeFileSync(snapshotFile, canonical(before) + '\n', { flag: 'wx' });
    const restored = new PostgresStore(driver, { schema: 'archive_corrections_restored' });
    await restored.migrate(); await restored.restore(JSON.parse(readFileSync(snapshotFile, 'utf8')));
    assert.deepEqual(await restored.exportSnapshot(), before);
    await assert.rejects(restored.restore(before), error => error.code === 'store_exists');
    const sqliteName = `pg-to-sqlite-${randomUUID()}`;
    restoreSnapshot(sqliteName, before);
    assert.equal(existsSync(storePaths(sqliteName).credential), false);
    const sqlite = new Store(sqliteName, { readOnly: true });
    let sqliteSnapshot;
    try { sqliteSnapshot = sqlite.exportSnapshot(); assert.deepEqual(sqliteSnapshot, before); } finally { sqlite.close(); }
    const again = new PostgresStore(driver, { schema: 'archive_corrections_from_sqlite' });
    await again.migrate(); await again.restore(sqliteSnapshot);
    assert.deepEqual(await again.exportSnapshot(), before);
    const malformed = { ...before, sha256: '0'.repeat(64) };
    await assert.rejects(again.restore(malformed), error => error.code === 'invalid_snapshot');
    t.diagnostic(`Executed PGlite PostgreSQL migrations, logical backup and exact SQLite restore retained in ${name} and ${sqliteName}; single engine, no hosted database.`);
  });

  await t.test('anonymous global rate bound and malformed fields fail without partial facts', async () => {
    const saved = await store.exportSnapshot();
    await assert.rejects(store.mutate('proposal', 'hosted-bad-fields', { ...payload('Test'), actor_role: 'owner' }), error => error.code === 'invalid_fields');
    await assert.rejects(store.mutate('proposal', 'hosted-too-long', { ...payload('x'.repeat(5001)) }), error => error.code === 'invalid_text');
    assert.deepEqual(await store.exportSnapshot(), saved);
    await stop(service); service = undefined;
    service = await startHostedService({ store, credentialRoot, origin, port: 0, proposalLimit: 1 });
    const current = saved.revisions.at(-1).text_revision;
    const body = { ...payload('Test limité'), base_revision: current };
    assert.equal((await request(service, '/v1/proposals', { method: 'POST', body, key: 'hosted-bounded-first' })).status, 201);
    const bounded = await store.exportSnapshot();
    assert.equal((await request(service, '/v1/proposals', { method: 'POST', body, key: 'hosted-bounded-second' })).status, 429);
    assert.deepEqual(await store.exportSnapshot(), bounded);
  });
});

test('PGlite child process abrupt restart retains proposals/decisions, invalidates session and permits exact replay', async t => {
  const name = `pg-restart-${randomUUID()}`;
  const directory = storePaths(name, true).directory;
  const credentialRoot = join(directory, 'auth'); mkdirSync(credentialRoot);
  const passphrase = phrase(); await enrollOwner(OWNER_NAME, passphrase, { credentialRoot });
  const dataDir = join(directory, 'pgdata');
  const setup = new PostgresStore(await pgliteDriver(dataDir));
  await setup.migrate(); await setup.close();
  const file = fileURLToPath(new URL('../../scripts/archive-corrections/hosted/service.mjs', import.meta.url));
  let child;
  const kill = async () => {
    if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited; }
  };
  t.after(kill);
  const start = async () => {
    child = spawn(process.execPath, [file, 'serve', '0'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
      ...process.env, ARCHIVE_CORRECTIONS_ENGINE: 'pglite', ARCHIVE_CORRECTIONS_PGLITE_DIRECTORY: dataDir,
      ARCHIVE_CORRECTIONS_AUTH_ROOT: credentialRoot, ARCHIVE_CORRECTIONS_PUBLIC_ORIGIN: origin,
    } });
    return new Promise((resolve, reject) => {
      let stdout = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error('PGlite pilot readiness timeout.')); }, 20000);
      child.once('error', () => { clearTimeout(timer); reject(new Error('PGlite pilot launch failed.')); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('PGlite pilot stopped before readiness.')); });
      child.stdout.on('data', bytes => {
        stdout += bytes;
        if (stdout.includes('\n')) {
          clearTimeout(timer); assert.equal(stdout.includes(passphrase) || stdout.includes(dataDir), false);
          resolve(JSON.parse(stdout.split('\n')[0]));
        }
      });
    });
  };
  let service = await start(); let owner = await login(service, passphrase);
  const proposed = (await request(service, '/v1/proposals', { method: 'POST', body: payload('Reprise fictive persistante.'), key: 'pg-restart-proposal' })).body.proposal;
  assert.equal((await request(service, '/v1/decisions', { method: 'POST', body: decision(proposed), key: 'pg-restart-decision', ...owner })).status, 201);
  const before = (await request(service, '/v1/export', owner)).body;
  await kill(); service = await start();
  assert.equal((await request(service, '/v1/export', owner)).status, 403);
  owner = await login(service, passphrase);
  assert.deepEqual((await request(service, '/v1/export', owner)).body, before);
  assert.equal((await request(service, '/v1/decisions', { method: 'POST', body: decision(proposed), key: 'pg-restart-decision', ...owner })).status, 200);
  t.diagnostic(`Abrupt restart evidence retained in ${name}; PGlite on local disk, proxy headers simulated over loopback HTTP.`);
});

test('hosted configuration fails closed without credentials/HTTPS; pg transaction stays on one acquired client', async () => {
  for (const value of [undefined, '', 'sqlite://local', 'postgres://user:password@db.example/test?sslmode=disable']) {
    await assert.rejects(postgresDriver(value), error => error.code === 'database_configuration_required');
  }
  await assert.rejects(startHostedService({ origin: '' }), error => error.code === 'https_configuration_required');
  const calls = [];
  const client = { query: async sql => { calls.push(sql); }, release: error => { calls.push(error ? 'release-error' : 'release'); } };
  const driver = poolDriver({ connect: async () => client, end: async () => {} });
  assert.equal(await driver.transaction(async tx => { await tx.query('SELECT fixture'); return 7; }), 7);
  assert.deepEqual(calls, ['BEGIN', 'SELECT fixture', 'COMMIT', 'release']);
  calls.length = 0;
  await assert.rejects(driver.transaction(async tx => { await tx.query('SELECT fixture'); throw new Error('test rollback'); }));
  assert.deepEqual(calls, ['BEGIN', 'SELECT fixture', 'ROLLBACK', 'release-error']);
});

test('operator CLI executes migration/restore/export on a fresh persistent PGlite store with bounded diagnostics', async t => {
  const name = `pg-cli-${randomUUID()}`;
  const directory = storePaths(name, true).directory;
  const sqlite = new Store(name);
  let snapshot;
  try {
    sqlite.mutate('proposal', 'cli-source-proposal', payload('Fixture de sauvegarde CLI.'));
    snapshot = sqlite.exportSnapshot();
  } finally { sqlite.close(); }
  const source = join(directory, 'source.json');
  const target = join(directory, 'restored.json');
  writeFileSync(source, canonical(snapshot) + '\n', { flag: 'wx' });
  const dataDir = join(directory, 'pgdata');
  const file = fileURLToPath(new URL('../../scripts/archive-corrections/hosted/service.mjs', import.meta.url));
  const run = async args => {
    const child = spawn(process.execPath, [file, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
      ...process.env, ARCHIVE_CORRECTIONS_ENGINE: 'pglite', ARCHIVE_CORRECTIONS_PGLITE_DIRECTORY: dataDir,
    } });
    let stdout = '', stderr = '';
    child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
    const timer = setTimeout(() => child.kill(), 20000);
    const [code] = await once(child, 'exit'); clearTimeout(timer);
    return { code, stdout, stderr };
  };
  const migrated = await run(['migrate']); assert.equal(migrated.code, 0); assert.equal(JSON.parse(migrated.stdout).applied, true);
  const restored = await run(['restore', source]); assert.equal(restored.code, 0); assert.equal(JSON.parse(restored.stdout).snapshot_sha256, snapshot.sha256);
  const exported = await run(['export', target]); assert.equal(exported.code, 0); assert.equal(JSON.parse(exported.stdout).snapshot_sha256, snapshot.sha256);
  assert.equal(readFileSync(target, 'utf8'), readFileSync(source, 'utf8'));
  assert.equal(existsSync(join(directory, 'auth')), false);
  const overwrite = await run(['export', target]); assert.equal(overwrite.code, 1);
  assert.equal(readFileSync(target, 'utf8'), readFileSync(source, 'utf8'));
  assert.equal([migrated, restored, exported, overwrite].some(result => result.stdout.includes(dataDir) || result.stderr.includes(dataDir)), false);
  t.diagnostic(`Executed CLI migrate/restore/export byte-identically; evidence ${name}, no credential copied.`);
});
