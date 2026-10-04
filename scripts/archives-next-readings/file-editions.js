(() => {
 'use strict';
 const reader=document.querySelector('[data-file-reader]');if(!reader)return;
 const tabs=[...reader.querySelectorAll('[data-file-tab]')],panels=[...reader.querySelectorAll('[data-file-panel]')];if(tabs.length!==3||panels.length!==3)return;
 const show=edition=>{tabs.forEach(tab=>{const active=tab.dataset.fileTab===edition;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});panels.forEach(panel=>{panel.hidden=panel.dataset.filePanel!==edition;});};
 for(const tab of tabs){tab.addEventListener('click',()=>show(tab.dataset.fileTab));tab.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const i=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?2:(i+(event.key==='ArrowRight'?1:-1)+3)%3;show(tabs[next].dataset.fileTab);tabs[next].focus();
 });}
 for(const link of reader.querySelectorAll('[data-review-target]'))link.addEventListener('click',()=>show('rereading'));
 for(const link of reader.querySelectorAll('[data-point-target]'))link.addEventListener('click',()=>{for(const id of link.dataset.relatedPoints.split(' ')){const details=document.getElementById(id)?.closest('details');if(details)details.open=true;}});
})();
