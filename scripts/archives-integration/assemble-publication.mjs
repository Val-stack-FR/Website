import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, realpath, lstat } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { decoratePublicationHtml } from './publication-runtime.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (value, message) => { if (!value) throw new Error(message); };
const { values } = parseArgs({ options: { snapshot: { type: 'string' }, output: { type: 'string' } } });
const root = await realpath(resolve('.')), snapshotRoot = await realpath(resolve(values.snapshot)), target = resolve(values.output);
ensure(relative(root, target).startsWith('.private' + sep + 'archives-integration' + sep) && await realpath(dirname(target)) === dirname(target), 'Use a fresh private assembly directory.');
try { await lstat(target); throw new Error('Assembly output exists.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const snapshotBytes = await readFile(resolve(snapshotRoot, 'snapshot.json')), snapshot = JSON.parse(snapshotBytes);
ensure(snapshot.scope === 'full' && snapshot.counts.text_files === 166 && snapshot.counts.selected_derivatives === 19 && snapshot.routes.length <= 240, 'Full accepted consultation snapshot required.');
const files = new Map(), site = resolve(target, 'site');
const selectedStaticFiles = new Set(snapshot.routes.map(row => row.file));
const add = async (name, bytes) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..') && !files.has(name), 'Unsafe or duplicate package file.');
  await mkdir(dirname(resolve(site, name)), { recursive: true });
  await writeFile(resolve(site, name), bytes, { flag: 'wx' }); files.set(name, { size_bytes: bytes.length, sha256: hash(bytes) });
};
// The existing public build is an input, not the repository's source tree.
// Archives are replaced by the selected snapshot. The unpublished library and
// all repository/runtime internals are refused rather than broadly copied.
const copyPortfolio = async (folder = '') => {
  const source = resolve(root, 'dist', folder);
  ensure(await realpath(source) === source, 'Public build reparse point refused.');
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const name = folder ? folder + '/' + entry.name : entry.name;
    if (name === 'archives' || selectedStaticFiles.has(name)) continue;
    if (entry.name === '.gitkeep') continue;
    ensure(!entry.isSymbolicLink() && !name.split('/').some(part => part.startsWith('.')) && !/(?:^|\/)library(?:\.html|\.css|\.js)?$/u.test(name) && !/\.(?:toml|env|sqlite|db)$/u.test(name) && (!name.endsWith('.md') || /^(?:essays|books)\//u.test(name)) && !/(?:^|\/)(?:node_modules|scripts|api|package\.json)(?:\/|$)/u.test(name), 'Internal or unpublished file in public build: ' + name);
    if (entry.isDirectory()) await copyPortfolio(name);
    else { ensure(entry.isFile() && files.size < 500, 'Unexpected public build entry.'); await add('dist/' + name, await readFile(resolve(root, 'dist', name))); }
  }
};
await mkdir(site, { recursive: true }); await copyPortfolio();
for (const row of snapshot.routes) {
  const source = resolve(snapshotRoot, 'site/dist', row.file);
  ensure(await realpath(source) === source && relative(resolve(snapshotRoot, 'site/dist'), source).split(sep).every(part => part !== '..'), 'Snapshot file escapes source.');
  let bytes = await readFile(source);
  ensure(hash(bytes) === row.sha256 && bytes.length === row.size_bytes, 'Snapshot drift during assembly.');
  if (row.content_type.startsWith('text/html')) bytes = Buffer.from(decoratePublicationHtml(bytes.toString('utf8')));
  await add('dist/' + row.file, bytes);
}
const proof = JSON.parse(await readFile(resolve(root, '.private/archives-integration/publication-data-20261004-v1/verification.json')));
const dataBytes = await readFile(resolve(root, '.private/archives-integration/publication-data-20261004-v1/selected-runtime-data.json'));
ensure(proof.passed === true && hash(dataBytes) === proof.sha256, 'Runtime selection drift.');
await add('runtime/archives/selected-data.json', dataBytes);
const copied = new Set();
async function copyModule(module) {
  const file = resolve(root, module), name = relative(root, file).split(sep).join('/');
  ensure(name.startsWith('scripts/') && name.endsWith('.mjs') && !name.split('/').includes('..') && await realpath(file) === file && copied.size < 40, 'Runtime import outside explicit source area.');
  if (copied.has(name)) return; copied.add(name);
  const bytes = await readFile(file), text = bytes.toString('utf8');
  await add(name, bytes);
  for (const match of text.matchAll(/\b(?:import|export)\s+[^;]*?\bfrom\s*['"]([^'"]+)['"]/gu)) {
    if (match[1].startsWith('node:')) continue;
    ensure(match[1].startsWith('.') && match[1].endsWith('.mjs'), 'Third-party or unclosed runtime import.');
    await copyModule(relative(root, resolve(dirname(file), match[1])));
  }
}
await copyModule('scripts/archives-integration/publication-runtime.mjs');
const entry = `import {loadPublicationData,createPublicationRuntime} from '../scripts/archives-integration/publication-runtime.mjs';\nlet pending;\nconst get=()=>pending??=loadPublicationData(new URL('./archives/selected-data.json',import.meta.url),'${proof.sha256}').then(createPublicationRuntime);\nexport async function dispatch(request,response,path){try{const url=new URL(request.url,'https://valerianteissier.com');const adapted={url:path+url.search,method:request.method,headers:request.headers,rawHeaders:request.rawHeaders};const app=await get();if(!await app.handle(adapted,response,new URL(adapted.url,'https://valerianteissier.com'))){response.writeHead(404);response.end();}}catch{if(!response.headersSent){response.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});response.end('Archives temporarily unavailable');}}}\n`;
await add('runtime/publication-entry.mjs', Buffer.from(entry));
const endpoints = { 'catalogue-data': '/__catalogue_data', hierarchy: '/__catalogue_hierarchy', catalogue: '/archives/catalogue/', texts: '/archives/textes/', text: '/archives/texte/', lexical: '/archives/reperes/', drafts: '/__draft_review_data', forms: '/archives/formes-brouillons/' };
for (const [name, route] of Object.entries(endpoints)) await add('api/archives/' + name + '.mjs', Buffer.from(`import {dispatch} from '../../runtime/publication-entry.mjs';\nexport default (request,response)=>dispatch(request,response,'${route}');\n`));
const config = JSON.parse(await readFile(resolve(root, 'vercel.json')));
// Ready-built candidate: verification is the build command. This assembly never
// changes the original Website build or hosting configuration.
config.buildCommand = 'node scripts/verify-archives-package.mjs'; config.outputDirectory = 'dist';
config.rewrites = [...Object.entries(endpoints).map(([name, source]) => ({ source, destination: '/api/archives/' + name })), ...snapshot.routes.filter(row => row.route.startsWith('/__archive_draft_derivative/')).map(row => ({ source: row.route, destination: '/' + row.file })), ...(config.rewrites ?? [])];
for (const rule of config.headers ?? []) for (const header of rule.headers ?? []) if (header.key.toLowerCase() === 'content-security-policy') header.value = header.value.replace("form-action 'none'", "form-action 'self'");
await add('vercel.json', Buffer.from(JSON.stringify(config, null, 2) + '\n'));
const staticPins = Object.fromEntries([...files].filter(([name]) => name.startsWith('dist/')));
await add('runtime/static-checksums.json', Buffer.from(JSON.stringify(staticPins, null, 2) + '\n'));
const verifier = `import {readFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';const pins=JSON.parse(await readFile('runtime/static-checksums.json','utf8'));const seen=[];async function visit(path){for(const item of await readdir(path,{withFileTypes:true})){if(item.isSymbolicLink())throw new Error('Link refused');const file=path+'/'+item.name;if(item.isDirectory())await visit(file);else{if(!pins[file])throw new Error('Unexpected dist file');const bytes=await readFile(file);if(bytes.length!==pins[file].size_bytes||createHash('sha256').update(bytes).digest('hex')!==pins[file].sha256)throw new Error('Dist drift');seen.push(file);}}}await visit('dist');if(seen.length!==Object.keys(pins).length)throw new Error('Missing dist file');console.log('Selected public Website package verified: '+seen.length+' files');\n`;
await add('scripts/verify-archives-package.mjs', Buffer.from(verifier));
await writeFile(resolve(target, 'assembly.json'), JSON.stringify({ format: 'archives-publication-assembly/1', snapshot_sha256: hash(snapshotBytes), runtime_data_sha256: proof.sha256, public_activation_executed: false, historical_confirmation: false, counts: { static_files: Object.keys(staticPins).length, texts: 166, selected_photos: 19, runtime_modules: copied.size, readonly_api_wrappers: 8 }, missing_external: ['Historical corrections HTTPS adapter and configured PostgreSQL', 'Qualified owner validation access', 'Publication in the existing hosting project'], files: Object.fromEntries(files) }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, site, static_files: Object.keys(staticPins).length, runtime_modules: copied.size, api_wrappers: 8, deployed: false }));
