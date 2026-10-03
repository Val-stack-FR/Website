import test from 'node:test';
import assert from 'node:assert/strict';
import { Agent, request } from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { PASSAGE, INITIAL_REVISION } from '../../scripts/archive-corrections/fixture.mjs';
import { canonical, digest } from '../../scripts/archive-corrections/contract.mjs';
import { SECRET_ENV, startLocalService } from '../../scripts/archive-corrections/server.mjs';
import { storePaths } from '../../scripts/archive-corrections/runtime.mjs';
import { validateSnapshot } from '../../scripts/archive-corrections/snapshot-validation.mjs';

const execFileAsync = promisify(execFile);
const serverFile = fileURLToPath(new URL('../../scripts/archive-corrections/server.mjs', import.meta.url));
const snapshotFile = fileURLToPath(new URL('../../scripts/archive-corrections/snapshot.mjs', import.meta.url));
const revision = number => `${PASSAGE.passage_id}:r${number}`;
const proposalBody = (base = 1, text = 'La boîte contient quatre jetons imaginaires.') => ({
  passage_id: PASSAGE.passage_id, base_revision: revision(base), replacement_text: text,
  reason: 'Modification inventée\tpour tester\nla collaboration.\r', evidence_refs: PASSAGE.evidence_refs, simulation: true,
});
const decisionBody = (proposal, outcome = 'accept') => ({
  proposal_id: proposal.proposal_id, base_revision: proposal.base_revision, outcome,
  reason: 'Décision locale\tde test,\nsans lecture historique.\r', evidence_refs: PASSAGE.evidence_refs, simulation: true,
});

function alterEntity(snapshot, kind, id, field, value) {
  const altered = structuredClone(snapshot);
  const idField = `${kind}_id`;
  const entity = altered[`${kind}s`].find(item => item[idField] === id);
  entity[field] = value;
  for (const request of altered.requests.filter(item => item.scope === kind && item.result[kind][idField] === id)) {
    request.result[kind][field] = value;
    if (Object.hasOwn(request.payload, field)) request.payload[field] = value;
  }
  // Keep accepted proposal text / decision timestamps consistent with their resulting revisions.
  if (kind === 'proposal' && field === 'replacement_text') {
    const acceptance = altered.decisions.find(item => item.proposal_id === id && item.outcome === 'accept');
    if (acceptance) altered.revisions.find(item => item.decision_id === acceptance.decision_id).text = value;
  }
  if (kind === 'decision' && field === 'created_at' && entity.outcome === 'accept') {
    altered.revisions.find(item => item.decision_id === id).created_at = value;
  }
  const { sha256: oldHash, ...content } = altered;
  altered.sha256 = digest(content);
  return altered;
}

async function startChild(name, secret) {
  const child = spawn(process.execPath, [serverFile, name, '0'], {
    env: { ...process.env, [SECRET_ENV]: secret }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const ready = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Local test service did not become ready.')); }, 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Service exited before readiness (${code}). ${stderr}`)); });
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.includes('\n')) {
        clearTimeout(timer);
        try { resolve(JSON.parse(stdout.split('\n')[0])); } catch (error) { reject(error); }
      }
    });
  });
  assert.equal(ready.simulation, true);
  assert.match(ready.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(stdout.includes(secret) || stderr.includes(secret), false, 'The secret must never appear in process output.');
  return {
    url: ready.url,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit');
        child.kill('SIGKILL'); // Abrupt process exit, no application shutdown or in-memory flush.
        await exited;
      }
      assert.equal(stdout.includes(secret) || stderr.includes(secret), false);
    },
  };
}

class Client {
  constructor() { this.agent = new Agent({ keepAlive: true }); }
  close() { this.agent.destroy(); }
  call(url, path, { method = 'GET', body, key, token, headers = {} } = {}) {
    const bytes = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    return new Promise((resolve, reject) => {
      const req = request(new URL(path, url), {
        method, agent: this.agent, headers: {
          ...(bytes ? { 'Content-Type': 'application/json', 'Content-Length': bytes.length } : {}),
          ...(key ? { 'Idempotency-Key': key } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers,
        },
      }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
          catch (error) { reject(error); }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => req.destroy(new Error('HTTP test timed out.')));
      req.end(bytes);
    });
  }
}

test('MVP-D: two real HTTP clients, immutable history, restart and identical restore', async t => {
  const suffix = randomUUID();
  const source = `test-${suffix}`;
  const target = `restored-${suffix}`;
  const badSource = `bad-${suffix}`;
  const badTarget = `blocked-${suffix}`;
  const secret = randomBytes(32).toString('hex');
  const visitor = new Client();
  const owner = new Client();
  let service = await startChild(source, secret);
  t.after(async () => { visitor.close(); owner.close(); await service.stop(); });
  const post = (client, path, body, key, token) => client.call(service.url, path, { method: 'POST', body, key, token });
  const state = async () => (await visitor.call(service.url, `/v1/passages/${PASSAGE.passage_id}`)).body;
  const snapshot = async () => {
    const response = await owner.call(service.url, '/v1/export', { token: secret });
    assert.equal(response.status, 200);
    assert.equal(canonical(response.body).includes(secret), false);
    return response.body;
  };
  let first;
  let second;
  let acceptance;
  let rollbackProposal;
  let stableSnapshot;

  await t.test('anonymous and AI clients cannot decide, and client role/simulation/evidence are not trusted', async () => {
    const created = await post(visitor, '/v1/proposals', proposalBody(), 'proposal-first');
    assert.equal(created.status, 201);
    first = created.body.proposal;
    assert.equal(first.actor_role, 'anonymous');
    assert.equal(first.simulation, true);
    for (const headers of [{}, { 'X-Actor-Role': 'owner', 'X-Actor-Type': 'ai' }]) {
      const denied = await visitor.call(service.url, '/v1/decisions', {
        method: 'POST', body: decisionBody(first), key: 'decision-denied', headers,
      });
      assert.equal(denied.status, 403);
      assert.equal(denied.body.error.code, 'owner_test_required');
    }
    assert.equal((await post(visitor, '/v1/decisions', decisionBody(first), 'wrong-credential', randomBytes(32).toString('hex'))).status, 403);
    assert.equal((await post(visitor, '/v1/decisions', { ...decisionBody(first), actor_role: 'owner' }, 'role-spoof')).status, 403);
    assert.equal((await post(owner, '/v1/decisions', { ...decisionBody(first), actor_role: 'owner' }, 'role-owner-spoof', secret)).status, 422);
    assert.equal((await post(visitor, '/v1/proposals', { ...proposalBody(), actor_role: 'owner' }, 'proposal-role-spoof')).status, 422);
    assert.equal((await post(visitor, '/v1/proposals', { ...proposalBody(), simulation: false }, 'not-simulation')).status, 422);
    assert.equal((await post(visitor, '/v1/proposals', { ...proposalBody(), passage_id: 'historical-unavailable' }, 'not-synthetic')).status, 422);
    assert.equal((await post(visitor, '/v1/proposals', { ...proposalBody(), evidence_refs: ['historical:unavailable'] }, 'not-evidence')).status, 422);
    assert.equal((await visitor.call(service.url, '/v1/export')).status, 403);
    assert.equal((await visitor.call(service.url, '/v1/health', { headers: { Host: 'untrusted.example' } })).status, 403);
    assert.equal((await visitor.call(service.url, '/v1/health', { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    const current = await state();
    assert.equal(current.decisions.length, 0);
    assert.deepEqual(current.revisions, [INITIAL_REVISION]);
  });

  await t.test('canonical and simultaneous replay preserve IDs; changed payload is refused', async () => {
    const reordered = Object.fromEntries(Object.entries(proposalBody()).reverse());
    const replay = await post(owner, '/v1/proposals', reordered, 'proposal-first');
    assert.equal(replay.status, 200);
    assert.equal(replay.body.replayed, true);
    assert.deepEqual(replay.body.proposal, first);
    const changed = await post(visitor, '/v1/proposals', proposalBody(1, 'Texte inventé différent.'), 'proposal-first');
    assert.equal(changed.status, 409);
    assert.equal(changed.body.error.code, 'idempotency_conflict');
    const duplicate = await Promise.all([
      post(visitor, '/v1/proposals', proposalBody(1, 'La boîte contient cinq jetons imaginaires.'), 'proposal-second'),
      post(owner, '/v1/proposals', proposalBody(1, 'La boîte contient cinq jetons imaginaires.'), 'proposal-second'),
    ]);
    assert.deepEqual(duplicate.map(result => result.status).sort(), [200, 201]);
    assert.deepEqual(duplicate[0].body.proposal, duplicate[1].body.proposal);
    second = duplicate[0].body.proposal;
    assert.equal((await state()).proposals.length, 2);
  });

  await t.test('proposal text/reason and owner decision reason refuse DEL and C1 controls without mutations', async () => {
    const before = await snapshot();
    for (const [index, control] of ['\u007f', '\u0085', '\u009f'].entries()) {
      for (const field of ['replacement_text', 'reason']) {
        const invalid = { ...proposalBody(), [field]: `Texte inventé${control}invalide.` };
        const response = await post(visitor, '/v1/proposals', invalid, `control-${field}-${index}`);
        assert.equal(response.status, 422);
        assert.equal(response.body.error.code, 'invalid_text');
      }
      const response = await post(owner, '/v1/decisions', { ...decisionBody(first), reason: `Motif simulé${control}invalide.` }, `control-decision-${index}`, secret);
      assert.equal(response.status, 422);
      assert.equal(response.body.error.code, 'invalid_text');
    }
    assert.deepEqual(await snapshot(), before);
    // Existing successful proposal/decision payloads explicitly contain each allowed TAB/LF/CR.
    for (const allowed of ['\t', '\n', '\r']) assert.equal(first.reason.includes(allowed), true);
  });

  await t.test('rejection records a decision while preserving the exact current text', async () => {
    const rejectionProposal = await post(visitor, '/v1/proposals', proposalBody(1, 'Variante synthétique refusée.'), 'proposal-rejected');
    const body = decisionBody(rejectionProposal.body.proposal, 'reject');
    const rejected = await post(owner, '/v1/decisions', body, 'decision-reject', secret);
    assert.equal(rejected.status, 201);
    assert.equal(rejected.body.decision.actor_role, 'owner_test');
    assert.equal(rejected.body.decision.text_revision, revision(1));
    assert.deepEqual((await state()).revisions, [INITIAL_REVISION]);
    const replay = await post(owner, '/v1/decisions', body, 'decision-reject', secret);
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body.decision, rejected.body.decision);
    assert.equal((await post(owner, '/v1/decisions', body, 'decision-reject-again', secret)).body.error.code, 'proposal_decided');
    assert.equal((await post(owner, '/v1/decisions', { ...body, outcome: 'accept' }, 'decision-reject', secret)).status, 409);
  });

  await t.test('two concurrent acceptances from one base yield one new revision and one conflict', async () => {
    const concurrent = await Promise.all([
      post(visitor, '/v1/decisions', decisionBody(first), 'decision-first', secret),
      post(owner, '/v1/decisions', decisionBody(second), 'decision-second', secret),
    ]);
    assert.deepEqual(concurrent.map(result => result.status).sort(), [201, 409]);
    const winningIndex = concurrent.findIndex(result => result.status === 201);
    acceptance = { body: decisionBody(winningIndex === 0 ? first : second), key: winningIndex === 0 ? 'decision-first' : 'decision-second', decision: concurrent[winningIndex].body.decision };
    assert.equal(concurrent[1 - winningIndex].body.error.code, 'revision_conflict');
    const current = await state();
    assert.equal(current.revisions.length, 2);
    assert.deepEqual(current.revisions[0], INITIAL_REVISION);
    assert.equal(current.current_revision.text_revision, revision(2));
    assert.equal(current.current_revision.text, winningIndex === 0 ? first.replacement_text : second.replacement_text);
    assert.equal(current.decisions.length, 2); // One rejection and exactly one acceptance.
    const stale = await post(visitor, '/v1/proposals', proposalBody(), 'stale-proposal');
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'revision_conflict');
    const replay = await post(owner, '/v1/decisions', acceptance.body, acceptance.key, secret);
    assert.equal(replay.status, 200); // Replay is checked before staleness.
    assert.deepEqual(replay.body.decision, acceptance.decision);
    assert.equal((await post(visitor, '/v1/decisions', acceptance.body, acceptance.key)).status, 403);
    assert.equal((await post(owner, '/v1/decisions', { ...acceptance.body, reason: 'Motif inventé différent.' }, acceptance.key, secret)).status, 409);
  });

  await t.test('a database failure after revision insertion rolls back all facts and the key can be retried', async () => {
    rollbackProposal = (await post(visitor, '/v1/proposals', proposalBody(2, 'La boîte contient six jetons imaginaires.'), 'proposal-rollback')).body.proposal;
    const before = await snapshot();
    const db = new DatabaseSync(storePaths(source).database, { timeout: 5000 });
    try {
      db.exec("CREATE TRIGGER test_fail_decision BEFORE INSERT ON decisions BEGIN SELECT RAISE(ABORT, 'injected storage failure'); END;");
      const failed = await post(owner, '/v1/decisions', decisionBody(rollbackProposal), 'decision-rollback', secret);
      assert.equal(failed.status, 500);
      assert.equal(failed.body.error.code, 'internal_error');
      assert.equal(JSON.stringify(failed.body).includes('injected storage failure'), false);
      assert.deepEqual(await snapshot(), before);
      db.exec('DROP TRIGGER test_fail_decision');
      const retried = await post(owner, '/v1/decisions', decisionBody(rollbackProposal), 'decision-rollback', secret);
      assert.equal(retried.status, 201);
      assert.equal(retried.body.decision.text_revision, revision(3));
      assert.throws(() => db.exec("UPDATE revisions SET entity_json='{}'"), /append-only/);
      assert.throws(() => db.exec('DELETE FROM decisions'), /append-only/);
    } finally {
      db.exec('DROP TRIGGER IF EXISTS test_fail_decision');
      db.close();
    }
    stableSnapshot = await snapshot();
  });

  await t.test('abrupt stop and fresh process preserve every record and successful replay', async () => {
    await service.stop();
    service = await startChild(source, secret);
    assert.deepEqual(await snapshot(), stableSnapshot);
    const replay = await post(visitor, '/v1/proposals', proposalBody(), 'proposal-first');
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body.proposal, first);
    const decided = await post(owner, '/v1/decisions', acceptance.body, acceptance.key, secret);
    assert.equal(decided.status, 200);
    assert.deepEqual(decided.body.decision, acceptance.decision);
    assert.deepEqual(await snapshot(), stableSnapshot);
  });

  await t.test('restoration rejects malformed proposal and decision UUIDs even with coherent links and valid hashes', async () => {
    const invalidSource = `invalid-id-${suffix}`;
    mkdirSync(storePaths(invalidSource).directory, { recursive: true });
    const malformedUuids = [
      { name: 'shape', uuid: '-'.repeat(36) },
      { name: 'version', uuid: '00000000-0000-5000-8000-000000000000' },
      { name: 'variant', uuid: '00000000-0000-4000-7000-000000000000' },
    ];
    for (const kind of ['proposal', 'decision']) {
      const originalId = stableSnapshot[`${kind}s`][0][`${kind}_id`];
      for (const malformed of malformedUuids) {
        const replacementId = `${kind}_${malformed.uuid}`;
        // Replace every reference, including revision links and idempotency results/payloads.
        const altered = JSON.parse(JSON.stringify(stableSnapshot), (_key, value) => value === originalId ? replacementId : value);
        const field = `${kind}_id`;
        altered[`${kind}s`].sort((a, b) => a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0);
        const { sha256: oldHash, ...content } = altered;
        altered.sha256 = digest(content);
        assert.equal(altered.sha256, digest(content));
        assert.throws(() => validateSnapshot(altered), error => error.code === 'invalid_snapshot'
          && error.message.startsWith(`Invalid ${kind} ID`));
        writeFileSync(storePaths(invalidSource).snapshot, canonical(altered));
        const refusedTarget = `refused-${kind}-${malformed.name}-${suffix}`;
        assert.equal(existsSync(storePaths(refusedTarget).directory), false);
        await assert.rejects(execFileAsync(process.execPath, [snapshotFile, 'restore', invalidSource, refusedTarget], { windowsHide: true }),
          error => error.stderr.includes(`Invalid ${kind} ID`));
        assert.equal(existsSync(storePaths(refusedTarget).directory), false, 'Invalid IDs must fail before any target store creation.');
      }
    }
  });

  await t.test('restoration rejects impossible proposal and decision dates before creating a target', async () => {
    const invalidSource = `bad-time-${suffix}`;
    mkdirSync(storePaths(invalidSource).directory, { recursive: true });
    for (const kind of ['proposal', 'decision']) {
      const entity = stableSnapshot[`${kind}s`][0];
      const altered = alterEntity(stableSnapshot, kind, entity[`${kind}_id`], 'created_at', '2026-02-31T00:00:00.000Z');
      const { sha256, ...content } = altered;
      assert.equal(sha256, digest(content));
      assert.throws(() => validateSnapshot(altered), error => error.code === 'invalid_snapshot' && error.message === 'Invalid created_at.');
      writeFileSync(storePaths(invalidSource).snapshot, canonical(altered));
      const refusedTarget = `refused-date-${kind}-${suffix}`;
      await assert.rejects(execFileAsync(process.execPath, [snapshotFile, 'restore', invalidSource, refusedTarget], { windowsHide: true }),
        error => error.stderr.includes('Invalid created_at.'));
      assert.equal(existsSync(storePaths(refusedTarget).directory), false);
    }
  });

  await t.test('restoration rejects DEL/C1 in proposal text and proposal/decision reasons with valid hashes', async () => {
    const invalidSource = `bad-control-${suffix}`;
    mkdirSync(storePaths(invalidSource).directory, { recursive: true });
    const cases = [
      { kind: 'proposal', field: 'replacement_text', control: '\u007f' },
      { kind: 'proposal', field: 'reason', control: '\u0085' },
      { kind: 'decision', field: 'reason', control: '\u009f' },
    ];
    for (const [index, item] of cases.entries()) {
      const entity = stableSnapshot[`${item.kind}s`][0];
      const altered = alterEntity(stableSnapshot, item.kind, entity[`${item.kind}_id`], item.field, `Texte inventé${item.control}invalide.`);
      const { sha256, ...content } = altered;
      assert.equal(sha256, digest(content));
      assert.throws(() => validateSnapshot(altered), error => error.code === 'invalid_text');
      writeFileSync(storePaths(invalidSource).snapshot, canonical(altered));
      const refusedTarget = `refused-control-${index}-${suffix}`;
      await assert.rejects(execFileAsync(process.execPath, [snapshotFile, 'restore', invalidSource, refusedTarget], { windowsHide: true }),
        error => error.stderr.includes('must be nonempty text'));
      assert.equal(existsSync(storePaths(refusedTarget).directory), false);
    }
  });

  await t.test('offline export and restoration are byte-identical; corruption and overwrites are refused', async () => {
    await service.stop();
    await execFileAsync(process.execPath, [snapshotFile, 'export', source], { windowsHide: true });
    const bytes = readFileSync(storePaths(source).snapshot, 'utf8');
    assert.equal(bytes, `${canonical(stableSnapshot)}\n`);
    await assert.rejects(execFileAsync(process.execPath, [snapshotFile, 'export', source], { windowsHide: true }));
    assert.equal(readFileSync(storePaths(source).snapshot, 'utf8'), bytes);
    await execFileAsync(process.execPath, [snapshotFile, 'restore', source, target], { windowsHide: true });
    await assert.rejects(execFileAsync(process.execPath, [snapshotFile, 'restore', source, target], { windowsHide: true }));
    mkdirSync(storePaths(badSource).directory, { recursive: true });
    const corrupted = structuredClone(stableSnapshot);
    corrupted.revisions[1].text = 'Corruption simulée, sans décision correspondante.';
    writeFileSync(storePaths(badSource).snapshot, canonical(corrupted));
    await assert.rejects(execFileAsync(process.execPath, [snapshotFile, 'restore', badSource, badTarget], { windowsHide: true }));
    assert.equal(existsSync(storePaths(badTarget).directory), false);
    const { sha256: ignoredHash, ...content } = corrupted;
    corrupted.sha256 = digest(content); // Correct hash is insufficient: relationships must also be valid.
    writeFileSync(storePaths(badSource).snapshot, canonical(corrupted));
    await assert.rejects(execFileAsync(process.execPath, [snapshotFile, 'restore', badSource, badTarget], { windowsHide: true }));
    assert.equal(existsSync(storePaths(badTarget).directory), false);
    const historical = structuredClone(stableSnapshot);
    historical.passage.data_kind = 'historical';
    historical.passage.simulation = false;
    const { sha256: oldHash, ...historicalContent } = historical;
    historical.sha256 = digest(historicalContent);
    writeFileSync(storePaths(badSource).snapshot, canonical(historical));
    await assert.rejects(execFileAsync(process.execPath, [snapshotFile, 'restore', badSource, badTarget], { windowsHide: true }));
    assert.equal(existsSync(storePaths(badTarget).directory), false);
    const newSecret = randomBytes(32).toString('hex');
    service = await startChild(target, newSecret);
    const restoredExport = await owner.call(service.url, '/v1/export', { token: newSecret });
    assert.deepEqual(restoredExport.body, stableSnapshot);
    const replay = await post(owner, '/v1/decisions', acceptance.body, acceptance.key, newSecret);
    assert.equal(replay.status, 200);
    assert.deepEqual(replay.body.decision, acceptance.decision);
    assert.equal((await owner.call(service.url, '/v1/export', { token: secret })).status, 403);
    await service.stop();
    await execFileAsync(process.execPath, [snapshotFile, 'export', target], { windowsHide: true });
    assert.equal(readFileSync(storePaths(target).snapshot, 'utf8'), bytes);
    t.diagnostic(`Synthetic runtime evidence retained in ignored stores ${source} and ${target}.`);
  });
});

test('local-only service fails closed before creating a store without its test owner secret', async () => {
  const name = `no-secret-${randomUUID()}`;
  await assert.rejects(startLocalService({ name, port: 0, ownerSecret: '' }), /local test secret/);
  assert.equal(existsSync(storePaths(name).directory), false);
});
