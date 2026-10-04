import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const parent = resolve('.private/archives-integration/publication-package-20261004-v12-r2');
const output = resolve('.private/archives-integration/publication-package-20261004-v13-r2');
const site = resolve(output, 'site');
const ui = resolve('.private/archives-next-readings/p09-corrections-ui-20261004-v1/reviewed-r2');
const backend = resolve('Z:/Codex/repos/Website-archives-corrections/.archive-corrections-private');
const d14 = resolve(backend, 'd14-p09-corrections-ae8f65bb-c7f6-4c90-92f7-6928af6b96cd');
const d15 = resolve(backend, 'd15-hosted-entry-2d67c079-33e7-4e89-879b-4285e6c2117e');
try { await lstat(output); throw new Error('Fresh package required.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const parentBytes = await readFile(resolve(parent, 'assembly.json'));
ensure(sha(parentBytes) === '47b9867149924b6f0b47a7929b6cbced4a3b1a06770c5c6298b32cac937fcb37', 'Qualified parent required.');
const previous = JSON.parse(parentBytes), files = {}, changed = {}, additions = {};
const readPinned = async (file, hash, size) => {
  ensure(await realpath(file) === file, 'Reparse source refused.');
  const bytes = await readFile(file);
  ensure(sha(bytes) === hash && (size === undefined || bytes.length === size), 'Selected source drift.');
  return bytes;
};
const contract = JSON.parse(await readFile(resolve(ui, 'integration-contract.json')));
ensure(contract.new_public_routes.length === 5 && contract.source.line_count === 21 && contract.browser_e2e_pending && contract.inline_code === false, 'Exact five-file proposed-edition UI required.');
const { renderP09CorrectionsPage } = await import(pathToFileURL(resolve(ui, contract.renderer_file)).href);
await readPinned(resolve(ui, contract.renderer_file), contract.renderer_sha256);
const sourceCorrection = await readPinned(resolve(parent, 'site/dist/archives/corrections/index.html'), contract.parent_page_sha256);
const formAdapter = await readPinned(resolve(ui, 'site/assets/archives-p09-corrections/form-adapter.mjs'), contract.d14_form_adapter_sha256);
const selection = await readPinned(resolve(ui, 'site/assets/archives-p09-corrections/selection.mjs'), contract.d14_selection_sha256);
const rendered = renderP09CorrectionsPage({ parentHtml: sourceCorrection.toString('utf8'), parentSha256: contract.parent_page_sha256, formAdapterBuffer: formAdapter, selectionBuffer: selection });
const renderedHtml = typeof rendered === 'string' ? rendered : rendered.html;
ensure(typeof renderedHtml === 'string' && sha(Buffer.from(renderedHtml)) === contract.new_public_routes[0].sha256, 'UI recomposition drift.');
for (const pin of contract.new_public_routes) additions['dist/' + pin.run_file.slice(5)] = await readPinned(resolve(ui, pin.run_file), pin.sha256, pin.bytes);
for (const run of [d14, d15]) {
  const delta = JSON.parse(await readFile(resolve(run, 'delta-allowlist.json')));
  ensure(delta.files.length === (run === d14 ? 9 : 7), 'Exact backend delta required.');
  for (const pin of delta.files) {
    ensure(!previous.files[pin.target_relative_path] && !additions[pin.target_relative_path], 'Unexpected backend replacement.');
    additions[pin.target_relative_path] = await readPinned(resolve(run, 'deployment-overlay', pin.target_relative_path), pin.sha256, pin.bytes);
  }
}
const removed = ['api/archive/public/monbezon/health.mjs', 'api/archive/public/monbezon/passage.mjs', 'api/archive/public/monbezon/corrections.mjs'];
ensure(removed.every(name => previous.files[name]), 'Three old wrappers required.');
const config = JSON.parse(await readFile(resolve(parent, 'site/vercel.json')));
const oldSelector = 'api/archive/public/monbezon/**/*.mjs';
ensure(config.functions[oldSelector], 'Old function selector missing.');
delete config.functions[oldSelector];
const newFunctions = JSON.parse(await readFile(resolve(d15, 'functions.single-entry.proposed.json'))).functions;
Object.assign(config.functions, newFunctions);
const publicRewrites = JSON.parse(await readFile(resolve(d15, 'rewrites.exact.proposed.json'))).rewrites;
ensure(publicRewrites.length === 6 && publicRewrites.every(r => !config.rewrites.some(old => old.source === r.source)), 'Unexpected public rewrite overlap.');
config.rewrites.unshift(...publicRewrites);
const ownerRules = config.rewrites.filter(rule => rule.source.startsWith('/api/archive/public/monbezon/') && rule.destination === '/api/archive-owner-disabled');
ensure(ownerRules.length === 7, 'Existing owner refusals required.');
config.rewrites.unshift(...ownerRules.map(rule => ({ ...rule, source: rule.source.replace('/monbezon/', '/p09/') })));
for (const pin of contract.new_public_routes.filter(pin => pin.route.endsWith('.mjs'))) config.headers.push({ source: pin.route, headers: [{ key: 'Content-Type', value: 'text/javascript; charset=utf-8' }] });
changed['vercel.json'] = Buffer.from(JSON.stringify(config, null, 2) + '\n');
const mainName = 'dist/archives/index.html', originalMain = (await readFile(resolve(parent, 'site', mainName))).toString('utf8');
const anchor = '<a href="/archives/formes/p09/">Quatre lectures à vérifier dans le brouillon auteur</a>';
const link = ' <a href="/archives/corrections/p09/">Proposer une correction de cette édition P09</a>';
ensure(originalMain.split(anchor).length === 2, 'Unique P09 link insertion required.');
const main = originalMain.replace(anchor, anchor + link);
ensure(main.replace(link, '') === originalMain, 'Other act content changed.');
changed[mainName] = Buffer.from(main);
const put = async (name, bytes) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..') && !files[name], 'Unsafe destination.');
  await mkdir(dirname(resolve(site, name)), { recursive: true }); await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  if (name === 'runtime/package-checksums.json' || removed.includes(name)) continue;
  const bytes = await readPinned(resolve(parent, 'site', name), pin.sha256, pin.size_bytes);
  await put(name, changed[name] || bytes);
}
for (const [name, bytes] of Object.entries(additions)) await put(name, bytes);
const closure = JSON.parse(await readFile(resolve(d15, 'runtime-allowlist.json')));
ensure(closure.files.length === 31, 'D15 closure count differs.');
for (const pin of closure.files) ensure(files[pin.target_relative_path]?.sha256 === pin.sha256 && files[pin.target_relative_path].size_bytes === pin.bytes, 'D15 shared dependency drift.');
const apiFunctions = Object.keys(files).filter(name => name.startsWith('api/') && name.endsWith('.mjs'));
ensure(apiFunctions.length === 10 && !apiFunctions.some(name => removed.includes(name)), 'Ten physical API functions required.');
const staticCount = Object.keys(files).filter(name => name.startsWith('dist/')).length;
ensure(staticCount === previous.counts.static_files + 5 && Object.keys(files).length < 500, 'Static or total package budget drift.');
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({
  ...previous, parent_assembly_sha256: sha(parentBytes),
  counts: { ...previous.counts, static_files: staticCount, correction_api_wrappers: 1, direct_api_functions: apiFunctions.length, p09_correction_public_files: 5, p09_backend_delta_files: 9, two_profile_entry_delta_files: 7 },
  p09_corrections: { route: '/archives/corrections/p09/', profile: 'p09-wip', edition_id: contract.source.edition_id, body_sha256: contract.source.diplomatic_sha256, modern_sha256: contract.source.french_sha256, proposed_lines: 21, human_decisions_enabled: false, original_source_unchanged: true, browser_e2e_pending: true },
  hosted_two_profile_entry: { entry: 'api/archive/public-router.mjs', exact_rewrites: 6, owner_refusals: 14, schema_isolation: true, provisioning_from_get: false, real_hosted_pg_tls_qualified: false, actual_vercel_rewrites_qualified: false, deployed: false },
  delta: { added: Object.keys(additions), modified: Object.keys(changed).concat('runtime/package-checksums.json'), removed }, files,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, static_files: staticCount, functions: apiFunctions.length, new_photos: 0, browser_gate_pending: true }));
