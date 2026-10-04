import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { version: { type: 'string', default: 'v20' } } });
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = resolve('.'), base = resolve('.private/archives-integration');
ensure(/^v20(?:-r[2-9])?$/u.test(values.version), 'Bounded fresh version required.');
const parent = resolve(base, 'publication-package-20261004-v19-r2'), output = resolve(base, 'publication-package-20261004-' + values.version), site = resolve(output, 'site');
try { await lstat(output); throw Error('Fresh package required.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const pinned = async (file, pin) => {
  ensure(await realpath(file) === file, 'Reparse source refused.');
  const bytes = await readFile(file);
  ensure(sha(bytes) === pin.sha256 && (pin.bytes === undefined || bytes.length === pin.bytes), 'Selected source changed: ' + file);
  return bytes;
};
const parentBytes = await pinned(resolve(parent, 'assembly.json'), { sha256: 'f8dfd682649ae865f15bb6ba40d375ce83b9252a53b52f6aef20f16cb24273af' });
const previous = JSON.parse(parentBytes), changed = {}, added = {}, files = {};
const parentFile = name => { const pin = previous.files[name]; ensure(pin, 'Selected parent file missing.'); return pinned(resolve(parent, 'site', name), { ...pin, bytes: pin.size_bytes }); };
const closed = async (directory, sealSha) => {
  const seal = JSON.parse(await pinned(resolve(directory, 'seal.json'), { sha256: sealSha }));
  return async name => { ensure(seal.files[name], 'Unsealed source: ' + name); return pinned(resolve(directory, name), seal.files[name]); };
};
// The reviews are private admission records, never copied into the public site.
const h07Review = JSON.parse(await pinned(resolve(base, 'h07-file-library-root-review-20261004-v1/verification.json'), { sha256: 'a4a14f6030832fdb7b39fe674367283af957199175fb9a9bb7dcf48cb73a9d9c' }));
ensure(h07Review.passed === true && h07Review.go === 'bounded-local-integration', 'Selected H07 independent admission required.');
const toneReview = JSON.parse(await pinned(resolve(base, 'p09-tonal-reading-root-review-20261004-v1/review.json'), { sha256: 'e41bd92e610c8026db2e93c2a084cefd1a0f2b448e94f7d808c805a99e79a8d8' }));
const d18Review = JSON.parse(await pinned(resolve(base, 'd18-human-messages-root-review-20261004-v1/verification.json'), { sha256: '8fe44601bf4df7b4ff528d245994fcbe42348d8a6716a46da1569c9426c4e04d' }));
ensure(toneReview.verdict === 'PASS_BOUNDED_FOR_ROOT_RECOMPOSITION' && toneReview.current_parent.package === 'publication-package-20261004-v19-r2', 'Selected L04 admission required.');
ensure(d18Review.decision === 'GO_FOR_INTEGRATION' && d18Review.checks.delta_allowlist_two_files_only === true, 'Selected paired D18 admission required.');
const h07Root = resolve('.private/archives-next-readings/h07-file-library-ui-20261004-v1/reviewed-r2');
const h07 = await closed(h07Root, 'fd88a1ede271eb6e7bde98bb52a6d80e6617036f5bb52e3864d4356598beb40b');
const h07Contract = JSON.parse(await h07('integration-contract.json'));
ensure(h07Contract.pilot_source_files === 2 && h07Contract.counts.map(item => item.transcriptionLines).join(',') === '37,4', 'Exact two-file pilot required.');
ensure(sha(await parentFile('dist/archives/fichiers/index.html')) === h07Contract.parent_library_sha256, 'Rebase requires the unchanged library parent.');
for (const entry of h07Contract.required_existing_assets) ensure(sha(await parentFile('dist' + entry.route)) === entry.sha256, 'Required library asset changed.');
const routeFile = route => 'dist' + route + (route.endsWith('/') ? 'index.html' : '');
for (const entry of h07Contract.public_routes) {
  const name = routeFile(entry.route), bytes = await h07(entry.run_file);
  if (entry.route === '/archives/fichiers/') changed[name] = bytes;
  else { ensure(!previous.files[name], 'Two-file target overlaps parent.'); added[name] = bytes; }
}
const mediaBytes = await pinned(resolve('C:/Users/Val/Documents/ChatGPT/PERSO/atelier-tuce/planning/media-release/remise-branchement-e133-e113-20261004-v1.json'), { sha256: '56c1658dfbdf3e86348510db9bd99e134e96d1b9c0b8dc5ebff38c16e5841c3f' });
const media = JSON.parse(mediaBytes);
ensure(media.files.length === 2 && media.matched_source_files === 2 && media.new_photos_crops_crawls_batches === 0, 'Two exact existing photo mappings required.');
const readingRoutes = {};
for (const mapping of media.files) {
  ensure(h07Contract.public_routes.some(entry => entry.route === mapping.file_route), 'Unknown mapped file route.');
  const photo = mapping.existing_JPEG, photoBytes = await parentFile('dist' + photo.route);
  ensure(sha(photoBytes) === photo.sha256 && photoBytes.length === photo.byte_size, 'Mapped photo changed.');
  const name = routeFile(mapping.file_route), original = added[name].toString('utf8');
  const nav = original.match(/<nav class="file-actions"[^>]*>[\s\S]*?<\/nav>/u)?.[0];
  ensure(nav && original.split(nav).length === 2 && /^\/archives\/media\/draft\/[a-f0-9]{64}\.jpg$/u.test(photo.route), 'Exact file photo landmark required.');
  const button = `<a class="file-photo-link" href="${photo.route}">Voir la photo</a>`;
  const result = original.replace(nav, nav.replace('</nav>', button + '</nav>'));
  ensure(result.replace(button, '') === original, 'Photo button changed file transcription.');
  added[name] = Buffer.from(result);
  readingRoutes[mapping.source_object_id] = mapping.file_route;
}
// This changes only the two matching card actions; all requests and navigation
// parameters continue to use the original catalogue JSON identifiers.
const clientName = 'dist/assets/archives-hierarchy.js', client = (await parentFile(clientName)).toString('utf8');
const clientAnchor = '      article.append(details(record));';
ensure(client.split(clientAnchor).length === 2 && !client.includes('const fileReadingRoutes ='), 'Catalogue action landmark changed.');
const routeDeclaration = '  const fileReadingRoutes = Object.freeze(' + JSON.stringify(readingRoutes) + ');\n';
const cardMarker = '  const card = entry => {';
ensure(client.split(cardMarker).length === 2, 'Catalogue card landmark changed.');
const fileAction = "      if (fileReadingRoutes[record.digitalObjectId]) { const link = node('a', 'catalogue-reader-link', 'Lire les transcriptions'); link.href = fileReadingRoutes[record.digitalObjectId]; article.append(link); }\n";
const linkedClient = client.replace(cardMarker, routeDeclaration + cardMarker).replace(clientAnchor, fileAction + clientAnchor);
ensure(linkedClient.replace(routeDeclaration, '').replace(fileAction, '') === client, 'Catalogue logic changed beyond mapped actions.');
changed[clientName] = Buffer.from(linkedClient);
const toneRoot = resolve('.private/archives-next-readings/p09-tonal-reading-ui-20261004-v1');
const tone = await closed(toneRoot, 'ef7cb7779585a5a8321a3fec9306db8ed7c51d5cce809094349c9b4ed08aefad');
const toneContract = JSON.parse(await tone('integration-contract.json'));
const toneModule = 'code-snapshot/p09-tonal-reading-adapter.mjs';
await tone(toneModule);
const { composeP09TonalReading } = await import(pathToFileURL(resolve(toneRoot, toneModule)).href);
const p09Name = routeFile('/archives/fichiers/p09/'), p09Bytes = await parentFile(p09Name);
const composed = composeP09TonalReading({ enabled: true, parentHtml: p09Bytes.toString('utf8'), parentSha256: sha(p09Bytes), componentBytes: await tone('inputs/component-index.html') });
ensure(Buffer.from(composed.html).equals(await tone('p09.html')) && composed.parentRestorable, 'Closed L04 composition changed.');
ensure(sha(await parentFile('dist' + toneContract.required_existing_crop.route)) === toneContract.required_existing_crop.sha256, 'L04 source crop changed.');
changed[p09Name] = Buffer.from(composed.html);
for (const entry of toneContract.public_routes.filter(item => item.route.startsWith('/assets/'))) {
  const name = routeFile(entry.route); ensure(!previous.files[name], 'Tonal asset overlaps parent.'); added[name] = await tone(entry.run_file);
}
const d18Root = resolve('Z:/Codex/repos/Website-archives-corrections/.archive-corrections-private/d18-p09-ui-messages-48b2fd11-5a79-4ca1-8b5e-2020890ac471');
const d18 = JSON.parse(await pinned(resolve(d18Root, 'delta-allowlist.json'), { sha256: '01c2db289ba12d728b6af7554acc1e193f04afa084aadf4a9bdd60900c9e1413' }));
ensure(d18.changed_files === 2 && d18.files.length === 2 && !d18.api_change && !d18.database_change, 'Exact presentation-only D18 required.');
for (const entry of d18.files) {
  ensure(['assets/archives-p09-corrections/client.mjs', 'assets/archives-p09-corrections/session.mjs'].includes(entry.target_relative_path), 'Unexpected D18 target.');
  const name = 'dist/' + entry.target_relative_path;
  ensure(sha(await parentFile(name)) === entry.source_sha256, 'D18 parent changed.');
  ensure(resolve(entry.proposed_path) === resolve(d18Root, 'proposed', entry.target_relative_path), 'D18 source escaped.');
  changed[name] = await pinned(resolve(entry.proposed_path), { sha256: entry.proposed_sha256, bytes: entry.bytes });
}
const put = async (name, bytes) => {
  ensure(!files[name] && !name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe or repeated package target.');
  await mkdir(dirname(resolve(site, name)), { recursive: true }); await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const [name] of Object.entries(previous.files)) if (name !== 'runtime/package-checksums.json') await put(name, changed[name] ?? await parentFile(name));
for (const [name, bytes] of Object.entries(added)) await put(name, bytes);
const staticCount = Object.keys(files).filter(name => name.startsWith('dist/')).length;
ensure(staticCount === previous.counts.static_files + 8 && Object.keys(files).filter(name => name.startsWith('api/') && name.endsWith('.mjs')).length === 10, 'Public delta shape changed.');
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({ ...previous, parent_assembly_sha256: sha(parentBytes), counts: { ...previous.counts, static_files: staticCount, source_file_review_pages: previous.counts.source_file_review_pages + 2, h07_transcription_lines: 41, p09_optional_tonal_points: 1 }, human_file_readings: { two_photo_mappings_exact: true, catalogue_actions_mapped: true, h07_lines_local_not_physical: true, new_crops: 0, p09_original_crop_unchanged: true, d18_human_messages: true, browser_gate_pending: true }, delta: { added: Object.keys(added), modified: Object.keys(changed).concat('runtime/package-checksums.json'), removed: [] }, files }, null, 2) + '\n', { flag: 'wx' });
await writeFile(resolve(output, 'preservation.json'), JSON.stringify({ parent_assembly_sha256: sha(parentBytes), library_parent_byte_identical_to_v14: true, h07_photo_insertions_reversible: true, catalogue_action_insertions_reversible: true, p09_composition_exact_closed_result: true, original_data_json_apis_and_photos_unchanged: true, historical_confirmation: false }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, static_files: staticCount, source_file_pages_added: 2, mapped_photo_links: 2, optional_tonal_points: 1, functions: 10, browser_gate_pending: true }));
