import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha = value => createHash('sha256').update(value).digest('hex');
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const repo = resolve('.');
const parent = resolve(repo, '.private/archives-integration/publication-package-20261004-v28/site');
const parentAssemblyPath = resolve(parent, '../assembly.json');
const overlayRoot = resolve('Z:/Codex/repos/Website-archives-corrections/.archive-corrections-private/e108-source-file-correction-mvp-20261004-v1');
const out = resolve(repo, '.private/archives-integration/publication-package-20261004-v29-r2');
const allowlistPath = resolve(overlayRoot, 'composition-allowlist.json');
const allowlistBytes = await readFile(allowlistPath);
const allowlist = JSON.parse(allowlistBytes);
ensure(allowlist.format === 'e108-source-file-composition/1.0.0' && allowlist.entries.length === 19, 'E108 composition allowlist changed.');
const parentAssemblyBytes = await readFile(parentAssemblyPath);
const parentAssembly = JSON.parse(parentAssemblyBytes);
ensure(parentAssembly.format === 'archives-publication-assembly/1' && parentAssembly.counts.e10811_reader_lines === 6 && parentAssembly.counts.source_file_human_pages === 166, 'Expected closed v28 parent required.');
const parentPin = sha(parentAssemblyBytes);
ensure(parentAssembly.snapshot_sha256 === '9048280ac0933d0d4fe853ae504e6238e2e740f162df19461339099dafd8cfe3' && sha(parentAssemblyBytes) === 'b8911b120d276686faa6b19db87c76e37021bcce1814b84feda55569d1ab6886' && allowlist.parent_assembly_sha256 === '245717cb32a04d11968e2a05dbe540661990beb9cce93cee8d67ceb41a876033', 'v28 parent binding mismatch.');
const reviewPath = resolve(repo, '.private/archives-integration/e108-source-file-correction-independent-review-20261004-v1/verification.json');
const review = JSON.parse(await readFile(reviewPath));
ensure(review.verdict === 'GO_FOR_PRIVATE_V29_COMPOSITION_WITH_EXPLICIT_ISOLATED_MOUNT' && review.parent_assembly_sha256 === sha(parentAssemblyBytes), 'Independent E108 composition GO is required for this exact parent.');
const overlay = resolve(overlayRoot, 'deployment-overlay');
const files = new Map();
for (const pin of allowlist.entries) {
  const target = resolve(parent, pin.path);
  const src = resolve(overlay, pin.path);
  ensure(relative(parent, target) && !relative(parent, target).startsWith('..') && !relative(overlay, src).startsWith('..'), 'Unsafe composition path.');
  if (pin.action === 'add') {
    const bytes = await readFile(src);
    ensure(bytes.length === pin.size_bytes && sha(bytes) === pin.sha256 && !parentAssembly.files[pin.path], `Overlay drift or collision: ${pin.path}`);
    files.set(pin.path, bytes);
  } else {
    const bytes = await readFile(target);
    ensure(bytes.length === pin.size_bytes && sha(bytes) === pin.sha256, `Required dependency drift: ${pin.path}`);
  }
}
ensure(files.size === 10, 'Expected ten new E108 files.');

const runtimePath = 'scripts/archives-integration/publication-runtime.mjs';
const runtimeBytes = await readFile(resolve(parent, runtimePath));
const runtimeText = runtimeBytes.toString('utf8');
const helperPath = 'scripts/archives-integration/e108-source-correction-link.mjs';
const helperText = files.get(helperPath).toString('utf8');
const moduleUrl = pathToFileURL(resolve(overlay, helperPath)).href;
const { decorateE108SourceCorrectionLink } = await import(moduleUrl);
ensure(typeof decorateE108SourceCorrectionLink === 'function', 'Exact E108 source-link helper missing.');
const sourceId = '81f2195b2dd92184859c2301a8da2f1126c3b7e25cdf8b1d1f6684029fa66a45';
const sourcePagePath = `dist/archives/textes/fichier/${sourceId}/index.html`;
const sourceHtml = (await readFile(resolve(parent, sourcePagePath))).toString('utf8');
const linked = decorateE108SourceCorrectionLink(sourceHtml, `/archives/textes/fichier/${sourceId}/`);
ensure(linked !== sourceHtml && decorateE108SourceCorrectionLink(linked, `/archives/textes/fichier/${sourceId}/`) === linked, 'Static E108 source-link projection must be idempotent.');
ensure(linked.includes('/archives/textes/fichier/' + sourceId + '/corrections/') && sourceHtml.includes('class="archive-preexisting-literal"') && linked.includes('class="archive-preexisting-literal"'), 'E108 link or exact source literal missing.');
files.set(sourcePagePath, Buffer.from(linked));

const newRuntime = runtimeText.replace("import { projectSourceFileHumanResponse } from './source-file-human-response-projection.mjs';", "import { projectSourceFileHumanResponse } from './source-file-human-response-projection.mjs';\nimport { decorateE108SourceCorrectionLink } from './e108-source-correction-link.mjs';")
  .replace("  return projectSourceFileHumanResponse(projectE108ElevenReaderLink(url, current), url);", "  const humanized = projectSourceFileHumanResponse(projectE108ElevenReaderLink(url, current), url);\n  const normalized = new URL(url, 'http://localhost');\n  if (normalized.pathname === '/archives/texte/') {\n    const ids = normalized.searchParams.getAll('object_id');\n    const match = ids.length === 1 ? /^object:path-([a-f0-9]{64})$/u.exec(ids[0]) : null;\n    if (match) normalized.pathname = `/archives/textes/fichier/${match[1]}/`;\n  }\n  return decorateE108SourceCorrectionLink(humanized, normalized.pathname);");
ensure(newRuntime !== runtimeText && newRuntime.includes('decorateE108SourceCorrectionLink(humanized, normalized.pathname)'), 'SSR link integration failed.');
files.set(runtimePath, Buffer.from(newRuntime));

const vercelPath = 'vercel.json';
const vercel = JSON.parse(await readFile(resolve(parent, vercelPath), 'utf8'));
const rewrites = [
  ['health', '/api/archive/public/e108-source/health'],
  ['passage', '/api/archive/public/e108-source/passage'],
  ['history', '/api/archive/public/e108-source/history'],
  ['corrections', '/api/archive/public/e108-source/corrections'],
].map(([route, source]) => ({ source, destination: `/api/archive/e108-source?__e108_route=${route}` }));
ensure(!vercel.rewrites.some(r => r.source.includes('/api/archive/public/e108-source/')), 'E108 rewrites already exist in v28.');
vercel.rewrites = [...vercel.rewrites, ...rewrites];
vercel.functions = { ...vercel.functions, 'api/archive/e108-source.mjs': { maxDuration: 10, includeFiles: 'scripts/archive-corrections/{hosted/migrations/001.sql,hosted/serverless/migrations/002.sql,public-e108-source/exact-context.json}' } };
files.set(vercelPath, Buffer.from(JSON.stringify(vercel, null, 2) + '\n'));

const addPaths = allowlist.entries.filter(e => e.action === 'add').map(e => e.path);
const allowedAdd = new Set([...addPaths, sourcePagePath]);
const allowedModified = new Set([runtimePath, vercelPath, sourcePagePath]);
for (const path of files.keys()) ensure(allowedAdd.has(path) || allowedModified.has(path), `Unexpected output path ${path}`);
const parentFiles = Object.keys(parentAssembly.files);
ensure(parentFiles.length === 458 && parentAssembly.counts.static_files === 376 && parentAssembly.counts.consultable_jpeg_photo_views === 25, 'v28 counts drifted.');
const parentBytes = new Map();
for (const path of parentFiles) {
  const bytes = await readFile(resolve(parent, path));
  ensure(bytes.length === parentAssembly.files[path].size_bytes && sha(bytes) === parentAssembly.files[path].sha256, `Closed v28 parent drift: ${path}`);
  parentBytes.set(path, bytes);
}

try { await mkdir(out); } catch { throw new Error('v29 output must be a new, empty package directory.'); }
const records = { ...parentAssembly.files };
for (const [path, bytes] of files) {
  const target = resolve(out, 'site', path); await mkdir(resolve(target, '..'), { recursive: true }); await writeFile(target, bytes, { flag: 'wx' });
  records[path] = { size_bytes: bytes.length, sha256: sha(bytes) };
}
for (const path of parentFiles) {
  if (files.has(path) || path === 'runtime/package-checksums.json') continue;
  const source = resolve(parent, path), target = resolve(out, 'site', path);
  await mkdir(resolve(target, '..'), { recursive: true }); await copyFile(source, target, 1);
  const bytes = await readFile(target); ensure(bytes.length === parentAssembly.files[path].size_bytes && sha(bytes) === parentAssembly.files[path].sha256, `Parent file changed during copy: ${path}`);
}
const checksumPath = 'runtime/package-checksums.json';
const checksums = Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(records).filter(([path]) => path !== checksumPath).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
await mkdir(resolve(out, 'site/runtime'), { recursive: true }); await writeFile(resolve(out, 'site', checksumPath), checksums, { flag: 'wx' });
records[checksumPath] = { size_bytes: checksums.length, sha256: sha(checksums) };
const allPaths = Object.keys(records).sort();
ensure(allPaths.length === 468 && files.size === 13, `v29 file count mismatch (${allPaths.length}/${files.size}).`);
const snapshot = sha(Buffer.from(JSON.stringify(Object.fromEntries(allPaths.map(path => [path, records[path]])), null, 2) + '\n'));
const assembly = { ...parentAssembly, snapshot_sha256: snapshot, parent_assembly_sha256: parentPin,
  delta: { added: addPaths, modified: [...new Set([...allowedModified, checksumPath])], removed: [] },
  public_activation_executed: false, historical_confirmation: false,
  counts: { ...parentAssembly.counts, static_files: parentAssembly.counts.static_files + 4, direct_api_functions: parentAssembly.counts.direct_api_functions + 1, e108_source_correction_files: 10, e108_source_correction_routes: 4, e108_source_correction_pages: 1 },
  e108_source_correction: { object_id: `object:path-${sourceId}`, relation_claims: [], owner_enabled: false, decisions_enabled: false, default_hosted_status: 503, explicit_mount_required: true },
  files: Object.fromEntries(allPaths.map(path => [path, records[path]])) };
await writeFile(resolve(out, 'assembly.json'), JSON.stringify(assembly, null, 2) + '\n', { flag: 'wx' });
const manifest = { format: 'publication-v29-e108-source-corrections/1', parent_assembly_sha256: parentPin, allowlist_sha256: sha(allowlistBytes), independent_review_sha256: sha(await readFile(reviewPath)), output_assembly_sha256: sha(Buffer.from(JSON.stringify(assembly, null, 2) + '\n')), added: addPaths, modified: [...allowedModified], parent_file_count: parentFiles.length, output_file_count: allPaths.length, source_pages: 166, text_records_unchanged: true, selected_photos: 25, hosted_default_closed: true };
await writeFile(resolve(out, 'composition.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
for (const [path, expected] of Object.entries(assembly.files)) {
  const actual = await readFile(resolve(out, 'site', path)); ensure(actual.length === expected.size_bytes && sha(actual) === expected.sha256, `Final package hash mismatch: ${path}`);
}
await import(pathToFileURL(resolve(out, 'site', runtimePath)).href + `?v=${Date.now()}`);
console.log(JSON.stringify({ output: out, files: allPaths.length, static_files: assembly.counts.static_files, added: addPaths.length, modified: [...allowedModified], sha256: manifest.output_assembly_sha256 }, null, 2));
