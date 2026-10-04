import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const parentName = 'publication-package-20261004-v13-r2';
const parent = resolve('.private/archives-integration', parentName);
const output = resolve('.private/archives-integration/publication-package-20261004-v14');
const site = resolve(output, 'site');
const fileUi = resolve('.private/archives-next-readings/p09-file-reading-ui-20261004-v1');
const humanUi = resolve('.private/archives-next-readings/reader-human-cleanup-20261004-v1');
try { await lstat(output); throw Error('Fresh human-review package required.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
// Authors close their selected handoffs before Root assembles any candidate.
await readFile(resolve(fileUi, 'HANDOFF.md')); await readFile(resolve(humanUi, 'HANDOFF.md'));
const parentBytes = await readFile(resolve(parent, 'assembly.json'));
ensure(sha(parentBytes) === 'c1d48e7bde4001be90cfacf2cfd23e39cb008cff7ac7f2b2b301f85f1a363bec', 'Qualified live parent required.');
const previous = JSON.parse(parentBytes), files = {}, additions = {}, changed = {};
const readPinned = async (file, pin) => {
  ensure(await realpath(file) === file, 'Reparse source refused.'); const bytes = await readFile(file);
  ensure(sha(bytes) === pin.sha256 && bytes.length === (pin.bytes ?? pin.size_bytes), 'Selected source drift.'); return bytes;
};
const build = JSON.parse(await readFile(resolve(fileUi, 'build-proof.json')));
const contract = JSON.parse(await readFile(resolve(fileUi, 'integration-contract.json')));
const projection = JSON.parse(await readPinned(resolve(fileUi, 'projection.json'), build.outputs['projection.json']));
ensure(contract.routes.length === 6 && build.counts.source_body_lines === 21 && build.counts.prepared_points === 4 && build.counts.review_crop_assets === 3 && build.counts.new_photographic_views === 0, 'Three-crop file review MVP required.');
const rendererPin = build.outputs['code-snapshot/file-reading-adapter.mjs'];
await readPinned(resolve(fileUi, 'code-snapshot/file-reading-adapter.mjs'), rendererPin);
const { renderFileLibrary, renderFileReading } = await import(pathToFileURL(resolve(fileUi, 'code-snapshot/file-reading-adapter.mjs')).href);
ensure(sha(Buffer.from(renderFileLibrary(projection))) === build.outputs['library.html'].sha256 && sha(Buffer.from(renderFileReading(projection))) === build.outputs['p09.html'].sha256, 'File pages must recompose exactly.');
for (const entry of contract.routes) {
  const name = 'dist' + entry.route + (entry.route.endsWith('/') ? 'index.html' : '');
  ensure(!previous.files[name], 'New public route overlaps parent.');
  additions[name] = await readPinned(resolve(fileUi, entry.run_file), build.outputs[entry.run_file]);
}
const humanBuild = JSON.parse(await readFile(resolve(humanUi, 'build-proof.json')));
await readPinned(resolve(humanUi, 'code-snapshot/reader-human-cleanup.mjs'), humanBuild.outputs['code-snapshot/reader-human-cleanup.mjs']);
const { composeReaderHumanUi, restoreReaderHumanUi } = await import(pathToFileURL(resolve(humanUi, 'code-snapshot/reader-human-cleanup.mjs')).href);
const mainName = 'dist/archives/index.html', parentMain = await readPinned(resolve(parent, 'site', mainName), previous.files[mainName]);
const clean = composeReaderHumanUi({ enabled: true, parentName, parentHtml: parentMain.toString('utf8'), assemblyBytes: parentBytes });
ensure(restoreReaderHumanUi(clean) === parentMain.toString('utf8') && clean.counts['technical-details'] === 453 && clean.counts['human-alternatives'] === 21 && clean.humanVisibleTechnical === false, 'Human cleanup exceeds selected reversible scope.');
ensure(sha(Buffer.from(clean.html)) === humanBuild.parents[parentName].result_html.sha256, 'Human reader recomposition drift.');
changed[mainName] = Buffer.from(clean.html);
changed['dist/archives/formes-brouillons/index.html'] = additions['dist/archives/fichiers/index.html'];
const runtimeName = 'scripts/archives-integration/publication-runtime.mjs';
const runtimeSource = (await readPinned(resolve(parent, 'site', runtimeName), previous.files[runtimeName])).toString('utf8');
const oldNav = '<a href="/archives/formes-brouillons/">Lectures à revoir</a>';
ensure(runtimeSource.split(oldNav).length === 2, 'Unique runtime review navigation required.');
let runtime = runtimeSource.replace(oldNav, '<a href="/archives/fichiers/">Lectures par fichier</a>');
const insertion = "    try {\n      const page = queryDraftProjection(data.drafts, url.searchParams);";
const redirect = "    if (url.pathname === '/archives/formes-brouillons/') { response.writeHead(303, { 'Location': '/archives/fichiers/', 'Cache-Control': 'no-store' }); response.end(); return true; }\n";
ensure(runtime.split(insertion).length === 2, 'Unique legacy HTML branch required.');
runtime = runtime.replace(insertion, redirect + insertion);
ensure(runtime.replace(redirect, '').replace('<a href="/archives/fichiers/">Lectures par fichier</a>', oldNav) === runtimeSource, 'Runtime exceeds navigation/legacy redirect delta.');
changed[runtimeName] = Buffer.from(runtime);
const put = async (name, bytes) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..') && !files[name], 'Unsafe target.');
  await mkdir(dirname(resolve(site, name)), { recursive: true }); await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  if (name === 'runtime/package-checksums.json') continue;
  const bytes = await readPinned(resolve(parent, 'site', name), pin); await put(name, changed[name] || bytes);
}
for (const [name, bytes] of Object.entries(additions)) await put(name, bytes);
const staticCount = Object.keys(files).filter(name => name.startsWith('dist/')).length;
ensure(staticCount === previous.counts.static_files + 6 && Object.keys(files).filter(name => name.startsWith('api/') && name.endsWith('.mjs')).length === 10, 'Static or function count drift.');
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'human-cleanup-metadata.json'), JSON.stringify({ edits: clean.edits, metadata: clean.metadata }, null, 2) + '\n', { flag: 'wx' });
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({
  ...previous, parent_assembly_sha256: sha(parentBytes),
  counts: { ...previous.counts, static_files: staticCount, source_file_review_pages: 2, numbered_review_lines: 21, precise_review_crop_assets: 3 },
  human_review: { entry: '/archives/fichiers/', pilot: '/archives/fichiers/p09/', source_edition: 'author-full-view-r0', source_body_sha256: projection.sourceBodySha256, prepared_points: 4, extracted_contexts: 3, unlocalized_points: 1, new_photographic_views: 0, removed_visible_technical_blocks: 453, human_alternatives_retained: 21, protected_texts_and_references: clean.protectedCount, machine_source_data_unchanged: true, legacy_html_redirect: true, legacy_machine_json_unchanged: true, human_confirmation: false, browser_gate_pending: true },
  delta: { added: Object.keys(additions), modified: Object.keys(changed).concat('runtime/package-checksums.json'), removed: [] }, files,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, static_files: staticCount, functions: 10, review_crops: 3, removed_technical_blocks: 453, browser_gate_pending: true }));
