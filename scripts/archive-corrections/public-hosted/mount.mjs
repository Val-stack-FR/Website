import { canonical,digest,ensure,validateKey,validatePayload,ApiError } from '../contract.mjs';
import { validateSnapshot } from '../snapshot-validation.mjs';
import { ServerlessStore } from '../hosted/serverless/store.mjs';
import { SharedSessions } from '../hosted/serverless/sessions.mjs';
import { readJson,API_VERSION } from '../hosted/serverless/handler.mjs';
import { validateArtifacts as validateMonbezon } from '../public-wip/bundle.mjs';
import { DELIVERY_POLICY as monbezonPolicy } from '../public-wip/policy.mjs';
import { validateArtifacts as validateP09 } from '../public-p09/bundle.mjs';
import { validateSubmission } from '../public-p09/adapter.mjs';
import { DELIVERY_POLICY as p09Policy } from '../public-p09/policy.mjs';
export function validateBundle(profile,bundle){return profile.slug==='monbezon'?validateMonbezon(bundle.context,bundle.mandate):validateP09(bundle.context,bundle.mandate);}
export function createPreparedPublicMount({profile,config,bundle,driver}){
 const checked=validateBundle(profile,bundle),context=checked.context;
 ensure(driver && typeof driver.transaction==='function' && typeof driver.close==='function',503,'hosted_driver_required','An explicit driver is required.');
 const store=new ServerlessStore(driver,{schema:config.schema,context}),sessions=new SharedSessions(store,config.sessionKey);
 const policy=profile.slug==='monbezon'?monbezonPolicy:p09Policy;
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','Strict-Transport-Security':'max-age=31536000','Content-Security-Policy':"default-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
 const wrap=body=>({...body,api_version:profile.slug==='monbezon'?API_VERSION:context.apiVersion,data_kind:context.dataKind,
  candidate_api_version:profile.slug==='monbezon'?'archive-corrections/public-wip-v1':'archive-corrections/public-p09-v1',...policy,
  ...(profile.slug==='p09'?{body_sha256:context.passage.body_sha256,context_sha256:profile.contextDigest}:{})});
 let readiness;
 const ready=()=>readiness??=driver.transaction(async tx=>{
  // Verification of pre-provisioned state only. No initialize, migrate, restore,
  // seed, enrollment or write transaction is reachable from this readiness path.
  await store.verifyMigration(tx);
  const metadata=(await tx.query(`SELECT fixture_json, api_version FROM ${store.table('metadata')}`)).rows[0];
  ensure(metadata?.fixture_json===canonical(context.passage) && metadata.api_version===context.apiVersion,
   503,'hosted_provisioning_required','Provision the exact selected context separately before serving.');
  const snapshot=await store.snapshot(tx);validateSnapshot(snapshot,context);
  ensure(snapshot.revisions.length===1 && snapshot.decisions.length===0 && digest(snapshot.revisions[0])===profile.revisionDigest,
   503,'hosted_source_revision_required','The unchanged pinned WIP source with zero decisions is required.');
 },{readOnly:true}).catch(error=>{readiness=undefined;throw error;});
 return {profile:profile.name,passage_id:profile.passageId,context_sha256:profile.contextDigest,schema:config.schema,close:()=>driver.close(),
  async handler(request,response){try{
   const route=request.url.slice(profile.prefix.length).split('?')[0];let payload;
   if(route==='corrections'){
    const body=await readJson(request);
    payload=profile.slug==='p09'?validateSubmission(body,context):body;
    validateKey(request.headers['idempotency-key']);validatePayload('proposal',payload,context.passage);
    ensure(payload.base_revision===profile.revision,409,'revision_conflict','Only the pinned WIP source revision is supported.');
   }
   await ready();let status=200,body;
   if(route==='health')body={status:'ready',auth_mode:'anonymous-proposal-only',passage_id:profile.passageId};
   else if(route==='passage'){const {passage,current_revision,revisions}=await store.history();
    ensure(revisions.length===1 && digest(current_revision)===profile.revisionDigest,503,'hosted_source_revision_required','The exact pinned WIP source revision is required.');
    body={passage,current_revision,revisions};}
   else{await sessions.reserve('proposal');const result=await store.mutate('proposal',request.headers['idempotency-key'],payload);status=result.status;
    body={...result.body,human_decision:false,...(profile.slug==='p09'?{proposal_binding:{edition_id:profile.editionId,base_text_sha256:context.passage.body_sha256,
     source_object_id:context.passage.source_object_id,admission_sha256:context.passage.admission_sha256}}:{})};}
   response.writeHead(status,headers);response.end(canonical(wrap(body))+'\n');
  }catch(error){const known=error instanceof ApiError;response.writeHead(known?error.status:503,headers);
   response.end(canonical(wrap({error:{code:known?error.code:'hosted_profile_unavailable',message:known?error.message:'The pre-provisioned public profile is unavailable.'}}))+'\n');}
 }};
}
