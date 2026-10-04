(() => {
 'use strict';
 for(const reader of document.querySelectorAll('[data-revision-join]')){
  const picker=reader.querySelector('[data-revision-picker]'),message=reader.querySelector('[data-revision-selection]'),passages=[...reader.querySelectorAll('[data-revision-passage]')],tabs=[...reader.querySelectorAll('[data-revision-choice]')],photos=reader.querySelector('[data-revision-photos]');
  if(!picker||!message||!photos||passages.length<1||passages.length>97||tabs.length!==4)continue;
  let current='first-draft';
  const show=()=>{
   const n=Number(picker.value);if(!Number.isInteger(n)||n<0||n>=passages.length)return;
   passages.forEach((passage,index)=>{passage.hidden=index!==n||current==='photos';passage.querySelectorAll('[data-revision-edition]').forEach(panel=>{panel.hidden=panel.dataset.revisionEdition!==current;});});
   photos.hidden=current!=='photos';
   const objects=new Set(passages[n].dataset.revisionPhotoObjects.split(' '));
   photos.querySelectorAll('img[data-draft-object-id]').forEach(photo=>{const figure=photo.closest('figure');if(figure)figure.hidden=!objects.has(photo.dataset.draftObjectId);});
   tabs.forEach(tab=>{const selected=tab.dataset.revisionChoice===current;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;tab.setAttribute('aria-controls',tab.dataset.revisionChoice==='photos'?photos.id:`${reader.dataset.revisionJoin}-revision-${n}-${tab.dataset.revisionChoice}`);});
   message.textContent=picker.selectedOptions[0].textContent+' · '+tabs.find(tab=>tab.dataset.revisionChoice===current).textContent;
  };
  for(const tab of tabs){tab.addEventListener('click',()=>{current=tab.dataset.revisionChoice;show();});tab.addEventListener('keydown',event=>{
   if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();const n=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(n+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;current=tabs[next].dataset.revisionChoice;show();tabs[next].focus();
  });}
  picker.addEventListener('change',show);show();
 }
})();
