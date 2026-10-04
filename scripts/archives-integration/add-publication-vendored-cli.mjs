import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { parseArgs } from 'node:util';

const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const { values } = parseArgs({ options: { base: { type: 'string' }, dependencies: { type: 'string' }, output: { type: 'string' } } });
const root = await realpath(resolve('.')), base = await realpath(resolve(values.base));
const dependencies = await realpath(resolve(values.dependencies));
const output = resolve(values.output), site = resolve(output, 'site');
ensure(relative(root, output).startsWith('.private' + sep + 'archives-integration' + sep) && await realpath(dirname(output)) === dirname(output), 'Fresh private output required.');
try { await lstat(output); throw new Error('Output exists.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const priorBytes = await readFile(resolve(base, 'assembly.json')), previous = JSON.parse(priorBytes);
ensure(sha(priorBytes) === 'c9ea0b10f31db70dfaf95a088df4246b9b47f7d9f31c888f7f72a7532e1eca7f', 'Only the independently reviewed v8 parent is qualified for this delta.');
ensure(previous.counts.direct_api_functions === 12 && previous.counts.texts === 166 && previous.counts.selected_photos === 19, 'Qualified base required.');
const manifestBytes = await readFile(resolve(dependencies, 'run-manifest.json')), manifest = JSON.parse(manifestBytes);
const closed = async name => {
  const bytes = await readFile(resolve(dependencies, name));
  const pin = manifest.outputs.find(item => item.uri.endsWith('/' + name));
  ensure(pin && pin.sha256 === sha(bytes), 'Closed source pin mismatch: ' + name);
  return bytes;
};
const selectionBytes = await closed('delivery-allowlist.json'), selection = JSON.parse(selectionBytes);
const closeout = JSON.parse(await closed('closeout-state.json'));
ensure(selection.file_count === 10 && selection.files.length === 10 && selection.vercel_function_delta === 0 && !selection.linux_qualified && !selection.vercel_tested, 'Unexpected delivery scope.');
ensure(closeout.install_attempts === 1 && closeout.installer_exit_code === 0 && closeout.version_exit_code === 0 && closeout.installed_packages === 39 && closeout.downloads === 0 && closeout.network_attempts === 0 && closeout.cold_wrapper_imports === 10 && closeout.pool_constructors === 0 && !closeout.linux_execution && !closeout.vercel_build_executed, 'Local qualification absent or overstated.');
const added = new Map();
for (const pin of selection.files) {
  const name = pin.target_relative_path;
  ensure(name.startsWith('ops/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..') && !added.has(name), 'Unsafe or duplicate operator path.');
  const source = resolve(dependencies, 'deployment-overlay', name);
  ensure(await realpath(source) === source && source === resolve(pin.source_path), 'Selected source path drift.');
  const bytes = await readFile(source);
  ensure(bytes.length === pin.bytes && sha(bytes) === pin.sha256, 'Selected operator drift.');
  added.set(name, bytes);
}
const files = {};
const put = async (name, bytes) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..') && !files[name], 'Unsafe or duplicate destination.');
  await mkdir(dirname(resolve(site, name)), { recursive: true });
  await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  if (name === 'runtime/package-checksums.json') continue;
  const source = resolve(base, 'site', name);
  ensure(await realpath(source) === source, 'Base reparse refused.');
  const bytes = await readFile(source);
  ensure(bytes.length === pin.size_bytes && sha(bytes) === pin.sha256, 'Base candidate drift.');
  if (added.has(name)) {
    ensure(name === 'ops/provision-archive-runtime.mjs', 'Unexpected replacement of existing file.');
    continue;
  }
  await put(name, bytes);
}
for (const [name, bytes] of added) await put(name, bytes);
const config = JSON.parse(await readFile(resolve(site, 'vercel.json'), 'utf8'));
ensure(config.installCommand === 'node ops/provision-archive-runtime.mjs', 'Provisioning command mismatch.');
ensure(!JSON.stringify(config.functions).includes('ops/'), 'Build operator leaked into function includes.');
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({
  ...previous, parent_assembly_sha256: sha(priorBytes),
  dependency_source_manifest_sha256: sha(manifestBytes),
  dependency_provisioning: {
    ...previous.dependency_provisioning,
    cli_source_selection_sha256: sha(selectionBytes),
    vendored_cli_files: 6, vendored_cli_bytes: selection.selected_public_cli_bytes,
    selected_operator_files: 4, uses_path_or_corepack: false,
    local_offline_install_qualified: true, local_node_version: '24.19.0', pnpm_version: '11.19.0',
    qualified_platform: 'win32/x64/Node v24.19.0',
    hosting_cli_selection_explicit: true,
    hosting_pnpm_availability_qualified: false,
    linux_qualified: false, build_operator_executed_on_hosting: false,
    missing_platform_proof_refused_before_install: true,
    copied_private_node_modules: false, added_api_functions: 0,
  },
  missing_external: [
    'Actual Linux qualification of the selected CLI/operator for the hosting Node version',
    'Configured PostgreSQL role/schema seeded by separate operator and strict TLS',
    'Six production environment values',
    'Qualified owner validation access',
    'Publication in existing hosting project',
  ],
  files,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, selected_delta_files: 10, static_files: previous.counts.static_files, direct_api_functions: 12, linux_qualified: false, deployed: false }));
