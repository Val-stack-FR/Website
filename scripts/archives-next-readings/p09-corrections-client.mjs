import {createP09CorrectionSession,editorProposalText} from './session.mjs';

export function displayP09Passage(elements,binding){
 elements.label.textContent=binding.label;
 elements.source.textContent=binding.text;
 elements.source.dataset.textRevision=binding.textRevision;
 elements.source.setAttribute('aria-busy','false');
 elements.french.textContent=binding.proposedFrench;
 elements.replacement.value=binding.text;
 elements.reason.value='';
 return elements.replacement.value;
}

export function mountP09Corrections(document,{session=createP09CorrectionSession()}={}){
 const get=id=>document.getElementById(id);
 const elements={label:get('p09-correction-label'),source:get('p09-correction-source'),french:get('p09-correction-french'),replacement:get('p09-correction-replacement'),reason:get('p09-correction-reason')};
 const form=get('correction-form'),submit=get('p09-correction-submit'),status=get('correction-status'),reload=get('p09-correction-reload'),retry=get('p09-correction-retry');
 if(!form||Object.values(elements).some(element=>!element)||![submit,status,reload,retry].every(Boolean))return;
 let initialValue;
 const lock=locked=>{elements.replacement.disabled=locked;elements.reason.disabled=locked;submit.disabled=locked;};
 const sync=()=>{const phase=session.snapshot().phase;lock(phase!=='ready');reload.hidden=phase!=='load-failed';reload.disabled=phase==='loading';retry.hidden=phase!=='uncertain';retry.disabled=phase==='sending';form.setAttribute('aria-busy',phase==='sending'?'true':'false');};
 const received=receipt=>{status.textContent='Proposition enregistrée, en attente de revue humaine. Le texte source reste intact. Référence : '+receipt.proposalId;status.dataset.proposalId=receipt.proposalId;};
 const failedSend=error=>{delete status.dataset.proposalId;status.textContent=error.message+' Le contenu et la clé de cet envoi sont conservés sur cette page. Gardez-la ouverte pour réessayer à l’identique.';};
 async function load(){
  status.textContent='Chargement de l’édition de travail P09…';const loading=session.load();sync();
  try{const binding=await loading;initialValue=displayP09Passage(elements,binding);status.textContent='Les 21 lignes de l’édition de travail sont prêtes. Seul le texte diplomatique peut faire l’objet de votre proposition.';}catch{elements.source.setAttribute('aria-busy','false');elements.source.textContent='Passage P09 indisponible pour le moment.';elements.french.textContent='Français proposé indisponible pour le moment.';status.textContent='Le passage P09 n’a pas pu être vérifié. Aucun envoi n’est possible. Vous pouvez réessayer son chargement.';}finally{sync();}
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(session.snapshot().phase!=='ready'||!form.reportValidity())return;
  const binding=session.snapshot().binding,replacementText=editorProposalText(binding,initialValue,elements.replacement.value),reason=elements.reason.value;
  if(!replacementText.trim()||!reason.trim()){status.textContent='Renseignez votre lecture et un motif avant l’envoi.';return;}
  delete status.dataset.proposalId;status.textContent='Envoi de votre proposition…';
  try{const sending=session.submit({replacementText,reason});sync();received(await sending);}catch(error){if(session.snapshot().pending)failedSend(error);else status.textContent='La lecture et le motif doivent respecter les limites indiquées.';}finally{sync();}
 });
 retry.addEventListener('click',async()=>{
  if(session.snapshot().phase!=='uncertain')return;status.textContent='Nouvelle tentative du même envoi…';
  try{const sending=session.retry();sync();received(await sending);}catch(error){failedSend(error);}finally{sync();}
 });
 reload.addEventListener('click',()=>{if(session.snapshot().phase==='load-failed')void load();});
 lock(true);void load();
 return Object.freeze({session});
}
if(typeof document!=='undefined')mountP09Corrections(document);
