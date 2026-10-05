(() => {
 'use strict';
 const results=document.getElementById('catalogue-results'),dialog=document.getElementById('e108-photo-dialog');
 if(!results||!dialog)return;
 const image=dialog.querySelector('#e108-photo-full'),title=dialog.querySelector('#e108-photo-title'),stage=dialog.querySelector('.e108-photo-stage'),fit=dialog.querySelector('[data-e108-fit]'),native=dialog.querySelector('[data-e108-native]'),scale=dialog.querySelector('#e108-photo-scale');
 let trigger=null;
 const adjust=mode=>{dialog.dataset.scale=mode;fit.setAttribute('aria-pressed',String(mode==='fit'));native.setAttribute('aria-pressed',String(mode==='native'));scale.textContent=mode==='fit'?'Photo ajustée à la fenêtre':'Taille réelle · 2 976 × 3 968 pixels · faire défiler pour explorer';stage.scrollTo(0,0);};
 results.addEventListener('click',event=>{
  const button=event.target.closest('button[data-e108-photo]');
  if(!button||!results.contains(button)||!button.closest('#ensemble-e108-11-14')||!['11','12'].includes(button.dataset.e108Photo))return;
  const preview=button.querySelector('img');if(!preview||!preview.getAttribute('src')?.startsWith('/archives/media/draft/'))return;
  trigger=button;image.src=preview.getAttribute('src');image.alt='Photo '+button.dataset.e108Photo+'.jpg du dossier E.108';title.textContent='E.108 · '+button.dataset.e108Photo+'.jpg';adjust('fit');dialog.showModal();
 });
 dialog.querySelector('[data-e108-close]').addEventListener('click',()=>dialog.close());
 fit.addEventListener('click',()=>adjust('fit'));native.addEventListener('click',()=>adjust('native'));
 dialog.addEventListener('close',()=>{image.removeAttribute('src');image.alt='';if(trigger?.isConnected)trigger.focus({preventScroll:true});else document.getElementById('ensemble-e108-11-14')?.focus({preventScroll:true});trigger=null;});
})();
