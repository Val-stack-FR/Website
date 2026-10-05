import {SELECTION} from './selection.mjs';
import {describeP09Passage,createP09Submission} from './form-adapter.mjs';

const ensure=(condition,message)=>{if(!condition)throw Error(message);};
const sameList=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>value===b[index]);
const flags=['identity_verified','historical_reading_validated','reading_confirmed','rights_approved','owner_access_enabled','decisions_enabled','human_validation_enabled'];
export const PASSAGE_URL=SELECTION.prefix+'passage?passage_id='+encodeURIComponent(SELECTION.passage_id);
export function editorProposalText(binding,initialValue,currentValue){return currentValue===initialValue?binding.text:currentValue;}

// A transport receipt is checked before the UI can report a pending proposal.
export function describeP09Receipt(body,request){
 const sent=JSON.parse(request.body),proposal=body?.proposal,binding=body?.proposal_binding;
 ensure(body?.api_version==='archive-corrections/p09-proposed-v1'&&body.delivery_profile===SELECTION.profile&&body.context_sha256===SELECTION.context_digest&&body.body_sha256===SELECTION.body_sha256,'Reçu lié à un autre passage.');
 ensure(body.simulation===true&&body.human_decision===false&&body.proposal_review_status==='pending'&&flags.every(key=>body[key]===false),'État du reçu non conforme.');
 ensure(binding?.edition_id===SELECTION.edition_id&&binding.base_text_sha256===SELECTION.body_sha256&&binding.source_object_id===SELECTION.source_object_id&&binding.admission_sha256===SELECTION.admission_sha256,'Édition du reçu non conforme.');
 ensure(proposal?.passage_id===sent.passage_id&&proposal.base_revision===sent.base_revision&&proposal.replacement_text===sent.replacement_text&&proposal.reason===sent.reason&&sameList(proposal.evidence_refs,sent.evidence_refs)&&proposal.simulation===true&&proposal.actor_role==='anonymous','Le reçu ne correspond pas à cet envoi.');
 const proposalFields=['passage_id','base_revision','replacement_text','reason','evidence_refs','simulation','proposal_id','actor_role','created_at'];
 ensure(Object.keys(proposal).length===proposalFields.length&&proposalFields.every(key=>Object.hasOwn(proposal,key)),'Le reçu contient un état de proposition non prévu.');
 ensure(typeof proposal.proposal_id==='string'&&/^proposal_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(proposal.proposal_id),'Référence de proposition indisponible.');
 return Object.freeze({proposalId:proposal.proposal_id,reviewStatus:'pending',humanDecision:false});
}

// One in-memory request per page. An uncertain result locks edits and retains
// the exact helper-created body/key; retry never reads form values again.
export function createP09CorrectionSession({fetchImpl=globalThis.fetch,keyFactory=()=>globalThis.crypto.randomUUID()}={}){
 ensure(typeof fetchImpl==='function'&&typeof keyFactory==='function','Transport et clé nécessaires.');
 let binding=null,pending=null,receipt=null,phase='unloaded',loading=false;
 const snapshot=()=>Object.freeze({phase,binding,pending,receipt});
 const json=async response=>{ensure((response.headers.get('content-type')??'').startsWith('application/json'),'Réponse du service indisponible.');return response.json();};
 async function load(){
  ensure(!loading&&!pending&&phase!=='sending'&&phase!=='received','Un envoi en cours doit être conservé.');loading=true;phase='loading';
  try{const response=await fetchImpl(PASSAGE_URL,{method:'GET',headers:{Accept:'application/json'},credentials:'omit',redirect:'error',cache:'no-store'});ensure(response.status===200,'Le passage P09 est temporairement indisponible.');const body=await json(response);ensure(body.simulation===true,'État du service non conforme.');binding=await describeP09Passage(body);phase='ready';return binding;}catch(error){phase='load-failed';throw error;}finally{loading=false;}
 }
 async function transmit(){
  ensure(pending&&['prepared','uncertain'].includes(phase),'Aucun envoi à réessayer.');phase='sending';
  try{
   const response=await fetchImpl(pending.url,{method:pending.method,headers:pending.headers,body:pending.body,credentials:'omit',redirect:'error',cache:'no-store'});
   ensure([200,201].includes(response.status),response.status===409?'Le service a refusé la liaison à cette édition. Aucun reçu valide n’a été obtenu.':'Aucun reçu valide n’a été obtenu. Vous pouvez réessayer le même envoi.');
   const checked=describeP09Receipt(await json(response),pending);receipt=checked;phase='received';return checked;
  }catch(error){phase='uncertain';throw error;}
 }
 async function submit({replacementText,reason}){
  ensure(phase==='ready'&&binding&&!pending,'Réessayez l’envoi conservé avant toute autre proposition.');
  pending=createP09Submission(binding,{replacementText,reason,idempotencyKey:keyFactory()});phase='prepared';return transmit();
 }
 return Object.freeze({load,submit,retry:transmit,snapshot});
}
