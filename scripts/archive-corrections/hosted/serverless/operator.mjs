import { readFileSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ServerlessStore } from './store.mjs';
import { enrollSharedOwner, PHRASE_ENV } from './sessions.mjs';
import { createNetworkDriver } from './network.mjs';
import { validateSnapshot } from '../../snapshot-validation.mjs';
import { ApiError, canonical, ensure } from '../../contract.mjs';

export async function operatorStore(env = process.env) {
  const store = new ServerlessStore(undefined, { schema: env.ARCHIVE_CORRECTIONS_SCHEMA });
  const engine = env.ARCHIVE_CORRECTIONS_OPERATOR_ENGINE ?? 'postgres';
  ensure(['postgres', 'pglite'].includes(engine), 422, 'invalid_engine', 'Use postgres or the explicit offline PGlite test engine.');
  if (engine === 'pglite') {
    const { pgliteDriver } = await import('../drivers.mjs');
    store.driver = await pgliteDriver(env.ARCHIVE_CORRECTIONS_OPERATOR_PGLITE_DIRECTORY);
  } else store.driver = createNetworkDriver(env.ARCHIVE_CORRECTIONS_OPERATOR_DATABASE_URL, { attach: () => {} });
  return store;
}

async function main() {
  const [command, file, ...extra] = process.argv.slice(2);
  ensure(['migrate', 'seed', 'enroll', 'rotate', 'export', 'restore'].includes(command) && extra.length === 0
    && (['export', 'restore'].includes(command) ? typeof file === 'string' && isAbsolute(file) : file === undefined),
  422, 'usage', 'Usage: operator.mjs migrate|seed|enroll|rotate|export NEW-PRIVATE-ABSOLUTE-FILE|restore PRIVATE-ABSOLUTE-FILE');
  let snapshot;
  if (command === 'export') ensure(!existsSync(file), 409, 'export_exists', 'A new private export file is required.');
  if (command === 'restore') {
    ensure(existsSync(file) && lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink() && lstatSync(file).size <= 2 * 1024 * 1024,
      422, 'invalid_snapshot', 'Use a private regular snapshot file of at most 2 MiB.');
    snapshot = JSON.parse(readFileSync(file, 'utf8')); validateSnapshot(snapshot);
  }
  const passphrase = process.env[PHRASE_ENV]; delete process.env[PHRASE_ENV];
  const store = await operatorStore();
  try {
    let result;
    if (command === 'migrate') result = await store.migrate();
    else if (command === 'seed') { await store.initialize(); result = { seeded: true, passage_id: store.passage.passage_id }; }
    else if (['enroll', 'rotate'].includes(command)) result = await enrollSharedOwner(store, passphrase, { rotate: command === 'rotate' });
    else if (command === 'restore') { await store.restore(snapshot); result = { restored: true, snapshot_sha256: snapshot.sha256 }; }
    else {
      await store.initialize({ seed: false }); snapshot = await store.exportSnapshot();
      const bytes = canonical(snapshot) + '\n';
      ensure(Buffer.byteLength(bytes) <= 2 * 1024 * 1024, 422, 'snapshot_too_large', 'The export exceeds this pilot restore limit.');
      writeFileSync(file, bytes, { flag: 'wx', mode: 0o600, flush: true });
      result = { exported: true, snapshot_sha256: snapshot.sha256 };
    }
    process.stdout.write(canonical({ ...result, simulation: true, identity_verified: false }) + '\n');
  } finally { await store.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { process.stderr.write((error instanceof ApiError ? error.message : 'Offline D5 command failed; inspect configuration privately.') + '\n'); process.exitCode = 1; });
}
