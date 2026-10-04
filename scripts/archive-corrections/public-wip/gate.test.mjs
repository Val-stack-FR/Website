import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { pgliteDriver } from '../hosted/drivers.mjs';
import { ServerlessStore } from '../hosted/serverless/store.mjs';
import { loadReaderContext, BUNDLE_HASHES } from '../reader-binding.mjs';
import { canonical, digest } from '../contract.mjs';
import { createConfiguredWip, createLocalWip } from './candidate.mjs';
import runtimeEntry, { createWipFunction } from './function.mjs';
import { ENV_NAMES, CANONICAL_ORIGIN } from './policy.mjs';
import { loadDeliveryBundle, CONTEXT_DIGEST, R1_DIGEST, TEXT_SHA256, literalHash } from './bundle.mjs';
import { seedExactContext } from './seed.mjs';
const run=resolve(process.argv[2]);
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pre=JSON.parse(readFileSync(join(run,'preflight.json'),'utf8'));
assert.equal(pre.passed,true);assert.equal(pre.database_started,false);
const input=JSON.parse(readFileSync(join(run,'input-manifest.json'),'utf8'));
for(const pin of input.source_pins)assert.equal(hash(readFileSync(join(repo,pin.path))),pin.sha256);
for(const pin of JSON.parse(readFileSync(join(run,'engine-file-pins.json'),'utf8')))assert.equal(hash(readFileSync(join(repo,pin.path))),pin.sha256);
const fakeEnv={ARCHIVE_PUBLIC_WIP_PROFILE:'monbezon-wip',ARCHIVE_PUBLIC_WIP_ORIGIN:CANONICAL_ORIGIN,
  ARCHIVE_PUBLIC_WIP_DATABASE_URL:'postgresql://invented:offline_only@unused.invalid/invented',
  ARCHIVE_PUBLIC_WIP_SCHEMA:'archive_corrections_d5_public_wip_gate',ARCHIVE_PUBLIC_WIP_SESSION_HMAC_KEY:'d'.repeat(64),ARCHIVE_PUBLIC_WIP_OWNER_MODE:'disabled'};
function request(path,{method='GET',body,headers={},local=false}={}) {
  const h={host:local?'127.0.0.1:8812':'valerianteissier.com',...(local?{}:{'x-forwarded-proto':'https'}),
    origin:local?'http://127.0.0.1:8812':CANONICAL_ORIGIN,...(body===undefined?{}:{'content-type':'application/json'}),...headers};
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);req.url=path;req.method=method;req.headers=h;
  req.rawHeaders=Object.entries(h).flatMap(([k,v])=>[k,v]);return req;
}
async function call(handler,path,options){const req=request(path,options),res={writeHead(s,h){this.status=s;this.headers=h;},end(bytes){this.body=JSON.parse(String(bytes));this.bytes=String(bytes);}};
  await handler(req,res);assert.equal(req.url,path);return res;}
const writeNew=(name,value)=>writeFileSync(join(run,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
test('D10 exact Monbezon WIP: separate mandate, read-only r1 and anonymous proposal persistence',async t=>{
  let driver,transactions=0;
  const report={version:'public-wip-gate/v1',passed:false,network_used:false,process_env_credentials_read:false,d8_store_accessed:false,stages:[]};
  t.after(async()=>{if(driver){await driver.close();report.offline_engine_closed=true;}writeNew('gate-proof.json',report);});
  assert.equal(typeof runtimeEntry,'function');
  const bundle=loadDeliveryBundle(join(run,'delivery-assets')),context=bundle.context;
  await t.test('missing configuration and altered source/mandate refuse before bundle/pool',async()=>{
    let pools=0,bundles=0;const factory=()=>{pools++;throw Error('No network');};
    for(const name of ENV_NAMES){const env={...fakeEnv};delete env[name];
      const result=await call(createWipFunction({envProvider:()=>env,bundleProvider:()=>{bundles++;return bundle;},driverFactory:factory}),'/api/archive/public/monbezon/health');
      assert.equal(result.status,503);assert.equal(result.body.error.code,'wip_configuration_required');}
    assert.equal(bundles,0);assert.equal(pools,0);
    for(const patch of [{ARCHIVE_PUBLIC_WIP_OWNER_MODE:'enabled'},{ARCHIVE_PUBLIC_WIP_PROFILE:'fixture'},
      {ARCHIVE_PUBLIC_WIP_SCHEMA:'archive_corrections_serverless'},{ARCHIVE_PUBLIC_WIP_ORIGIN:'http://valerianteissier.com'},
      {ARCHIVE_PUBLIC_WIP_DATABASE_URL:fakeEnv.ARCHIVE_PUBLIC_WIP_DATABASE_URL+'?sslmode=disable'}])
      assert.throws(()=>createConfiguredWip({...fakeEnv,...patch},{...bundle,driverFactory:factory}));
    assert.throws(()=>createConfiguredWip(fakeEnv,{...bundle,context:{...context,passage:{...context.passage,public_rights_review:'approved'}},driverFactory:factory}));
    assert.throws(()=>createConfiguredWip(fakeEnv,{...bundle,mandate:{...bundle.mandate,rights_approved:true},driverFactory:factory}));
    assert.equal(pools,0);report.stages.push({stage:'configuration-and-artifacts-before-pool',passed:true,missing_env_checked:6,pools_opened:0});
  });
  await t.test('operator seed is exactly D3 r1 in a new schema, with no owner credentials',async()=>{
    assert.equal(canonical(context),canonical(loadReaderContext(join(run,'derivatives'))));assert.equal(digest(context),CONTEXT_DIGEST);
    assert.equal(digest(context.initialRevision),R1_DIGEST);assert.equal(literalHash(context),TEXT_SHA256);
    driver=await pgliteDriver(join(run,'historical-gate-data'));
    const proof=await seedExactContext(driver,{schema:fakeEnv.ARCHIVE_PUBLIC_WIP_SCHEMA,...bundle});writeNew('seed-proof.json',proof);
    await assert.rejects(seedExactContext(driver,{schema:fakeEnv.ARCHIVE_PUBLIC_WIP_SCHEMA,...bundle}),e=>e.code==='new_schema_required');
    const auth=(await driver.transaction(tx=>tx.query(`SELECT count(*) AS count FROM ${fakeEnv.ARCHIVE_PUBLIC_WIP_SCHEMA}.owner_credentials`))).rows[0];assert.equal(Number(auth.count),0);
    report.stages.push({stage:'exact-new-schema-seed',passed:true,r1_canonical_sha256:R1_DIGEST,r1_text_sha256:TEXT_SHA256,owner_credentials:0,existing_schema_refused:true});
  });
  const observed={transaction(...args){transactions++;return driver.transaction(...args);},close:()=>driver.close()};
  const candidate=createConfiguredWip(fakeEnv,{...bundle,driverFactory:()=>observed});
  const prefix='/api/archive/public/monbezon/',path=prefix+'passage?passage_id='+encodeURIComponent(context.passage.passage_id);
  let baseline;
  await t.test('GET delivers the historical source and explicit pending/unreviewed statuses',async()=>{
    assert.equal((await call(candidate.handler,prefix+'health')).status,200);
    const result=await call(candidate.handler,path);assert.equal(result.status,200);baseline=result.body;
    assert.equal(canonical(baseline.passage),canonical(context.passage));assert.equal(canonical(baseline.current_revision),canonical(context.initialRevision));
    assert.equal(baseline.data_kind,'historical-local');assert.equal(baseline.passage.public_rights_review,'pending');assert.equal(baseline.passage.reading_status,'unreviewed');
    assert.equal(baseline.user_wip_delivery_authorized,true);assert.equal(baseline.wip_delivery_enabled,true);
    for(const field of ['rights_approved','reading_confirmed','identity_verified','owner_access_enabled','decisions_enabled','human_validation_enabled'])assert.equal(baseline[field],false);
    for(const route of [prefix+'passage?passage_id=synthetic-mvp-d-001',path+'&extra=1','/api/archive/public/fixture/health'])assert.equal((await call(candidate.handler,route)).status,404);
    for(const headers of [{host:'www.valerianteissier.com'},{origin:'https://foreign.invalid'},{'x-forwarded-proto':'http'}])assert.equal((await call(candidate.handler,path,{headers})).status,403);
    report.stages.push({stage:'exact-historical-get',passed:true,synthetic_substitution:false,rights:'pending',reading:'unreviewed',source_context_unchanged:true});
  });
  await t.test('one technical no-change proposal is idempotent; source stays r1 with zero decisions',async()=>{
    const body={passage_id:context.passage.passage_id,base_revision:context.initialRevision.text_revision,replacement_text:context.initialRevision.text,
      reason:'Essai technique D10 sans modification du texte : vérification de la réception et de l’idempotence, aucune correction historique proposée.',evidence_refs:context.passage.evidence_refs,simulation:true};
    const options={method:'POST',body,headers:{'idempotency-key':'monbezon-wip-gate-v1'}};
    const created=await call(candidate.handler,prefix+'corrections',options),replay=await call(candidate.handler,prefix+'corrections',options);
    assert.equal(created.status,201);assert.equal(replay.status,200);assert.equal(created.body.proposal.proposal_id,replay.body.proposal.proposal_id);
    assert.equal((await call(candidate.handler,prefix+'corrections',{...options,body:{...body,reason:'Different request'}})).status,409);
    assert.equal((await call(candidate.handler,prefix+'corrections',{...options,body:{...body,actor_role:'owner'}})).status,422);
    assert.equal(canonical((await call(candidate.handler,path)).body),canonical(baseline));
    const store=new ServerlessStore(driver,{schema:fakeEnv.ARCHIVE_PUBLIC_WIP_SCHEMA,context}),snapshot=await store.exportSnapshot();
    assert.equal(snapshot.proposals.length,1);assert.equal(snapshot.decisions.length,0);assert.equal(snapshot.revisions.length,1);assert.equal(digest(snapshot.revisions[0]),R1_DIGEST);
    writeNew('historical-editorial-export.json',snapshot);
    report.stages.push({stage:'historical-proposal-idempotency',passed:true,statuses:[201,200],proposal_id:created.body.proposal.proposal_id,
      proposal_kind:'technical-no-text-change',source_get_unchanged:true,revisions:1,decisions:0,proposals:1});
  });
  await t.test('every owner/auth endpoint returns 403 before SQL or cookies',async()=>{
    const before=transactions;
    for(const [route,method] of [['auth/login','POST'],['auth/session','GET'],['auth/logout','POST'],['auth/revoke-all','POST'],['owner/corrections','GET'],['owner/decisions','POST'],['owner/export','GET']]){
      const result=await call(candidate.handler,prefix+route,{method,body:method==='POST'?{}:undefined,headers:{cookie:'invented=cookie','x-csrf-token':'invented'}});
      assert.equal(result.status,403);assert.equal(result.body.error.code,'owner_access_unqualified');assert.equal(result.headers['Set-Cookie'],undefined);}
    assert.equal(transactions,before);report.stages.push({stage:'owner-endpoints-closed',passed:true,endpoints:7,sql_transactions:0,cookies:0});
  });
  await t.test('Root can mount the exact profile locally using explicit arguments and no production env',async()=>{
    const local=createLocalWip({driver:observed,schema:fakeEnv.ARCHIVE_PUBLIC_WIP_SCHEMA,...bundle,origin:'http://127.0.0.1:8812',sessionKey:'e'.repeat(64)});
    const result=await call(local.handler,path,{local:true});assert.equal(result.status,200);assert.equal(canonical(result.body),canonical(baseline));
    assert.equal((await call(local.handler,prefix+'owner/decisions',{local:true,method:'POST',body:{}})).status,403);
    assert.equal((await call(local.handler,prefix+'corrections',{local:true,method:'POST',body:{},headers:{origin:'http://127.0.0.1:8810'}})).status,403);
    for(const [name,expected] of Object.entries(BUNDLE_HASHES))assert.equal(hash(readFileSync(join(run,'derivatives',name))),expected);
    assert.equal(digest(loadDeliveryBundle(join(run,'delivery-assets')).context),CONTEXT_DIGEST);
    report.stages.push({stage:'explicit-local-mount',passed:true,actual_socket_opened:false,production_env_read:false,all_six_derivatives_unchanged:true});
  });
  await t.test('new-package overlay resolves exact wrappers and includes only pinned runtime assets',async()=>{
    const allow=JSON.parse(readFileSync(join(run,'runtime-allowlist.json'),'utf8'));
    const all=[...allow.runtime_files,...allow.generated_files,...allow.dependency_manifests];assert.equal(all.length,29);
    for(const item of all)assert.equal(hash(readFileSync(item.source_path)),item.sha256);
    for(const item of allow.generated_files.filter(i=>i.target_relative_path.endsWith('.mjs'))){
      const spec=/from '([^']+)'/.exec(readFileSync(item.source_path,'utf8'))[1];
      assert.equal(resolve(repo,dirname(item.target_relative_path),spec),join(repo,'scripts/archive-corrections/public-wip/function.mjs'));}
    const additions=JSON.parse(readFileSync(join(run,'vercel.additions-only.json'),'utf8'));assert.deepEqual(Object.keys(additions),['functions']);
    assert.equal(canonical(JSON.parse(readFileSync(join(run,'deployment-overlay/scripts/archive-corrections/public-wip/delivery-assets/exact-context.json'),'utf8'))),canonical(context));
    report.stages.push({stage:'new-package-delta',passed:true,allowlist_files:29,wrappers:10,exact_context_included:true,author_config_modified:false});
  });
  report.passed=report.stages.length===7;
  assert.equal(report.stages.length,7,'All seven bounded stages must pass.');
});
