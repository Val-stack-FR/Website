import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { parseArgs } from 'node:util';
const ensure = (ok, message) => { if (!ok) throw new Error(message); }, hash = b => createHash('sha256').update(b).digest('hex');
const { values } = parseArgs({ options: { base: { type: 'string' }, output: { type: 'string' } } });
const root = await realpath(resolve('.')), base = await realpath(resolve(values.base)), output = resolve(values.output), site = resolve(output, 'site');
ensure(relative(root, output).startsWith('.private' + sep + 'archives-integration' + sep) && await realpath(dirname(output)) === dirname(output), 'Fresh private output required.');
try { await lstat(output); throw new Error('Output exists.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const previousBytes = await readFile(resolve(base, 'assembly.json')), previous = JSON.parse(previousBytes), files = {};
ensure(previous.hosting_preparation.direct_api_functions === 12 && previous.files['api/archive-owner-disabled.mjs'], 'V5 selected candidate required.');
const put = async (name, bytes) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..') && !files[name], 'Unsafe or duplicate package file.');
  await mkdir(dirname(resolve(site, name)), { recursive: true }); await writeFile(resolve(site, name), bytes, { flag: 'wx' }); files[name] = { size_bytes: bytes.length, sha256: hash(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  if (['api/archive-owner-disabled.mjs', 'runtime/package-checksums.json'].includes(name)) continue;
  const source = resolve(base, 'site', name); ensure(await realpath(source) === source, 'Base reparse refused.');
  const bytes = await readFile(source); ensure(bytes.length === pin.size_bytes && hash(bytes) === pin.sha256, 'Base candidate drift.'); await put(name, bytes);
}
const body = { candidate_api_version: 'archive-corrections/public-wip-v1', data_kind: 'historical-local', simulation: true, identity_verified: false, historical_reading_validated: false, reading_confirmed: false, rights_approved: false, public_rights_review: 'pending', human_validation_enabled: false, owner_access_enabled: false, decisions_enabled: false, user_wip_delivery_authorized: true, wip_delivery_enabled: true, publication_enabled: false, delivery_profile: 'monbezon-wip', mandate_id: 'mandate:monbezon-wip-20261004', error: { code: 'owner_access_unqualified', message: 'Owner login, decisions, queue and export are disabled.' } };
const denial = `const body=Buffer.from(JSON.stringify(${JSON.stringify(body)})+'\\n');\nexport default function(request,response){response.writeHead(403,{'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});response.end(request.method==='HEAD'?undefined:body);}\n`;
await put('api/archive-owner-disabled.mjs', Buffer.from(denial));
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({ ...previous, parent_assembly_sha256: hash(previousBytes), hosting_preparation: { ...previous.hosting_preparation, owner_denial_imports: 0, owner_denial_dependency_or_migration_reads: false }, files }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, direct_api_functions: 12, owner_denial_imports: 0, deployed: false }));
