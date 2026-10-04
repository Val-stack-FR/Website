'use strict';
const dialog=document.getElementById('release-zoom');
const image=document.getElementById('zoom-image');
const title=document.getElementById('zoom-title');
const scroll=document.getElementById('zoom-scroll');
const size=document.getElementById('zoom-size');
const close=document.getElementById('zoom-close');
let opener=null;
for(const link of document.querySelectorAll('a[data-release-zoom]')) {
  link.addEventListener('click',event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0||typeof dialog.showModal!=='function')return;
    event.preventDefault();opener=link;
    image.src=link.getAttribute('data-release-zoom');image.alt=link.getAttribute('data-release-label');title.textContent=image.alt;
    scroll.classList.remove('is-native');size.setAttribute('aria-pressed','false');size.textContent='Taille réelle';
    document.body.classList.add('zoom-open');dialog.showModal();close.focus();
  });
}
size.addEventListener('click',()=>{
  const native=scroll.classList.toggle('is-native');size.setAttribute('aria-pressed',String(native));size.textContent=native ? 'Adapter à la fenêtre' : 'Taille réelle';
});
close.addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{document.body.classList.remove('zoom-open');opener?.focus();});
