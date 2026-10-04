"""Bind the changed candidate modules and prepare an uninstalled private copy."""
from pathlib import Path
import hashlib
import json
import os
import re

root = Path.cwd()
base = root / '.private/archives-integration'
old = base / 'publication-final-windows-binding-20261004-v27'
candidate = base / 'publication-package-20261004-v28'
site = candidate / 'site'
binding = base / 'publication-final-windows-binding-20261004-v28'
copy = base / 'publication-final-windows-copy-20261004-v28'
assert not binding.exists() and not copy.exists(), 'Fresh qualification outputs required'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assembly = json.loads((candidate / 'assembly.json').read_text(encoding='utf8'))
previous_graph = json.loads((old / 'import-graph.json').read_text(encoding='utf8'))
graph = json.loads(json.dumps(previous_graph))
added = {
    'scripts/archives-integration/e108-eleven-reader-link-projection.mjs',
    'scripts/archives-integration/source-file-human-response-projection.mjs',
    'scripts/archives-integration/source-text-page-decoration.mjs',
}
changed = []
for rel, pin in graph['local_modules'].items():
    actual = assembly['files'][rel]
    assert sha(site / rel) == actual['sha256']
    fresh = {'sha256': actual['sha256'], 'bytes': actual['size_bytes']}
    if fresh != pin:
        changed.append({'path': rel, 'before': pin, 'after': fresh})
    graph['local_modules'][rel] = fresh
assert len(changed) == 1 and changed[0]['path'].endswith('/publication-runtime.mjs')
for rel in sorted(added):
    pin = assembly['files'][rel]
    assert sha(site / rel) == pin['sha256']
    graph['local_modules'][rel] = {'sha256': pin['sha256'], 'bytes': pin['size_bytes']}

pattern = re.compile(r'''(?:\bimport\s+[^;\n]*?\bfrom\s*|\bexport\s+[^;\n]*?\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(["'])([^"']+)\1''')
runtime = changed[0]['path']
old_specifiers = {edge['specifier'] for edge in graph['edges'] if edge['from'] == runtime}
new_specifiers = {match[1] for match in pattern.findall((site / runtime).read_text(encoding='utf8'))}
expected = {'./e108-eleven-reader-link-projection.mjs', './source-file-human-response-projection.mjs'}
assert new_specifiers == old_specifiers | expected, 'Changed runtime import surface expanded unexpectedly'
for rel in [runtime, *sorted(added)]:
    specifiers = {match[1] for match in pattern.findall((site / rel).read_text(encoding='utf8'))}
    if rel in added:
        expected_imports = {'./source-text-page-decoration.mjs'} if rel.endswith('/source-file-human-response-projection.mjs') else ({'node:assert/strict'} if rel.endswith('/e108-eleven-reader-link-projection.mjs') else set())
        assert specifiers == expected_imports
    existing = {edge['specifier'] for edge in graph['edges'] if edge['from'] == rel}
    for specifier in sorted(specifiers - existing):
        if specifier.startswith('node:'):
            graph['edges'].append({'from': rel, 'specifier': specifier, 'kind': 'builtin'})
            continue
        assert specifier.startswith('.'), 'Unexpected new package import'
        target = (site / rel).parent.joinpath(specifier).resolve().relative_to(site.resolve()).as_posix()
        assert target in graph['local_modules']
        graph['edges'].append({'from': rel, 'specifier': specifier, 'kind': 'literal-dynamic-or-static', 'to': target})
assert len(graph['local_modules']) == 53
assert graph['direct_production_dependencies'] == previous_graph['direct_production_dependencies']
graph['parent_assembly_sha256'] = sha(candidate / 'assembly.json')
graph['package_checksums_sha256'] = sha(site / 'runtime/package-checksums.json')
graph['copy_scope'] = '53 reachable modules, root manifest/lock and inherited nested package boundary; no data/media'
binding.mkdir()
for name in ['qualify-final-windows.py', 'cold-import.mjs', 'cold-guard.cjs', 'cli-guard.cjs']:
    (binding / name).write_bytes((old / name).read_bytes())
(binding / 'import-graph.json').write_text(json.dumps(graph, indent=2) + '\n', encoding='utf8')
old_inputs = json.loads((old / 'input-manifest.json').read_text(encoding='utf8'))
inputs = {key: old_inputs[key] for key in ['node', 'pnpm', 'pnpm_toolchain']}
inputs.update({'format': 'final-candidate-windows-binding/1', 'parent_directory': str(candidate), 'assembly_sha256': sha(candidate / 'assembly.json'), 'closed_previous_binding_sha256': sha(old / 'import-graph.json'), 'application_environment_read': False})
(binding / 'input-manifest.json').write_text(json.dumps(inputs, indent=2) + '\n', encoding='utf8')

copy.mkdir()
selected = sorted(set(graph['local_modules']) | {'package.json', 'pnpm-lock.yaml', 'scripts/archive-corrections/hosted/serverless/package.json'})
for rel in selected:
    target = copy / 'site' / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes((site / rel).read_bytes())
    assert sha(target) == sha(site / rel)
cache_source = base / 'publication-final-windows-copy-20261004-v27/store'
cache_target = copy / 'store'
cache_target.mkdir()
files = 0
for parent, directories, names in os.walk('\\\\?\\' + str(cache_source.resolve())):
    relative = Path(parent).relative_to(Path('\\\\?\\' + str(cache_source.resolve())))
    for name in names:
        source = Path(parent) / name
        target = Path('\\\\?\\' + str(cache_target.resolve())) / relative / name
        target.parent.mkdir(parents=True, exist_ok=True)
        data = source.read_bytes()
        target.write_bytes(data)
        assert hashlib.sha256(target.read_bytes()).hexdigest() == hashlib.sha256(data).hexdigest()
        files += 1
assert files == 1175
proof = {'passed': True, 'assembly_sha256': sha(candidate / 'assembly.json'), 'local_modules': 53, 'changed_modules': changed, 'added_modules': sorted(added), 'added_edges': len(graph['edges']) - len(previous_graph['edges']), 'selected_copy_files': len(selected), 'cache_files': files, 'helpers_byte_identical': True, 'closed_package_modified': False, 'network': 0, 'media_or_corpus_opened': False, 'windows_only': True}
(binding / 'binding-proof.json').write_text(json.dumps(proof, indent=2) + '\n', encoding='utf8')
(copy / 'copy-proof.json').write_text(json.dumps(proof, indent=2) + '\n', encoding='utf8')
print(json.dumps({'passed': True, 'modules': 53, 'copy_files': len(selected), 'cache_files': files}))
