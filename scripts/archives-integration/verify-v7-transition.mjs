import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const record = resolve('.private/archives-integration/publication-wip-local-20261004-v1');
const before = await readFile(resolve(record, 'second-stopped-snapshot.json'));
const after = await readFile(resolve(record, 'third-v7-prepared-initial-snapshot.json'));
const snapshot = JSON.parse(after);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = [
  '/archives/', '/archives/recherche/', '/api/archive/public/monbezon/health',
  '/api/archive/public/monbezon/passage?passage_id=text%3Aatelier-494756c2009be577ad11a5eb0a662d38',
  '/runtime/archives/selected-data.json', '/ops/provision-archive-runtime.mjs',
];
const checks = [];
for (const path of paths) {
  const response = await fetch('http://127.0.0.1:8822' + path);
  await response.arrayBuffer();
  checks.push({ path, status: response.status, expected: path.startsWith('/runtime/') || path.startsWith('/ops/') ? 404 : 200 });
}
const proof = {
  passed: before.equals(after) && snapshot.revisions.length === 1 && snapshot.proposals.length === 1 && snapshot.decisions.length === 0 && checks.every(item => item.status === item.expected),
  checked_at_utc: new Date().toISOString(),
  candidate: 'publication-package-20261004-v7',
  snapshot_byte_identical: before.equals(after), snapshot_size_bytes: after.length,
  snapshot_sha256: sha(after),
  counts: { revisions: snapshot.revisions.length, proposals: snapshot.proposals.length, decisions: snapshot.decisions.length },
  http_checks: checks,
  posts: 0, historical_reading_changed: false, old_photo_browser_tests_repeated: false,
  hosted_build_executed: false, pnpm_hosting_resolution_review_pending: true,
};
await writeFile(resolve(record, 'v7-transition-verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(proof));
if (!proof.passed) process.exitCode = 1;
