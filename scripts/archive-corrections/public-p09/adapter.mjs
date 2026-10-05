import { ApiError, canonical, digest, ensure, exactFields, validatePayload } from '../contract.mjs';
import { ServerlessStore } from '../hosted/serverless/store.mjs';
import { SharedSessions } from '../hosted/serverless/sessions.mjs';
import { readJson } from '../hosted/serverless/handler.mjs';
import { validateArtifacts } from './bundle.mjs';
import { validateSchema, validateOrigin, validateRequest, classifyRoute, DELIVERY_POLICY } from './policy.mjs';
import { SELECTION } from './selection.mjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
const wrap=body=>({...body,api_version:'archive-corrections/p09-proposed-v1',data_kind:'historical-proposed-edition',
 candidate_api_version:'archive-corrections/public-p09-v1',...DELIVERY_POLICY,body_sha256:SELECTION.body_sha256,context_sha256:SELECTION.context_digest});
export function sendP09Error(response,error){
 const known=error instanceof ApiError;response.writeHead(known?error.status:503,headers);
 response.end(canonical(wrap({error:{code:known?error.code:'p09_unavailable',message:known?error.message:'The prepared P09 adapter is unavailable.'}}))+'\n');
}
export function validateSubmission(body,context){
 exactFields(body,['passage_id','base_revision','base_text_sha256','edition_id','replacement_text','reason','evidence_refs','simulation']);
 ensure(body.passage_id===SELECTION.passage_id,422,'p09_passage_required','Only this exact P09 draft passage is supported.');
 ensure(body.edition_id===SELECTION.edition_id,409,'p09_edition_conflict','The selected proposed edition differs.');
 ensure(body.base_revision===SELECTION.text_revision,409,'revision_conflict','Refresh the exact P09 draft revision.');
 ensure(body.base_text_sha256===SELECTION.body_sha256,409,'base_text_conflict','The base text fingerprint differs from the pinned P09 draft.');
 const {base_text_sha256,edition_id,...payload}=body;
 validatePayload('proposal',payload,context.passage);return payload;
}
// Root supplies an explicitly owned driver and mount after review. No automatic
// environment lookup, database URL, pool creation, seeding, routing fallback or owner.
export function createP09Adapter({driver,schema,context,mandate,origin,sessionKey,local=false}={}){
 validateSchema(schema);validateOrigin(origin,{local});
 const validated=validateArtifacts(context,mandate);
 ensure(driver && typeof driver.transaction==='function' && typeof driver.close==='function',503,'p09_driver_required','An explicit owned driver is required.');
 ensure(typeof sessionKey==='string' && /^[a-f0-9]{64}$/.test(sessionKey),503,'p09_key_required','An explicit private mount key is required.');
 const store=new ServerlessStore(driver,{schema,context:validated.context}),sessions=new SharedSessions(store,sessionKey);
 let readiness;
 const ready=()=>readiness??=store.initialize({seed:false}).catch(error=>{readiness=undefined;throw error;});
 return {profile:SELECTION.profile,passage_id:SELECTION.passage_id,edition_id:SELECTION.edition_id,context_sha256:SELECTION.context_digest,
  close:()=>store.close(),async handler(request,response){
  try{
   validateRequest(request,origin,{local});const route=classifyRoute(request);
   // Bind a submission to the exact admitted draft before readiness or any SQL.
   const payload=route==='corrections'?validateSubmission(await readJson(request),validated.context):undefined;
   await ready();let status=200,body;
   if(route==='health')body={status:'ready',auth_mode:'anonymous-proposal-only',passage_id:SELECTION.passage_id};
   else if(route==='passage'){
    const {passage,current_revision,revisions}=await store.history();
    ensure(revisions.length===1 && digest(current_revision)===SELECTION.revision_digest,503,'p09_source_revision_mismatch','This profile requires the unchanged proposed draft, without decisions.');
    body={passage,current_revision,revisions};
   }else{
    await sessions.reserve('proposal');const result=await store.mutate('proposal',request.headers['idempotency-key'],payload);
    status=result.status;body={...result.body,proposal_binding:{edition_id:SELECTION.edition_id,base_text_sha256:SELECTION.body_sha256,
     source_object_id:SELECTION.source_object_id,admission_sha256:SELECTION.admission_sha256},human_decision:false};
   }
   response.writeHead(status,headers);response.end(canonical(wrap(body))+'\n');
  }catch(error){sendP09Error(response,error);}
 }};
}
