import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstat, mkdir, readFile, readdir, realpath, writeFile} from 'node:fs/promises';
import {dirname, join, posix, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo = resolve(import.meta.dirname, '../..');
const root = resolve(repo, '.private/archives-integration');
const parent = resolve(root, 'publication-package-20261004-v31-r2');
const v30 = resolve(root, 'publication-package-20261004-v30');
const out = resolve(root, 'publication-package-20261004-v32-r2');
const sourceRoot = 'Z:/Codex/repos/Website-archives-corrections/.archive-corrections-private/publication-website-three-profile-operator-guide-20261004-v1';
const overlay = resolve(sourceRoot, 'deployment-overlay');
const allowlistPath = resolve(sourceRoot, 'composition-allowlist.json');
const expectedParent = '680402973c6186b05bbd6eb74aa14bdffda89bd0261dcbc3cdc324cf37d60a6d';
const expectedV30 = '210278a44c7c661dddc37a3ef2344e853d466211931f434baf8f4ec25d9e37d9';
const expectedParentSeal = 'e9c5707699001134b41069740c05335d809c137d277e4875d09ec010baac3649';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pin = bytes => ({size_bytes: bytes.length, sha256: sha(bytes)});
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const safeRel = value => typeof value === 'string' && !value.startsWith('/') && !value.includes('\\') && !value.includes(':') && value.split('/').every(part => part && part !== '.' && part !== '..');
const file = async (path, expected) => {
  const bytes = await readFile(path);
  if (expected) assert(sha(bytes) === expected.sha256 && (expected.size_bytes === undefined || bytes.length === expected.size_bytes), `Pin mismatch: ${path}`);
  return bytes;
};
const newDir = async path => {
  try { await lstat(path); throw new Error(`Refusing existing output: ${path}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
};
const writeNew = async (path, bytes) => {
  await mkdir(dirname(path), {recursive: true});
  await writeFile(path, bytes, {flag: 'wx'});
};

await newDir(out);
const parentAssemblyBytes = await file(resolve(parent, 'assembly.json'), {sha256: expectedParent});
const parentAssembly = JSON.parse(parentAssemblyBytes);
const v30AssemblyBytes = await file(resolve(v30, 'assembly.json'), {sha256: expectedV30});
const v30Assembly = JSON.parse(v30AssemblyBytes);
const parentSealBytes = await file(resolve(parent, 'candidate-seal.json'), {sha256: expectedParentSeal});
const parentSeal = JSON.parse(parentSealBytes);
assert(parentSeal.closed === true && parentSeal.candidate_assembly_sha256 === expectedParent, 'Closed v31-r2 seal required.');
const allowlistBytes = await readFile(allowlistPath);
const allowlist = JSON.parse(allowlistBytes);
assert(allowlist.parent_assembly_sha256 === expectedV30, 'Overlay allowlist is not bound to v30.');
assert(allowlist.changes.replacements === 3 && allowlist.changes.additions === 1 && allowlist.changes.unchanged_required_dependencies === 11, 'Unexpected allowlist shape.');
assert(parentAssembly.files && v30Assembly.files, 'Assembly file maps required.');
const parentCheckBytes = await file(resolve(parent, 'site/runtime/package-checksums.json'), parentAssembly.files['runtime/package-checksums.json']);
const parentChecksums = JSON.parse(parentCheckBytes);
const v30Checksums = JSON.parse(await file(resolve(v30, 'site/runtime/package-checksums.json'), v30Assembly.files['runtime/package-checksums.json']));
const overlayInputs = new Map();
const changes = [];
for (const entry of allowlist.entries) {
  assert(safeRel(entry.path), `Unsafe allowlist path: ${entry.path}`);
  const source = resolve(overlay, entry.path);
  assert(await realpath(source) === source, `Overlay reparse point rejected: ${entry.path}`);
  const bytes = await file(source, entry);
  overlayInputs.set(entry.path, bytes);
  if (entry.action === 'require-existing-exact') {
    assert(parentAssembly.files[entry.path], `Required dependency missing in v31-r2: ${entry.path}`);
    assert(parentAssembly.files[entry.path].sha256 === entry.before_sha256 && parentAssembly.files[entry.path].size_bytes === entry.size_bytes, `Required dependency drift: ${entry.path}`);
    assert(parentChecksums[entry.path] && parentChecksums[entry.path].sha256 === entry.sha256 && parentChecksums[entry.path].size_bytes === entry.size_bytes, `Required dependency checksum drift: ${entry.path}`);
    continue;
  }
  if (entry.action === 'replace') {
    await file(resolve(v30, 'site', entry.path), {sha256: entry.before_sha256});
    assert(v30Assembly.files[entry.path]?.sha256 === entry.before_sha256, `v30 before pin mismatch in assembly: ${entry.path}`);
    assert(v30Checksums[entry.path]?.sha256 === entry.before_sha256, `v30 before pin mismatch in package checksum: ${entry.path}`);
    assert(parentAssembly.files[entry.path]?.sha256 === entry.before_sha256, `v31-r2 no longer has the v30 before hash: ${entry.path}`);
    assert(parentChecksums[entry.path]?.sha256 === entry.before_sha256, `v31-r2 checksum no longer has the v30 before hash: ${entry.path}`);
    changes.push({path: entry.path, action: 'replace', before_sha256: entry.before_sha256, after: pin(bytes)});
  } else if (entry.action === 'add') {
    assert(!v30Assembly.files[entry.path] && !parentAssembly.files[entry.path], `Addition already exists: ${entry.path}`);
    changes.push({path: entry.path, action: 'add', after: pin(bytes)});
  } else throw new Error(`Unknown allowlist action: ${entry.action}`);
}
assert(changes.length === 4, 'Expected exactly four overlay changes.');

const nextContent = new Map();
for (const [name, metadata] of Object.entries(parentAssembly.files)) {
  assert(safeRel(name), `Unsafe parent site path: ${name}`);
  nextContent.set(name, await file(resolve(parent, 'site', name), metadata));
}
for (const change of changes) nextContent.set(change.path, overlayInputs.get(change.path));
const checksumPath = 'runtime/package-checksums.json';
const checkRecords = Object.fromEntries([...nextContent.entries()].filter(([name]) => name !== checksumPath).sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => [name, pin(bytes)]));
const nextChecksumBytes = json(checkRecords);
nextContent.set(checksumPath, nextChecksumBytes);
const nextFiles = Object.fromEntries([...nextContent.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => [name, pin(bytes)]));
assert(Object.keys(nextFiles).length === Object.keys(parentAssembly.files).length + 1, 'Expected one net-new site file.');
assert(Object.keys(checkRecords).length === Object.keys(parentChecksums).length + 1, 'Expected checksum map to grow by one record.');

const apiEntries = Object.keys(nextFiles).filter(name => name.startsWith('api/') && name.endsWith('.mjs')).sort();
assert(apiEntries.length === 11, 'Expected 11 API entrypoints.');
const resolveImport = (from, specifier) => posix.normalize(posix.join(posix.dirname(from), specifier));
const graph = {};
const visited = new Set();
const externals = new Set();
async function visit(name) {
  if (visited.has(name)) return;
  const bytes = nextContent.get(name);
  assert(bytes, `Import target missing: ${name}`);
  visited.add(name);
  const source = bytes.toString('utf8');
  const imports = [];
  const pattern = /(?:\bimport\s*(?:[^'";]*?\s+from\s*)?|\bexport\s+[^'";]*?\s+from\s*)['"]([^'"]+)['"]/gu;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[1];
    if (specifier.startsWith('.')) {
      const target = resolveImport(name, specifier);
      assert(safeRel(target), `Unsafe module edge: ${name} -> ${specifier}`);
      imports.push(target);
      await visit(target);
    } else {
      externals.add(specifier);
      imports.push(`external:${specifier}`);
    }
  }
  const dynamicPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu;
  for (const match of source.matchAll(dynamicPattern)) {
    const specifier = match[1];
    if (specifier.startsWith('.')) {
      const target = resolveImport(name, specifier);
      assert(safeRel(target), `Unsafe dynamic module edge: ${name} -> ${specifier}`);
      imports.push(target);
      await visit(target);
    } else {
      externals.add(specifier);
      imports.push(`external:${specifier}`);
    }
  }
  graph[name] = [...new Set(imports)].sort();
}
for (const api of apiEntries) await visit(api);
for (const name of visited) assert(nextContent.has(name), `Unpinned reachable module: ${name}`);
const graphObject = Object.fromEntries(Object.entries(graph).sort(([a], [b]) => a.localeCompare(b)));
const graphBytes = json(graphObject);
const graphSha = sha(graphBytes);

const updatedCounts = {...parentAssembly.counts, runtime_modules: parentAssembly.counts.runtime_modules + 1, e108_source_correction_files: parentAssembly.counts.e108_source_correction_files + 1};
const assembly = {
  ...parentAssembly,
  parent_assembly_sha256: sha(parentAssemblyBytes),
  snapshot_sha256: sha(nextChecksumBytes),
  counts: updatedCounts,
  delta: {
    added: ['scripts/archive-corrections/public-e108-source/hosted-entry.mjs'],
    modified: ['dist/assets/e108-source-corrections.mjs', 'scripts/archive-corrections/public-e108-source/adapter.mjs', 'scripts/archive-corrections/public-e108-source/function.mjs', checksumPath].sort(),
    removed: []
  },
  files: nextFiles,
  hosted_three_profile_e108_extension: {
    entry: 'scripts/archive-corrections/public-e108-source/hosted-entry.mjs',
    imported_api_entrypoints: apiEntries.length,
    imported_module_count: visited.size,
    import_graph_sha256: graphSha,
    environment_names: 12,
    exact_e108_routes: 4,
    explicit_mount_required: true,
    default_status: 503,
    owner_enabled: false,
    decisions_enabled: false,
    provisioning_from_get: false,
    actual_hosted_tls_qualified: false,
    actual_rewrites_qualified: false,
    deployed: false
  }
};
assert(parentAssembly.direct_api_functions === undefined || parentAssembly.counts.direct_api_functions === 11, 'API count changed unexpectedly.');

await mkdir(resolve(out, 'site'), {recursive: true});
for (const [name, bytes] of nextContent) await writeNew(resolve(out, 'site', name), bytes);
const assemblyBytes = json(assembly);
await writeNew(resolve(out, 'assembly.json'), assemblyBytes);
await writeNew(resolve(out, 'api-import-graph.json'), graphBytes);
const preservation = {
  format: 'publication-v32-r2-e108-three-profile-preservation/1',
  passed: true,
  candidate_inactive: true,
  parent_assembly: pin(parentAssemblyBytes),
  v30_assembly: pin(v30AssemblyBytes),
  allowlist: pin(allowlistBytes),
  overlay_changes: changes,
  required_dependencies_exact: 11,
  inherited_site_files_byte_identical: Object.keys(parentAssembly.files).length - 3,
  net_site_file_delta: 1,
  final_site_files: Object.keys(nextFiles).length,
  package_checksum_records: Object.keys(checkRecords).length,
  package_checksum_self_pin: false,
  static_file_count_unchanged: assembly.counts.static_files === parentAssembly.counts.static_files,
  public_api_functions_unchanged: assembly.counts.direct_api_functions === parentAssembly.counts.direct_api_functions,
  api_entrypoints: apiEntries,
  api_graph: {path: 'api-import-graph.json', sha256: graphSha, module_count: visited.size, external_imports: [...externals].sort()},
  preserved_texts_versions_json_media_and_routes: true,
  stores_or_private_configs_included: false,
  network_install_database_main_or_publication_used: false,
  hosted_tls_and_real_rewrites_qualified: false
};
await writeNew(resolve(out, 'preservation.json'), json(preservation));
const sourceReview = {
  format: 'publication-v32-r2-e108-three-profile-import-review/1',
  accepted_allowlist_review: true,
  allowlist_sha256: sha(allowlistBytes),
  imported_changes: changes,
  unchanged_dependencies: allowlist.entries.filter(x => x.action === 'require-existing-exact').map(x => ({path: x.path, sha256: x.sha256, size_bytes: x.size_bytes})),
  api_import_graph: {path: 'api-import-graph.json', sha256: graphSha, api_entrypoints: apiEntries.map(path => ({api: path, imports: graphObject[path] ?? []})), transitive_module_count: visited.size, external_imports: [...externals].sort() },
  activation: {public_activation_executed: false, explicit_host_mount_required: true, default_unconfigured_status: 503, owner_or_decision_routes_enabled: false},
  qualification_limits: {pglite_tests_replayed: false, hosted_tls_tested: false, actual_vercel_rewrites_tested: false, deployment_performed: false}
};
await writeNew(resolve(out, 'source-review.json'), json(sourceReview));
const handoff = `# Candidat privé v32-r2 — extension E108 à trois profils

Statut : candidat fermé et inactif, prêt pour revue et recomposition du portfolio. Aucun service, store, configuration privée ou publication n’a été modifié.

Le parent v31-r2 est épinglé à l’assembly SHA256 \`${sha(parentAssemblyBytes)}\`. L’allowlist sélectionnée est épinglée à \`${sha(allowlistBytes)}\`. Les trois valeurs \`before_sha256\` des remplacements ont été vérifiées dans les octets et manifestes v30, puis retrouvées à l’identique dans v31-r2. Les onze dépendances exigées sont byte-identiques au parent. La composition ajoute \`scripts/archive-corrections/public-e108-source/hosted-entry.mjs\`, remplace seulement les trois entrées déclarées et régénère \`runtime/package-checksums.json\`.

Le site compte ${Object.keys(nextFiles).length} fichiers, dont ${assembly.counts.static_files} fichiers statiques et 166 pages de texte. Le delta est +1 fichier : 1 ajouté, 3 remplacés, aucun retiré ; ${Object.keys(parentAssembly.files).length - 3} fichiers hérités restent byte-identiques. Les textes, versions, JSON de données, médias, routes API directes et leurs onze points d’entrée sont conservés. Le manifeste complet est dans \`assembly.json\`, les empreintes package dans \`runtime/package-checksums.json\`, et la fermeture du graphe d’import dans \`api-import-graph.json\`.

Graphe API : 11 entrées restent inchangées — \`api/archive-owner-disabled.mjs\`, \`api/archive/e108-source.mjs\`, \`api/archive/public-router.mjs\`, et les huit routes \`api/archives/{catalogue-data,catalogue,drafts,forms,hierarchy,lexical,text,texts}.mjs\`. Leur fermeture transitive épingle ${visited.size} modules locaux, en incluant les imports statiques et dynamiques littéraux, ainsi que ${externals.size} imports externes distincts. Le nouvel adaptateur hébergé est une dépendance du routeur d’archives et son montage reste opt-in ; sans les paramètres/DB explicites le statut reste 503. Aucun owner ni décision n’est activé.

Les 18 cas PGlite antérieurs ne sont pas rejoués ici. L’activation hébergée réelle, TLS PostgreSQL, les rewrites déployés et la publication restent à qualifier séparément. Le candidat n’est pas actif.
`;
await writeNew(resolve(out, 'HANDOFF.md'), Buffer.from(handoff, 'utf8'));
await writeNew(resolve(out, 'composer-snapshot.mjs'), await readFile(fileURLToPath(import.meta.url)));

async function walkFiles(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const child = join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await walkFiles(child, rel));
    else if (entry.isFile()) result.push(rel);
    else throw new Error(`Unexpected filesystem entry in candidate: ${rel}`);
  }
  return result;
}
const outputFiles = (await walkFiles(out)).filter(name => name !== 'candidate-seal.json').sort();
const sealEntries = {};
for (const name of outputFiles) sealEntries[name] = pin(await readFile(resolve(out, name)));
const seal = {
  format: 'publication-v32-r2-e108-three-profile-candidate-seal/1',
  closed: true,
  file_count: outputFiles.length,
  parent_assembly_sha256: sha(parentAssemblyBytes),
  candidate_assembly_sha256: sha(assemblyBytes),
  files: sealEntries
};
await writeNew(resolve(out, 'candidate-seal.json'), json(seal));

for (const [name, bytes] of nextContent) assert(sha(await readFile(resolve(out, 'site', name))) === sha(bytes), `Candidate verification failed: ${name}`);
for (const [name, bytes] of Object.entries(sealEntries)) assert(JSON.stringify(pin(await readFile(resolve(out, name)))) === JSON.stringify(bytes), `Seal verification failed: ${name}`);
for (const change of changes) {
  const actual = await readFile(resolve(out, 'site', change.path));
  assert(sha(actual) === change.after.sha256 && actual.length === change.after.size_bytes, `Overlay result mismatch: ${change.path}`);
}
for (const name of visited) if (name.endsWith('.mjs')) execFileSync(process.execPath, ['--check', resolve(out, 'site', name)]);
execFileSync(process.execPath, ['--check', resolve(out, 'site/dist/assets/e108-source-corrections.mjs')]);
console.log(JSON.stringify({output: out, assembly_sha256: sha(assemblyBytes), seal_sha256: sha(json(seal)), site_files: Object.keys(nextFiles).length, static_files: assembly.counts.static_files, added: assembly.delta.added, modified: assembly.delta.modified, api_count: apiEntries.length, graph_modules: visited.size, graph_sha256: graphSha}, null, 2));
