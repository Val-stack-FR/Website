import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { parseArgs } from 'node:util';

const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const { values } = parseArgs({ options: { base: { type: 'string' }, dependencies: { type: 'string' }, output: { type: 'string' } } });
const root = await realpath(resolve('.'));
const base = await realpath(resolve(values.base));
const dependencies = await realpath(resolve(values.dependencies));
const output = resolve(values.output), site = resolve(output, 'site');
ensure(relative(root, output).startsWith('.private' + sep + 'archives-integration' + sep) && await realpath(dirname(output)) === dirname(output), 'Fresh private output required.');
try { await lstat(output); throw new Error('Output already exists.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const assemblyBytes = await readFile(resolve(base, 'assembly.json'));
const previous = JSON.parse(assemblyBytes);
ensure(previous.counts.direct_api_functions === 12 && previous.hosting_preparation.owner_denial_imports === 0, 'Qualified isolated-denial candidate required.');
const manifestBytes = await readFile(resolve(dependencies, 'run-manifest.json'));
const manifest = JSON.parse(manifestBytes);
const selected = {};
for (const name of ['provision-build.mjs', 'root-package.fragment.json', 'vercel.install-addition.proposed.json', 'closeout-state.json']) {
  const pin = manifest.outputs.find(item => item.uri.endsWith('/' + name));
  const bytes = await readFile(resolve(dependencies, name));
  ensure(pin && pin.sha256 === sha(bytes), 'Closed D12 source pin mismatch: ' + name);
  selected[name] = bytes;
}
const closeout = JSON.parse(selected['closeout-state.json']);
ensure(closeout.installer_success && closeout.installer_exit_code === 0 && closeout.cold_start_passed && closeout.wrapper_imports === 10 && closeout.exact_package_and_lock_unchanged && !closeout.production_build_executed, 'D12 qualification missing or overstated.');
const files = {};
const put = async (name, bytes) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..') && !files[name], 'Unsafe or duplicate file.');
  await mkdir(dirname(resolve(site, name)), { recursive: true });
  await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  if (['package.json', 'vercel.json', 'runtime/package-checksums.json'].includes(name)) continue;
  const source = resolve(base, 'site', name);
  ensure(await realpath(source) === source, 'Base reparse refused.');
  const bytes = await readFile(source);
  ensure(bytes.length === pin.size_bytes && sha(bytes) === pin.sha256, 'Base candidate changed.');
  await put(name, bytes);
}
const rootPackage = JSON.parse(await readFile(resolve(base, 'site/package.json'), 'utf8'));
const fragment = JSON.parse(selected['root-package.fragment.json']);
ensure(fragment.engines.node === '24.x' && fragment.packageManager === 'pnpm@11.19.0', 'Unexpected qualified toolchain.');
await put('package.json', Buffer.from(JSON.stringify({ ...rootPackage, ...fragment }, null, 2) + '\n'));
const config = JSON.parse(await readFile(resolve(base, 'site/vercel.json'), 'utf8'));
const addition = JSON.parse(selected['vercel.install-addition.proposed.json']);
ensure(Object.keys(addition).length === 1 && addition.installCommand === 'node ops/provision-archive-runtime.mjs', 'Unexpected installation addition.');
await put('vercel.json', Buffer.from(JSON.stringify({ ...config, ...addition }, null, 2) + '\n'));
await put('ops/provision-archive-runtime.mjs', selected['provision-build.mjs']);
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
const assembly = {
  ...previous,
  parent_assembly_sha256: sha(assemblyBytes),
  dependency_source_manifest_sha256: sha(manifestBytes),
  dependency_provisioning: {
    local_offline_install_qualified: true,
    local_node_version: '24.19.0', pnpm_version: '11.19.0',
    reused_packages: 39, downloads: 0, network_requests: 0,
    exact_lock_and_package_preserved: true,
    copied_private_node_modules: false,
    build_operator: 'ops/provision-archive-runtime.mjs',
    build_operator_executed_on_hosting: false,
    hosting_pnpm_availability_qualified: false,
    installation_scripts_disabled: true,
    added_api_functions: 0,
  },
  missing_external: [
    'Configured PostgreSQL role/schema seeded by separate operator and strict TLS',
    'Six production environment values',
    'Hosting availability of exact pnpm 11.19.0 and execution of the prepared locked build',
    'Qualified owner validation access',
    'Publication in existing hosting project',
  ],
  files,
};
await writeFile(resolve(output, 'assembly.json'), JSON.stringify(assembly, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, files: Object.keys(files).length, direct_api_functions: 12, copied_private_node_modules: false, deployed: false }));
