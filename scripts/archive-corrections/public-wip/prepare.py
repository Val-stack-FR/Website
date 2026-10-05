"""Pin a D10 run after its closed-derivative context preflight; no credentials or network."""
import hashlib, json, re, sys
from pathlib import Path
from datetime import datetime, timezone
REPO=Path(__file__).resolve().parents[3]
D9=REPO/'.archive-corrections-private/d9-public-candidate-abe625f5-930d-4700-ae9a-dca1472d84fd'
NODE=Path('C:/Users/Val/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def save(p,v):
    with Path(p).open('x',encoding='utf-8',newline='\n') as out:json.dump(v,out,ensure_ascii=False,indent=2);out.write('\n')
run=Path(sys.argv[1]).resolve()
assert run.parent==REPO/'.archive-corrections-private' and re.fullmatch(r'd10-public-wip-[a-f0-9-]{36}',run.name)
pre_context=read(run/'context-preflight.json');context_input=read(run/'context-input-manifest.json')
assert pre_context['passed'] and sha(run/'context-input-manifest.json')==pre_context['input_sha256']
assert sha(D9/'run-manifest.json')=='5bce290033fbeabde9a550c93f857c1c40aa8da6665502cb8d9a9b6e18c47128'
for pin in context_input['old_sources']:assert sha(pin['path'])==pin['sha256']
for name,pin in context_input['derivative_files'].items():assert sha(run/'derivatives'/name)==pin
previous=read(D9/'input-manifest.json')
paths={pin['path'] for pin in previous['source_pins'] if '/public-candidate/' not in pin['path']}
paths.update(p.relative_to(REPO).as_posix() for p in Path(__file__).parent.iterdir() if p.is_file())
pins=[]
for path in sorted(paths):
    source=REPO/path;pin={'path':path,'sha256':sha(source)};pins.append(pin)
    target=run/'source-freeze'/path;target.parent.mkdir(parents=True,exist_ok=True)
    with target.open('xb') as out:out.write(source.read_bytes())
engine=read(D9/'engine-file-pins.json')
assert sha(D9/'engine-file-pins.json')==previous['engine_pins_sha256']
for pin in engine:assert sha(REPO/pin['path'])==pin['sha256']
save(run/'engine-file-pins.json',engine)
inputs={'version':'public-wip-inputs/v1','started_at':context_input['started_at'],
    'context_input_sha256':sha(run/'context-input-manifest.json'),'source_pins':pins,
    'engine_pins_sha256':sha(run/'engine-file-pins.json'),'node_sha256':sha(NODE),
    'derivative_files':context_input['derivative_files'],'source_closed_manifest_sha256':sha(D9/'run-manifest.json'),
    'context_canonical_sha256':'3b831b7be7e0b2ab3ee785a52281249fab733da5d1bbdcbc896973a21c96d655',
    'scope':'one exact Monbezon r1 with separate user WIP mandate, anonymous proposals; owner disabled',
    'rights_review':'pending','historical_reading_validated':False,'corpus_preflight':'N/A: six closed authorized derivative copies, no originals',
    'originals_read':False,'d8_store_accessed':False,'existing_secrets_read':False,'network_allowed':False,'git_policy':'inherited only, no invocation'}
save(run/'input-manifest.json',inputs)
save(run/'preflight.json',{'version':'public-wip-preflight/v1','passed':True,'checked_at':datetime.now(timezone.utc).isoformat(),
    'input_sha256':sha(run/'input-manifest.json'),'source_pins':len(pins),'engine_pins':len(engine),'derivative_pins':6,
    'old_sources':len(context_input['old_sources']),'database_started':False,'network_allowed':False,
    'user_wip_delivery_authorized':True,'rights_review':'pending','historical_reading_validated':False,'d8_store_accessed':False,
    'existing_secrets_read':False,'installed':False,'deployed':False,'git_invoked':False})
base=read(D9/'run-manifest.json')
save(run/'run-manifest-before-execution.json',{'schema_version':'1.0.0','run_id':run.name,'operation':'review','started_at':inputs['started_at'],
    'session_urls':base['session_urls'],'agent':{**base['agent'],'method_version':'public-wip/v1'},
    'inputs':{'manifest_version':inputs['version'],'manifest_sha256':sha(run/'input-manifest.json'),'corpus_root_reference':'env:PHD_CORPUS_ROOT',
        'manifest_uri':'checkout:archive-corrections/'+(run/'input-manifest.json').relative_to(REPO).as_posix()},'git':base['git'],
    'outputs':[{'logical_id':'public-wip:preflight','uri':'checkout:archive-corrections/'+(run/'preflight.json').relative_to(REPO).as_posix(),
        'sha256':sha(run/'preflight.json'),'media_type':'application/json','rights_status':'restricted'}],
    'validation':{'schema_valid':True,'output_hashes_verified':True,'provenance_complete':True,'rights_review':'pending','human_review_status':'pending',
        'notes':'PRE-EXECUTION: exact closed D3 derivative context; explicit human WIP delivery mandate recorded separately. No rights approval, historical validation, original, D8 store, existing secret, network, install, Git or deployment. Git metadata inherited.'},
    'publication':{'status':'private'}})
print(json.dumps({'prepared':True,'source_pins':len(pins),'engine_pins':len(engine),'old_sources':len(context_input['old_sources']),
    'input_sha256':sha(run/'input-manifest.json')}))
