import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const record = resolve('.private/archives-integration/publication-wip-local-20261004-v1');
const before = await readFile(resolve(record, 'fifth-v10-p09-pilot-stopped-snapshot.json'));
const after = await readFile(resolve(record, 'sixth-v11-full-p09-initial-snapshot.json'));
const snapshot = JSON.parse(after), sha = b => createHash('sha256').update(b).digest('hex');
const checks = [];
for (const path of ['/archives/', '/archives/next-readings/versions/p09-full-view-proposed/', '/archives/next-readings/versions/next-reading-p09-author-pilot/', '/archives/cartes/extrait/', '/api/archive/public/monbezon/health', '/ops/pnpm/bin/pnpm.mjs', '/runtime/archives/selected-data.json']) {
  const response = await fetch('http://127.0.0.1:8822' + path); await response.arrayBuffer();
  checks.push({ path, status: response.status, expected: path.startsWith('/ops/') || path.startsWith('/runtime/') ? 404 : 200 });
}
const proof = {
  passed: before.equals(after) && after.length === 6260 && sha(after) === '6d489e4ce3f9704f396aa32a8ae77cd7874cb8f4e12f8fd737b5f297e715b9c6' && snapshot.revisions.length === 1 && snapshot.proposals.length === 1 && snapshot.decisions.length === 0 && checks.every(x => x.status === x.expected),
  checked_at_utc: new Date().toISOString(), candidate: 'publication-package-20261004-v11',
  snapshot_byte_identical: before.equals(after), snapshot_size_bytes: after.length, snapshot_sha256: sha(after),
  counts: { revisions: snapshot.revisions.length, proposals: snapshot.proposals.length, decisions: snapshot.decisions.length },
  http_checks: checks, posts: 0, manuscript_photos_opened: 0,
  prior_frozen_readings_changed: false, new_reading: '21-line unconfirmed P09 comparison edition with ten preserved editions',
  mobile_browser_receipt: 'publication-full-reading-browser-20261004-v1/verification.json',
  hosted_build_executed: false, owner_enabled: false,
};
await writeFile(resolve(record, 'v11-transition-verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(proof)); if (!proof.passed) process.exitCode = 1;
