import {createHash} from 'node:crypto';
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
const check=(value,message)=>{if(!value)throw Error('Revision fixture: '+message);};
const id=/^[a-z][a-z0-9:._-]{2,159}$/u,sha=/^[a-f0-9]{64}$/u;
export const EDITIONS=['first-draft','rereading','modern-french'];
export const VIEW_LABELS={'first-draft':'Original',rereading:'Relecture','modern-french':'Français moderne',photos:'Photos'};
const status=value=>check(value?.reading==='machine-draft'&&value.human_review==='pending'&&value.rights==='unknown'&&value.publication==='private','state must remain machine-draft/pending/unknown/private');
function index(items,label){check(Array.isArray(items),'missing '+label);const map=new Map();for(const item of items){check(id.test(item.id)&&!map.has(item.id),'duplicate/invalid '+label+' id');map.set(item.id,item);}return map;}
function span(value,text){check(value?.units==='unicode-codepoints-half-open'&&Number.isSafeInteger(value.start)&&Number.isSafeInteger(value.end)&&value.start>=0&&value.end>=value.start&&value.end<=Array.from(text).length&&Array.from(text).slice(value.start,value.end).join('')===value.exact_text,'version-specific Unicode span drift');}
export function prepareRevisionFixture(input){
 check(input?.format==='reader-transcription-versions/0.1.0'&&input.scope==='fixture'&&input.read_only===true,'only the invented read-only fixture is accepted');
 check(JSON.stringify(input.display_order)===JSON.stringify(EDITIONS),'edition order drift');status(input.status);
 check(Array.isArray(input.canonical_decisions)&&input.canonical_decisions.length===0&&Array.isArray(input.human_memory)&&input.human_memory.length===0,'human decisions/memory refused');
 const sources=index(input.sources,'source'),fragments=index(input.fragments,'fragment'),versions=index(input.versions,'version'),proposals=index(input.replacement_proposals,'proposal');
 check(fragments.size===4&&versions.size===9&&proposals.size===2,'fixture universe drift');
 for(const source of sources.values())check(sha.test(source.sha256)&&source.simulation===true&&source.rights_status==='unknown'&&['source-photo','derived-image','derived-text'].includes(source.kind)&&Array.isArray(source.derived_from_ids)&&source.derived_from_ids.every(ref=>sources.has(ref)),'source descriptor/provenance drift');
 const editionsByFragment=new Map();
 for(const version of versions.values()){
  status(version.status);check(version.entity_id===null&&version.human_decision===null,'identity/human decision promotion refused');
  check(fragments.get(version.fragment_id)?.selection==='included'&&EDITIONS.includes(version.edition),'version outside included fragment/edition');
  check(typeof version.text_exact==='string'&&hash(version.text_exact)===version.text_sha256_utf8&&Buffer.byteLength(version.text_exact,'utf8')===version.utf8_byte_length,'exact version text/hash/bytes drift');
  const locator=version.source_locator,textSource=sources.get(version.source_id);
  check(textSource?.kind==='derived-text'&&locator?.kind==='utf8-text'&&locator.json_pointer===null&&locator.span?.exact_text===version.text_exact&&locator.container_text_sha256_utf8===textSource.sha256,'text provenance drift');
  check(locator.span.units==='unicode-codepoints-half-open'&&Number.isSafeInteger(locator.span.start)&&Number.isSafeInteger(locator.span.end)&&locator.span.start>=0&&locator.span.end-locator.span.start===Array.from(version.text_exact).length,'inherited Unicode locator coordinates drift');
  check(Number.isSafeInteger(locator.byte_span?.start)&&Number.isSafeInteger(locator.byte_span?.end)&&locator.byte_span.start>=0&&locator.byte_span.end-locator.byte_span.start===version.utf8_byte_length,'inherited UTF-8 locator coordinates drift');
  check(Array.isArray(version.image_evidence)&&version.image_evidence.length===1,'fixture photo descriptor required');
  for(const image of version.image_evidence)check(sources.get(image.photo_source_id)?.kind==='source-photo'&&sources.get(image.derived_image_source_id)?.kind==='derived-image'&&sources.get(image.derived_image_source_id).derived_from_ids.includes(image.photo_source_id)&&image.canonical_view_id===null&&image.region_frame==='unknown'&&image.region===null&&image.simulation===true,'fixture image descriptor, invented crop or canonical view refused');
  check(Array.isArray(version.ambiguities),'missing ambiguities');for(const ambiguity of version.ambiguities){check(ambiguity.entity_id===null&&ambiguity.reading_status==='unresolved'&&ambiguity.identification_status==='unresolved','ambiguity promotion refused');span(ambiguity.span,version.text_exact);}
  const items=editionsByFragment.get(version.fragment_id)??[];items.push(version);editionsByFragment.set(version.fragment_id,items);
 }
 const included=[],excluded=[];
 for(const fragment of fragments.values()){
  check(fragment.active_version_id===null&&Array.isArray(fragment.version_ids),'active edition forbidden');const items=editionsByFragment.get(fragment.id)??[];
  if(fragment.selection==='excluded'){check(fragment.version_ids.length===0&&items.length===0,'excluded fragment must have no edition');excluded.push(fragment.id);continue;}
  check(fragment.selection==='included'&&items.length===3&&fragment.version_ids.length===3&&new Set(fragment.version_ids).size===3&&items.every(v=>fragment.version_ids.includes(v.id))&&new Set(items.map(v=>v.edition)).size===3,'each included fragment requires exactly three distinct editions');
  const ordered=EDITIONS.map(edition=>items.find(v=>v.edition===edition));
  check(ordered.every(v=>JSON.stringify(v.image_evidence)===JSON.stringify(ordered[0].image_evidence)),'photo descriptors must remain unchanged across fixture editions');
  included.push({id:fragment.id,versions:ordered,proposals:[]});
 }
 check(included.length===3&&excluded.length===1,'included/excluded fixture count drift');
 for(const proposal of proposals.values()){
  const from=versions.get(proposal.from_version_id),to=versions.get(proposal.to_version_id);
  check(proposal.kind==='partial-replacement-proposal'&&proposal.status==='proposed'&&proposal.applied===false&&proposal.human_decision===null&&proposal.entity_id===null,'replacement proposals must remain unapplied');
  check(from&&to&&from.fragment_id===to.fragment_id&&from.id!==to.id,'replacement outside a single included fragment');span(proposal.from_span,from.text_exact);span(proposal.to_span,to.text_exact);
  included.find(f=>f.id===from.fragment_id).proposals.push(proposal);
 }
 return structuredClone({id:input.id,fragments:included,excluded,sources:[...sources.values()],status:input.status});
}
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
// Character references preserve CRLF and an initial LF in HTML parsing.
const exactHtml=text=>escape(text).replaceAll('\r','&#13;').replaceAll('\n','&#10;');
function renderVersion(version,n){return `<section class="revision-panel" id="edition-${n}-${version.edition}" data-edition="${version.edition}" role="tabpanel" aria-labelledby="tab-${version.edition}"${version.edition!=='first-draft'?' hidden':''}>
 <h2>${VIEW_LABELS[version.edition]}</h2><p class="revision-note">${version.edition==='first-draft'?'Premier brouillon conservé sans modification.':version.edition==='rereading'?'Relecture de travail, à vérifier.':'Reformulation de travail, à vérifier.'}</p>
 <pre class="revision-text" data-version-id="${escape(version.id)}" data-text-sha256="${version.text_sha256_utf8}">${exactHtml(version.text_exact)}</pre>
 ${version.ambiguities.length?`<aside class="revision-uncertain"><h3>Lectures incertaines</h3><ul>${version.ambiguities.map(a=>`<li>${escape(a.span.exact_text)} : ${a.alternatives.map(escape).join(' / ')} — non résolu.</li>`).join('')}</ul></aside>`:''}
 <details><summary>Source de cette version</summary><dl><dt>Référence du texte</dt><dd>${escape(version.source_id)}</dd><dt>Version</dt><dd>${escape(version.id)}</dd><dt>Empreinte du texte exact</dt><dd>${version.text_sha256_utf8}</dd></dl></details>
 </section>`;}
export function renderRevisionFixture(input){const model=prepareRevisionFixture(input);
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Comparer les versions — exemple inventé</title><link rel="stylesheet" href="/css/archives-revisions.css"></head>
 <body class="revision-page"><a class="revision-skip" href="#revision-reader">Aller au texte</a><main><header><p class="revision-kicker">Exemple inventé · consultation privée</p><h1>Comparer les versions</h1><p>L’original, la relecture et le français moderne restent consultables séparément.</p><a href="http://127.0.0.1:8801/archives/">Quitter l’exemple et accéder aux archives →</a></header>
 <aside class="revision-notice"><strong>Ces textes sont entièrement inventés.</strong> Aucune lecture ni identité historique n’est validée.</aside>
 <div class="revision-controls"><label for="revision-fragment">Passage à consulter</label><select id="revision-fragment">${model.fragments.map((f,n)=>`<option value="${n}">Passage ${n+1}</option>`).join('')}</select></div>
 <div class="revision-tabs" role="tablist" aria-label="Version à consulter">${[...EDITIONS,'photos'].map((edition,n)=>`<button id="tab-${edition}" role="tab" data-revision-tab="${edition}" aria-selected="${n===0}" aria-controls="edition-0-${edition}" tabindex="${n===0?'0':'-1'}">${VIEW_LABELS[edition]}</button>`).join('')}</div>
 <p class="revision-selection" id="revision-selection" role="status" aria-live="polite">Passage 1 · Original</p>
 <div id="revision-reader" tabindex="-1">${model.fragments.map((f,n)=>`<article data-revision-fragment="${n}" data-fragment-id="${escape(f.id)}"${n?' hidden':''}>${f.versions.map(v=>renderVersion(v,n)).join('')}
 <section class="revision-panel" id="edition-${n}-photos" data-edition="photos" role="tabpanel" aria-labelledby="tab-photos" hidden><h2>Photos</h2><div class="revision-photo" data-photo-source-id="${escape(f.versions[0].image_evidence[0].photo_source_id)}" data-derived-image-source-id="${escape(f.versions[0].image_evidence[0].derived_image_source_id)}"><strong>Référence photographique conservée</strong><p>Cet exemple fournit une référence inventée, sans image. Aucune photographie réelle n’est associée à ces textes.</p></div><details><summary>Référence de la photo</summary><p>${escape(f.versions[0].image_evidence[0].photo_source_id)}</p><p>${escape(f.versions[0].image_evidence[0].derived_image_source_id)}</p><p>Vue entière ; aucune zone précise établie.</p></details></section>
 ${f.proposals.length?`<details class="revision-proposals"><summary>Changements partiels suggérés — non appliqués</summary><ul>${f.proposals.map(p=>`<li data-proposal-id="${escape(p.id)}"><q>${exactHtml(p.from_span.exact_text)}</q> → <q>${exactHtml(p.to_span.exact_text)}</q> · suggestion seulement.</li>`).join('')}</ul><p>L’ancienne version reste intacte.</p></details>`:''}</article>`).join('')}</div>
 <footer><p>Trois passages de démonstration. Un passage exclu ne fournit aucun texte.</p></footer></main><script src="/js/archives-revisions.js" defer></script></body></html>`;
}
