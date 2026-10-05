import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = b => createHash('sha256').update(b).digest('hex');
const base = resolve('.private/archives-integration');
const parent = resolve(base, 'publication-package-20261004-v26-r3');
const output = resolve(base, 'publication-package-20261004-v27'), site = resolve(output, 'site');
try { await lstat(output); throw Error('Fresh output required'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const pinned = async (path, pin) => {
  ensure(await realpath(path) === path, 'Reparse input refused');
  const b = await readFile(path);
  ensure(sha(b) === pin.sha256 && (pin.bytes === undefined || b.length === pin.bytes), 'Input changed: ' + path);
  return b;
};
const parentBytes = await pinned(resolve(parent, 'assembly.json'), { sha256: '47f3dacee07ccaa0ab9d7c7d00f7fee91d5f4a96673bee9132a9b0f1927d5552' });
const previous = JSON.parse(parentBytes), changes = new Map(), inputs = {};
const addChange = (name, bytes) => { ensure(!changes.has(name), 'Overlapping delta'); changes.set(name, bytes); };
const e108 = resolve('.private/archives-next-readings/e108-four-photo-current-parent-delta-20261004-v1');
inputs.e108_handoff = sha(await pinned(resolve(e108, 'HANDOFF.md'), { sha256: 'c29dfacc90d2581ef0c39893fd556ec7a320061d7c8254a961be879782ba7c3c' }));
inputs.e108_seal = sha(await pinned(resolve(e108, 'seal.json'), { sha256: '9941ac0d1f929e4b4a31f29f4fc63efd3c748934d531ae15aabf7fd7489a54ab' }));
const whitelistBytes = await readFile(resolve(e108, 'whitelist.json'));
const whitelist = JSON.parse(whitelistBytes);
ensure(whitelist.parent_assembly.sha256 === sha(parentBytes) && whitelist.files.length === 6, 'E108 scope/parent drift');
const gate = JSON.parse(await pinned(resolve(e108, 'browser-gate.json'), { sha256: '10d8adb9324267b8d7e30aa5de411e859ef2dea9f84d2121547525f66a58da4a' }));
ensure(Object.values(gate.checks).every(value => value === true) && gate.integrated_trusted_touch_gate_passed === false && gate.root_main_mount_executed === false, 'Closed producer keyboard gate missing or scope changed');
for (const item of whitelist.files) {
  ensure(/^(?:dist\/|scripts\/archives-integration\/)/u.test(item.target) && !item.target.includes('..'), 'E108 escaped');
  if (item.before) ensure(previous.files[item.target]?.sha256 === item.before.sha256 && previous.files[item.target]?.size_bytes === item.before.bytes, 'E108 parent file drift');
  else ensure(!previous.files[item.target], 'E108 new file already present');
  addChange(item.target, await pinned(resolve(e108, 'composition', item.target), item.after));
}
inputs.e108_whitelist = sha(whitelistBytes);
const dependency = resolve('../Website-archives-corrections/.archive-corrections-private/publication-platform-dependency-fix-20261004-v1');
const depBytes = await readFile(resolve(dependency, 'dependency-allowlist.json')), dep = JSON.parse(depBytes);
ensure(dep.changes.length === 2 && dep.changes[0].target === 'package.json' && dep.changes[1].target === 'pnpm-lock.yaml', 'Dependency scope drift');
for (const item of dep.changes) {
  if (item.operation === 'replace') ensure(previous.files[item.target]?.sha256 === item.parent_sha256, 'Dependency parent drift');
  else ensure(!previous.files[item.target], 'Root lock already present');
  addChange(item.target, await pinned(resolve(dependency, item.proposed_file), item));
}
inputs.dependency_allowlist = sha(depBytes);
const graphBytes = await readFile(resolve(dependency, 'import-graph.json')), graph = JSON.parse(graphBytes);
for (const [name, pin] of Object.entries(graph.local_modules)) ensure(previous.files[name]?.sha256 === pin.sha256, 'Production graph changed: ' + name);
inputs.production_import_graph = sha(graphBytes);
const manifest = JSON.parse(changes.get('package.json'));
ensure(JSON.stringify(manifest.dependencies) === JSON.stringify({ pg: '8.23.1', '@vercel/functions': '3.9.11' }) || (Object.keys(manifest.dependencies).length === 2 && manifest.dependencies.pg === '8.23.1' && manifest.dependencies['@vercel/functions'] === '3.9.11'), 'Dependency versions drift');
for (const [name, b] of changes) {
  if (/\.html$/u.test(name)) ensure(!/<style\b|\sstyle=|\son\w+=|<script\b(?![^>]*\bsrc=)/iu.test(b.toString('utf8')), 'Inline execution introduced');
  if (/\.(?:mjs|js)$/u.test(name)) execFileSync(process.execPath, ['--input-type=module', '--check'], { input: b, stdio: ['pipe', 'pipe', 'pipe'] });
}
const board = changes.get('dist/archives/avancement/index.html').toString('utf8');
const oldBoard = await readFile(resolve(parent, 'site/dist/archives/avancement/index.html'), 'utf8');
const marker = '<template id="agent-statusboard-metadata"';
ensure(board.slice(board.indexOf(marker)) === oldBoard.slice(oldBoard.indexOf(marker)) && board.includes('25 photographies sont consultables avec zoom.') && board.includes('4 photos consultables sur 4'), 'Visible counter or inert snapshot changed');
const files = {}, put = async (name, b) => {
  ensure(!files[name] && !name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..'), 'Unsafe output');
  await mkdir(dirname(resolve(site, name)), { recursive: true }); await writeFile(resolve(site, name), b, { flag: 'wx' });
  files[name] = { size_bytes: b.length, sha256: sha(b) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  const b = await pinned(resolve(parent, 'site', name), { sha256: pin.sha256, bytes: pin.size_bytes });
  if (name !== 'runtime/package-checksums.json') await put(name, changes.get(name) ?? b);
}
for (const [name, b] of changes) if (!previous.files[name]) await put(name, b);
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
const added = [...changes.keys()].filter(n => !previous.files[n]);
const modified = [...changes.keys()].filter(n => previous.files[n]);
const photos = Object.entries(files).filter(([n]) => /^dist\/archives\/.*\.jpg$/u.test(n));
ensure(added.length === 3 && modified.length === 5 && photos.length === 25 && new Set(photos.map(([, p]) => p.sha256)).size === 25, 'Combined delta/count drift');
ensure(Object.keys(files).length === 450 && Object.keys(files).filter(n => n.startsWith('dist/')).length === 371, 'Package file drift');
const counts = { ...previous.counts, static_files: 371, additional_e108_gallery_photos: 4, consultable_jpeg_photo_views: 25 };
const assembly = { ...previous, parent_assembly_sha256: sha(parentBytes), counts,
  hosting_preparation: { ...previous.hosting_preparation, direct_api_functions: 10, production_dependency_provisioning: 'Exact root package and frozen pnpm lock included; fresh final Windows qualification pending' },
  context_galleries: { ...previous.context_galleries, e108_previews: ['11.jpg', '12.jpg', '13.jpg', '14.jpg'], integrated_browser_pending: true },
  statusboard_photography_counter_correction: { ...previous.statusboard_photography_counter_correction, current_distinct_jpeg_views: 25 },
  selected_delta_inputs: inputs, delta: { added, modified: modified.concat('runtime/package-checksums.json'), removed: [] }, files };
await writeFile(resolve(output, 'assembly.json'), JSON.stringify(assembly, null, 2) + '\n', { flag: 'wx' });
await writeFile(resolve(output, 'preservation.json'), JSON.stringify({ parent_assembly_sha256: sha(parentBytes), all_parent_files_rehashed: true, source_texts_versions_api_json_old_media_unchanged: true, inherited_jpegs_exact: 23, store_files_not_accessed: true, no_original_read: true, historical_confirmation: false, added, modified, removed: [] }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, package_files: 450, static_files: 371, photos: 25, added: added.length, modified: modified.length, browser_and_final_install_pending: true }));
