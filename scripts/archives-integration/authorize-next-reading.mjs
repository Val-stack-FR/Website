import { readFile, writeFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const base = resolve('.private/archives-integration');
const output = resolve(base, 'phase1-qualification-20261004-v1.json');
try { await lstat(output); throw new Error('Immutable qualification already exists.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const inputs = {
  candidate: resolve(base, 'publication-package-20261004-v6/assembly.json'),
  local_browser: resolve(base, 'publication-wip-browser-20261004-v3/verification.json'),
  persistence: resolve(base, 'publication-wip-local-20261004-v1/restart-verification.json'),
  local_review: resolve(base, 'publication-wip-review-20261004-v1/verification.json'),
  hosting_denial_review: resolve(base, 'publication-hosting-review-20261004-v6/verification.json'),
  dependencies: resolve('../Website-archives-corrections/.archive-corrections-private/d12-offline-trusted-lock-5fbebf07-18b7-41be-a979-7c74191de9ac/closeout-state.json'),
  dependency_manifest: resolve('../Website-archives-corrections/.archive-corrections-private/d12-offline-trusted-lock-5fbebf07-18b7-41be-a979-7c74191de9ac/run-manifest.json'),
  p09_review: resolve('../PHD-Maine-archives-import/data/private/coordinator-review/e99-queue-p09-20261004-v1/verification.json'),
  p08_review: resolve('../PHD-Maine-archives-import/data/private/coordinator-review/e99-p08-xmp-orientation8-20261004-v1/verification.json'),
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = {}, parsed = {};
for (const [key, path] of Object.entries(inputs)) {
  const bytes = await readFile(path);
  pins[key] = { path, size_bytes: bytes.length, sha256: sha(bytes) };
  parsed[key] = JSON.parse(bytes);
}
if (!parsed.local_browser.passed || !parsed.persistence.passed || !parsed.dependencies.installer_success || !parsed.dependencies.cold_start_passed || parsed.candidate.counts.direct_api_functions !== 12 || parsed.candidate.public_activation_executed !== false) throw new Error('Local phase-one qualification conditions missing.');
const receipt = {
  format: 'archives-local-phase1-reading-authorization/1',
  created_at_utc: new Date().toISOString(),
  coordinator_thread_id: '01a1014a-ab31-7f43-ad02-769487ace70f',
  core_closed: true,
  candidate_closed: true,
  private_reading_authorized: true,
  qualification_scope: 'Local integrated consultation and correction persistence; concrete selected publication candidate v6 prepared and reviewed. Not an executed hosted deployment.',
  source_authority: 'Val: autonomous overnight integration, then pertinent Tucé readings when the local milestone is qualified; CLEAN scope and small pilots.',
  pins,
  live_candidate_origin: 'http://127.0.0.1:8822',
  live_candidate_version_at_receipt: 'v4',
  prepared_candidate_version: 'v6',
  dependency_offline_install: 'D12 closed author evidence: exit0, 39 reused packages, zero network; provisioning operator delta review pending separately.',
  candidate_future_increment: 'Root is adding the prepared dependency installation operator in a new immutable candidate. This does not assert a production build.',
  first_reading: {
    source_object_id: 'object:path-bb85ab737e3b2ef749a76d8b40636202af7b27fd9dea1feace413fc36f43670b',
    derivative_sha256: '2a7b6be96cff6891a061152cf4e8f25d8a010a1a8697f8d6cc57b2ba76a98c34',
    max_contiguous_lines: 6,
    author_must_freeze_before_comparison: true,
    independent_reader_receives_roi_before_author_text: true,
    roi_reference: 'Measured selected derivative raster, 3968 × 2976 native pixels; historical upright orientation unknown.',
    originals_or_other_images_authorized_in_this_receipt: false,
  },
  extension_gate: 'Root accepts the six-line pilot after an independent visual reading and comparison. No automatic full-corpus extension.',
  human_reading_validated: false,
  historical_identity_resolved: false,
  owner_enabled: false,
  hosted_database_configured: false,
  deployed: false,
  missing_external: parsed.candidate.missing_external,
  goal_status: 'active; phase-two Tucé readings remain required',
};
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + '\n');
await writeFile(output, bytes, { flag: 'wx' });
console.log(JSON.stringify({ path: output, sha256: sha(bytes), private_reading_authorized: true }));
