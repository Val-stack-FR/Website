import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const base = resolve('.private/archives-integration');
const parent = resolve(base, 'publication-package-20261004-v25');
const output = resolve(base, 'publication-package-20261004-v26-r3'), site = resolve(output, 'site');
try { await lstat(output); throw Error('Fresh package required.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const pinned = async (path, expected) => {
  ensure(await realpath(path) === path, 'Reparse input refused.');
  const bytes = await readFile(path);
  ensure(sha(bytes) === expected.sha256 && (expected.bytes === undefined || bytes.length === expected.bytes), 'Selected input changed: ' + path);
  return bytes;
};
const parentBytes = await pinned(resolve(parent, 'assembly.json'), { sha256: 'b5508c432ec18116f4073481e00ee36d9ad941e45cadd9ed38c7db028d58a25b' });
const previous = JSON.parse(parentBytes), changed = {}, added = {}, files = {}, inputs = {};
const parentFile = name => pinned(resolve(parent, 'site', name), { sha256: previous.files[name].sha256, bytes: previous.files[name].size_bytes });
const change = (name, bytes) => {
  ensure(!changed[name] && !added[name], 'Overlapping delta refused: ' + name);
  (previous.files[name] ? changed : added)[name] = bytes;
};

const e113 = resolve(base, 'e113-line2-current-parent-delta-20261004-v1');
const e113AllowBytes = await pinned(resolve(e113, 'allowlist.json'), { sha256: '1fde3730b3ebe74480de111c3dd132f7174725b6a9af923bab3b8d908050efd5' });
const e113Allow = JSON.parse(e113AllowBytes);
const e113Review = JSON.parse(await pinned(resolve(base, 'e113-line2-current-parent-independent-review-20261004-v1/review.json'), { sha256: 'f18712f536c756752a168f28ce824188221975d530e64bb26306684541be1e6c' }));
ensure(e113Review.verdict === 'BOUNDED-GO' && !e113Review.blocking_findings.length && e113Allow.parent_assembly_sha256 === sha(parentBytes) && e113Allow.files.length === 4, 'E113 scope or review changed.');
for (const item of e113Allow.files) {
  const name = item.proposed_file.replace(/^proposed\/site\//u, '');
  ensure(name.startsWith('dist/archives/fichiers/') || name.startsWith('dist/archives/review-crops/h07/'), 'E113 route escaped.');
  if (item.parent_sha256) ensure(previous.files[name]?.sha256 === item.parent_sha256, 'E113 parent file changed.');
  change(name, await pinned(resolve(e113, item.proposed_file), { sha256: item.sha256 }));
}
inputs.e113_allowlist = sha(e113AllowBytes);

const margin = resolve(base, 'p09-margin-current-parent-delta-20261004-v1');
const marginPinsBytes = await pinned(resolve(margin, 'pins.json'), { sha256: '35d9b050e8f788a85419c8eb4ba25e1ee088d13107fa73414747823ece3626e7' });
const marginPins = JSON.parse(marginPinsBytes);
const marginAllow = JSON.parse(await pinned(resolve(margin, 'allowlist.json'), { sha256: '18a559a3b2eea42eff76ff31afc5c865990645791e68916b0ee8e4dbeea7bb69' }));
const marginAdmission = JSON.parse(await pinned(resolve(base, 'p09-margin-physical-admission-20261004-v1/verification.json'), { sha256: marginPins.root_physical_admission.verification_sha256 }));
ensure(marginPins.parent.assembly_sha256 === sha(parentBytes) && marginPins.parent.p09_page_sha256 === previous.files['dist/archives/fichiers/p09/index.html'].sha256 && marginAllow.entries.length === 5, 'Marge scope or parent changed.');
ensure(marginAdmission.passed && marginAdmission.root_physically_inspected_derivative && marginAdmission.derived_jpeg_sha256 === marginPins.selected_derivative.sha256 && marginAdmission.historical_confirmation === false, 'Marge physical admission missing.');
for (const entry of marginAllow.entries) {
  const name = entry.path.replace(/^proposed\/site\//u, '');
  ensure(['dist/archives/fichiers/p09/index.html', 'dist/archives/fichiers/p09/marge/index.html', 'dist/assets/p09-marge.css', 'dist/assets/p09-marge.js', 'dist' + marginPins.selected_derivative.route].includes(name), 'Marge route escaped.');
  const pin = marginPins.proposed_files[entry.path];
  ensure(pin, 'Unpinned Marge output.');
  change(name, await pinned(resolve(margin, entry.path), { sha256: pin.sha256, bytes: pin.size_bytes }));
}
inputs.margin_pins = sha(marginPinsBytes);

const e108 = resolve('.private/archives-next-readings/e108-two-photo-current-parent-delta-20261004-v1');
// A closed handoff must exist before consuming the producer's composition.
const e108Handoff = await pinned(resolve(e108, 'HANDOFF.md'), { sha256: 'e93e65360b1d9bd403334911b5b38c664773a2bfe0888c8037e9aac3cefb69c6' });
const e108SealBytes = await pinned(resolve(e108, 'seal.json'), { sha256: '7a32607a4cc40d4d581ee046150cdfd837ef822e35bc7dda5b3c9aa90454937f' });
const e108WhitelistBytes = await pinned(resolve(e108, 'whitelist.json'), { sha256: '7459d8a14d1e5822ef3ee1ea86a1b7e2f2cecba01e093a020f92f2d57a476687' });
const e108Whitelist = JSON.parse(e108WhitelistBytes);
const e108ContractBytes = await pinned(resolve(e108, 'integration-contract.json'), { sha256: 'f56075584b4cf38baceb6f3dd38addffc739bc98937361f9d3ad8a65376039fa' });
const e108Contract = JSON.parse(e108ContractBytes);
ensure(e108Whitelist.parent_assembly.sha256 === sha(parentBytes) && e108Whitelist.files.length === 8 && e108Contract.root_integrated_trusted_touch_gate_pending === true, 'E108 parent/scope changed.');
const mediaAdmission = JSON.parse(await pinned(resolve(base, 'e108-two-photo-media-admission-20261004-v1/verification.json'), e108Contract.admission.verification));
ensure(mediaAdmission.verdict === 'GO-TWO-SELECTED-E108-DERIVATIVES-FOR-UI-INTEGRATION', 'E108 media admission missing.');
for (const entry of e108Whitelist.files) {
  ensure(/^(?:dist\/|scripts\/archives-integration\/)/u.test(entry.target) && !entry.target.includes('..'), 'E108 target escaped.');
  if (entry.before) ensure(previous.files[entry.target]?.sha256 === entry.before.sha256 && previous.files[entry.target]?.size_bytes === entry.before.bytes, 'E108 parent file changed.');
  else ensure(!previous.files[entry.target], 'E108 added route already exists.');
  change(entry.target, await pinned(resolve(e108, 'composition', entry.target), entry.after));
}
inputs.e108_whitelist = sha(e108WhitelistBytes);
inputs.e108_contract = sha(e108ContractBytes);
inputs.e108_handoff = sha(e108Handoff);
inputs.e108_seal = sha(e108SealBytes);

// The old table is a hidden historical snapshot. Add the actual current
// photograph count to the human board without rewriting that snapshot.
const unitNote = '<p class="unit-note">Ces chiffres comptent des fichiers. Une photo peut couvrir une partie d’un acte ; les limites des actes restent à établir.</p>';
const boardName = 'dist/archives/avancement/index.html';
const board = changed[boardName].toString('utf8');
ensure(board.split(unitNote).length === 2, 'Unique public unit note changed.');
changed[boardName] = Buffer.from(board.replace(unitNote, unitNote + '\n<p class="unit-note">23 photographies sont consultables avec zoom.</p>'));

ensure(Object.keys(added).length === 11 && Object.keys(changed).length === 6, 'Combined delta exceeded.');
for (const [name, bytes] of Object.entries({ ...changed, ...added })) if (/\.html$/u.test(name)) {
  ensure(!/<style\b|\sstyle=|\son\w+=|<script\b(?![^>]*\bsrc=)/iu.test(bytes.toString('utf8')), 'Inline executable HTML introduced.');
}
for (const name of ['scripts/archives-integration/publication-runtime.mjs', 'scripts/archives-integration/e108-two-photo-response-projection.mjs', 'dist/assets/archives-e108-two-photo.js', 'dist/assets/p09-marge.js']) {
  execFileSync(process.execPath, ['--input-type=module', '--check'], { input: changed[name] ?? added[name], stdio: ['pipe', 'pipe', 'pipe'] });
}
const put = async (name, bytes) => {
  ensure(!files[name] && !name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe output path.');
  await mkdir(dirname(resolve(site, name)), { recursive: true });
  await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const name of Object.keys(previous.files)) if (name !== 'runtime/package-checksums.json') await put(name, changed[name] ?? await parentFile(name));
for (const [name, bytes] of Object.entries(added)) await put(name, bytes);
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
const photoHashes = Object.entries(files).filter(([name]) => /^dist\/archives\/.*\.jpg$/u.test(name)).map(([, pin]) => pin.sha256);
ensure(photoHashes.length === 23 && new Set(photoHashes).size === 23, 'Consultable photography count drift.');
const counts = { ...previous.counts, static_files: previous.counts.static_files + 10, additional_e108_gallery_photos: 2, p09_margin_gallery_photos: 1, total_native_review_context_assets: 8, consultable_jpeg_photo_views: photoHashes.length };
ensure(Object.keys(files).filter(name => name.startsWith('dist/')).length === counts.static_files && Object.keys(files).filter(name => /^dist\/archives\/review-crops\/.*\.png$/u.test(name)).length === 8, 'Static or native context count drift.');
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({ ...previous, parent_assembly_sha256: sha(parentBytes), counts,
  context_galleries: { e113_line2_contexts: 2, e108_previews: ['11.jpg', '12.jpg'], p09_margin_gallery: true, integrated_browser_pending: true },
  selected_delta_inputs: inputs, statusboard_photography_counter_correction: { added_visible_counter: true, current_distinct_jpeg_views: 23, retained_previous_hidden_snapshot: true, context_pngs_not_counted: true }, delta: { added: Object.keys(added), modified: Object.keys(changed).concat('runtime/package-checksums.json'), removed: [] }, files }, null, 2) + '\n', { flag: 'wx' });
await writeFile(resolve(output, 'preservation.json'), JSON.stringify({ parent_assembly_sha256: sha(parentBytes), source_texts_versions_api_json_old_media_unchanged: true, store_files_not_accessed: true,
  e113_candidates_not_confirmed: true, margin_attachment_unknown: true, e108_order_and_act_probable: true, no_original_read: true, added: Object.keys(added), modified: Object.keys(changed) }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, static_files: counts.static_files, added: 11, modified: 6, integrated_browser_pending: true }));
