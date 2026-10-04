import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { enrollOwner, OwnerSessions, COOKIE_NAME } from '../../scripts/archive-corrections/owner-auth.mjs';
import { startOwnerService } from '../../scripts/archive-corrections/server.mjs';
import { PASSAGE, INITIAL_REVISION } from '../../scripts/archive-corrections/fixture.mjs';
import { storePaths } from '../../scripts/archive-corrections/runtime.mjs';

export const randomPassphrase = () => randomBytes(32).toString('hex');
export async function stopService(service) {
  await new Promise(resolve => { service.server.close(resolve); service.server.closeIdleConnections(); });
  service.store.close();
}
export async function call(service, path, { method = 'GET', body, key, cookie, csrf, origin = service.url, headers = {} } = {}) {
  const response = await fetch(`${service.url}${path}`, {
    method, headers: { ...(origin ? { Origin: origin } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}), ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
export async function login(service, passphrase) {
  const result = await call(service, '/v1/auth/login', { method: 'POST', body: { passphrase } });
  assert.equal(result.status, 200);
  return { cookie: result.headers.get('set-cookie').split(';')[0], csrf: result.body.csrf_token, result };
}
export const proposalPayload = (context, replacement = 'Variante locale entièrement révisable.') => ({
  passage_id: context.passage.passage_id, base_revision: context.initialRevision.text_revision,
  replacement_text: replacement, reason: 'Essai local sans validation historique.',
  evidence_refs: context.passage.evidence_refs, simulation: true,
});
export const decisionPayload = (proposal, outcome = 'accept') => ({
  proposal_id: proposal.proposal_id, base_revision: proposal.base_revision, outcome,
  reason: 'Décision technique locale de simulation.', evidence_refs: proposal.evidence_refs, simulation: true,
});

test('offline enrollment is explicit, private, non-overwriting and required before database creation', async () => {
  const name = `no-owner-${randomUUID()}`;
  await assert.rejects(startOwnerService({ name, port: 0 }), error => error.code === 'owner_not_enrolled');
  assert.equal(existsSync(storePaths(name).directory), false);
  await assert.rejects(enrollOwner(name, 'weak'), error => error.code === 'invalid_passphrase');
  assert.equal(existsSync(storePaths(name).directory), false);
  const passphrase = randomPassphrase();
  const result = await enrollOwner(name, passphrase);
  assert.equal(result.identity_verified, false);
  assert.equal(existsSync(storePaths(name).database), false);
  const bytes = readFileSync(storePaths(name).credential, 'utf8');
  assert.equal(bytes.includes(passphrase), false);
  assert.equal(JSON.parse(bytes).algorithm, 'scrypt-N32768-r8-p1');
  await assert.rejects(enrollOwner(name, randomPassphrase()), error => error.code === 'owner_already_enrolled');
  assert.equal(readFileSync(storePaths(name).credential, 'utf8'), bytes);
});

test('local owner session: protected queue, cookie/CSRF, conflict, logout, expiry and offline rotation', async t => {
  const name = `session-${randomUUID()}`;
  const passphrase = randomPassphrase();
  let now = Date.now();
  await enrollOwner(name, passphrase);
  const service = await startOwnerService({ name, port: 0, sessionOptions: { now: () => now, idleMs: 10000, absoluteMs: 20000 } });
  t.after(() => stopService(service));
  let first;
  let second;
  let owner;
  const context = { passage: PASSAGE, initialRevision: INITIAL_REVISION };
  const publicPath = `/v1/passages/${encodeURIComponent(PASSAGE.passage_id)}`;

  await t.test('anonymous visitor proposes without publishing text or disclosing the owner queue', async () => {
    const created = await call(service, '/v1/proposals', { method: 'POST', body: proposalPayload(context), key: 'session-proposal-first' });
    assert.equal(created.status, 201);
    first = created.body.proposal;
    second = (await call(service, '/v1/proposals', { method: 'POST', body: proposalPayload(context, 'Autre variante locale.'), key: 'session-proposal-second' })).body.proposal;
    for (const path of ['/v1/owner/history', '/v1/export']) assert.equal((await call(service, path)).status, 403);
    const current = await call(service, publicPath);
    assert.equal(Object.hasOwn(current.body, 'proposals') || Object.hasOwn(current.body, 'decisions'), false);
    assert.equal(JSON.stringify(current.body).includes(first.reason), false);
    assert.equal(current.body.current_revision.text, INITIAL_REVISION.text);
    assert.equal((await call(service, '/v1/decisions', { method: 'POST', body: decisionPayload(first), key: 'session-denied', headers: { Authorization: `Bearer ${passphrase}`, 'X-Actor-Role': 'owner' } })).status, 403);
  });

  await t.test('login validates exact Origin and credential; cookie is HttpOnly and CSRF is required', async () => {
    for (const origin of ['', 'https://foreign.example', 'null']) {
      assert.equal((await call(service, '/v1/auth/login', { method: 'POST', body: { passphrase }, origin })).status, 403);
    }
    assert.equal((await call(service, '/v1/auth/login', { method: 'POST', body: { passphrase: randomPassphrase() } })).status, 403);
    owner = await login(service, passphrase);
    const cookieHeader = owner.result.headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly; SameSite=Strict; Path=\//);
    assert.equal(owner.result.body.identity_verified, false);
    assert.equal(JSON.stringify(owner.result.body).includes(owner.cookie.slice(COOKIE_NAME.length + 1)), false);
    assert.equal((await call(service, '/v1/owner/history', owner)).body.proposals.length, 2);
    for (const csrf of [undefined, randomPassphrase()]) {
      assert.equal((await call(service, '/v1/decisions', { method: 'POST', body: decisionPayload(first), key: 'session-csrf-denied', cookie: owner.cookie, csrf })).status, 403);
    }
    assert.equal((await call(service, '/v1/decisions', { method: 'POST', body: decisionPayload(first), key: 'session-origin-denied', ...owner, origin: '' })).status, 403);
    assert.equal(service.store.current().text_revision, INITIAL_REVISION.text_revision);
  });

  await t.test('two decisions from one base produce one revision and a 409; replay is durable', async () => {
    const responses = await Promise.all([first, second].map((proposal, index) => call(service, '/v1/decisions', {
      method: 'POST', body: decisionPayload(proposal), key: `session-accept-${index}`, ...owner,
    })));
    assert.deepEqual(responses.map(item => item.status).sort(), [201, 409]);
    const success = responses.find(item => item.status === 201);
    const index = responses.indexOf(success);
    const replay = await call(service, '/v1/decisions', { method: 'POST', body: decisionPayload([first, second][index]), key: `session-accept-${index}`, ...owner });
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body.decision, success.body.decision);
    const snapshot = (await call(service, '/v1/export', owner)).body;
    assert.equal(snapshot.revisions.length, 2);
    assert.equal(snapshot.decisions.length, 1);
    assert.equal(JSON.stringify(snapshot).includes(passphrase) || JSON.stringify(snapshot).includes(owner.csrf), false);
  });

  await t.test('logout revokes the server session, not just the displayed cookie', async () => {
    assert.equal((await call(service, '/v1/auth/logout', { method: 'POST', ...owner, csrf: undefined })).status, 403);
    const result = await call(service, '/v1/auth/logout', { method: 'POST', ...owner });
    assert.equal(result.status, 200);
    assert.match(result.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await call(service, '/v1/owner/history', owner)).status, 403);
  });

  await t.test('idle and absolute expiry refuse the previous session without altering durable records', async () => {
    owner = await login(service, passphrase);
    now += 10000;
    assert.equal((await call(service, '/v1/export', owner)).status, 403);
    owner = await login(service, passphrase);
    now += 9000;
    assert.equal((await call(service, '/v1/export', owner)).status, 200);
    now += 9000;
    assert.equal((await call(service, '/v1/export', owner)).status, 200);
    now += 2000;
    assert.equal((await call(service, '/v1/export', owner)).status, 403);
    assert.equal(service.store.history().decisions.length, 1);
  });

  await t.test('offline credential rotation invalidates all existing sessions and the old password', async () => {
    now += 60001; // Start a fresh login rate window.
    owner = await login(service, passphrase);
    const replacement = randomPassphrase();
    await enrollOwner(name, replacement, { rotate: true });
    assert.equal((await call(service, '/v1/export', owner)).status, 403);
    assert.equal((await call(service, '/v1/auth/login', { method: 'POST', body: { passphrase } })).status, 403);
    const renewed = await login(service, replacement);
    assert.equal((await call(service, '/v1/export', renewed)).status, 200);
  });
});

test('concurrent login failures are bounded before expensive password verification', async () => {
  const name = `throttle-${randomUUID()}`;
  await enrollOwner(name, randomPassphrase());
  let now = Date.now();
  const sessions = new OwnerSessions(name, { now: () => now });
  const attempts = await Promise.allSettled(Array.from({ length: 10 }, () => sessions.login({ passphrase: randomPassphrase() })));
  assert.equal(attempts.filter(result => result.reason?.code === 'invalid_credential').length, 5);
  assert.equal(attempts.filter(result => result.reason?.code === 'login_throttled').length, 5);
  now += 60001;
  await assert.rejects(sessions.login({ passphrase: randomPassphrase() }), error => error.code === 'invalid_credential');
});

test('fresh process keeps durable corrections but invalidates previous in-memory sessions', async t => {
  const name = `session-restart-${randomUUID()}`;
  const passphrase = randomPassphrase();
  await enrollOwner(name, passphrase);
  const file = fileURLToPath(new URL('../../scripts/archive-corrections/session.mjs', import.meta.url));
  let child;
  const stop = async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit'); child.kill('SIGKILL'); await exit;
    }
  };
  t.after(stop);
  const start = async () => {
    child = spawn(process.execPath, [file, name, '0'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    const ready = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error('Session service readiness timed out.')); }, 10000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Session service exited before readiness.')); });
      child.stdout.on('data', bytes => {
        stdout += bytes;
        if (stdout.includes('\n')) { clearTimeout(timer); resolve(JSON.parse(stdout.split('\n')[0])); }
      });
    });
    assert.equal(stdout.includes(passphrase), false);
    return { url: ready.url };
  };
  let service = await start();
  let owner = await login(service, passphrase);
  const payload = proposalPayload({ passage: PASSAGE, initialRevision: INITIAL_REVISION });
  const proposal = await call(service, '/v1/proposals', { method: 'POST', body: payload, key: 'session-restart-proposal' });
  assert.equal(proposal.status, 201);
  const before = (await call(service, '/v1/export', owner)).body;
  await stop();
  service = await start();
  assert.equal((await call(service, '/v1/export', owner)).status, 403);
  owner = await login(service, passphrase);
  assert.deepEqual((await call(service, '/v1/export', owner)).body, before);
  const replay = await call(service, '/v1/proposals', { method: 'POST', body: payload, key: 'session-restart-proposal' });
  assert.equal(replay.status, 200);
  assert.deepEqual(replay.body.proposal, proposal.body.proposal);
});
