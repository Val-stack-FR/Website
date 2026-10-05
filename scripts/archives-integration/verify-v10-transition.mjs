import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const record = resolve('.private/archives-integration/publication-wip-local-20261004-v1');
const before = await readFile(resolve(record, 'fourth-v8-map-stopped-snapshot.json'));
const after = await readFile(resolve(record, 'fifth-v10-p09-pilot-initial-snapshot.json'));
const snapshot = JSON.parse(after);
const sha = b => createHash('sha256').update(b).digest('hex');
const checks = [];
for (const path of ['/archives/', '/archives/next-readings/versions/next-reading-p09-author-pilot/', '/archives/cartes/extrait/', '/api/archive/public/monbezon/health', '/ops/provision-archive-runtime.mjs', '/ops/pnpm/bin/pnpm.mjs', '/runtime/archives/selected-data.json']) {
  const response = await fetch('http://127.0.0.1:8822' + path);
  await response.arrayBuffer();
  checks.push({ path, status: response.status, expected: path.startsWith('/ops/') || path.startsWith('/runtime/') ? 404 : 200 });
}
const photo = await fetch('http://127.0.0.1:8822/archives/next-readings/media/2a7b6be96cff6891a061152cf4e8f25d8a010a1a8697f8d6cc57b2ba76a98c34.jpg', { method: 'HEAD' });
checks.push({ method: 'HEAD', path: 'new P09 derivative only', status: photo.status, expected: 200 });
const proof = {
  passed: before.equals(after) && after.length === 6260 && sha(after) === '6d489e4ce3f9704f396aa32a8ae77cd7874cb8f4e12f8fd737b5f297e715b9c6' && snapshot.revisions.length === 1 && snapshot.proposals.length === 1 && snapshot.decisions.length === 0 && checks.every(x => x.status === x.expected),
  checked_at_utc: new Date().toISOString(), candidate: 'publication-package-20261004-v10',
  snapshot_byte_identical: before.equals(after), snapshot_size_bytes: after.length, snapshot_sha256: sha(after),
  counts: { revisions: snapshot.revisions.length, proposals: snapshot.proposals.length, decisions: snapshot.decisions.length },
  http_checks: checks, posts: 0, old_photo_browser_tests_repeated: false,
  historical_reading_changed: false, new_reading: 'P09 six-line author draft with frozen independent and earlier versions',
  mobile_browser_receipt: 'publication-next-reading-browser-20261004-v2/verification.json',
  hosted_build_executed: false, owner_enabled: false,
};
await writeFile(resolve(record, 'v10-transition-verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(proof));
if (!proof.passed) process.exitCode = 1;
