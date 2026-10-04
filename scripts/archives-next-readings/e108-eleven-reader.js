(() => {
 'use strict';
 const select=document.getElementById('reading-edition');if(!select)return;
 const labels={A:'Lecture A · auteur',B:'Lecture B · indépendante'};
 select.addEventListener('change',()=>{
  const key=select.value,template=document.getElementById('edition-'+key);if(!labels[key]||!template)return;
  const original=template.content.querySelector('[data-original]'),modern=template.content.querySelector('[data-modern]');
  if(!original||!modern)return;
  document.getElementById('original-lines').replaceChildren(...original.cloneNode(true).childNodes);
  document.getElementById('modern-lines').replaceChildren(...modern.cloneNode(true).childNodes);
  document.querySelectorAll('.edition-badge').forEach(n=>{n.textContent=labels[key];});
  document.getElementById('edition-announcement').textContent=labels[key]+' affichée dans les deux textes.';
 });
 const rail=document.getElementById('reading-panels');
 document.querySelectorAll('[data-panel]').forEach(button=>button.addEventListener('click',()=>{
  const panel=document.getElementById(button.dataset.panel);if(!panel||panel.parentElement!==rail)return;
  rail.scrollTo({left:panel.offsetLeft-rail.firstElementChild.offsetLeft,behavior:'instant'});panel.focus({preventScroll:true});
 }));
 const opener=document.getElementById('open-crop'),dialog=document.getElementById('crop-dialog'),image=document.getElementById('crop-image');
 const fit=document.getElementById('crop-fit'),native=document.getElementById('crop-native');
 const scale=mode=>{dialog.dataset.scale=mode;fit.setAttribute('aria-pressed',String(mode==='fit'));native.setAttribute('aria-pressed',String(mode==='native'));document.getElementById('crop-scale').textContent=mode==='fit'?'Extrait ajusté à la fenêtre':'Taille réelle · faire défiler l’extrait';const stage=dialog.querySelector('.crop-stage');stage.scrollTop=0;stage.scrollLeft=0;};
 opener.addEventListener('click',()=>{image.src=opener.querySelector('img').getAttribute('src');scale('fit');dialog.showModal();});
 fit.addEventListener('click',()=>scale('fit'));native.addEventListener('click',()=>scale('native'));
 document.getElementById('close-crop').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{image.removeAttribute('src');opener.focus({preventScroll:true});});
})();
