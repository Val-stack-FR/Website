import { pathToFileURL } from 'node:url';
import { isAbsolute } from 'node:path';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { ApiError, canonical, ensure, envelope } from '../contract.mjs';
import { OwnerSessions, enrollOwner, PASSPHRASE_ENV } from '../owner-auth.mjs';
import { createLocalServer } from '../server.mjs';
import { PostgresStore, DEFAULT_SCHEMA } from './postgres-store.mjs';
import { postgresDriver, pgliteDriver } from './drivers.mjs';
import { validateSnapshot } from '../snapshot-validation.mjs';

export const AUTH_ROOT_ENV = 'ARCHIVE_CORRECTIONS_AUTH_ROOT';
export const ORIGIN_ENV = 'ARCHIVE_CORRECTIONS_PUBLIC_ORIGIN';
export const ENGINE_ENV = 'ARCHIVE_CORRECTIONS_ENGINE';
export const PGLITE_ENV = 'ARCHIVE_CORRECTIONS_PGLITE_DIRECTORY';
export const OWNER_NAME = 'hosted-owner';

function requireOrigin(origin) {
  ensure(typeof origin === 'string' && origin.length > 0, 422, 'https_configuration_required', `Set ${ORIGIN_ENV} to the exact HTTPS origin.`);
}

export function authRoot(value) {
  ensure(typeof value === 'string' && isAbsolute(value) && existsSync(value)
    && lstatSync(value).isDirectory() && !lstatSync(value).isSymbolicLink(),
  422, 'auth_root_required', `Set ${AUTH_ROOT_ENV} to a real private mounted directory.`);
  return value;
}

export async function configuredStore(env = process.env) {
  const engine = env[ENGINE_ENV] ?? 'postgres';
  ensure(['postgres', 'pglite'].includes(engine), 422, 'invalid_engine', 'Select postgres or the explicit local pglite fallback.');
  const schema = env.ARCHIVE_CORRECTIONS_SCHEMA ?? DEFAULT_SCHEMA;
  // Validate schema before opening a database.
  const store = new PostgresStore(undefined, { schema });
  store.driver = engine === 'postgres' ? await postgresDriver(env.ARCHIVE_CORRECTIONS_DATABASE_URL) : await pgliteDriver(env[PGLITE_ENV]);
  return store;
}

export async function startHostedService({ store, credentialRoot, origin, port = 8791, sessionOptions = {}, proposalLimit } = {}) {
  requireOrigin(origin);
  ensure(Number.isInteger(port) && port >= 0 && port <= 65535, 422, 'invalid_port', 'Invalid service port.');
  const ownerSessions = new OwnerSessions(OWNER_NAME, { ...sessionOptions, credentialRoot: authRoot(credentialRoot), secure: true });
  const server = createLocalServer({ store, ownerSessions, httpsProxyOrigin: origin, proposalLimit });
  // Migration is offline; startup never installs/upgrades schema and refuses mismatches.
  await store.initialize();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { store, server, ownerSessions, origin, url: `http://127.0.0.1:${server.address().port}` };
}

async function main() {
  const [command, argument, ...extra] = process.argv.slice(2);
  ensure(['enroll', 'rotate', 'migrate', 'serve', 'export', 'restore'].includes(command) && extra.length === 0
    && (['export', 'restore'].includes(command) ? argument : command === 'serve' ? !argument || /^\d{1,5}$/.test(argument) : !argument),
  422, 'usage', 'Usage: service.mjs enroll|rotate|migrate|serve [port]|export NEW-FILE|restore FILE');
  if (['enroll', 'rotate'].includes(command)) {
    const passphrase = process.env[PASSPHRASE_ENV]; delete process.env[PASSPHRASE_ENV];
    const result = await enrollOwner(OWNER_NAME, passphrase, { rotate: command === 'rotate', credentialRoot: authRoot(process.env[AUTH_ROOT_ENV]) });
    process.stdout.write(`${canonical(result)}\n`); return;
  }
  if (command === 'export') ensure(isAbsolute(argument) && !existsSync(argument), 409, 'export_exists', 'Export requires a new absolute private file.');
  let snapshot;
  if (command === 'restore') {
    ensure(isAbsolute(argument) && lstatSync(argument).isFile() && !lstatSync(argument).isSymbolicLink()
      && lstatSync(argument).size <= 2 * 1024 * 1024, 422, 'invalid_snapshot', 'Restore requires a private regular snapshot file of at most 2 MiB.');
    snapshot = JSON.parse(readFileSync(argument, 'utf8'));
    validateSnapshot(snapshot); // Before opening/creating a target engine directory.
  }
  // Validate origin/auth enrollment before opening the engine in serve mode.
  if (command === 'serve') {
    requireOrigin(process.env[ORIGIN_ENV]);
    const root = authRoot(process.env[AUTH_ROOT_ENV]);
    const sessions = new OwnerSessions(OWNER_NAME, { credentialRoot: root, secure: true });
    createLocalServer({ store: {}, ownerSessions: sessions, httpsProxyOrigin: process.env[ORIGIN_ENV] });
  }
  const store = await configuredStore();
  let serving = false;
  try {
    if (command === 'migrate') process.stdout.write(`${canonical(await store.migrate())}\n`);
    else if (command === 'restore') {
      await store.restore(snapshot);
      process.stdout.write(`${canonical({ restored: true, snapshot_sha256: snapshot.sha256, simulation: true })}\n`);
    } else if (command === 'export') {
      await store.initialize({ seed: false });
      const content = await store.exportSnapshot();
      const bytes = `${canonical(content)}\n`;
      ensure(Buffer.byteLength(bytes) <= 2 * 1024 * 1024, 422, 'snapshot_too_large', 'This pilot snapshot exceeds its 2 MiB restore limit; extend the format before writing a backup.');
      writeFileSync(argument, bytes, { flag: 'wx', mode: 0o600, flush: true });
      process.stdout.write(`${canonical({ exported: true, snapshot_sha256: content.sha256, simulation: true })}\n`);
    } else {
      const service = await startHostedService({ store, credentialRoot: process.env[AUTH_ROOT_ENV], origin: process.env[ORIGIN_ENV], port: Number(argument ?? '8791') });
      serving = true;
      process.stdout.write(`${canonical(envelope({ url: service.url, public_origin: service.origin,
        engine: process.env[ENGINE_ENV] ?? 'postgres', identity_verified: false, hosted_verified: false }))}\n`);
      const close = () => {
        service.server.close(async () => { await store.close(); process.exit(0); });
        service.server.closeIdleConnections();
      };
      process.once('SIGINT', close); process.once('SIGTERM', close);
    }
  } finally { if (!serving) await store.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof ApiError ? error.message : 'Hosted pilot failed; inspect configuration privately. No secret or SQL details are printed.'}\n`);
    process.exitCode = 1;
  });
}
