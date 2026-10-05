(() => {
 'use strict';
 for(const card of document.querySelectorAll('[data-next-reading="p09-full-view-proposed"]')){
  const tabs=[...card.querySelectorAll('[data-next-tab]')],panels=[...card.querySelectorAll('[data-next-panel]')];
  if(tabs.length!==3||panels.length!==3)continue;
  const show=tab=>{tabs.forEach(value=>{const selected=value===tab;value.setAttribute('aria-selected',String(selected));value.tabIndex=selected?0:-1;});panels.forEach(value=>{value.hidden=value.dataset.nextPanel!==tab.dataset.nextTab;});};
  for(const tab of tabs){tab.addEventListener('click',()=>show(tab));tab.addEventListener('keydown',event=>{
   if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();const n=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?2:(n+(event.key==='ArrowRight'?1:-1)+3)%3;show(tabs[next]);tabs[next].focus();
  });}
 }
})();
