import { SELECTION } from './selection.mjs';
const requireValue=(value,message)=>{if(!value)throw Error(message);};
const sha=async text=>Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
// Browser-compatible pure binding. No fetch, DOM mutation or default dossier route.
export async function describeP09Passage(body){
 const p=body?.passage,r=body?.current_revision;
 requireValue(body?.api_version==='archive-corrections/p09-proposed-v1' && body.delivery_profile===SELECTION.profile && body.context_sha256===SELECTION.context_digest,'Wrong correction profile.');
 requireValue(p?.passage_id===SELECTION.passage_id && p.edition_id===SELECTION.edition_id && p.edition_status===SELECTION.edition_status &&
  p.source_object_id===SELECTION.source_object_id && p.source_derivative_sha256===SELECTION.derivative_sha256 &&
  p.admission_sha256===SELECTION.admission_sha256 && p.line_count===21 && p.reading_status===SELECTION.edition_status &&
  p.rights_status==='unknown' && p.source_publication_status==='private' && p.human_review==='pending','Wrong P09 source/edition.');
 requireValue(['act_id','document_id','view_id','date','person_id','place_id'].every(k=>p[k]===null) &&
  Object.values(p.canonical_refs??{}).every(v=>v===null),'Unresolved P09 references must remain null.');
 requireValue(['identity_verified','historical_reading_validated','reading_confirmed','rights_approved','owner_access_enabled','decisions_enabled','human_validation_enabled'].every(k=>body[k]===false),'Unexpected authority or confirmation.');
 requireValue(r?.passage_id===SELECTION.passage_id && r.text_revision===SELECTION.text_revision && r.based_on_revision===null && r.decision_id===null &&
  typeof r.text==='string' && await sha(r.text)===SELECTION.body_sha256,'Pinned draft text/version differs.');
 requireValue(p.proposed_french?.edition_id===SELECTION.edition_id && p.proposed_french.status===SELECTION.edition_status &&
  typeof p.proposed_french.text==='string' && await sha(p.proposed_french.text)===SELECTION.modern_sha256,'Pinned French proposed variant differs.');
 return Object.freeze({profile:SELECTION.profile,passageId:SELECTION.passage_id,editionId:SELECTION.edition_id,textRevision:SELECTION.text_revision,
  baseTextSha256:SELECTION.body_sha256,sourceObjectId:SELECTION.source_object_id,admissionSha256:SELECTION.admission_sha256,
  title:p.title,label:'Édition de travail P09 — proposition non confirmée',text:r.text,proposedFrench:p.proposed_french.text,
  evidenceRefs:Object.freeze([...p.evidence_refs]),canonicalActId:null,canonicalViewId:null,canonicalDate:null,canonicalPersonId:null,
  proposalLabel:'Proposition du visiteur, en attente de revue humaine',submissionUrl:SELECTION.prefix+'corrections'});
}
export function createP09Submission(binding,{replacementText,reason,idempotencyKey}){
 requireValue(binding?.profile===SELECTION.profile && binding.passageId===SELECTION.passage_id && binding.editionId===SELECTION.edition_id &&
  binding.textRevision===SELECTION.text_revision && binding.baseTextSha256===SELECTION.body_sha256 && binding.submissionUrl===SELECTION.prefix+'corrections','Explicit P09 binding required.');
 requireValue(typeof idempotencyKey==='string' && /^[A-Za-z0-9._:-]{8,100}$/.test(idempotencyKey),'Stable idempotency key required.');
 requireValue(typeof replacementText==='string' && replacementText.trim().length>0 && replacementText.length<=5000 &&
  typeof reason==='string' && reason.trim().length>0 && reason.length<=1000,'Nonempty bounded proposal and reason required.');
 return Object.freeze({url:binding.submissionUrl,method:'POST',headers:Object.freeze({'Content-Type':'application/json','Idempotency-Key':idempotencyKey}),
  body:JSON.stringify({passage_id:binding.passageId,base_revision:binding.textRevision,base_text_sha256:binding.baseTextSha256,
   edition_id:binding.editionId,replacement_text:replacementText,reason,evidence_refs:[...binding.evidenceRefs],simulation:true})});
}
