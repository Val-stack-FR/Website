import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { pgliteDriver } from '../hosted/drivers.mjs';
import { ServerlessStore } from '../hosted/serverless/store.mjs';
import { SYNTHETIC_CONTEXT as context } from '../fixture.mjs';
import { canonical } from '../contract.mjs';
import { createConfiguredCandidate } from './candidate.mjs';
import runtimeEntry, { createCandidateFunction } from './function.mjs';
import { CANONICAL_ORIGIN, ENV_NAMES } from './policy.mjs';
import { prepareMonbezonMapping } from './context-mapping.mjs';
import { prepareDeployment } from './deployment.mjs';

const run=process.argv[2] ?? process.env.D9_RUN_DIRECTORY;
if(!run)throw new Error('Explicit new D9 run required.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
// Entirely invented fixture inputs, never read from credentials or process.env.
const fakeEnv={ARCHIVE_PUBLIC_CANDIDATE_PROFILE:'fixture',ARCHIVE_PUBLIC_CANDIDATE_ORIGIN:CANONICAL_ORIGIN,
  ARCHIVE_PUBLIC_CANDIDATE_DATABASE_URL:'postgresql://invented:fixture_only@unused.invalid/invented',
  ARCHIVE_PUBLIC_CANDIDATE_SCHEMA:'archive_corrections_d5_public_fixture_gate',
  ARCHIVE_PUBLIC_CANDIDATE_SESSION_HMAC_KEY:'b'.repeat(64),ARCHIVE_PUBLIC_CANDIDATE_OWNER_MODE:'disabled'};
const report={version:'public-candidate-gate/v1',simulation:true,identity_verified:false,network_used:false,
  process_env_credentials_read:false,d8_store_accessed:false,d6_d7_replayed:false,stages:[]};
function request(path,{method='GET',body,headers={}}={}){
  const h={host:'valerianteissier.com','x-forwarded-proto':'https',origin:CANONICAL_ORIGIN,
    ...(body!==undefined?{'content-type':'application/json'}:{}),...headers};
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
  req.method=method;req.url=path;req.headers=h;req.rawHeaders=Object.entries(h).flatMap(([k,v])=>[k,v]);return req;
}
async function call(handler,path,options){
  const req=request(path,options),res={writeHead(status,headers){this.status=status;this.headers=headers;},end(bytes){this.bytes=String(bytes);this.body=JSON.parse(this.bytes);}};
  await handler(req,res);assert.equal(req.url,path);return res;
}
const writeNew=async(file,value)=>{const {writeFileSync}=await import('node:fs');writeFileSync(join(run,file),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});};
test('prepared canonical HTTPS public candidate: fail-closed configuration, routing and permanently disabled owner authority',async t=>{
  let driver,candidate,transactionCount=0;
  t.after(async()=>{if(driver)await driver.close();await writeNew('gate-proof.json',report);});
  await t.test('missing or unsafe configuration fails before driver creation, with no runtime environment read',async()=>{
    assert.equal(typeof runtimeEntry,'function');let factoryCalls=0;
    const factory=()=>{factoryCalls++;throw new Error('No driver should be created.');};
    for(const name of ENV_NAMES){const env={...fakeEnv};delete env[name];
      const fn=createCandidateFunction({envProvider:()=>env,driverFactory:factory});
      const response=await call(fn,'/api/archive/public/fixture/health');assert.equal(response.status,503);assert.equal(response.body.error.code,'candidate_configuration_required');}
    for(const patch of [{ARCHIVE_PUBLIC_CANDIDATE_ORIGIN:'http://valerianteissier.com'},
      {ARCHIVE_PUBLIC_CANDIDATE_ORIGIN:'https://www.valerianteissier.com'},{ARCHIVE_PUBLIC_CANDIDATE_OWNER_MODE:'enabled'},
      {ARCHIVE_PUBLIC_CANDIDATE_SCHEMA:'archive_corrections_serverless'},
      {ARCHIVE_PUBLIC_CANDIDATE_DATABASE_URL:'postgresql://invented:fixture_only@unused.invalid/invented?sslmode=disable'}]){
      const response=await call(createCandidateFunction({envProvider:()=>({...fakeEnv,...patch}),driverFactory:factory}),'/api/archive/public/fixture/health');
      assert.equal(response.status,503);assert.equal(response.bytes.includes('fixture_only'),false);}
    assert.equal(factoryCalls,0);report.stages.push({stage:'configuration-before-driver',passed:true,required_variables:ENV_NAMES.length,driver_created_on_refusal:false,runtime_credentials_read:false});
  });
  // Offline SQL only, in this exclusive new D9 test directory; never D8 data.
  driver=await pgliteDriver(join(run,'fixture-data'));
  const store=new ServerlessStore(driver,{schema:fakeEnv.ARCHIVE_PUBLIC_CANDIDATE_SCHEMA});await store.migrate();await store.initialize();
  const observed={transaction(...args){transactionCount++;return driver.transaction(...args);},close:()=>driver.close()};
  candidate=createConfiguredCandidate(fakeEnv,{driverFactory:()=>observed});
  const prefix='/api/archive/public/fixture/',passage=prefix+'passage?passage_id='+encodeURIComponent(context.passage.passage_id);
  let baseline;
  await t.test('canonical HTTPS and exact routes reject spoofed authority and preserve fixture fields',async()=>{
    for(const headers of [{host:'www.valerianteissier.com'},{origin:'https://foreign.invalid'},{'x-forwarded-proto':'http'}])
      assert.equal((await call(candidate.handler,prefix+'health',{headers})).status,403);
    const bad=request(prefix+'health');bad.rawHeaders.push('Host','valerianteissier.com');const result={writeHead(s,h){this.status=s;},end(b){this.body=JSON.parse(b);}};
    await candidate.handler(bad,result);assert.equal(result.status,400);
    const health=await call(candidate.handler,prefix+'health');assert.equal(health.status,200);
    baseline=(await call(candidate.handler,passage)).body;assert.equal(baseline.current_revision.text_revision,context.initialRevision.text_revision);
    for(const key of ['identity_verified','human_validation_enabled','reading_confirmed','publication_enabled','owner_access_enabled'])assert.equal(baseline[key],false);
    assert.equal((await call(candidate.handler,passage+'&extra=1')).status,404);
    assert.equal((await call(candidate.handler,prefix+'health?x=1')).status,404);
    assert.equal((await call(candidate.handler,prefix+'corrections')).status,405);
    assert.equal((await call(candidate.handler,'/api/archive/public/monbezon/health')).status,404);
    report.stages.push({stage:'canonical-route-boundary',passed:true,canonical_origin:CANONICAL_ORIGIN,r1_unchanged:true,private_context_not_routed:true});
  });
  await t.test('all owner and auth endpoints refuse before SQL, regardless of fake cookie or CSRF',async()=>{
    const before=transactionCount;
    for(const [route,method] of [['auth/login','POST'],['auth/session','GET'],['auth/logout','POST'],['auth/revoke-all','POST'],
      ['owner/corrections','GET'],['owner/decisions','POST'],['owner/export','GET']]){
      const response=await call(candidate.handler,prefix+route,{method,body:method==='POST'?{}:undefined,
        headers:{cookie:'invented=cookie','x-csrf-token':'c'.repeat(64)}});
      assert.equal(response.status,403);assert.equal(response.body.error.code,'owner_access_unqualified');assert.equal(response.headers['Set-Cookie'],undefined);
    }
    assert.equal(transactionCount,before);
    assert.equal((await call(candidate.handler,prefix+'health',{headers:{authorization:'Bearer invented'}})).status,403);
    report.stages.push({stage:'owner-authority-disabled',passed:true,owner_routes_checked:7,owner_sql_queries:0,cookies_issued:0});
  });
  await t.test('one anonymous invented proposal replays through real D5 SQL without changing reading or publication',async()=>{
    const body={passage_id:context.passage.passage_id,base_revision:context.initialRevision.text_revision,
      replacement_text:'Variante entièrement fictive du candidat HTTPS.',reason:'Essai ciblé privé, aucune lecture confirmée.',evidence_refs:context.passage.evidence_refs,simulation:true};
    const options={method:'POST',body,headers:{'idempotency-key':'public-fixture-proposal'}};
    const created=await call(candidate.handler,prefix+'corrections',options);assert.equal(created.status,201);
    const replay=await call(candidate.handler,prefix+'corrections',options);assert.equal(replay.status,200);assert.equal(replay.body.proposal.proposal_id,created.body.proposal.proposal_id);
    assert.equal((await call(candidate.handler,prefix+'corrections',{...options,body:{...body,actor_role:'owner'}})).status,422);
    assert.equal(canonical((await call(candidate.handler,passage)).body),canonical(baseline));
    const snapshot=await store.exportSnapshot();assert.equal(snapshot.decisions.length,0);assert.equal(snapshot.revisions.length,1);
    await writeNew('fixture-editorial-export.json',snapshot);
    report.stages.push({stage:'fixture-proposal-only',passed:true,statuses:[201,200],proposal_id:created.body.proposal.proposal_id,decisions:0,revisions:1,public_reading_unchanged:true});
  });
  await t.test('private exact Monbezon r1 mapping never opens a public driver or serves historical text',async()=>{
    const mapping=prepareMonbezonMapping(run);
    assert.equal(mapping.text_revision,'text:atelier-494756c2009be577ad11a5eb0a662d38:r1');
    assert.equal(mapping.source_revision,'7be10cb405aadd1628c565dcbac7a6442d2b970c69a01f45cf6d43dd76b0e6b4');
    assert.equal(mapping.reading_status,'unreviewed');assert.equal(mapping.act_id,null);assert.equal(mapping.document_id,null);assert.equal(mapping.translation,null);
    assert.equal(mapping.public_rights_review,'pending');assert.equal(mapping.publication_status,'not-published');assert.equal(mapping.public_delivery_enabled,false);
    let calls=0;const fn=createCandidateFunction({envProvider:()=>({...fakeEnv,ARCHIVE_PUBLIC_CANDIDATE_PROFILE:'monbezon'}),driverFactory:()=>{calls++;}});
    const refusal=await call(fn,'/api/archive/public/monbezon/passage');assert.equal(refusal.status,503);assert.equal(refusal.body.error.code,'publication_rights_pending');assert.equal(calls,0);
    report.stages.push({stage:'private-monbezon-mapping',passed:true,r1_text_sha256:mapping.r1_text_sha256,r1_canonical_sha256:mapping.r1_canonical_sha256,public_delivery_enabled:false,driver_created:false});
  });
  await t.test('executable delta adapter resolves all function imports and preserves the existing static deployment fields',async()=>{
    const deployment=prepareDeployment(run);assert.equal(deployment.files.length,20);assert.equal(deployment.deployed,false);assert.equal(deployment.values_included,false);
    const repository=resolve(run,'../..'),target=join(repository,'scripts/archive-corrections/public-candidate/function.mjs');
    for(const path of deployment.files){const bytes=readFileSync(join(run,'deployment-overlay',path),'utf8');const specifier=/from '([^']+)'/.exec(bytes)[1];
      const resolved=resolve(repository,dirname(path),specifier);assert.equal(resolved,target);
      assert.equal(typeof(await import(pathToFileURL(resolved).href)).default,'function');}
    const original=JSON.parse(readFileSync(join(run,'site-config-reference.json'),'utf8')),
      proposed=JSON.parse(readFileSync(join(run,'deployment-overlay/vercel.merge-proposal.json'),'utf8'));
    assert.equal(canonical(proposed.headers),canonical(original.headers));assert.equal(proposed.buildCommand,original.buildCommand);assert.equal(proposed.outputDirectory,original.outputDirectory);
    assert.equal(deployment.private_mapping_or_derivatives_included,false);assert.equal(deployment.auto_install_configured,false);
    report.stages.push({stage:'deployment-delta-resolved',passed:true,entrypoints:20,relative_imports_valid:true,existing_static_fields_preserved:true,root_config_modified:false,installed:false,deployed:false});
  });
  report.passed=true;
});
