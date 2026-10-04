import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const sha = b => createHash('sha256').update(b).digest('hex');
const root = await realpath(resolve('.'));
const base = resolve('.private/archives-integration/publication-package-20261004-v10');
const selected = resolve('.private/archives-next-readings/p09-full-view-20261004-v1/reviewed-r2');
const output = resolve('.private/archives-integration/publication-package-20261004-v11');
const site = resolve(output, 'site');
try { await lstat(output); throw new Error('Fresh v11 required.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const parentBytes = await readFile(resolve(base, 'assembly.json')), previous = JSON.parse(parentBytes);
ensure(sha(parentBytes) === '5a434e73f82dcc4aa90e42147266d8d9aefb682ba27812821b485eaa797dcf58', 'Reviewed v10 assembly required.');
const sealBytes = await readFile(resolve(selected, 'closeout.json')), seal = JSON.parse(sealBytes);
ensure(seal.format === 'p09-full-view-handoff-seal/1' && seal.status === 'ready-for-root-recomposition-and-integrated-pointer-gate' && seal.selected_assets.length === 3 && seal.new_image_files === 0 && seal.publication_executed === false && seal.memory_events === 0, 'Closed unconfirmed full-view handoff required.');
const get = async name => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..'), 'Unsafe selected input.');
  const pin = seal.inventory[name], file = resolve(selected, name);
  ensure(pin && await realpath(file) === file && relative(selected, file).startsWith('..') === false, 'Unselected or reparsed input.');
  const bytes = await readFile(file);
  ensure(bytes.length === pin.bytes && sha(bytes) === pin.sha256, 'Full-view input drift: ' + name);
  return bytes;
};
const contract = JSON.parse(await get('recomposition-contract.json'));
const proof = JSON.parse(await get('build-proof.json'));
ensure(proof.human_review === 'pending' && proof.historical_confirmation === false && proof.memory_events === 0 && proof.hosted_publication_executed === false, 'Working edition must not claim approval.');
const admissionBuffer = await get('admission.json');
ensure(sha(admissionBuffer) === 'a6648269b163546105d32f33ce62e9eb8e852dfc61daad0bac03b5503fffb804', 'Root full-view admission changed.');
const sourceBuffers = new Map(), pilotBuffers = new Map();
for (const [key, name] of Object.entries(contract.source_files)) sourceBuffers.set(key, await get(name));
for (const [key, name] of Object.entries(contract.pilot_files)) pilotBuffers.set(key, await get(name));
const adapter = resolve(root, 'scripts/archives-next-readings/adapter-full-view.mjs');
ensure(await realpath(adapter) === adapter && sha(await readFile(adapter)) === '603e738f6ab5164a6b7b74474deb9648a5cc7cc2da801d29729e071decd6dcca', 'Full-view adapter changed.');
const readerBytes = await readFile(resolve(base, 'site/dist/archives/index.html'));
ensure(sha(readerBytes) === seal.parent_sha256 && sha(readerBytes) === contract.parent_sha256, 'Exact v10 reader required.');
const { composeP09FullView } = await import(pathToFileURL(adapter).href);
const result = composeP09FullView({ enabled: true, parentHtml: readerBytes.toString('utf8'), parentSha256: sha(readerBytes), admissionBuffer, admissionSha256: sha(admissionBuffer), sourceBuffers, pilotBuffers });
const composed = Buffer.from(result.html);
ensure(sha(composed) === seal.reader_sha256 && composed.equals(await get('reader.html')) && Buffer.from(result.versionsHtml).equals(await get('versions-full.html')), 'Recomposition differs from qualified source.');
const assets = new Map(), allowed = new Set(['/assets/archives-next-reading-full.css', '/assets/archives-next-reading-full.js', result.historyRoute]);
for (const pin of seal.selected_assets) {
  ensure(allowed.delete(pin.route), 'Unexpected or duplicate route.');
  const bytes = await get(pin.file);
  ensure(bytes.length === pin.bytes && sha(bytes) === pin.sha256, 'Asset drift.');
  assets.set('dist/' + pin.route.slice(1) + (pin.route.endsWith('/') ? 'index.html' : ''), bytes);
}
ensure(allowed.size === 0 && result.photoDuplicated === false && result.retainedPilotVersionCount === 4 && result.fullVersionCount === 6 && result.preservedParentAfterRestoration, 'Full-view preservation failed.');
const files = {};
const put = async (name, bytes) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..') && !files[name], 'Unsafe/duplicate destination.');
  await mkdir(dirname(resolve(site, name)), { recursive: true });
  await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  if (name === 'runtime/package-checksums.json') continue;
  const file = resolve(base, 'site', name);
  ensure(await realpath(file) === file, 'Parent reparse refused.');
  const bytes = await readFile(file);
  ensure(bytes.length === pin.size_bytes && sha(bytes) === pin.sha256, 'Parent pin drift.');
  await put(name, name === 'dist/archives/index.html' ? composed : bytes);
}
for (const [name, bytes] of assets) await put(name, bytes);
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({
  ...previous, parent_assembly_sha256: sha(parentBytes),
  counts: { ...previous.counts, static_files: previous.counts.static_files + 3, full_reading_selected_files: 3 },
  next_reading: { ...previous.next_reading,
    full_view: { edition: result.editionId, line_count: 21, versions: 10, author_zones: result.authorZoneCount, independent_groups: result.independentGroupCount, comparison_rows: result.comparisonRowCounts, admission_sha256: sha(admissionBuffer), source_seal_sha256: sha(sealBytes), adapter_sha256: sha(await readFile(adapter)), photo_duplicated: false },
    line_count: 21, versions_preserved: 10, pointer_history_navigation: 'requires Root full-view browser gate',
  }, files,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, static_files: previous.counts.static_files + 3, direct_api_functions: previous.counts.direct_api_functions, selected_photos_total: 20, body_lines: 21, versions: 10, deployed: false }));
