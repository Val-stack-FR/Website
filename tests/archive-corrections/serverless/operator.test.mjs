import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pgliteDriver } from '../../../scripts/archive-corrections/hosted/drivers.mjs';
import { ServerlessStore } from '../../../scripts/archive-corrections/hosted/serverless/store.mjs';
import { SharedSessions } from '../../../scripts/archive-corrections/hosted/serverless/sessions.mjs';
import { storePaths } from '../../../scripts/archive-corrections/runtime.mjs';
import { canonical } from '../../../scripts/archive-corrections/contract.mjs';
import { prepareOverlay } from '../../../scripts/archive-corrections/hosted/serverless/prepare-overlay.mjs';

const operator = fileURLToPath(new URL('../../../scripts/archive-corrections/hosted/serverless/operator.mjs', import.meta.url));
async function run(args, env) {
  const child = spawn(process.execPath, [operator, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  let stdout = '', stderr = '';
  child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
  const timer = setTimeout(() => child.kill(), 20000);
  const [code] = await once(child, 'exit'); clearTimeout(timer);
  return { code, stdout, stderr };
}

test('D5 operator runs migration, seed, offline enrollment/recovery and exact export/restore without auth filesystem', async t => {
  const name = `d5-operator-${randomUUID()}`;
  const directory = storePaths(name, true).directory;
  const dataDir = join(directory, 'pgdata');
  const passphrase = randomBytes(32).toString('hex'); const replacement = randomBytes(32).toString('hex');
  const env = { ARCHIVE_CORRECTIONS_OPERATOR_ENGINE: 'pglite', ARCHIVE_CORRECTIONS_OPERATOR_PGLITE_DIRECTORY: dataDir,
    ARCHIVE_CORRECTIONS_OWNER_PASSPHRASE: passphrase };
  const results = [];
  for (const command of ['migrate', 'seed', 'enroll']) {
    const result = await run([command], env); results.push(result); assert.equal(result.code, 0);
  }
  let driver = await pgliteDriver(dataDir); let store = new ServerlessStore(driver);
  const sessions = new SharedSessions(store, randomBytes(32).toString('hex'));
  const loggedIn = await sessions.login({ passphrase });
  await store.mutate('proposal', 'd5-operator-proposal', { passage_id: store.passage.passage_id,
    base_revision: store.context.initialRevision.text_revision, replacement_text: 'Sauvegarde opérateur fictive D5.', reason: 'Test CLI fictif.',
    evidence_refs: store.passage.evidence_refs, simulation: true });
  await store.close();
  const rotated = await run(['rotate'], { ...env, ARCHIVE_CORRECTIONS_OWNER_PASSPHRASE: replacement });
  results.push(rotated); assert.equal(rotated.code, 0);
  driver = await pgliteDriver(dataDir); store = new ServerlessStore(driver);
  const after = new SharedSessions(store, sessions.key);
  assert.equal((await after.session({ headers: { cookie: sessions.cookie(loggedIn.token).split(';')[0] } })).authenticated, false);
  await assert.rejects(after.login({ passphrase }), error => error.code === 'invalid_credential');
  assert.equal((await after.login({ passphrase: replacement })).authenticated, true);
  const before = await store.exportSnapshot(); await store.close();
  const exported = join(directory, 'export.json');
  const result = await run(['export', exported], env); results.push(result); assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(readFileSync(exported, 'utf8')), before);
  assert.equal(existsSync(join(directory, 'owner-auth.json')) || existsSync(join(directory, 'auth')), false);

  const target = join(directory, 'restored-pgdata');
  const targetEnv = { ...env, ARCHIVE_CORRECTIONS_OPERATOR_PGLITE_DIRECTORY: target };
  assert.equal((await run(['migrate'], targetEnv)).code, 0);
  assert.equal((await run(['restore', exported], targetEnv)).code, 0);
  const restored = join(directory, 'restored.json');
  assert.equal((await run(['export', restored], targetEnv)).code, 0);
  assert.equal(readFileSync(exported, 'utf8'), readFileSync(restored, 'utf8'));
  assert.equal((await run(['export', exported], env)).code, 1);
  const invalid = join(directory, 'invalid.json'); writeFileSync(invalid, canonical({ ...before, sha256: '0'.repeat(64) }), { flag: 'wx' });
  const unopened = join(directory, 'unopened-pgdata');
  assert.equal((await run(['restore', invalid], { ...env, ARCHIVE_CORRECTIONS_OPERATOR_PGLITE_DIRECTORY: unopened })).code, 1);
  assert.equal(existsSync(unopened), false);
  const output = results.map(value => value.stdout + value.stderr).join('\n');
  assert.equal([passphrase, replacement, dataDir].some(value => output.includes(value)), false);
  const sha = createHash('sha256').update(readFileSync(exported)).digest('hex');
  t.diagnostic(`D5 offline CLI migration/seed/enroll/rotate/export/restore executed in ${name}; identical private export SHA ${sha}; no real owner/account or persistent auth file.`);
});

test('private integration overlay has ten explicit function entries and never changes the site or includes secrets', () => {
  const result = prepareOverlay(); assert.equal(result.functions, 10); assert.equal(result.deployed, false);
  const target = join(storePaths('unused').directory, '..', result.directory);
  const manifest = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'));
  assert.equal(manifest.original_site_modified, false); assert.equal(manifest.secrets_included, false);
  for (const file of manifest.function_files) {
    const bytes = readFileSync(join(target, file), 'utf8');
    assert.match(bytes, /^export \{ default \} from '\.\.\//);
    assert.equal(bytes.includes('serverless/function.mjs'), true);
  }
});
