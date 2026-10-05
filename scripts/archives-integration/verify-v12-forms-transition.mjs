import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const record = resolve('.private/archives-integration/publication-wip-local-20261004-v1');
const before = await readFile(resolve(record, 'sixth-v11-full-p09-stopped-snapshot.json'));
const after = await readFile(resolve(record, 'seventh-v12-r2-p09-forms-initial-snapshot.json'));
const snapshot = JSON.parse(after), sha = b => createHash('sha256').update(b).digest('hex');
const checks = [];
for (const path of ['/archives/', '/archives/formes/p09/', '/archives/formes-brouillons/?query=souille&lot=&page=1&page_size=50', '/archives/next-readings/versions/p09-full-view-proposed/', '/api/archive/public/monbezon/health', '/ops/pnpm/bin/pnpm.mjs']) {
  const response = await fetch('http://127.0.0.1:8822' + path), bytes = Buffer.from(await response.arrayBuffer());
  const exact = path === '/archives/formes/p09/' ? sha(bytes) === '689366e18f7cbe2a1667b9e53d0653ce8a7923eb59a0d37cc107740a38c014b4' : !path.startsWith('/archives/formes-brouillons/') || bytes.toString('utf8').includes('P09 : quatre lectures à vérifier');
  checks.push({ path, status: response.status, expected: path.startsWith('/ops/') ? 404 : 200, exact_selected_content: exact });
}
const proof = {
  passed: before.equals(after) && after.length === 6260 && sha(after) === '6d489e4ce3f9704f396aa32a8ae77cd7874cb8f4e12f8fd737b5f297e715b9c6' && snapshot.revisions.length === 1 && snapshot.proposals.length === 1 && snapshot.decisions.length === 0 && checks.every(c => c.status === c.expected && c.exact_selected_content),
  checked_at_utc: new Date().toISOString(), candidate: 'publication-package-20261004-v12-r2',
  snapshot_byte_identical: before.equals(after), snapshot_size_bytes: after.length, snapshot_sha256: sha(after),
  counts: { revisions: snapshot.revisions.length, proposals: snapshot.proposals.length, decisions: snapshot.decisions.length },
  http_checks: checks, posts: 0, manuscript_photos_opened: 0, prior_readings_changed: false,
  four_unconfirmed_forms: true, confirmed_memory: false, browser_receipts: ['publication-p09-forms-browser-20261004-v1/verification.json (two accepted groups, final navigation failed)', 'publication-p09-forms-browser-20261004-v2/verification.json (corrected route passed)'], owner_enabled: false, hosted_publication_executed: false,
};
await writeFile(resolve(record, 'v12-r2-transition-verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(proof)); if (!proof.passed) process.exitCode = 1;
