import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = value => createHash('sha256').update(value).digest('hex');
const base = resolve('.private/archives-integration'), parent = resolve(base, 'publication-package-20261004-v24-r2');
const output = resolve(base, 'publication-package-20261004-v25'), site = resolve(output, 'site');
try { await lstat(output); throw Error('Fresh package required.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const pinned = async (path, expected) => {
  ensure(await realpath(path) === path, 'Reparse input refused.');
  const bytes = await readFile(path);
  ensure(sha(bytes) === expected.sha256 && (expected.bytes === undefined || bytes.length === expected.bytes), 'Selected input changed: ' + path);
  return bytes;
};
const parentBytes = await pinned(resolve(parent, 'assembly.json'), { sha256: 'aaa8b5c87cd7a7baf6d2d33489d0955f7f8940a8055789b76258ebaba9e61a11' });
const previous = JSON.parse(parentBytes), files = {}, changed = {}, added = {};
const parentFile = name => { ensure(previous.files[name], 'Missing parent file.'); return pinned(resolve(parent, 'site', name), { sha256: previous.files[name].sha256, bytes: previous.files[name].size_bytes }); };
const once = (text, before, after) => { ensure(text.split(before).length === 2, 'Unique UI landmark changed: ' + before); return text.replace(before, after); };

const left = resolve(base, 'p09-left21-current-parent-delta-20261004-v1');
const leftManifest = JSON.parse(await pinned(resolve(left, 'delta-manifest.json'), { sha256: 'c21d8bad6dc86d7b02b90d7eed3540361b63d4e0fac7b08fde818015d768a7b8' }));
await pinned(resolve(left, 'compose-p09-left21-delta.mjs'), { sha256: 'eec3b55d3a4b891ac2d113aa5608f54e9b01a545124c23f4391482ece5959a6a' });
const { composeP09Left21Delta } = await import(pathToFileURL(resolve(left, 'compose-p09-left21-delta.mjs')).href);
const sourceFiles = {};
for (const pin of leftManifest.inputs) sourceFiles[pin.path] = await pinned(resolve(left, 'inputs/adapter/site', pin.path), { sha256: pin.sha256, bytes: pin.size_bytes });
const p09Name = 'dist/archives/fichiers/p09/index.html';
const leftOutputs = composeP09Left21Delta({ parentAssemblySha256: sha(parentBytes), parentPageHtml: await parentFile(p09Name), sourceFiles });
for (const [name, bytes] of leftOutputs) (previous.files[name] ? changed : added)[name] = bytes;

const cropRoot = resolve('Z:/Codex/repos/PHD-Maine-paleography-harness/data/private/transcription-campaign/p09-l07-native-context-crop-20261004-v1');
const cropMappingBytes = await pinned(resolve(cropRoot, 'crop-to-point-map.json'), { sha256: 'ffdd068804a25b7a9f9bd5bcfb276015d3c8fc6debf85ff1aa1c96c6d3258a11' });
const cropMap = JSON.parse(cropMappingBytes), crop = cropMap.entries[0];
const admission = JSON.parse(await pinned(resolve(base, 'p09-l07-final-native-admission-20261004-v1/verification.json'), { sha256: 'fd8b5d42555d9c32543b048f7efde4aa75a32c742876ec9904ed9cb45805173c' }));
ensure(admission.passed && admission.mapping_sha256 === sha(cropMappingBytes) && admission.pixels_equal_to_root_inspected_admission && admission.final_png_visually_inspected, 'Final native admission missing.');
ensure(cropMap.entries.length === 1 && cropMap.selected_parent_assembly_sha256 === sha(parentBytes) && cropMap.selected_parent_view_sha256 === previous.files[p09Name].sha256, 'Crop parent changed.');
ensure(crop.point_id === 'point-l07' && crop.quote === 'vre' && crop.source_text_version === 'author-full-view-r0' && crop.local_physical_line === 7 && crop.historical_reading_confirmed === false && crop.proposed_projection_crop_value.word_bbox === null, 'Crop reading binding changed.');
const route = crop.proposed_public_asset.route;
ensure(route === '/archives/review-crops/p09/dbef599e83664a5547488333a6275a00de3bfa506b063a9fa737fcf1a8223700.png', 'Unexpected crop route.');
added['dist' + route] = await pinned(resolve(cropRoot, 'roi/roi.png'), { sha256: crop.proposed_public_asset.sha256, bytes: crop.proposed_public_asset.bytes });
let p09 = changed[p09Name].toString('utf8');
const point = p09.match(/<article class="reading-point" id="point-l07"[\s\S]*?<\/article>/u)?.[0];
ensure(point?.includes('<span data-point-quote>vre</span>') && point.includes('href="#ligne-l07"'), 'Exact L07 point changed.');
const context = `<figure><a href="${route}"><img src="${route}" width="760" height="165" alt="Petit extrait du groupe proposé vre à la ligne L07"></a><figcaption>Contexte du mot à revoir · emplacement probable. Cliquez pour agrandir.</figcaption></figure>`;
const newPoint = once(point, '<p class="crop-pending">Cadrage à préparer</p>', context);
p09 = once(p09, point, newPoint);
p09 = once(p09, 'Trois extraits de contexte.', 'Quatre extraits de contexte.');
changed[p09Name] = Buffer.from(p09);
const libraryName = 'dist/archives/fichiers/index.html';
changed[libraryName] = Buffer.from(once((await parentFile(libraryName)).toString('utf8'), '3 petits extraits d’image · 1 cadrage à préparer', '4 petits extraits d’image'));

const board = resolve('.private/archives-next-readings/public-statusboard-delta-20261004-v1');
const seal = JSON.parse(await pinned(resolve(board, 'seal.json'), { sha256: 'd820af91ff83f0fa259af67eb7e3a97e26206571cbb37625b6d931d9f51c0480' }));
const boardFile = name => pinned(resolve(board, name), seal.files[name]);
const contract = JSON.parse(await boardFile('integration-contract.json'));
const review = JSON.parse(await boardFile('independent-review.json'));
ensure(contract.parent_assembly.sha256 === sha(parentBytes) && contract.unit_counts_verified && review.findings.length === 0, 'Statusboard selection not admitted.');
const boardName = 'dist/archives/avancement/index.html';
ensure(previous.files[boardName].sha256 === contract.parent_statusboard.sha256, 'Statusboard parent changed.');
let boardHtml = (await boardFile('avancement.html')).toString('utf8');
boardHtml = once(boardHtml, '4 points à revoir · 3 petits extraits · 1 cadrage à préparer', '4 points à revoir · 4 petits extraits');
changed[boardName] = Buffer.from(boardHtml);
added['dist/assets/archives-public-statusboard.css'] = await boardFile('public-statusboard.css');

const put = async (name, bytes) => {
  ensure(!files[name] && !name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe output path.');
  await mkdir(dirname(resolve(site, name)), { recursive: true }); await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const name of Object.keys(previous.files)) if (name !== 'runtime/package-checksums.json') await put(name, changed[name] ?? await parentFile(name));
for (const [name, bytes] of Object.entries(added)) { ensure(!previous.files[name], 'Added route collision.'); await put(name, bytes); }
ensure(Object.keys(added).length === 7 && Object.keys(changed).length === 3, 'Review progress delta exceeded.');
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
const counts = { ...previous.counts, static_files: previous.counts.static_files + 7, precise_review_crop_assets: 4, p09_left21_localizer_assets: 5 };
ensure(Object.keys(files).filter(name => name.startsWith('dist/')).length === counts.static_files, 'Static count drift.');
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({ ...previous, parent_assembly_sha256: sha(parentBytes), counts,
  missing_external: previous.missing_external.map(value => value === 'Six production environment values' ? 'Nine production environment values' : value),
  public_review_progress: { statusboard: true, p09_l07_native_context: true, left21_local_lines: true, assembled_browser_pending: true },
  delta: { added: Object.keys(added), modified: Object.keys(changed).concat('runtime/package-checksums.json'), removed: [] }, files }, null, 2) + '\n', { flag: 'wx' });
await writeFile(resolve(output, 'preservation.json'), JSON.stringify({ parent_assembly_sha256: sha(parentBytes), source_texts_versions_api_json_jpegs_and_stores_unchanged: true,
  old_crop_assets_unchanged: true, left21_limited_local_lines: true, l07_word_bbox: null, historical_confirmation: false,
  statusboard_unit_counts: { prepared_files: 3, old_text_files: 166, inventoried_images: 2989 } }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, static_files: counts.static_files, three_components: true, browser_pending: true }));
