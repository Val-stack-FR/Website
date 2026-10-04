(() => {
 'use strict';
 // Private preview instrumentation only. Excluded from all deployable routes.
 const key='e108-touch-shortcut-private-probe-v1';
 const marker=document.createElement('output');marker.id='touch-shortcut-private-probe';marker.hidden=true;
 const read=()=>{try{return JSON.parse(sessionStorage.getItem(key)||'[]');}catch{return [];}};
 marker.dataset.events=JSON.stringify(read());document.body.append(marker);
 const link=document.querySelector('.catalogue-ensemble-entry a');if(!link)return;
 for(const type of ['pointerdown','pointerup','click','keydown'])link.addEventListener(type,event=>{
  const box=link.getBoundingClientRect(),record={type:event.type,isTrusted:event.isTrusted,pointerType:event.pointerType||null,key:event.key||null,
   clientX:event.clientX??null,clientY:event.clientY??null,targetTag:event.target.tagName,currentTargetTag:event.currentTarget.tagName,
   href:link.getAttribute('href'),queryBefore:new URLSearchParams(location.search).get('query'),width:innerWidth,height:innerHeight,
   box:{x:box.x,y:box.y,width:box.width,height:box.height}};
  const events=[...read(),record];sessionStorage.setItem(key,JSON.stringify(events));marker.dataset.events=JSON.stringify(events);
 },{capture:true});
})();
