import { pathToFileURL } from 'node:url';
import { enrollOwner, PASSPHRASE_ENV } from './owner-auth.mjs';
import { ApiError, canonical, ensure } from './contract.mjs';

async function main() {
  const [command, name, ...extra] = process.argv.slice(2);
  ensure(['enroll', 'rotate'].includes(command) && name && extra.length === 0,
    422, 'usage', 'Usage: node owner.mjs enroll|rotate STORE (passphrase from environment only)');
  const passphrase = process.env[PASSPHRASE_ENV];
  delete process.env[PASSPHRASE_ENV];
  const result = await enrollOwner(name, passphrase, { rotate: command === 'rotate' });
  process.stdout.write(`${canonical(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof ApiError ? error.message : 'Owner credential command failed.'}\n`);
    process.exitCode = 1;
  });
}
