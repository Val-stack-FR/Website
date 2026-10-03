import { existsSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Store, restoreSnapshot } from './store.mjs';
import { storePaths } from './runtime.mjs';
import { ApiError, canonical, ensure } from './contract.mjs';

export function exportToFile(name) {
  const paths = storePaths(name);
  ensure(existsSync(paths.database), 404, 'store_not_found', 'Source store does not exist.');
  const store = new Store(name, { readOnly: true });
  try {
    const snapshot = store.exportSnapshot();
    writeFileSync(paths.snapshot, `${canonical(snapshot)}\n`, { flag: 'wx', mode: 0o600 });
    return snapshot.sha256;
  } finally { store.close(); }
}

export function restoreFromFile(sourceName, targetName) {
  const paths = storePaths(sourceName);
  ensure(existsSync(paths.snapshot) && statSync(paths.snapshot).size <= 2 * 1024 * 1024,
    422, 'invalid_snapshot', 'Source export.json must exist and be at most 2 MiB.');
  const snapshot = JSON.parse(readFileSync(paths.snapshot, 'utf8'));
  restoreSnapshot(targetName, snapshot);
  return snapshot.sha256;
}

function main() {
  const [command, name, target, ...extra] = process.argv.slice(2);
  ensure(extra.length === 0 && name && (command === 'export' ? !target : command === 'restore' && target),
    422, 'usage', 'Usage: node snapshot.mjs export SOURCE | restore SOURCE NEW-TARGET');
  const sha256 = command === 'export' ? exportToFile(name) : restoreFromFile(name, target);
  process.stdout.write(`${canonical({ snapshot_sha256: sha256, simulation: true, command })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); }
  catch (error) {
    process.stderr.write(`${error instanceof ApiError ? error.message : 'Snapshot command failed; an existing file is never overwritten.'}\n`);
    process.exitCode = 1;
  }
}
