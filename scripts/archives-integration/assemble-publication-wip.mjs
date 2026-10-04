import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';

const hash = b => createHash('sha256').update(b).digest('hex');
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const { values } = parseArgs({ options: { base: { type: 'string' }, d10: { type: 'string' }, output: { type: 'string' } } });
const root = await realpath(resolve('.')), base = await realpath(resolve(values.base)), d10 = await realpath(resolve(values.d10)), output = resolve(values.output), site = resolve(output, 'site');
ensure(relative(root, output).startsWith('.private' + sep + 'archives-integration' + sep) && await realpath(dirname(output)) === dirname(output), 'Fresh private output required.');
try { await lstat(output); throw new Error('Output exists.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const previous = JSON.parse(await readFile(resolve(base, 'assembly.json')));
ensure(previous.format === 'archives-publication-assembly/1' && previous.counts.static_files === 314 && previous.counts.texts === 166, 'Closed v3 selection required.');
const files = {};
const put = async (name, bytes, replace = false) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..') && (replace ? files[name] : !files[name]), 'Unsafe or colliding file.');
  await mkdir(dirname(resolve(site, name)), { recursive: true });
  await writeFile(resolve(site, name), bytes, { flag: replace ? 'w' : 'wx' }); files[name] = { size_bytes: bytes.length, sha256: hash(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  const source = resolve(base, 'site', name);
  ensure(await realpath(source) === source && relative(resolve(base, 'site'), source).split(sep).every(p => p !== '..'), 'Base selection escaped.');
  const bytes = await readFile(source); ensure(bytes.length === pin.size_bytes && hash(bytes) === pin.sha256, 'Base selection drift.');
  await put(name, bytes);
}
const listBytes = await readFile(resolve(d10, 'runtime-allowlist.json')), list = JSON.parse(listBytes);
ensure(list.version === 'public-wip-runtime-allowlist/v1' && list.project_root_outside_static_dist === true && list.owner_enabled === false, 'D10 allowlist contract required.');
const selected = [...list.runtime_files, ...list.generated_files, ...list.dependency_manifests];
ensure(selected.length === 29 && new Set(selected.map(x => x.target_relative_path)).size === 29, 'Exactly 29 disjoint D10 files required.');
for (const row of selected) {
  const name = row.target_relative_path;
  ensure(/^(?:scripts\/archive-corrections\/|api\/archive\/public\/monbezon\/)/u.test(name) && await realpath(row.source_path) === row.source_path, 'D10 selection escaped.');
  const bytes = await readFile(row.source_path); ensure(hash(bytes) === row.sha256 && bytes.length < 2 * 1024 * 1024, 'D10 source drift.');
  await put(name, bytes);
}
const clientName = 'dist/assets/archives-integration-corrections.js';
const oldClient = (await readFile(resolve(site, clientName))).toString('utf8');
ensure(oldClient.split('/api/archive/preview/').length === 2, 'Expected single D8 client prefix.');
await put(clientName, Buffer.from(oldClient.replace('/api/archive/preview/', '/api/archive/public/monbezon/')), true);
const correctionName = 'dist/archives/corrections/index.html';
const oldCorrection = (await readFile(resolve(site, correctionName))).toString('utf8');
ensure(oldCorrection.includes('Les propositions sont conservées dans cet atelier local.'), 'Expected prepared correction notice.');
await put(correctionName, Buffer.from(oldCorrection.replace('Les propositions sont conservées dans cet atelier local.', 'Les propositions sont conservées en attente d’examen.')), true);
const m2 = await readFile(resolve(root, 'scripts/archives-integration/publication-m2-links/annex-search-links.js'));
await put('dist/assets/archives-integration-m2-links.js', m2);
const m2Name = 'dist/archives/recherche/index.html', m2Html = (await readFile(resolve(site, m2Name))).toString('utf8');
ensure(m2Html.includes('</body>') && !m2Html.includes('archives-integration-m2-links.js'), 'M2 page shell drift.');
await put(m2Name, Buffer.from(m2Html.replace('</body>', '<script src="/assets/archives-integration-m2-links.js" defer></script></body>')), true);
const config = JSON.parse(await readFile(resolve(site, 'vercel.json'))), additions = JSON.parse(await readFile(resolve(d10, 'vercel.additions-only.json')));
ensure(Object.keys(additions).length === 1 && Object.keys(additions.functions).length === 1 && !config.functions, 'Function configuration collision.');
config.functions = additions.functions;
await put('vercel.json', Buffer.from(JSON.stringify(config, null, 2) + '\n'), true);
const staticPins = Object.fromEntries(Object.entries(files).filter(([name]) => name.startsWith('dist/')));
await put('runtime/static-checksums.json', Buffer.from(JSON.stringify(staticPins, null, 2) + '\n'), true);
const verifier = `import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';const pins=JSON.parse(await readFile('runtime/package-checksums.json','utf8'));const seen=[];async function visit(path=''){for(const item of await readdir(path||'.',{withFileTypes:true})){const file=path?path+'/'+item.name:item.name;if(file==='scripts/archive-corrections/hosted/serverless/node_modules'&&item.isDirectory())continue;if(item.isSymbolicLink())throw new Error('Link refused');if(item.isDirectory())await visit(file);else{if(file==='runtime/package-checksums.json')continue;if(!pins[file])throw new Error('Unexpected package file');const bytes=await readFile(file);if(bytes.length!==pins[file].size_bytes||createHash('sha256').update(bytes).digest('hex')!==pins[file].sha256)throw new Error('Package drift');seen.push(file);}}}await visit();if(seen.length!==Object.keys(pins).length)throw new Error('Missing package file');console.log('Selected Website WIP package verified: '+seen.length+' files');\n`;
await put('scripts/verify-archives-package.mjs', Buffer.from(verifier), true);
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({ ...previous, parent_assembly_sha256: hash(await readFile(resolve(base, 'assembly.json'))), d10_allowlist_sha256: hash(listBytes), corrections: { profile: 'monbezon-wip', context_sha256: files['scripts/archive-corrections/public-wip/delivery-assets/exact-context.json'].sha256, source_status: 'pending / unreviewed / not-published', user_wip_delivery_authorized: true, owner_enabled: false, production_configuration_present: false }, counts: { ...previous.counts, static_files: Object.keys(staticPins).length, correction_runtime_selected_files: 29, correction_api_wrappers: 10, m2_literal_search_asset: 1 }, missing_external: ['Configured PostgreSQL role/schema seeded by separate operator and strict TLS', 'Six production environment values and pinned dependency provisioning', 'Qualified owner validation access', 'Publication in existing hosting project'], files }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, static_files: Object.keys(staticPins).length, d10_selected_files: 29, deployed: false }));
