(() => {
 'use strict';
 const picker=document.getElementById('revision-fragment'),message=document.getElementById('revision-selection'),fragments=[...document.querySelectorAll('[data-revision-fragment]')],tabs=[...document.querySelectorAll('[data-revision-tab]')];
 if(!picker||!message||fragments.length!==3||tabs.length!==4)return;
 let current='first-draft';
 const show=()=>{
  const n=Number(picker.value);if(!Number.isInteger(n)||n<0||n>=fragments.length)return;
  fragments.forEach((fragment,index)=>{fragment.hidden=index!==n;fragment.querySelectorAll('[data-edition]').forEach(panel=>{panel.hidden=panel.dataset.edition!==current;});});
  tabs.forEach(tab=>{const selected=tab.dataset.revisionTab===current;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;tab.setAttribute('aria-controls',`edition-${n}-${tab.dataset.revisionTab}`);});
  message.textContent=picker.selectedOptions[0].textContent+' · '+tabs.find(tab=>tab.dataset.revisionTab===current).textContent;
 };
 for(const tab of tabs){tab.addEventListener('click',()=>{current=tab.dataset.revisionTab;show();});tab.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const n=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(n+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;current=tabs[next].dataset.revisionTab;show();tabs[next].focus();
 });}
 picker.addEventListener('change',show);show();
})();
