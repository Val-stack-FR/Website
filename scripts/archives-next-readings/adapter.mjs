import {createHash} from 'node:crypto';
import {TextDecoder} from 'node:util';

// Portable projection only: the coordinator admits real inputs separately.
// Neither files, image bytes, HTTP services nor historical identities are read.
export const NEXT_READING_ASSETS=[
 {route:'/assets/archives-next-reading.css',file:'scripts/archives-next-readings/card.css',contentType:'text/css; charset=utf-8'},
 {route:'/assets/archives-next-reading.js',file:'scripts/archives-next-readings/card.js',contentType:'text/javascript; charset=utf-8'},
];
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const requireValue=(value,message)=>{if(!value)throw Error('Next reading: '+message);};
const hash=/^[a-f0-9]{64}$/u,id=/^[a-z][a-z0-9-]*:[A-Za-z0-9_.:-]+$/u;
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const exact=value=>escape(value).replaceAll('\r','&#13;').replaceAll('\n','&#10;');
const bounded=value=>typeof value==='string'&&value.trim().length>0&&value.length<=1500;
function slice(container,span){
 const points=[...container];requireValue(span?.coordinate_system==='unicode-codepoints'&&Number.isSafeInteger(span.start)&&Number.isSafeInteger(span.end)&&span.start>=0&&span.end>span.start&&span.end<=points.length,'invalid text offsets');
 return points.slice(span.start,span.end).join('');
}
function locate(bytes,source,locator){
 const decoded=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
 if(source.format==='utf8-text'){requireValue(locator.json_pointer===null,'text source cannot have JSON pointer');return decoded;}
 requireValue(source.format==='json'&&typeof locator.json_pointer==='string'&&/^(?:\/(?:[^~]|~[01])*)+$/u.test(locator.json_pointer),'invalid JSON source locator');
 let value=JSON.parse(decoded);for(const part of locator.json_pointer.slice(1).split('/')){const key=part.replaceAll('~1','/').replaceAll('~0','~');requireValue(value!==null&&typeof value==='object'&&Object.hasOwn(value,key),'missing JSON source field');value=value[key];}
 requireValue(typeof value==='string','JSON source field is not text');return value;
}
const gaps=text=>text.match(/\[lacune\]|\[\.\.\.\]|\[…\]|----/gu)??[];
const lines=text=>{const values=text.split(/\r\n|\r|\n/u);if(values.at(-1)==='')values.pop();return values;};
export function validateNextReading({reading,sourceBuffers,qualifiedImages}){
 requireValue(reading?.version==='archive-next-reading/1'&&['synthetic-preparation','private-candidate'].includes(reading.scope),'explicit reading scope required');
 requireValue(id.test(reading.candidate_id??'')&&id.test(reading.fragment_id??'')&&/^[a-z][a-z0-9-]{1,90}$/u.test(reading.slug??''),'invalid candidate/fragment identity');
 requireValue(reading.document_identified===false&&reading.canonical_act_id===null&&reading.date===null&&Array.isArray(reading.person_ids)&&reading.person_ids.length===0&&reading.historical_confirmation===false&&reading.publication_approved===false&&reading.human_review==='pending'&&reading.rights==='unknown','identity or publication promotion');
 requireValue(Array.isArray(reading.limitations)&&reading.limitations.length>0&&reading.limitations.length<=12&&reading.limitations.every(bounded),'explicit limitations required');
 requireValue(Array.isArray(reading.sources)&&reading.sources.length>=1&&reading.sources.length<=2&&new Set(reading.sources.map(value=>value.id)).size===reading.sources.length&&reading.sources.every(value=>id.test(value.id)&&hash.test(value.sha256)&&['utf8-text','json'].includes(value.format)),'one or two exact text sources required');
 requireValue(sourceBuffers instanceof Map&&sourceBuffers.size===reading.sources.length&&reading.sources.every(value=>sourceBuffers.has(value.id)),'text source absent or unexpected');
 requireValue(Array.isArray(reading.versions)&&reading.versions.length===2&&reading.versions[0].kind==='diplomatic'&&reading.versions[1].kind==='modern-french'&&new Set(reading.versions.map(value=>value.id)).size===2,'diplomatic and modern versions required');
 const uncertainties=new Set(),usedSources=new Set();
 for(const version of reading.versions){
  requireValue(id.test(version.id??'')&&typeof version.text_exact==='string'&&version.text_exact.length>0&&version.text_exact.length<=20000&&hash.test(version.text_sha256_utf8??'')&&digest(Buffer.from(version.text_exact,'utf8'))===version.text_sha256_utf8&&Buffer.byteLength(version.text_exact,'utf8')===version.utf8_byte_length,'version text/hash drift');
  requireValue(lines(version.text_exact).length===6,'P09 pilot requires exactly six lines per version');
  const source=reading.sources.find(value=>value.id===version.source_locator?.source_id);requireValue(source,'version source mismatch');usedSources.add(source.id);const bytes=sourceBuffers.get(source.id);requireValue(Buffer.isBuffer(bytes)&&bytes.length<=1048576&&digest(bytes)===source.sha256,'source hash/type drift');
  requireValue(slice(locate(bytes,source,version.source_locator),version.source_locator.span)===version.text_exact,'source offsets/text mismatch');
  requireValue(Array.isArray(version.uncertainties)&&version.uncertainties.length<=40,'uncertainty list required');
  for(const value of version.uncertainties){requireValue(id.test(value.id??'')&&!uncertainties.has(value.id)&&value.status==='unresolved'&&bounded(value.note)&&typeof value.span?.exact_text==='string'&&slice(version.text_exact,value.span)===value.span.exact_text&&Array.isArray(value.alternatives)&&value.alternatives.length<=5&&value.alternatives.every(bounded),'uncertainty span/state drift');uncertainties.add(value.id);}
 }
 requireValue(usedSources.size===reading.sources.length,'unused text source');
 requireValue(JSON.stringify(lines(reading.versions[0].text_exact).map(value=>gaps(value).sort()))===JSON.stringify(lines(reading.versions[1].text_exact).map(value=>gaps(value).sort())),'modern version lost or moved a lacuna marker');
 requireValue(Array.isArray(qualifiedImages)&&qualifiedImages.length===1,'one qualified photo binding required');
 const image=qualifiedImages[0],photo=reading.photo;
 requireValue(image.qualification===(reading.scope==='synthetic-preparation'?'synthetic-reference':'accepted-private-view')&&id.test(image.source_object_id??'')&&id.test(image.view_id??'')&&hash.test(image.source_sha256??'')&&hash.test(image.derivative_sha256??'')&&image.canonical_view_id===null,'qualified photo identity required');
 requireValue(Number.isSafeInteger(image.width)&&Number.isSafeInteger(image.height)&&image.width>0&&image.height>0&&image.width<=20000&&image.height<=20000&&bounded(image.limits),'qualified view dimensions/limits required');
 requireValue(typeof image.route==='string'&&/^\/(?:__archive_draft_derivative\/[a-f0-9]{64}|archives\/(?:next-readings\/media|media-releases\/[a-f0-9]{32}\/media)\/[a-f0-9]{64}\.jpg)$/u.test(image.route)&&image.route.includes(image.derivative_sha256),'qualified photo route mismatch');
 for(const key of ['source_object_id','view_id','source_sha256','derivative_sha256','route','width','height','canonical_view_id'])requireValue(photo?.[key]===image[key],'photo binding mismatch: '+key);
 requireValue(photo.text_fragment_id===reading.fragment_id&&photo.transformation_applied===false,'photo/text fragment or transformation mismatch');
 return structuredClone(reading);
}
function panel(reading,version,label){const key=reading.slug+'-'+version.kind;return `<section id="${key}" data-next-panel="${version.kind}" role="tabpanel" aria-labelledby="${reading.slug}-tab-${version.kind}"${version.kind==='modern-french'?' hidden':''}><h3>${label}</h3><p class="next-reading-note">${version.kind==='diplomatic'?'Lecture diplomatique de travail, à vérifier.':'Français modernisé de travail ; lacunes conservées, à vérifier.'}</p><pre class="next-reading-text" data-next-version-id="${escape(version.id)}" data-text-sha256="${version.text_sha256_utf8}">${exact(version.text_exact)}</pre>${version.uncertainties.length?`<aside class="next-reading-uncertainties"><strong>Lectures incertaines</strong><ul>${version.uncertainties.map(value=>`<li>${escape(value.span.exact_text)} — ${escape(value.note)}${value.alternatives.length?' · '+value.alternatives.map(escape).join(' / '):''} · non résolu.</li>`).join('')}</ul></aside>`:''}<details><summary>Source du texte</summary><p>${escape(version.id)}</p><p>Source ${escape(version.source_locator.source_id)} · SHA-256 ${reading.sources.find(value=>value.id===version.source_locator.source_id).sha256}</p><p>Empreinte du texte exact : ${version.text_sha256_utf8}</p><p>Caractères Unicode [${version.source_locator.span.start}, ${version.source_locator.span.end}) dans le conteneur source.</p></details></section>`;}
function renderCard(reading,limits){const labels=[['diplomatic','Texte de travail'],['modern-french','Français modernisé'],['photo','Photo']],photo=reading.photo;
 return `<article class="archive-act next-reading-card" id="${reading.slug}" tabindex="-1" aria-labelledby="${reading.slug}-title" data-next-reading><header class="act-header"><div class="act-title-block"><p class="act-fonds">${reading.scope==='synthetic-preparation'?'Exemple inventé · préparation du raccord':'Nouvelle lecture de travail · document non identifié'}</p><h2 id="${reading.slug}-title">Document non identifié — lecture partielle</h2><p>Identité et date non établies.</p></div><div class="act-statuses" aria-label="États de la lecture"><span class="status-badge">Identification · candidat</span><span class="status-badge status-draft">Lecture · à vérifier</span><span class="status-badge status-draft">Diffusion · inactive</span></div></header><div class="next-reading-content"><div class="next-reading-tabs" role="tablist" aria-label="Lecture et photographie">${labels.map(([kind,label],n)=>`<button type="button" role="tab" id="${reading.slug}-tab-${kind}" data-next-tab="${kind}" aria-controls="${reading.slug}-${kind}" aria-selected="${n===0}" tabindex="${n===0?0:-1}">${label}</button>`).join('')}</div>${panel(reading,reading.versions[0],'Lecture diplomatique de travail')}${panel(reading,reading.versions[1],'Français modernisé')}<section id="${reading.slug}-photo" data-next-panel="photo" role="tabpanel" aria-labelledby="${reading.slug}-tab-photo" hidden><h3>Photographie qualifiée pour cette lecture</h3><p class="next-reading-note">${escape(limits)}</p><figure><a href="${photo.route}" data-zoom-image="${photo.route}" data-zoom-caption="Vue de travail qualifiée · document non identifié · droits inconnus"><img src="${photo.route}" width="${photo.width}" height="${photo.height}" loading="lazy" alt="Photographie de travail du document non identifié" data-next-source-object-id="${escape(photo.source_object_id)}" data-next-view-id="${escape(photo.view_id)}" /></a><figcaption>La lecture porte sur un extrait. L’image ne confirme ni une identité de document ni une date.</figcaption></figure><details><summary>Référence de la photographie</summary><p>Objet ${escape(photo.source_object_id)}</p><p>Vue ${escape(photo.view_id)}</p><p>SHA-256 source : ${photo.source_sha256}</p><p>SHA-256 image affichée : ${photo.derivative_sha256}</p><p>Aucune transformation n’est appliquée par ce raccord.</p></details></section><details class="next-reading-limits"><summary>Incertitudes et limites de cette lecture</summary><ul>${reading.limitations.map(value=>`<li>${escape(value)}</li>`).join('')}</ul><p>Texte et français modernisé restent des propositions de travail. Aucun nom, date ou acte n’est identifié à partir d’un nom de fichier.</p><p>${escape(reading.fragment_id)} · ${escape(reading.candidate_id)}</p></details></div></article>`;
}
function htmlTags(html){
 const tags=[];let at=0;
 while((at=html.indexOf('<',at))>=0){
  if(html.startsWith('<!--',at)){const end=html.indexOf('-->',at+4);requireValue(end>=0,'unclosed parent comment');at=end+3;continue;}
  let quote=null,end=at+1;for(;end<html.length;end++){const value=html[end];if(quote){if(value===quote)quote=null;}else if(value==='"'||value==="'")quote=value;else if(value==='>')break;}
  requireValue(end<html.length,'unclosed parent tag');const raw=html.slice(at,end+1),match=/^<(\/)?([A-Za-z][A-Za-z0-9:-]*)\b/u.exec(raw);
  if(match){const tag=match[2].toLowerCase(),closing=Boolean(match[1]);tags.push({start:at,end:end+1,tag,closing,raw});
   if(!closing&&['script','style','textarea','title'].includes(tag)){const close=new RegExp('</'+tag+'\\s*>','igu');close.lastIndex=end+1;const found=close.exec(html);requireValue(found,'unclosed parent raw-text element');tags.push({start:found.index,end:close.lastIndex,tag,closing:true,raw:found[0]});at=close.lastIndex;continue;}
  }
  at=end+1;
 }
 return tags;
}
function railEnd(tags,opening){let depth=0;for(const token of tags.filter(value=>value.start>=opening.start&&value.tag==='div')){depth+=token.closing?-1:1;if(depth===0)return token.start;}throw Error('Next reading: unclosed parent rail');}
export function composeNextReading({enabled=false,parentHtml,parentSha256,...inputs}){
 requireValue(typeof enabled==='boolean'&&typeof parentHtml==='string'&&hash.test(parentSha256??'')&&digest(Buffer.from(parentHtml,'utf8'))===parentSha256,'parent HTML/pin drift');
 if(!enabled)return {html:parentHtml,additionalAssets:[],candidateAdded:false};
 const reading=validateNextReading(inputs),tags=htmlTags(parentHtml),rails=tags.filter(value=>value.raw==='<div class="acts-track">'),heads=tags.filter(value=>value.tag==='head'&&value.closing),bodies=tags.filter(value=>value.tag==='body'&&value.closing);
 requireValue(rails.length===1&&!parentHtml.includes('data-next-reading')&&!parentHtml.includes('id="'+reading.slug+'"'),'parent rail or candidate collision');
 requireValue(heads.length===1&&bodies.length===1,'parent document boundary drift');const end=railEnd(tags,rails[0]),head=heads[0].start,body=bodies[0].start;requireValue(head<rails[0].start&&body>end,'parent document boundary drift');
 const rendered=renderCard(reading,inputs.qualifiedImages[0].limits),syntheticPanel=`<section id="${reading.slug}-photo" data-next-panel="photo" role="tabpanel" aria-labelledby="${reading.slug}-tab-photo" hidden><h3>Référence photographique synthétique</h3><p>Aucune image fournie ou affichée ; aucun pixel ni lien image actif.</p><p>${escape(inputs.qualifiedImages[0].limits)}</p><details><summary>Descripteur inventé de la vue</summary><p>Objet ${escape(reading.photo.source_object_id)} · vue ${escape(reading.photo.view_id)}</p><p>Empreinte du descripteur source synthétique : ${reading.photo.source_sha256}</p><p>Empreinte du descripteur de vue synthétique : ${reading.photo.derivative_sha256}</p></details></section>`,card=reading.scope==='synthetic-preparation'?rendered.replace(new RegExp('<section id="'+reading.slug+'-photo"[^>]*>[\\s\\S]*?<\\/section>','u'),syntheticPanel):rendered;
 let html=parentHtml;for(const [at,value]of [[end,card],[head,'<link rel="stylesheet" href="/assets/archives-next-reading.css" />\n'],[body,'<script src="/assets/archives-next-reading.js" defer></script>\n']].sort((a,b)=>b[0]-a[0]))html=html.slice(0,at)+value+html.slice(at);
 return {html,additionalAssets:structuredClone(NEXT_READING_ASSETS),candidateAdded:true,slug:reading.slug,scope:reading.scope,textHashes:reading.versions.map(value=>value.text_sha256_utf8),lineCounts:reading.versions.map(value=>lines(value.text_exact).length),photoBinding:structuredClone(reading.photo),parentSha256};
}
