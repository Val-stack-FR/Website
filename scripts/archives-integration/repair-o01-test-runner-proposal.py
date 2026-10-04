"""Produce a new proposal; never edit closed runner receipts or the 166 texts."""
import ast
import difflib
import hashlib
import json
from pathlib import Path

base = Path.cwd() / '.private/archives-integration'
prior = base / 'o01-v041-test-runner-fix-20261004-v1'
output = base / 'o01-v041-test-runner-fix-20261004-r2'
data = (prior / 'quality_v041.py').read_bytes()
assert hashlib.sha256(data).hexdigest() == 'bcc2d4a8d10a251327a1780ef8880db06bcae4bd906bd35f9d27e76eda29d503'
text = data.decode('utf-8')
anchor = '    test_receipt=run_pinned_test_suites(repo,out,expected_pins=pins)\n'
assert text.count(anchor) == 1
text = text.replace(anchor, anchor + '    runtime=Path(r"Z:\\Codex\\repos\\PHD-Maine-paleography-harness\\data\\private\\knowledge-graph-runtime\\venv\\Scripts\\python.exe")\n')
for test in ('test_quality_v04.py', 'test_quality_v041.py'):
    anchor = '"test_file":"' + test + '"}'
    assert text.count(anchor) == 1
    text = text.replace(anchor, '"test_file":"' + test + '","expected_tests":3}')
anchor = '            "tests_reported":int(match.group(1)) if match else None,\n'
assert text.count(anchor) == 1
text = text.replace(anchor, anchor + '            "tests_expected":spec["expected_tests"],\n')
anchor = '"status":"passed" if completed.returncode==0 and match else "failed"'
assert text.count(anchor) == 1
text = text.replace(anchor, '"status":"passed" if completed.returncode==0 and match and int(match.group(1))==spec["expected_tests"] and not re.search(r"\\bskipped\\b",output) else "failed"')
tree = ast.parse(text)
compile(text, 'quality_v041.py', 'exec')
run = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'run')
assignments = [node.lineno for node in ast.walk(run) if isinstance(node, ast.Name) and node.id == 'runtime' and isinstance(node.ctx, ast.Store)]
loads = [node.lineno for node in ast.walk(run) if isinstance(node, ast.Name) and node.id == 'runtime' and isinstance(node.ctx, ast.Load)]
assert len(assignments) == 1 and assignments[0] < min(loads)
output.mkdir()
(output / 'quality_v041.py').write_text(text, encoding='utf-8', newline='\n')
(output / 'runner-r2.diff').write_text(''.join(difflib.unified_diff(data.decode('utf-8').splitlines(True), text.splitlines(True), fromfile='proposal-v1/quality_v041.py', tofile='proposal-r2/quality_v041.py')), encoding='utf-8')
proof = {'status': 'syntax-and-scope-passed-awaiting-independent-review', 'parent_proposal_sha256': hashlib.sha256(data).hexdigest(),
    'proposed_sha256': hashlib.sha256(text.encode('utf-8')).hexdigest(), 'parent_canonical_sha256': '121e84f699d1d05b9309bd20b49f04c7dd90125113f595e3073339c5b8938a2c',
    'runtime_defined_before_schema_call': True, 'expected_tests_per_suite': 3, 'skip_accepted': False,
    'real_suites_rerun': False, 'prior_real_3_plus_3_remains_v1_evidence': True,
    'canonical_code_updated': False, 'closed_run_updated': False, 'texts_recalculated': 0}
(output / 'verification.json').write_text(json.dumps(proof, indent=2) + '\n', encoding='utf-8')
(output / 'HANDOFF.md').write_text('# O01 — proposition r2\n\nLe runtime est à nouveau défini dans run avant son emploi pour le schéma. '
    'Chaque suite doit rapporter exactement trois tests sans skip, conformément aux fichiers épinglés ; zéro ou un compte incomplet échoue. '
    'Syntaxe et définition avant usage contrôlées. Les six tests v1 réellement exécutés restent une preuve v1 ; aucun replay ni recalcul des166. '
    'Revue indépendante encore requise avant code canonique. Ancienne proposition/run/reçus inchangés.\n', encoding='utf-8')
print(json.dumps(proof))
