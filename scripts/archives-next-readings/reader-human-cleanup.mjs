import {createHash} from 'node:crypto';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const READER_HUMAN_PARENTS=Object.freeze({
 'publication-package-20261004-v12-r2':{assembly:'47b9867149924b6f0b47a7929b6cbced4a3b1a06770c5c6298b32cac937fcb37',html:'3e25db65428e64c3e6845910bc36e9ed1c0a43a423dfa224510df6d0bb499150'},
 'publication-package-20261004-v13-r2':{assembly:'c1d48e7bde4001be90cfacf2cfd23e39cb008cff7ac7f2b2b301f85f1a363bec',html:'ef7dba25125d5bbbe9cc13fd839ea4f8b822010c2ce809219675328f188d3645'}
});
const ensure=(v,m)=>{if(!v)throw Error('Human reader: '+m);};
const decode=value=>value.replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,hex,dec)=>String.fromCodePoint(parseInt(hex||dec,hex?16:10))).replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const forbidden=/\bSHA(?:-256)?\b|[a-f0-9]{64}|(?:object|source|segment|occurrence|fragment|package|text|presentation):[a-z0-9_-]|\b(?:H07|MVP|MOCKUP|SNAPSHOT|Root|codepoints)\b/;
const text=html=>decode(html.replace(/<[^>]*>/g,''));
// Balanced static HTML ranges, used only after pinning one of the two immutable parents.
function nodes(html){
 const out=[],stack=[],voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
 for(const m of html.matchAll(/<(\/?)([a-z][a-z0-9:-]*)\b[^>]*>/gi)){
  const closing=m[1]==='/',tag=m[2].toLowerCase();
  if(closing){const i=stack.findLastIndex(n=>n.tag===tag);ensure(i>=0,'unbalanced closing '+tag);const n=stack[i];n.end=m.index+m[0].length;n.closeStart=m.index;ensure(i===stack.length-1,'implicit closing is outside this fixed adapter');stack.pop();}
  else {const n={tag,start:m.index,openEnd:m.index+m[0].length,parent:stack.at(-1)||null,open:m[0]};out.push(n);if(voids.has(tag)||m[0].endsWith('/>'))n.end=n.openEnd;else stack.push(n);}
 }
 ensure(stack.length===0&&out.every(n=>n.end!==undefined),'closed static HTML required');return out;
}
const within=(n,a)=>n.start>=a.start&&n.end<=a.end;
function protectedSlices(html,tree){
 const rawJsonDetails=tree.filter(n=>n.tag==='details'&&text(html.slice(n.start,n.end)).startsWith('Référence de l’incertitude'));
 return tree.filter(n=>n.tag==='pre'&&!rawJsonDetails.some(a=>within(n,a))||['q','blockquote'].includes(n.tag)||/\bclass="act-cote"/.test(n.open)).map(n=>html.slice(n.start,n.end));
}
export function composeReaderHumanUi({enabled=false,parentName,parentHtml,assemblyBytes}){
 const pins=READER_HUMAN_PARENTS[parentName];ensure(pins&&Buffer.isBuffer(assemblyBytes)&&digest(assemblyBytes)===pins.assembly&&typeof parentHtml==='string'&&digest(Buffer.from(parentHtml))===pins.html,'exact immutable parent');
 ensure(typeof enabled==='boolean','explicit enablement');if(!enabled)return {html:parentHtml,added:false,edits:[],metadata:{}};
 const tree=nodes(parentHtml),edits=[],counts={},metadata=[];
 const edit=(n,after,kind)=>{const before=parentHtml.slice(n.start,n.end);ensure(!edits.some(e=>n.start<e.end&&n.end>e.start),'disjoint changes');edits.push({start:n.start,end:n.end,before,after,kind});counts[kind]=(counts[kind]||0)+1;};
 for(const n of tree.filter(n=>n.tag==='details')){
  const summary=tree.find(c=>c.parent===n&&c.tag==='summary');if(!summary)continue;const label=text(parentHtml.slice(summary.openEnd,summary.closeStart));
  if(['Source et image affichée','Source de cette version','Référence du fragment'].includes(label)){
   const before=parentHtml.slice(n.start,n.end);ensure(forbidden.test(text(before)),'technical-only block signature');ensure(!/<(?:q|blockquote|a)\b/.test(before),'do not remove quotations or links');ensure(!/class="(?:revision-join-text|next-reading-text)"/.test(before),'do not remove transcription');metadata.push({kind:label,original_html:before});edit(n,'','technical-details');
  }else if(label==='Référence de l’incertitude'){
   const pre=tree.find(c=>c.parent===n&&c.tag==='pre');ensure(pre,'source alternatives JSON required');const alternatives=JSON.parse(decode(parentHtml.slice(pre.openEnd,pre.closeStart)));ensure(Array.isArray(alternatives)&&alternatives.every(a=>typeof a.reading==='string'&&typeof a.rationale==='string'),'existing alternatives preserved');
   const after=alternatives.length?'<details><summary>Autres lectures envisagées</summary><ul>'+alternatives.map(a=>'<li><strong>'+escape(a.reading)+'</strong> — '+escape(a.rationale)+'</li>').join('')+'</ul></details>':'';ensure(!forbidden.test(text(after)),'human alternatives text');metadata.push({kind:label,original_html:parentHtml.slice(n.start,n.end),alternatives});edit(n,after,'human-alternatives');
  }
 }
 const panelNotes=tree.filter(n=>n.tag==='p'&&n.open.includes('class="panel-source"'));ensure(panelNotes.length===9,'fixed panel metadata notes');
 for(const n of panelNotes){const before=parentHtml.slice(n.start,n.end),label=text(before);let after;
  if(label.startsWith('Texte '))after='<p class="panel-source">Lecture partielle · à revoir.</p>';
  else if(label==='Les décisions de cet essai ne valident pas le texte historique.')after='';
  else if(label==='Vues du dossier photo candidat · rattachement de travail, aucune association acceptée.')after='<p class="panel-source">Photographies du dossier · rattachement à vérifier.</p>';
  else if(label==='Traduction proposée · état brouillon IA non relu')after='<p class="panel-source">Français proposé · à vérifier.</p>';
  else throw Error('Unexpected panel source note');
  metadata.push({kind:'panel-source-note',original_html:before});edit(n,after,'human-panel-note');
 }
 for(const [before,after,kind]of [
  ['<p class="archives-kicker">Prévisualisation locale · données réelles</p>','<p class="archives-kicker">Archives · consultation</p>','human-kicker'],
  ['<a class="reader-button" href="/archives/catalogue/">Catalogue CLEAN</a>','<a class="reader-button" href="/archives/catalogue/">Dossiers et photographies</a>','human-catalogue-label'],
  ['<a class="reader-button" href="/archives/corrections/">Proposer une lecture · essai local privé</a>','<a class="reader-button" href="/archives/corrections/">Proposer une lecture</a>','human-correction-label'],
  ['<a href="/archives/formes-brouillons/">Lectures à revoir</a>','<a href="/archives/fichiers/">Lectures par fichier</a>','file-navigation'],
  ['<a href="/archives/formes/p09/">Quatre lectures à vérifier dans le brouillon auteur</a>','<a href="/archives/formes/p09/">Quatre lectures à vérifier dans le brouillon auteur</a> <a href="/archives/fichiers/p09/">Lire le brouillon auteur et ses extraits</a>','file-p09-link'],
  ['<span class="footer-text">Prévisualisation privée · paquet package:atelier-642f2dc17823c179b3f3d42d66085f75</span>','<span class="footer-text">Atelier des archives</span>','human-footer']
 ]){const start=parentHtml.indexOf(before);ensure(start>=0&&parentHtml.indexOf(before,start+1)<0,'unique '+kind);edit({start,end:start+before.length},after,kind);}
 const notice=tree.filter(n=>n.tag==='aside'&&n.open.includes('class="fixture-notice"'));ensure(notice.length===1,'single development notice');metadata.push({kind:'development-notice',original_html:parentHtml.slice(notice[0].start,notice[0].end)});edit(notice[0],'','development-notice');
 ensure(counts['technical-details']===453&&counts['human-alternatives']===21,'exact parent block counts');
 edits.sort((a,b)=>a.start-b.start);let cursor=0,html='',delta=0;
 for(const e of edits){e.newStart=e.start+delta;html+=parentHtml.slice(cursor,e.start)+e.after;cursor=e.end;delta+=e.after.length-e.before.length;}html+=parentHtml.slice(cursor);
 const newTree=nodes(html);ensure(JSON.stringify(protectedSlices(parentHtml,tree))===JSON.stringify(protectedSlices(html,newTree)),'all transcriptions, quotes and archive references unchanged');
 const visible=text(html),technical=forbidden.exec(visible);ensure(!technical,'technical human text near '+(technical?visible.slice(Math.max(0,technical.index-50),technical.index+130):''));ensure(html.includes('<a href="/archives/corrections/p09/">Proposer une correction de cette édition P09</a>')===parentHtml.includes('<a href="/archives/corrections/p09/">Proposer une correction de cette édition P09</a>'),'retain correction link');
 const result={html,added:true,parentName,parentSha256:pins.html,counts,edits,metadata,protectedCount:protectedSlices(html,newTree).length,humanVisibleTechnical:false,sourceDataDeleted:false};ensure(restoreReaderHumanUi(result)===parentHtml,'exact reversibility');return result;
}
export function restoreReaderHumanUi({html,edits}){let restored=html;for(const e of [...edits].reverse()){ensure(restored.slice(e.newStart,e.newStart+e.after.length)===e.after,'restoration signature');restored=restored.slice(0,e.newStart)+e.before+restored.slice(e.newStart+e.after.length);}return restored;}
