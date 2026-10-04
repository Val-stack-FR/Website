import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { request } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, writeNew, sha } from './config.mjs';
import { canonical } from '../contract.mjs';
import { SYNTHETIC_CONTEXT as fixture } from '../fixture.mjs';

const configFile = process.env.D8_CONFIG_FILE;
if (!configFile) throw new Error('Explicit new D8 configuration required.');
const value = loadConfig(configFile), processes = [], report = { version: 'd8-integrated-gate/v1', simulation: true,
  identity_verified: false, browser_used: false, historical_human_validation_enabled: false, stages: [] };
let child;
async function start(episode) {
  child = fork(join(value.repository, 'scripts/archive-corrections/integrated-loopback/service.mjs'),
    ['serve',configFile,episode], { silent: true, windowsHide: true });
  processes.push(child); child.stdout.resume(); child.stderr.resume();
  const ready = await Promise.race([once(child,'message').then(([m])=>m),
    once(child,'exit').then(()=>{throw new Error('Owned D8 process exited before readiness.');}),
    new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('D8 startup timeout.')),30000);timer.unref();})]);
  assert.equal(ready.ready,true); return ready;
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exit=once(child,'exit'); child.send({action:'stop'});
  const timer=setTimeout(()=>child.kill(),10000); await exit; clearTimeout(timer); assert.equal(child.exitCode,0);
}
async function exportPreview(file) {
  const message=once(child,'message'); child.send({action:'export',profile:'preview',file});
  const [result]=await message; assert.equal(result.exported,true); return JSON.parse(readFileSync(join(value.run_directory,file),'utf8'));
}
function call(profile, route, {method='GET',body,key,cookie,csrf,headers={}}={}) {
  return new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port:value.listen_port,path:`/api/archive/${profile}/${route}`,method,timeout:10000,
      headers:{Host:new URL(value.public_origin).host,Origin:value.public_origin,
        ...(body !== undefined?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{}),
        ...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...headers}},res=>{
      let bytes='';res.on('data',b=>{bytes+=b});res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(bytes),headers:res.headers})}
        catch{reject(new Error('D8 response must be JSON.'))}});
    });req.on('error',()=>reject(new Error('D8 loopback request failed.')));req.on('timeout',()=>req.destroy(new Error('D8 request timeout.')));
    req.end(body === undefined?undefined:JSON.stringify(body));
  });
}
const proposal=(context,text)=>({passage_id:context.passage.passage_id,base_revision:context.initialRevision.text_revision,
  replacement_text:text,reason:'D8 : essai technique privé, aucune confirmation historique.',evidence_refs:context.passage.evidence_refs,simulation:true});
const decision=p=>({proposal_id:p.proposal_id,base_revision:p.base_revision,outcome:'accept',reason:'Décision entièrement fictive D8.',evidence_refs:p.evidence_refs,simulation:true});
test('D8 mounted-loopback contract, persistent SQL fixture gate and one closed D3 Monbezon preview',async t=>{
  t.after(async()=>{await stop();writeNew(join(value.run_directory,'gate-proof.json'),report);
    writeNew(join(value.run_directory,'test-process-closeout.json'),{workers:processes.map(p=>({node_pid:p.pid,exit_code:p.exitCode})),all_exited:processes.every(p=>p.exitCode===0),live_preview_in_this_gate:false});});
  const first=await start('gate-first');let p,owner,fixtureSnapshot,previewSnapshot;
  const passageRoute='passage?passage_id='+encodeURIComponent(fixture.passage.passage_id);
  const baseline=(await call('fixture',passageRoute)).body;
  await t.test('exact Origin, client role refusal and anonymous owner boundary',async()=>{
    assert.equal((await call('fixture','health',{headers:{Host:'foreign.invalid'}})).status,403);
    assert.equal((await call('fixture','health',{headers:{Origin:'http://127.0.0.1:9999'}})).status,403);
    assert.equal((await call('fixture','owner/corrections')).status,403);
    assert.equal((await call('fixture','health',{headers:{'X-Owner-Role':'owner'}})).status,403);
    assert.equal((await call('fixture','corrections',{method:'POST',key:'d8-role-spoof',body:{...proposal(fixture,'Essai fictif.'),actor_role:'owner'}})).status,422);
    assert.deepEqual((await call('fixture',passageRoute)).body,baseline);
    report.stages.push({stage:'authority-boundary',passed:true,client_role_refused:true,foreign_origin_refused:true,anonymous_owner_refused:true});
  });
  await t.test('proposal and idempotent replay preserve public reading and publication',async()=>{
    const body=proposal(fixture,'Variante fictive D8 pour le test SQL.');
    const created=await call('fixture','corrections',{method:'POST',key:'d8-fixture-proposal',body});assert.equal(created.status,201);p=created.body.proposal;
    const replay=await call('fixture','corrections',{method:'POST',key:'d8-fixture-proposal',body});assert.equal(replay.status,200);assert.equal(replay.body.proposal.proposal_id,p.proposal_id);
    assert.equal((await call('fixture','corrections',{method:'POST',key:'d8-fixture-proposal',body:{...body,replacement_text:'Payload différent.'}})).status,409);
    assert.deepEqual((await call('fixture',passageRoute)).body,baseline);assert.equal(baseline.publication_enabled,false);
    assert.equal(Object.hasOwn(baseline,'proposals'),false);
    report.stages.push({stage:'proposal-replay-before-decision',passed:true,statuses:[201,200],proposal_id:p.proposal_id,public_reading_unchanged:true,publication_unchanged:true});
  });
  await t.test('separate fixture decision enforces SQL session, exact Origin and CSRF',async()=>{
    const login=await call('fixture','auth/login',{method:'POST',body:{passphrase:value.fixture_owner_passphrase}});assert.equal(login.status,200);assert.equal(login.body.identity_verified,false);
    owner={cookie:login.headers['set-cookie'][0].split(';')[0],csrf:login.body.csrf_token};
    assert.match(login.headers['set-cookie'][0],/HttpOnly; SameSite=Strict; Path=\/api\/archive\/fixture/);
    assert.equal((await call('fixture','owner/decisions',{method:'POST',key:'d8-bad-csrf',body:decision(p),cookie:owner.cookie,csrf:'0'.repeat(64)})).status,403);
    assert.equal((await call('fixture','owner/decisions',{method:'POST',key:'d8-no-origin',body:decision(p),...owner,headers:{Origin:''}})).status,403);
    const accepted=await call('fixture','owner/decisions',{method:'POST',key:'d8-fixture-decision',body:decision(p),...owner});assert.equal(accepted.status,201);assert.equal(accepted.body.simulation,true);assert.equal(accepted.body.identity_verified,false);
    fixtureSnapshot=(await call('fixture','owner/export',owner)).body.snapshot;assert.ok(fixtureSnapshot);assert.equal(fixtureSnapshot.decisions.length,1);
    writeNew(join(value.run_directory,'fixture-before-restart.json'),fixtureSnapshot);
    report.stages.push({stage:'fixture-only-decision',passed:true,decision_id:accepted.body.decision.decision_id,csrf_enforced:true,identity_verified:false});
  });
  await t.test('one real D3-bound passage accepts a pending proposal and refuses every historical decision',async()=>{
    const health=(await call('preview','health')).body;
    assert.equal(health.data_kind,'historical-local');assert.equal(health.human_validation_enabled,false);
    const route='passage?passage_id='+encodeURIComponent(health.passage_id), before=(await call('preview',route)).body;
    assert.equal(before.passage.reading_status,'unreviewed');assert.equal(before.passage.act_id,null);assert.equal(before.passage.document_id,null);assert.equal(before.passage.translation,null);
    assert.equal(before.passage.publication_status,'not-published');assert.equal(before.decisions_enabled,false);
    const body={passage_id:health.passage_id,base_revision:before.current_revision.text_revision,
      replacement_text:before.current_revision.text+'\n[Essai de dépôt D8 — aucune lecture confirmée.]',
      reason:'Dépôt technique sur ce témoin réel D3 ; proposition privée d’essai, aucune validation historique.',evidence_refs:before.passage.evidence_refs,simulation:true};
    const created=await call('preview','corrections',{method:'POST',key:'d8-real-pending-proposal',body});assert.equal(created.status,201);
    const replay=await call('preview','corrections',{method:'POST',key:'d8-real-pending-proposal',body});assert.equal(replay.status,200);assert.equal(replay.body.proposal.proposal_id,created.body.proposal.proposal_id);
    assert.equal((await call('preview','owner/decisions',{method:'POST',key:'d8-real-refused-decision',body:decision(created.body.proposal),...owner})).body.error.code,'human_validation_disabled');
    assert.equal((await call('preview','auth/login',{method:'POST',body:{passphrase:value.fixture_owner_passphrase}})).status,403);
    assert.deepEqual((await call('preview',route)).body,before);
    previewSnapshot=await exportPreview('preview-before-restart.json');assert.equal(previewSnapshot.decisions.length,0);assert.equal(previewSnapshot.revisions.length,1);assert.equal(previewSnapshot.proposals.length,1);
    report.stages.push({stage:'single-real-passage-pending-only',passed:true,passage_id:health.passage_id,proposal_id:created.body.proposal.proposal_id,
      revision:before.current_revision.text_revision,source_revision:before.passage.source_revision,reading_status:'unreviewed',historical_decisions:0,
      human_validation_disabled:true,publication_status:'not-published',public_reading_unchanged:true});
  });
  await stop();const second=await start('gate-restarted');
  await t.test('clean new process keeps fixture history/export IDs and the real pending proposal',async()=>{
    assert.notEqual(first.node_pid,second.node_pid);
    const login=await call('fixture','auth/login',{method:'POST',body:{passphrase:value.fixture_owner_passphrase}});assert.equal(login.status,200);
    const auth={cookie:login.headers['set-cookie'][0].split(';')[0],csrf:login.body.csrf_token};
    const after=(await call('fixture','owner/export',auth)).body.snapshot;assert.equal(canonical(after),canonical(fixtureSnapshot));
    writeNew(join(value.run_directory,'fixture-after-restart.json'),after);
    const replay=await call('fixture','owner/decisions',{method:'POST',key:'d8-fixture-decision',body:decision(p),...auth});assert.equal(replay.status,200);assert.equal(replay.body.decision.decision_id,after.decisions[0].decision_id);
    const realAfter=await exportPreview('preview-after-restart.json');assert.equal(canonical(realAfter),canonical(previewSnapshot));
    report.stages.push({stage:'persistent-restart',passed:true,pids:[first.node_pid,second.node_pid],fixture_ids_preserved:true,real_pending_id_preserved:true,
      fixture_snapshot_sha256:after.sha256,preview_snapshot_sha256:realAfter.sha256,
      byte_identical_exports:sha(readFileSync(join(value.run_directory,'fixture-before-restart.json')))===sha(readFileSync(join(value.run_directory,'fixture-after-restart.json')))});
  });
  report.passed=true;
});
