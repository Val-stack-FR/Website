import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ensure = (value, message) => { if (!value) throw new Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const base = resolve('.private/archives-integration');
const parent = resolve(base, 'publication-package-20261004-v27');
const output = resolve(base, 'publication-package-20261004-v28');
const site = resolve(output, 'site');
try { await lstat(output); throw new Error('Fresh v28 output required.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const pinned = async (path, pin) => {
  ensure(await realpath(path) === path, 'Reparse input refused: ' + path);
  const bytes = await readFile(path);
  ensure(sha(bytes) === pin.sha256 && (pin.bytes === undefined || bytes.length === pin.bytes), 'Selected input changed: ' + path);
  return bytes;
};
const parentBytes = await pinned(resolve(parent, 'assembly.json'), { sha256: '245717cb32a04d11968e2a05dbe540661990beb9cce93cee8d67ceb41a876033' });
const previous = JSON.parse(parentBytes);
ensure(previous.snapshot_sha256 === '9048280ac0933d0d4fe853ae504e6238e2e740f162df19461339099dafd8cfe3' && previous.counts.static_files === 371 && previous.counts.consultable_jpeg_photo_views === 25, 'Exact v27 parent required.');

const changed = new Map(), added = new Map(), files = {}, inputPins = {};
const parentCache = new Map();
const parentFile = async name => {
  if (parentCache.has(name)) return parentCache.get(name);
  const pin = previous.files[name];
  ensure(pin, 'Missing selected parent file: ' + name);
  const bytes = await pinned(resolve(parent, 'site', name), { sha256: pin.sha256, bytes: pin.size_bytes });
  parentCache.set(name, bytes);
  return bytes;
};
const addChange = (name, bytes) => { ensure(!changed.has(name) && !added.has(name), 'Overlapping delta: ' + name); (previous.files[name] ? changed : added).set(name, bytes); };
const safeTarget = name => !name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..');

// Consume the reviewer-corrected binding, then verify every source/output pair again.
const deltaRoot = resolve(base, 'source-file-human-journey-current-parent-delta-20261004-v1');
const binding = JSON.parse(await pinned(resolve(base, 'source-file-human-journey-independent-review-20261004-v1/verified-parent-binding.json'), { sha256: '0ed11a4ccb2f74509a80e4eac9587d8b1eae172abeb1018383d88a89b7f36d52' }));
ensure(binding.parent.assembly_json_sha256 === sha(parentBytes) && binding.parent.assembly_snapshot_sha256 === previous.snapshot_sha256 && binding.all166_actual_source_output_pins_verified === true, 'Independent source-page binding changed.');
const sourceManifestBytes = await pinned(resolve(deltaRoot, 'page-manifest.json'), { sha256: '89d2bacaa427908ca5e2ccfc419a8cf8179a7d07d1a56ddb366e1dc6a952faa4' });
const sourceManifest = JSON.parse(sourceManifestBytes);
ensure(sourceManifest.scope.routes === 166 && sourceManifest.scope.modified_pages === 166 && sourceManifest.scope.added_pages === 0, 'Expected exact 166-page source delta.');
const sourceDecoration = await pinned(resolve(deltaRoot, 'decorate-source-text-page.mjs'), { sha256: 'c40b1fcc44f12190e9a23b324660a60cd305ee75f9b876d0104081abaae5eff4' });
inputPins.source_page_manifest = sha(sourceManifestBytes);
inputPins.source_page_decorator = sha(sourceDecoration);
ensure(sourceManifest.records.length === 166 && new Set(sourceManifest.records.map(row => row.object_id)).size === 166, 'Source delta record set is not unique.');
for (const row of sourceManifest.records) {
  const target = row.relative_path.replace(/^dist\//u, 'dist/');
  ensure(/^dist\/archives\/textes\/fichier\/[a-f0-9]{64}\/index\.html$/u.test(target) && safeTarget(target), 'Unexpected source-page route.');
  const parentBytesForPage = await parentFile(target);
  ensure(sha(parentBytesForPage) === row.source_sha256 && parentBytesForPage.length === row.source_bytes, 'Source page no longer matches v27: ' + target);
  const outputBytes = await pinned(resolve(deltaRoot, 'site', target), { sha256: row.output_sha256, bytes: row.output_bytes });
  const html = outputBytes.toString('utf8');
  ensure(html.includes('class="archive-preexisting-literal"') || row.empty_occurrence === true, 'Source literal/empty marker missing: ' + target);
  addChange(target, outputBytes);
}

// The E10811 mini-reader is an independently closed six-line SITE presentation.
const readerRoot = resolve('.private/archives-next-readings/e108-11-six-line-reader-ui-20261004-v1');
const readerSealBytes = await pinned(resolve(readerRoot, 'seal.json'), { sha256: '6f92d5d39442e0e4702c6e9a965a4bd408501f55890eab944cee8d611098df8c' });
const readerSeal = JSON.parse(readerSealBytes);
const readerGet = async name => {
  ensure(readerSeal.files[name] && safeTarget(name), 'Unsealed E10811 input: ' + name);
  return pinned(resolve(readerRoot, name), readerSeal.files[name]);
};
const readerCloseout = JSON.parse(await readerGet('closeout.json'));
const readerContractBytes = await readerGet('integration-contract.json');
const readerAllowBytes = await readerGet('allowlist.json');
const readerContract = JSON.parse(readerContractBytes), readerAllow = JSON.parse(readerAllowBytes);
ensure(readerCloseout.source_and_output_pins_match && readerCloseout.public_activation === false && readerCloseout.historical_confirmation === false && readerCloseout.public_files === 5 && readerCloseout.hook_modules === 1, 'Closed E10811 pilot is not ready.');
ensure(readerContract.public_routes.length === 5 && readerAllow.files.length === 6 && readerContract.no_partial_louis_text_link === true && readerContract.roi.word_bbox === null, 'E10811 allowlist or scope changed.');
const parentCompatibility = JSON.parse(await readerGet('parent-compatibility.json'));
ensure(parentCompatibility.assembly.sha256 === sha(parentBytes) && parentCompatibility.exact_four_photo_catalogue_matches_qualified_fixture && parentCompatibility.new_targets_absent, 'E10811 current-parent compatibility changed.');
const readerReviewBytes = await readerGet('independent-review.json');
const readerReview = JSON.parse(readerReviewBytes);
ensure(readerReview.final_verdict?.startsWith('GO') && readerReview.actionable_findings === 0 && readerReview.historical_confirmation === false, 'E10811 independent review is not a pass.');
for (const entry of readerAllow.files) {
  ensure(entry.action === 'add' && safeTarget(entry.target) && !previous.files[entry.target], 'E10811 target overlaps parent.');
  const bytes = await readerGet(entry.source);
  ensure(bytes.length === entry.bytes && sha(bytes) === entry.sha256, 'E10811 allowlist does not match sealed asset.');
  addChange(entry.target, bytes);
}
const readerHook = readerAllow.files.find(row => row.target === 'scripts/archives-integration/e108-eleven-reader-link-projection.mjs');
ensure(readerHook && readerHook.sha256 === readerContract.composable_hook.sha256, 'E10811 runtime hook pin mismatch.');
inputPins.e10811_closeout = sha(await readerGet('closeout.json'));
inputPins.e10811_contract = sha(readerContractBytes);
inputPins.e10811_allowlist = sha(readerAllowBytes);
inputPins.e10811_independent_review = sha(readerReviewBytes);
inputPins.e10811_seal = sha(readerSealBytes);

// Copy the Root-approved SSR r3 modules only; r1/r2 are not interchangeable.
const ssrRoot = resolve(base, 'source-file-human-response-preparation-20261004-r3');
const responseProjection = await pinned(resolve(ssrRoot, 'source-file-human-response-projection.mjs'), { sha256: '607a5dbad3d1e028d71b9269c9cd1fdc2312b9d2707079d3ba01b18fbb08b5c3' });
const sourceDecorator = await pinned(resolve(ssrRoot, 'source-text-page-decoration.mjs'), { sha256: '63f3122f46ffacc29fe907c6cce4c58b3f338a18046ee9129a25cc62f76863af' });
const ssrVerificationBytes = await pinned(resolve(ssrRoot, 'verification.json'), { sha256: '3ec0752226d7ebc3ed29a58707c31422bd8dddb444d6104ec7899234399ec213' });
const ssrVerification = JSON.parse(ssrVerificationBytes);
ensure(ssrVerification.passed === true && ssrVerification.decorator_sha256 === sha(sourceDecorator) && ssrVerification.normalizer_sha256 === sha(responseProjection), 'Root SSR r3 admission changed.');
addChange('scripts/archives-integration/source-file-human-response-projection.mjs', responseProjection);
addChange('scripts/archives-integration/source-text-page-decoration.mjs', sourceDecorator);
inputPins.source_ssr_r3_verification = sha(ssrVerificationBytes);

// Compose the static catalogue link after the existing four-photo E108 projection.
const e108ProjectionName = 'scripts/archives-integration/e108-human-response-projection.mjs';
const e108ProjectionBytes = await parentFile(e108ProjectionName);
inputPins.inherited_e108_projection = sha(e108ProjectionBytes);
for (const [name, pin] of Object.entries(parentCompatibility.matched_current_inputs)) {
  const bytes = await parentFile(name);
  ensure(sha(bytes) === pin.sha256 && bytes.length === pin.bytes, 'E10811 current-parent compatibility pin failed: ' + name);
}
const linkHookPath = resolve(readerRoot, readerHook.source);
const { projectE108ElevenReaderLink } = await import(pathToFileURL(linkHookPath).href);
const catalogueName = 'dist/archives/catalogue/index.html';
const catalogueParent = (await parentFile(catalogueName)).toString('utf8');
ensure(catalogueParent.includes('id="e108-ensemble-template"') && catalogueParent.includes('11.jpg'), 'Four-photo catalogue template missing.');
const catalogueResult = projectE108ElevenReaderLink('/archives/catalogue/', catalogueParent);
ensure(typeof catalogueResult === 'string' && catalogueResult.includes('/archives/fichiers/e108-vue-11/passage-en-cours/') && catalogueResult.includes('archives-e108-eleven-link.css'), 'E10811 link projection failed on catalogue.');
changedCatalogueAssertions(catalogueParent, catalogueResult);
addChange(catalogueName, Buffer.from(catalogueResult));

function changedCatalogueAssertions(before, after) {
  ensure(after.includes('id="e108-eleven-passage-link"') && after.includes('Lire le passage en cours · vue 11') && after.includes('archives-e108-eleven-link.css'), 'E10811 catalogue link not present.');
  ensure(after.includes('id="e108-ensemble-template"') && after.includes('12.jpg') && after.includes('13.jpg') && after.includes('14.jpg'), 'Existing four-photo ensemble changed.');
  ensure(!after.includes('81f2195b2dd92184859c2301a8da2f1126c3b7e25cdf8b1d1f6684029fa66a45'), 'E10811 was linked to the partial Louis text.');
}

// Compose the dynamic HTML hooks in the required order. JSON and other routes stay untouched.
const runtimeName = 'scripts/archives-integration/publication-runtime.mjs';
const runtime = (await parentFile(runtimeName)).toString('utf8');
const e108Import = "import { projectE108CatalogueResponse } from './e108-human-response-projection.mjs';";
const linkImport = "import { projectE108ElevenReaderLink } from './e108-eleven-reader-link-projection.mjs';";
const twoPhotoImport = "import { projectE108TwoPhotoResponse } from './e108-two-photo-response-projection.mjs';";
const sourceImport = "import { projectSourceFileHumanResponse } from './source-file-human-response-projection.mjs';";
ensure(runtime.includes(e108Import) && runtime.includes(twoPhotoImport) && !runtime.includes(linkImport) && !runtime.includes(sourceImport), 'Expected v27 response hook anchors.');
const oldReturn = '  return projectE108TwoPhotoResponse(url, projectE108CatalogueResponse(url, decorateVisibleLexicalFilenames(decorateHumanSecondaryPage(decorateHumanCataloguePage(decorateOtherHumanScreens(decorateHumanSourcePage(presented), url), url), url), url)));';
ensure(runtime.split(oldReturn).length === 2, 'Unique current response pipeline changed.');
const newReturn = '  const current = projectE108TwoPhotoResponse(url, projectE108CatalogueResponse(url, decorateVisibleLexicalFilenames(decorateHumanSecondaryPage(decorateHumanCataloguePage(decorateOtherHumanScreens(decorateHumanSourcePage(presented), url), url), url), url)));\n  return projectSourceFileHumanResponse(projectE108ElevenReaderLink(url, current), url);';
let nextRuntime = runtime.replace(e108Import, e108Import + '\n' + linkImport + '\n' + sourceImport).replace(oldReturn, newReturn);
ensure(nextRuntime.replace(linkImport + '\n', '').replace(sourceImport + '\n', '').replace(newReturn, oldReturn) === runtime, 'SSR hook changed unrelated runtime bytes.');
addChange(runtimeName, Buffer.from(nextRuntime));

// Expose the six-line local reading as a fourth distinct file-reading pathway.
const libraryName = 'dist/archives/fichiers/index.html';
const library = (await parentFile(libraryName)).toString('utf8');
const libraryIntro = 'Trois fichiers ont un parcours préparé ici. Les autres lectures restent à organiser par source.';
const libraryArticle = '<article class="file-entry"><div><p class="eyebrow">E.108 · vue 11 · passage local</p><h2><a href="/archives/fichiers/e108-vue-11/passage-en-cours/">Vue 11 · six lignes en cours</a></h2><p>Deux lectures proposées · six lignes locales · français modernisé séparé</p><p class="file-status">À relire · aucune lecture confirmée</p></div><div><p>Un extrait de consultation · aucune relation d’acte déduite</p><a href="/archives/fichiers/e108-vue-11/passage-en-cours/">Ouvrir le passage</a></div></article>';
ensure(library.split(libraryIntro).length === 2 && library.includes('<section id="fichiers"') && !library.includes('/archives/fichiers/e108-vue-11/passage-en-cours/'), 'File index v27 landmark changed.');
let nextLibrary = library.replace(libraryIntro, 'Quatre fichiers ont un parcours préparé ici. Les autres lectures restent à organiser par source.');
const sectionClose = '</article></section><p class="muted">Une photo peut être une partie d’un acte.';
ensure(nextLibrary.split(sectionClose).length === 2, 'File index closing landmark changed.');
nextLibrary = nextLibrary.replace(sectionClose, '</article>' + libraryArticle + '</section><p class="muted">Une photo peut être une partie d’un acte.');
addChange(libraryName, Buffer.from(nextLibrary));

const boardName = 'dist/archives/avancement/index.html';
let board = (await parentFile(boardName)).toString('utf8');
ensure(board.includes('<strong>3</strong><span>fichiers avec un parcours de lecture préparé</span>') && board.includes('25 photographies sont consultables avec zoom.'), 'Statusboard current counters changed.');
board = board.replace('<strong>3</strong><span>fichiers avec un parcours de lecture préparé</span>', '<strong>4</strong><span>fichiers avec un parcours de lecture préparé</span>');
ensure(board.split('Trois fichiers à ouvrir maintenant').length === 2, 'Statusboard heading landmark changed.');
board = board.replace('Trois fichiers à ouvrir maintenant', 'Quatre fichiers à ouvrir maintenant');
const e108BoardCard = '<article class="reading-card"><p class="eyebrow">E.108 · vue 11 · passage local</p><h3><a href="/archives/fichiers/e108-vue-11/passage-en-cours/">Six lignes en cours</a></h3><p class="state">Lectures proposées, à relire</p><p>Deux lectures séparées · six lignes locales.</p><a href="/archives/fichiers/e108-vue-11/passage-en-cours/">Ouvrir le passage</a></article>';
const boardClose = '</div><p class="muted">Pour E.133 et E.113';
ensure(board.split(boardClose).length === 2, 'Statusboard reading-grid close changed.');
board = board.replace(boardClose, e108BoardCard + boardClose);
ensure(board.includes('25 photographies sont consultables avec zoom.') && board.includes('id="agent-statusboard-metadata"') && board.includes('19 vues consultables avec zoom'), 'Statusboard photo count or historical snapshot changed.');
addChange(boardName, Buffer.from(board));

// Check every new/revised HTML page against the strict publication CSP conventions.
for (const [name, bytes] of changed) if (name.endsWith('.html')) {
  ensure(!/<style\b|\sstyle\s*=|\son[a-z]+\s*=|<script\b(?![^>]*\bsrc\s*=)/iu.test(bytes.toString('utf8')), 'Inline executable markup in ' + name);
}
for (const [name, bytes] of added) if (/\.(?:mjs|js)$/u.test(name)) execFileSync(process.execPath, ['--input-type=module', '--check'], { input: bytes, stdio: ['pipe', 'pipe', 'pipe'] });
for (const name of ['scripts/archives-integration/publication-runtime.mjs', 'scripts/archives-integration/source-file-human-response-projection.mjs', 'scripts/archives-integration/source-text-page-decoration.mjs', 'scripts/archives-integration/e108-eleven-reader-link-projection.mjs']) {
  const bytes = changed.get(name) ?? added.get(name) ?? await parentFile(name);
  execFileSync(process.execPath, ['--input-type=module', '--check'], { input: bytes, stdio: ['pipe', 'pipe', 'pipe'] });
}

// Complete all parent and delta checks before creating the fresh output tree.
for (const name of Object.keys(previous.files)) await parentFile(name);
const addedNames = [...added.keys()].sort(), modifiedNames = [...changed.keys()].sort();
ensure(addedNames.length === 8 && modifiedNames.length === 170 && ![...addedNames, ...modifiedNames].some(name => /(?:runtime-data|\.jsonl$|\.sqlite$|\.db$)/iu.test(name)), 'Unexpected data/API delta.');
const expectedPhotoNames = Object.keys(previous.files).filter(name => /^dist\/archives\/.*\.jpg$/u.test(name));
ensure(expectedPhotoNames.length === 25 && new Set(expectedPhotoNames.map(name => previous.files[name].sha256)).size === 25, 'Parent 25-photo set is not exact.');
ensure(previous.counts.runtime_modules === 14 && previous.counts.direct_api_functions === 10, 'Runtime or API baseline changed.');

const put = async (name, bytes) => {
  ensure(safeTarget(name) && !files[name], 'Unsafe or duplicate package output: ' + name);
  await mkdir(dirname(resolve(site, name)), { recursive: true });
  await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  const bytes = await parentFile(name);
  if (name !== 'runtime/package-checksums.json') await put(name, changed.get(name) ?? bytes);
}
for (const [name, bytes] of added) await put(name, bytes);
const photoFiles = Object.entries(files).filter(([name]) => /^dist\/archives\/.*\.jpg$/u.test(name));
ensure(photoFiles.length === 25 && new Set(photoFiles.map(([, pin]) => pin.sha256)).size === 25, 'Inherited 25-photo set changed.');
const staticFiles = Object.keys(files).filter(name => name.startsWith('dist/')).length;
ensure(staticFiles === 376 && Object.keys(files).length === 457, 'Expected 457 files before regenerated checksum / 376 static files.');
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
ensure(Object.keys(files).length === 458, 'Expected 458 files after regenerated checksum.');

const counts = { ...previous.counts, static_files: staticFiles, source_file_human_pages: 166, e10811_reader_lines: 6, e10811_reader_versions: 2, total_selected_photos: 20, consultable_jpeg_photo_views: 25 };
const assembly = {
  ...previous,
  parent_assembly_sha256: sha(parentBytes),
  counts,
  e10811_reader: { route: '/archives/fichiers/e108-vue-11/passage-en-cours/', local_lines: 6, separate_readings: 2, source_photo_added: false, word_bbox: null, human_review: 'pending', historical_confirmation: false },
  source_file_human_pages: { pages: 166, literals_and_empty_occurrences_preserved: true, api_json_versions_and_stores_changed: false, generic_history_api_available: false },
  source_file_response: { ssr_r3_wrapper: sha(responseProjection), decorator: sha(sourceDecorator), json_routes_unchanged: true, alias_id_validation: true },
  e10811_inputs: inputPins,
  delta: { added: addedNames, modified: [...modifiedNames, 'runtime/package-checksums.json'].sort(), removed: [] },
  files,
};
await writeFile(resolve(output, 'assembly.json'), Buffer.from(JSON.stringify(assembly, null, 2) + '\n'), { flag: 'wx' });
await writeFile(resolve(output, 'preservation.json'), Buffer.from(JSON.stringify({ parent_assembly_sha256: sha(parentBytes), all_parent_files_rehashed: true, all_166_source_pages_verified: true, E10811_two_readings_kept_separate: true, static_and_ssr_navigation_preserved: true, runtime_json_api_data_texts_versions_editions_stores_unchanged: true, photo_files_unchanged: photoFiles.length === 25, no_originals_read: true, historical_confirmation: false, added: addedNames, modified: [...modifiedNames, 'runtime/package-checksums.json'].sort(), removed: [] }, null, 2) + '\n'), { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, total_files: Object.keys(files).length, static_files: staticFiles, source_pages: 166, e10811_lines: 6, jpeg_views: photoFiles.length, added: addedNames.length, modified: modifiedNames.length, browser_gate_pending: true }));
