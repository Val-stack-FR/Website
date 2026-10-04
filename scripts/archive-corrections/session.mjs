import { pathToFileURL } from 'node:url';
import { startOwnerService } from './server.mjs';
import { ApiError, canonical, ensure, envelope } from './contract.mjs';

async function main() {
  const [name, portValue = '8789', ...extra] = process.argv.slice(2);
  ensure(name && extra.length === 0 && /^\d{1,5}$/.test(portValue),
    422, 'usage', 'Usage: node session.mjs ENROLLED-STORE [port]');
  const service = await startOwnerService({ name, port: Number(portValue) });
  process.stdout.write(`${canonical(envelope({ url: service.url, auth_mode: 'local_owner_session', identity_verified: false }))}\n`);
  const close = () => {
    service.server.close(() => { service.store.close(); process.exit(0); });
    service.server.closeIdleConnections();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof ApiError ? error.message : 'Local owner service could not start.'}\n`);
    process.exitCode = 1;
  });
}
