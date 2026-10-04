import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {digest} from './p09-corrections-renderer.mjs';

const root=resolve('.private/archives-next-readings/p09-corrections-ui-20261004-v1/reviewed-r2'),assets=join(root,'site/assets/archives-p09-corrections');
const proofBytes=await readFile(join(root,'build-proof.json'));assert.equal(digest(proofBytes),'c4d2b737f5d3f3d03219c41518ed0c834bcd4f44b756308fc006325ddc5cbace');const proof=JSON.parse(proofBytes);
for(const [name,pin]of Object.entries(proof.outputs)){const bytes=await readFile(join(root,name));assert.equal(digest(bytes),pin.sha256);assert.equal(bytes.length,pin.bytes);}
const {SELECTION}=await import(pathToFileURL(join(assets,'selection.mjs')));
const {describeP09Passage}=await import(pathToFileURL(join(assets,'form-adapter.mjs')));
const {PASSAGE_URL,editorProposalText,createP09CorrectionSession,describeP09Receipt}=await import(pathToFileURL(join(assets,'session.mjs')));
const {displayP09Passage}=await import(pathToFileURL(join(assets,'client.mjs')));
const contextPath='Z:/Codex/repos/Website-archives-corrections/.archive-corrections-private/d14-p09-corrections-ae8f65bb-c7f6-4c90-92f7-6928af6b96cd/deployment-overlay/scripts/archive-corrections/public-p09/delivery-assets/exact-context.json';
const contextBytes=await readFile(contextPath);assert.equal(digest(contextBytes),SELECTION.context_file_sha256);const context=JSON.parse(contextBytes);
// Private unit envelopes derived from the pinned D14 context. These are not API
// responses obtained over the network, and no proposal or DB is created.
const flags={simulation:true,identity_verified:false,historical_reading_validated:false,reading_confirmed:false,rights_approved:false,owner_access_enabled:false,decisions_enabled:false,human_validation_enabled:false};
const envelope={...flags,api_version:'archive-corrections/p09-proposed-v1',delivery_profile:SELECTION.profile,context_sha256:SELECTION.context_digest,body_sha256:SELECTION.body_sha256,proposal_review_status:'pending',passage:context.passage,current_revision:context.initialRevision,revisions:[context.initialRevision]};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});
const binding=await describeP09Passage(envelope);assert.equal(digest(Buffer.from(binding.text)),SELECTION.body_sha256);assert.equal(digest(Buffer.from(binding.proposedFrench)),SELECTION.modern_sha256);assert.equal(binding.text.split('\n').filter((line,index,all)=>index<all.length-1||line!=='').length,21);
const refusalNames=[];
for(const [name,change]of [
 ['wrong profile',copy=>{copy.delivery_profile='monbezon-wip';}],
 ['wrong edition',copy=>{copy.passage.edition_id='other-edition';}],
 ['wrong revision',copy=>{copy.current_revision.text_revision+='-other';}],
 ['changed diplomatic bytes',copy=>{copy.current_revision.text+=' ';}],
 ['changed French bytes',copy=>{copy.passage.proposed_french.text+=' ';}],
 ['resolved person',copy=>{copy.passage.person_id='person:invented';}],
 ['claimed authority',copy=>{copy.human_validation_enabled=true;}]
]){const copy=structuredClone(envelope);change(copy);await assert.rejects(describeP09Passage(copy));refusalNames.push(name);}
const calls=[];let keyCount=0,failNext=true;
function receiptFor(options){const {edition_id,base_text_sha256,...payload}=JSON.parse(options.body);return {...flags,api_version:envelope.api_version,delivery_profile:SELECTION.profile,context_sha256:SELECTION.context_digest,body_sha256:SELECTION.body_sha256,human_decision:false,proposal_review_status:'pending',proposal:{...payload,proposal_id:'proposal_00000000-0000-4000-8000-000000000001',actor_role:'anonymous',created_at:'unit-only'},proposal_binding:{edition_id,base_text_sha256,source_object_id:SELECTION.source_object_id,admission_sha256:SELECTION.admission_sha256}};}
const fakeFetch=async(url,options)=>{calls.push({url,options});if(options.method==='GET')return json(envelope);if(failNext){failNext=false;throw Error('Unit-controlled lost response after POST');}return json(receiptFor(options),200);};
const session=createP09CorrectionSession({fetchImpl:fakeFetch,keyFactory:()=>{keyCount++;return 'unit-p09-stable-key-001';}});
await session.load();assert.equal(calls[0].url,PASSAGE_URL);assert.equal(calls[0].options.credentials,'omit');
await assert.rejects(session.submit({replacementText:binding.text,reason:'   '}));assert.equal(session.snapshot().pending,null);assert.equal(calls.length,1);
const replacementText=binding.text.replace('Noble','Noble [proposition de test]');
await assert.rejects(session.submit({replacementText,reason:'Test unitaire de conservation de l’envoi.'}));
assert.equal(session.snapshot().phase,'uncertain');const retained=session.snapshot().pending,bodyBefore=retained.body,keyBefore=retained.headers['Idempotency-Key'];
assert.equal(JSON.parse(retained.body).edition_id,SELECTION.edition_id);assert.equal(JSON.parse(retained.body).base_revision,SELECTION.text_revision);assert.equal(JSON.parse(retained.body).base_text_sha256,SELECTION.body_sha256);assert.deepEqual(JSON.parse(retained.body).evidence_refs,binding.evidenceRefs);assert.equal(JSON.parse(retained.body).simulation,true);
assert.deepEqual(Object.keys(JSON.parse(retained.body)).sort(),['passage_id','base_revision','base_text_sha256','edition_id','replacement_text','reason','evidence_refs','simulation'].sort());
assert.deepEqual(Object.keys(retained.headers).sort(),['Content-Type','Idempotency-Key'].sort());
await assert.rejects(session.submit({replacementText:'modified after uncertain response',reason:'Must not send'}));await assert.rejects(session.load());assert.equal(calls.length,2);
const checked=await session.retry();assert.equal(session.snapshot().phase,'received');assert.equal(checked.reviewStatus,'pending');assert.equal(checked.humanDecision,false);assert.equal(session.snapshot().pending,retained);assert.equal(calls[1].options.body,bodyBefore);assert.equal(calls[2].options.body,bodyBefore);assert.equal(calls[1].options.headers['Idempotency-Key'],keyBefore);assert.equal(calls[2].options.headers['Idempotency-Key'],keyBefore);assert.equal(keyCount,2); // one unused key for invalid reason, one retained valid request
await assert.rejects(session.retry());assert.equal(calls.length,3);assert.equal(binding.text,context.initialRevision.text);
const wrongReceipts=[];
for(const [name,change]of [
 ['pending promoted',copy=>{copy.proposal_review_status='accepted';}],
 ['contradictory nested accepted status',copy=>{copy.proposal.review_status='accepted';}],
 ['unexpected nested decision',copy=>{copy.proposal.human_decision=true;}],
 ['human decision claimed',copy=>{copy.human_decision=true;}],
 ['wrong edition receipt',copy=>{copy.proposal_binding.edition_id='other';}],
 ['wrong base SHA receipt',copy=>{copy.proposal_binding.base_text_sha256='0'.repeat(64);}],
 ['different submitted text',copy=>{copy.proposal.replacement_text+=' ';}],
 ['unsafe proposal ID',copy=>{copy.proposal.proposal_id='<img src=x onerror=alert(1)>';}]
]){const copy=receiptFor(calls[2].options);change(copy);assert.throws(()=>describeP09Receipt(copy,retained));wrongReceipts.push(name);}
let malformedPosts=0;const invalidReceiptSession=createP09CorrectionSession({keyFactory:()=> 'unit-p09-receipt-key-001',fetchImpl:async(url,options)=>{if(options.method==='GET')return json(envelope);malformedPosts++;return new Response('<not-json>',{status:201,headers:{'Content-Type':'application/json'}});}});await invalidReceiptSession.load();await assert.rejects(invalidReceiptSession.submit({replacementText,reason:'Test reçu invalide'}));const malformedRequest=invalidReceiptSession.snapshot().pending;await assert.rejects(invalidReceiptSession.retry());assert.equal(invalidReceiptSession.snapshot().pending,malformedRequest);assert.equal(invalidReceiptSession.snapshot().phase,'uncertain');assert.equal(malformedPosts,2);
const crlfBinding={text:'ligne un\r\nligne deux\r\n'};assert.equal(editorProposalText(crlfBinding,'ligne un\nligne deux\n','ligne un\nligne deux\n'),crlfBinding.text);assert.equal(editorProposalText(crlfBinding,'ligne un\nligne deux\n','modifié\n'),'modifié\n');
let htmlWrites=0;const element=()=>({dataset:{},textContent:'',value:'',setAttribute(){},set innerHTML(value){htmlWrites++;throw Error('HTML sink forbidden');}});const elements=Object.fromEntries(['label','source','french','replacement','reason'].map(key=>[key,element()]));
const literal='<img src=x onerror=alert(1)> & <script>bad</script>';
displayP09Passage(elements,{...binding,text:literal,proposedFrench:literal});assert.equal(elements.source.textContent,literal);assert.equal(elements.french.textContent,literal);assert.equal(elements.replacement.value,literal);assert.equal(htmlWrites,0);
const html=await readFile(join(root,'site/archives/corrections/p09/index.html'),'utf8');assert(html.includes('id="correction-form"'));assert(html.includes('id="correction-status"'));assert(html.includes('name="reason" rows="3" minlength="1" maxlength="1000" required disabled'));assert(!/<script(?![^>]*\bsrc=)|\bon[a-z]+\s*=|\bstyle\s*=/iu.test(html));
const gate={format:'p09-corrections-ui-targeted-checks/1',status:'pass',scope:'unit checks of actual selected browser modules; no HTTP service or database',build_proof_sha256:digest(proofBytes),source_context_sha256:digest(contextBytes),checks:{real_selected_modules_imported:true,exact_diplomatic_21_lines:true,exact_diplomatic_sha256:SELECTION.body_sha256,exact_french_sha256:SELECTION.modern_sha256,binding_refusals:refusalNames,motif_required_before_post:true,eight_exact_payload_fields:true,no_client_role_headers:true,lost_post_response_preserves_request_object:true,retry_body_and_key_byte_identical:true,ambiguous_result_blocks_new_submission_and_reload:true,source_text_unchanged:true,receipt_remains_pending:true,receipt_refusals:wrongReceipts,malformed_receipt_keeps_uncertain_state:true,unchanged_editor_preserves_original_newlines:true,literal_text_sinks_no_markup:true,parent_css_selector_ids_reused:true,inline_code:false},network_requests:0,sockets_opened:0,database_created:false,real_proposals_created:0,browser_e2e_executed:false,browser_e2e_owner:'Root with real D14 backend'};
await writeFile(join(root,'targeted-checks.json'),JSON.stringify(gate,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS',selected_diplomatic_lines:21,binding_refusals:refusalNames.length,receipt_refusals:wrongReceipts.length,retry_exact:true,network:0,proposals:0,browser_e2e:'Root pending'},null,2));
