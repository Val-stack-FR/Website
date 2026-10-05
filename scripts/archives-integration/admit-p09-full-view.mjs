import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
const campaign = resolve('../PHD-Maine-paleography-harness/data/private/transcription-campaign');
const author = resolve(campaign, 'e99-p09-full-view-20261004-v1');
const independent = resolve(campaign, 'e99-p09-full-view-independent-20261004-v1');
const comparison = resolve(campaign, 'e99-p09-full-view-comparison-20261004-v1');
const review = resolve(campaign, 'p09-full-view-package-review-20261004-v1');
const out = resolve('.private/archives-integration/p09-full-view-admission-20261004-v1');
try { await lstat(out); throw new Error('Fresh full-view admission required.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const sha = b => createHash('sha256').update(b).digest('hex');
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const pins = {}, data = {};
async function select(key, dir, name, expected) {
  const path = resolve(dir, name), bytes = await readFile(path), digest = sha(bytes);
  ensure(!expected || digest === expected, 'Frozen full-view source drift: ' + key);
  pins[key] = { path, sha256: digest, size_bytes: bytes.length };
  data[key] = name.endsWith('.json') ? JSON.parse(bytes) : decoder.decode(bytes);
}
await select('pilot_admission', resolve('.private/archives-integration/p09-pilot-admission-20261004-v1'), 'admission.json', '537ee38eb0ec1bbed43330c5eeac507884982d373b3da18ac50e065728119dbb');
await select('author_package', author, 'package.full-r0.json', '8a7196c7de301bc3db453c6502a8bf200d4d699f05ee97adceb883ee9163f644');
await select('author_body', author, 'transcription-body.full-r0.txt', 'b827189b0e30ad119e825bfdd8e2267c3321c635891dd08581d16ac080c1dee1');
await select('author_modern', author, 'french-body.full-r0.txt', 'a1e293a332a1edaa6d7b6df40ba97dc6a07293b485109afb555e6dff7736b0f3');
await select('author_diplomatic_regions', author, 'diplomatic-full-view.txt');
await select('author_modern_regions', author, 'french-proposed-full-view.txt');
await select('author_closeout', author, 'closeout-private.json', 'febe7ebaa2fd834468530beec8ab6b4e33a7217c11457f12361a4f7e1a74862e');
await select('author_evidence', author, 'reading-evidence.json', '3a3417551505aa69d0480296cf3da5162ffe864605cbd9868c2385fb8f4a22fe');
await select('mechanical_review', review, 'verification.json');
await select('independent_freeze', independent, 'independent-full-view-frozen-r0.json', '962861eaf29221a2c081f101f1b71df4e5bd8b22005d006e153365319b97e788');
await select('independent_receipt', independent, 'freeze-receipt.json');
await select('independent_body', independent, 'body-l07-l21.r0.txt', '74b94beae563f4d869abd8e4bd1fda19d2d73a71ac2c1c8eef9dfbeb8518cd80');
await select('independent_modern', independent, 'body-l07-l21.modern.r0.txt', 'd7eb0b3fb988943204dd25151f8d0acb7446f5074aa6940f952e36af8e852895');
await select('independent_marks', independent, 'marks-separate.r0.txt', 'd33e4468436b1552d1be84e53771c1915da71ddf2a21ce8f5e6c662c3c750696');
await select('comparison_manifest', comparison, 'run-manifest.json');
await select('comparison_closeout', comparison, 'closeout.json');
for (const entry of data.comparison_manifest.outputs) {
  const path = resolve('../PHD-Maine-paleography-harness', entry.uri);
  const local = relative(comparison, path);
  ensure(local && !local.startsWith('..') && !local.includes(sep), 'Only closed flat comparison outputs admitted.');
  ensure(sha(await readFile(path)) === entry.sha256, 'Comparison output drift.');
}
for (const [key, name] of [['display_body', 'body.display-r1.proposed.txt'], ['display_modern', 'french.display-r1.proposed.txt'], ['comparison_table', 'comparison-table.md'], ['display_proposals', 'display-proposals.json'], ['comparison_verdict', 'verdict.json'], ['comparison_inputs', 'input-manifest.json']]) {
  const expected = data.comparison_manifest.outputs.find(x => x.uri.endsWith('/' + name));
  ensure(expected, 'Closed comparison output missing: ' + name);
  await select(key, comparison, name, expected.sha256);
}
const a = data.author_evidence, m = data.mechanical_review, f = data.independent_receipt, p = data.display_proposals;
ensure(data.author_closeout.passed && !data.author_closeout.pilot_modified && a.body_physical_lines === 21 && a.unique_source_images === 1 && !a.historical_identity_resolved && a.human_review === 'pending', 'Author full-view conditions missing.');
ensure(m.validation.independent_mechanical_checks_passed && m.structure.body_physical_lines === 21 && m.structure.offset_slice_matches_observed_text === 197 && m.pilot_preservation.pilot_files_modified === false, 'Independent package review missing.');
ensure(f.reading_sha256 === pins.independent_freeze.sha256 && f.new_author_text_seen_before_freeze === false && f.prior_L01_L06_exposure_declared === true, 'Independent exposure boundary missing.');
ensure(data.comparison_closeout.passed && data.comparison_inputs.independent_frozen_sha256 === pins.independent_freeze.sha256 && data.comparison_inputs.independent_new_lines_author_text_seen_before_freeze === false, 'Closed full-view comparison missing.');
ensure(data.comparison_verdict.protocol === 'GO-bounded' && data.comparison_verdict.human_review === 'pending' && data.comparison_verdict.proposals_applied === 0 && p.status === 'unapplied' && p.patches.length === 3 && p.memory_events === 0, 'Working comparison boundary missing.');
const lines = text => (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n');
for (const key of ['author_body', 'author_modern', 'display_body', 'display_modern']) ensure(lines(data[key]).length === 21, 'Twenty-one physical lines required.');
for (const [baseKey, displayKey, anchorKey, replacementKey] of [['author_body', 'display_body', 'diplomatic_anchor', 'diplomatic_replacement'], ['author_modern', 'display_modern', 'modern_anchor', 'modern_replacement']]) {
  let chars = Array.from(data[baseKey]);
  for (const patch of [...p.patches].sort((x, y) => y[anchorKey].span.start - x[anchorKey].span.start)) {
    const anchor = patch[anchorKey], { start, end } = anchor.span;
    ensure(chars.slice(start, end).join('') === anchor.quote && patch.applied === false, 'Unapplied Unicode proposal anchor drift.');
    chars.splice(start, end - start, ...Array.from(patch[replacementKey]));
  }
  ensure(chars.join('') === data[displayKey], 'Only the three declared comparison variants may differ.');
  ensure(lines(data[baseKey]).slice(0, 6).join('\n') === lines(data[displayKey]).slice(0, 6).join('\n'), 'No new blind review claimed for first six lines.');
}
const receipt = {
  format: 'p09-full-view-root-admission/1', created_at_utc: new Date().toISOString(),
  decision: 'GO for a clearly labelled, unconfirmed twenty-one-line working edition in the reader; no historical adjudication.',
  reader_full_view_authorized: true, reader_line_count: 21, pins,
  source_object_id: a.source_object_id, derivative_sha256: a.derivative_sha256,
  reader_text_choice: { diplomatic: 'display_body', modern: 'display_modern', edition_id: 'p09-full-comparison-r1-proposed', status: 'unconfirmed-comparison-variant', does_not_replace_author_or_pilot: true },
  history: 'Preserve four pilot versions. Add full author diplomatic/modern, independent L07-L21 diplomatic/modern and the two full comparison variants as explicitly different editions; never label full r0 as pilot r1.',
  separate_zones: 'Signature, annotations, upper fragment and stamp stay separate from the 21-line body; author and independent grouping may differ.',
  comparison_output_pins_checked: data.comparison_manifest.outputs.length,
  root_physical_coverage_check: 'Previously inspected the sole qualified overview derivative and body coverage; lexical certainty is not assessed by this admission.',
  independent_new_lines_frozen_before_author_exposure: true, first_six_lines_prior_exposure_declared: true,
  pilot_files_immutable: true, proposals_applied_to_frozen_sources: 0, reader_variant_only: true,
  human_review: 'pending', canonical_identity_or_date_resolved: false, canonical_refs: { act_id: null, view_id: null, person_id: null, place_id: null },
  rights_status: 'unknown', source_review_status: 'unreviewed', source_publication_status: 'private',
  delivery_scope: 'User-authorized public work in progress candidate; local preview first. Source review and public delivery mandate remain distinct.',
  hosted_publication_executed: false, original_or_other_view_authorized_by_this_receipt: false,
  CER: null, accuracy_score: null, memory_events: 0,
};
await mkdir(out);
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + '\n');
await writeFile(resolve(out, 'admission.json'), bytes, { flag: 'wx' });
console.log(JSON.stringify({ path: resolve(out, 'admission.json'), sha256: sha(bytes), pins: Object.keys(pins).length, reader_line_count: 21 }));
