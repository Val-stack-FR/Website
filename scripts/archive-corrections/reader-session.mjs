import { pathToFileURL } from 'node:url';
import { startOwnerService } from './server.mjs';
import { loadReaderContext, READER_PACKAGE_ENV } from './reader-binding.mjs';
import { exportToFile, restoreFromFile } from './snapshot.mjs';
import { ApiError, canonical, ensure, envelope } from './contract.mjs';

async function main() {
  const [command, name, argument, ...extra] = process.argv.slice(2);
  ensure(['serve', 'export', 'restore'].includes(command) && name && extra.length === 0,
    422, 'usage', 'Usage: node reader-session.mjs serve STORE [port] | export STORE | restore SOURCE NEW-TARGET');
  const context = loadReaderContext(process.env[READER_PACKAGE_ENV]);
  if (command !== 'serve') {
    ensure(command === 'restore' ? Boolean(argument) : !argument, 422, 'usage', 'Export takes one store; restore takes two.');
    const sha256 = command === 'export' ? exportToFile(name, context) : restoreFromFile(name, argument, context);
    process.stdout.write(`${canonical({ snapshot_sha256: sha256, simulation: true, publication_status: 'not-published' })}\n`);
    return;
  }
  ensure(/^\d{1,5}$/.test(argument ?? '8789'), 422, 'invalid_port', 'Port must be a number.');
  const service = await startOwnerService({ name, port: Number(argument ?? '8789'), context });
  process.stdout.write(`${canonical(envelope({ url: service.url, auth_mode: 'local_owner_session', identity_verified: false, passage_id: context.passage.passage_id }, context))}\n`);
  const close = () => {
    service.server.close(() => { service.store.close(); process.exit(0); });
    service.server.closeIdleConnections();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof ApiError ? error.message : 'Private reader service could not start.'}\n`);
    process.exitCode = 1;
  });
}
