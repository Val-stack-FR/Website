import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { parseArgs } from 'node:util';
const ensure = (ok, message) => { if (!ok) throw new Error(message); }, hash = b => createHash('sha256').update(b).digest('hex');
const { values } = parseArgs({ options: { base: { type: 'string' }, output: { type: 'string' } } });
const root = await realpath(resolve('.')), base = await realpath(resolve(values.base)), output = resolve(values.output), site = resolve(output, 'site');
ensure(relative(root, output).startsWith('.private' + sep + 'archives-integration' + sep) && await realpath(dirname(output)) === dirname(output), 'Fresh private output required.');
try { await lstat(output); throw new Error('Output exists.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const previousBytes = await readFile(resolve(base, 'assembly.json')), previous = JSON.parse(previousBytes);
ensure(previous.format === 'archives-publication-assembly/1' && previous.counts.correction_api_wrappers === 10, 'Selected v4 candidate required.');
const refused = ['auth/login', 'auth/session', 'auth/logout', 'auth/revoke-all', 'owner/corrections', 'owner/decisions', 'owner/export'];
const omitted = new Set(refused.map(route => 'api/archive/public/monbezon/' + route + '.mjs'));
ensure([...omitted].every(name => previous.files[name]), 'Seven existing deny wrappers required.');
const files = {};
const put = async (name, bytes, replace = false) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..') && (replace ? files[name] : !files[name]), 'Unsafe or colliding file.');
  await mkdir(dirname(resolve(site, name)), { recursive: true }); await writeFile(resolve(site, name), bytes, { flag: replace ? 'w' : 'wx' }); files[name] = { size_bytes: bytes.length, sha256: hash(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  if (omitted.has(name) || name === 'runtime/package-checksums.json') continue;
  const source = resolve(base, 'site', name); ensure(await realpath(source) === source, 'Source reparse point refused.');
  const bytes = await readFile(source); ensure(hash(bytes) === pin.sha256 && bytes.length === pin.size_bytes, 'Closed v4 file changed.'); await put(name, bytes);
}
// One unconditional denial function keeps all seven owner routes closed before
// any environment lookup, pool creation, SQL or cookie. No user role is accepted.
const deny = `import {ApiError} from '../scripts/archive-corrections/contract.mjs';\nimport {sendWipError} from '../scripts/archive-corrections/public-wip/candidate.mjs';\nexport default function(request,response){sendWipError(response,new ApiError(403,'owner_access_unqualified','Owner login, decisions, queue and export are disabled.'));}\n`;
await put('api/archive-owner-disabled.mjs', Buffer.from(deny));
const config = JSON.parse(await readFile(resolve(site, 'vercel.json')));
const sources = new Set(config.rewrites.map(rule => rule.source));
ensure(refused.every(route => !sources.has('/api/archive/public/monbezon/' + route)), 'Deny rewrite collision.');
config.rewrites = [...refused.map(route => ({ source: '/api/archive/public/monbezon/' + route, destination: '/api/archive-owner-disabled' })), ...config.rewrites];
config.functions['api/archives/**/*.mjs'] = { maxDuration: 10, includeFiles: 'runtime/archives/selected-data.json' };
config.functions['api/archive-owner-disabled.mjs'] = { maxDuration: 10 };
await put('vercel.json', Buffer.from(JSON.stringify(config, null, 2) + '\n'), true);
// Root engines applies to the hosted project; the nested D5 manifest remains exact.
await put('package.json', Buffer.from(JSON.stringify({ name: 'valerianteissier-archives-candidate', private: true, type: 'module', engines: { node: '24.x' } }, null, 2) + '\n'));
const api = Object.keys(files).filter(name => name.startsWith('api/') && name.endsWith('.mjs'));
ensure(api.length === 12, 'Hobby direct-function limit exceeded.');
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({ ...previous, parent_assembly_sha256: hash(previousBytes), hosting_preparation: { node_engine: '24.x', direct_api_functions: 12, deny_routes: 7, production_dependency_provisioning: 'pending separate locked offline pilot', runtime_data_explicitly_included: true, node_version_reference: 'https://vercel.com/docs/functions/runtimes/node-js/node-js-versions', direct_function_limit_reference: 'https://vercel.com/docs/functions/runtimes#functions-created-per-deployment' }, counts: { ...previous.counts, correction_runtime_selected_files: 22, correction_api_wrappers: 3, disabled_owner_function: 1, direct_api_functions: 12 }, excluded_closed_d10_wrappers: [...omitted], files }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, direct_api_functions: api.length, owner_enabled: false, deployed: false }));
