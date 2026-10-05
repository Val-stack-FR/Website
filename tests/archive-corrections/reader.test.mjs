import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { loadReaderContext, READER_PACKAGE_ENV, BUNDLE_HASHES, MONBEZON_TEXT_ID } from '../../scripts/archive-corrections/reader-binding.mjs';
import { enrollOwner } from '../../scripts/archive-corrections/owner-auth.mjs';
import { startOwnerService, createLocalServer } from '../../scripts/archive-corrections/server.mjs';
import { storePaths } from '../../scripts/archive-corrections/runtime.mjs';
import { canonical } from '../../scripts/archive-corrections/contract.mjs';
import { exportToFile, restoreFromFile } from '../../scripts/archive-corrections/snapshot.mjs';
import { exportPortable } from '../../scripts/archive-corrections/portable.mjs';

const directory = process.env[READER_PACKAGE_ENV];
const skip = !directory && `Set ${READER_PACKAGE_ENV} to run the authorized private-package integration gate.`;
async function call(url, path, { method = 'GET', body, key, cookie, csrf } = {}) {
  const response = await fetch(`${url}${path}`, { method, headers: {
    Origin: url, ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(key ? { 'Idempotency-Key': key } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function login(url, passphrase) {
  const response = await call(url, '/v1/auth/login', { method: 'POST', body: { passphrase } });
  assert.equal(response.status, 200);
  return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: response.body.csrf_token };
}

test('reader UI routes: exact selected passage query and real unreviewed labels; unknown queries refused', { skip }, async t => {
  const context = loadReaderContext(directory);
  // Read-only route probe: no credential enrollment, database, login, proposal or decision.
  const server = createLocalServer({ store: { context, passage: context.passage }, ownerSessions: {} });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const exact = `/demo/?passage=${encodeURIComponent(context.passage.passage_id)}`;
  for (const path of ['/demo/', exact]) {
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Passage réel non relu · essai privé local/);
    assert.match(html, /décisions restent simulées/i);
    assert.equal(/Un seul passage entièrement inventé|Chargement du passage fictif|Révisions du texte fictif/.test(html), false);
    assert.equal(/relative_path|storage_uri/.test(html), false);
  }
  for (const path of ['/demo/?passage=unknown', '/demo/?passage=synthetic-mvp-d-001', exact + '&extra=1', '/demo/?passage=' + encodeURIComponent(context.passage.passage_id) + '&passage=unknown', '/demo/?passage=']) {
    assert.equal((await fetch(url + path)).status, 404, path);
  }
});

test('reader binding refuses unknown selection and any changed pinned derivative before import', { skip }, () => {
  const target = storePaths(`binding-test-${randomUUID()}`).directory;
  mkdirSync(target, { recursive: true });
  for (const filename of Object.keys(BUNDLE_HASHES)) copyFileSync(join(directory, filename), join(target, filename));
  const valid = loadReaderContext(target);
  assert.equal(valid.passage.passage_id, MONBEZON_TEXT_ID);
  assert.equal(valid.passage.act_id, null);
  assert.equal(valid.passage.document_id, null);
  assert.equal(valid.passage.reading_status, 'unreviewed');
  assert.equal(valid.passage.linked_view_ids.length, 2);
  assert.equal(valid.passage.link_review_scope, 'digital-object-association-only');
  assert.throws(() => loadReaderContext(target, 'text:unlinked-e108'), error => error.code === 'reader_binding_refused');
  for (const filename of Object.keys(BUNDLE_HASHES)) {
    const path = join(target, filename);
    const bytes = readFileSync(path);
    writeFileSync(path, Buffer.concat([bytes, Buffer.from('\n')]));
    assert.throws(() => loadReaderContext(target), error => error.code === 'reader_binding_refused');
    writeFileSync(path, bytes);
  }
  const encoded = canonical(valid);
  assert.equal(/relative_path|storage_uri|corpus\/|PHD_CORPUS_ROOT|Transcription\/A ENVOYER/.test(encoded), false);
});

test('private Monbezon passage: session decisions, conflict, abrupt restart, exact restore and portable exports', { skip }, async t => {
  const context = loadReaderContext(directory);
  const suffix = randomUUID();
  const name = `reader-test-${suffix}`;
  const target = `reader-restored-${suffix}`;
  const passphrase = randomBytes(32).toString('hex');
  await enrollOwner(name, passphrase);
  const file = fileURLToPath(new URL('../../scripts/archive-corrections/reader-session.mjs', import.meta.url));
  let child;
  let restored;
  const stop = async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit'); child.kill('SIGKILL'); await exit;
    }
  };
  t.after(async () => {
    await stop();
    if (restored) {
      await new Promise(resolve => { restored.server.close(resolve); restored.server.closeIdleConnections(); });
      restored.store.close();
    }
  });
  const start = async () => {
    child = spawn(process.execPath, [file, 'serve', name, '0'], { env: { ...process.env, [READER_PACKAGE_ENV]: directory }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error('Reader readiness timed out.')); }, 10000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Private reader exited before readiness.')); });
      child.stdout.on('data', bytes => {
        stdout += bytes;
        if (stdout.includes('\n')) {
          clearTimeout(timer);
          assert.equal(stdout.includes(passphrase) || stdout.includes(directory), false);
          resolve(JSON.parse(stdout.split('\n')[0]).url);
        }
      });
    });
  };
  let url = await start();
  const path = `/v1/passages/${encodeURIComponent(context.passage.passage_id)}`;
  const initial = await call(url, path);
  assert.equal(initial.status, 200);
  assert.deepEqual(initial.body.current_revision, context.initialRevision);
  assert.equal(initial.body.data_kind, 'historical-local');
  assert.equal(initial.body.passage.translation, null);
  assert.equal((await call(url, '/v1/passages/synthetic-mvp-d-001')).status, 404);
  const owner = await login(url, passphrase);
  const propose = replacement_text => ({ passage_id: context.passage.passage_id, base_revision: context.initialRevision.text_revision,
    replacement_text, reason: 'Variante technique de simulation, sans relecture humaine.', evidence_refs: context.passage.evidence_refs, simulation: true });
  const firstPayload = propose('<script>Texte inerte de test</script>');
  const first = (await call(url, '/v1/proposals', { method: 'POST', body: firstPayload, key: 'reader-proposal-first' })).body.proposal;
  const second = (await call(url, '/v1/proposals', { method: 'POST', body: propose('Deuxième variante technique.'), key: 'reader-proposal-second' })).body.proposal;
  assert.equal((await call(url, '/v1/owner/history')).status, 403);
  assert.equal(Object.hasOwn((await call(url, path)).body, 'proposals'), false);
  const decision = proposal => ({ proposal_id: proposal.proposal_id, base_revision: proposal.base_revision,
    outcome: 'accept', reason: 'Acceptation de simulation locale uniquement.', evidence_refs: proposal.evidence_refs, simulation: true });
  const results = await Promise.all([first, second].map((proposal, index) => call(url, '/v1/decisions', {
    method: 'POST', body: decision(proposal), key: `reader-decision-${index}`, ...owner,
  })));
  assert.deepEqual(results.map(item => item.status).sort(), [201, 409]);
  const accepted = results.find(item => item.status === 201).body.decision;
  assert.equal(accepted.actor_role, 'owner_local');
  assert.equal(accepted.simulation, true);
  const before = (await call(url, '/v1/export', owner)).body;
  assert.equal(before.passage.reading_status, 'unreviewed');
  assert.equal(before.passage.publication_status, 'not-published');
  assert.equal(/owner-auth|verifier|relative_path|storage_uri/.test(canonical(before)), false);
  await stop();
  url = await start();
  assert.equal((await call(url, '/v1/export', owner)).status, 403);
  const renewed = await login(url, passphrase);
  assert.deepEqual((await call(url, '/v1/export', renewed)).body, before);
  const replay = await call(url, '/v1/proposals', { method: 'POST', body: firstPayload, key: 'reader-proposal-first' });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.proposal.proposal_id, first.proposal_id);
  await stop();
  exportToFile(name, context);
  restoreFromFile(name, target, context);
  assert.equal(existsSync(storePaths(target).credential), false, 'Restoring editorial history does not restore owner credentials.');
  await enrollOwner(target, randomBytes(32).toString('hex'));
  restored = await startOwnerService({ name: target, port: 0, context });
  assert.deepEqual(restored.store.exportSnapshot(), before);
  exportToFile(target, context);
  assert.equal(readFileSync(storePaths(name).snapshot, 'utf8'), readFileSync(storePaths(target).snapshot, 'utf8'));
  assert.equal(exportPortable(name, context).revisions, 2);
  assert.equal(exportPortable(target, context).revisions, 2);
  for (const filename of ['revisions.jsonl', 'revisions.csv']) {
    const sourceBytes = readFileSync(join(storePaths(name).directory, filename), 'utf8');
    assert.equal(sourceBytes, readFileSync(join(storePaths(target).directory, filename), 'utf8'));
    assert.equal(sourceBytes.includes(passphrase) || /proposal_|reason|relative_path|storage_uri/.test(sourceBytes), false);
  }
  assert.throws(() => exportPortable(name, context), error => error.code === 'export_exists');
  t.diagnostic(`Private local evidence retained in ${name} and ${target}; no original or canonical corpus written.`);
});
