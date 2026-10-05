(() => {
 'use strict';
 const results=document.getElementById('catalogue-results'),template=document.getElementById('e108-ensemble-template');
 if(!results||!template)return;
 const members=[...template.content.querySelectorAll('[data-ensemble-object-id]')].map(node=>({id:node.dataset.ensembleObjectId,path:node.dataset.ensembleLogicalPath}));
 if(members.length!==4||new Set(members.map(m=>m.id)).size!==4)return;
 let lastFocusedGroup=null;
 const facts=article=>{const values=new Map();for(const div of article.querySelectorAll('.catalogue-facts > div')){const key=div.querySelector('dt')?.textContent,value=div.querySelector('dd')?.textContent;if(key&&value)values.set(key,value);}return values;};
 const project=()=>{
  if(results.getAttribute('aria-busy')==='true'||results.querySelector('[data-ensemble-card]'))return;
  if(new URLSearchParams(location.search).get('folder')!==template.dataset.ensembleFolder)return;
  const cards=[...results.children].filter(node=>node.matches('.catalogue-card'));
  const chosen=[];
  for(const member of members){const matches=cards.filter(card=>{const values=facts(card);return values.get('Objet numérique')===member.id&&values.get('Chemin dans le classement')===member.path;});if(matches.length!==1)return;chosen.push(matches[0]);}
  const group=template.content.firstElementChild.cloneNode(true),first=cards.find(card=>chosen.includes(card));first.before(group);for(const card of chosen)card.remove();
  if(location.hash==='#'+group.id&&lastFocusedGroup!==group){lastFocusedGroup=group;group.scrollIntoView({block:'start',behavior:'instant'});const search=document.getElementById('catalogue-search');if(search&&getComputedStyle(search).position==='sticky')window.scrollBy({top:-Math.ceil(search.getBoundingClientRect().height+12),behavior:'instant'});group.focus({preventScroll:true});}
 };
 new MutationObserver(project).observe(results,{childList:true,attributes:true,attributeFilter:['aria-busy']});
 project();
})();
