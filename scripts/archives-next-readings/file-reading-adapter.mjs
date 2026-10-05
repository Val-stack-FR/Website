import {createHash} from 'node:crypto';

export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const FILE_READING_PINS=Object.freeze({
 assembly:'47b9867149924b6f0b47a7929b6cbced4a3b1a06770c5c6298b32cac937fcb37',
 body:'b827189b0e30ad119e825bfdd8e2267c3321c635891dd08581d16ac080c1dee1',
 evidence:'3a3417551505aa69d0480296cf3da5162ffe864605cbd9868c2385fb8f4a22fe',
 forms:'1824607dc38d3d71e76aba06e36d24befd7fa61592b728e96a6e35bc4f8ebe23',
 formsPage:'689366e18f7cbe2a1667b9e53d0653ce8a7923eb59a0d37cc107740a38c014b4',
 admission:'77e417de04ddfb7eee83ddab8b21b5e00156d64e2a0b213f7788072e2558d17c',
 candidate:'cbd463da79bbc06a3522a8483489d10862c049781e99e292ac09807d033e2d8d',
 overview:'2a7b6be96cff6891a061152cf4e8f25d8a010a1a8697f8d6cc57b2ba76a98c34',
 object:'object:path-bb85ab737e3b2ef749a76d8b40636202af7b27fd9dea1feace413fc36f43670b'
});
export const FILE_ROUTES=Object.freeze({index:'/archives/fichiers/',p09:'/archives/fichiers/p09/',css:'/assets/archives-file-reading.css'});
const ensure=(value,message)=>{if(!value)throw Error('File reading: '+message);};
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const pinned=(bytes,key)=>{ensure(Buffer.isBuffer(bytes)&&digest(bytes)===FILE_READING_PINS[key],key+' source pin');return bytes;};
const json=(bytes,key)=>JSON.parse(pinned(bytes,key));
const overviewRoute='/archives/next-readings/media/'+FILE_READING_PINS.overview+'.jpg';
const expectedForms=[['L01','⟦[…]trix ?⟧'],['L04','⟦souille ?⟧'],['L07','vre'],['L21','⟦septenbre ?⟧']];

// One file and one body edition. No act grouping or alignment between fragments is inferred.
export function projectP09File({assemblyBytes,bodyBytes,evidenceBytes,formsBytes,formsPageBytes,admissionBytes,candidateBytes,cropBytes}){
 const assembly=json(assemblyBytes,'assembly'),evidence=json(evidenceBytes,'evidence'),forms=json(formsBytes,'forms'),admission=json(admissionBytes,'admission'),candidate=json(candidateBytes,'candidate');
 const body=pinned(bodyBytes,'body').toString('utf8'),formsPage=pinned(formsPageBytes,'formsPage').toString('utf8');
 const lines=body.split('\n');ensure(lines.pop()===''&&lines.length===21&&!body.includes('\r'),'exact 21-line author body');
 ensure(evidence.body_physical_lines===21&&evidence.human_review==='pending'&&evidence.historical_identity_resolved===false&&evidence.source_object_id===FILE_READING_PINS.object&&evidence.memory_events===0,'physical line evidence and unresolved scope');
 ensure(assembly.historical_confirmation===false&&assembly.next_reading.photo_source_object_id===FILE_READING_PINS.object&&assembly.next_reading.derivative_sha256===FILE_READING_PINS.overview,'parent source binding');
 ensure(assembly.files['dist'+overviewRoute]?.sha256===FILE_READING_PINS.overview&&assembly.files['dist'+overviewRoute]?.size_bytes===3604434,'existing selected overview target');
 ensure(assembly.p09_forms.source_body_sha256===FILE_READING_PINS.body&&assembly.p09_forms.projection_sha256===FILE_READING_PINS.forms&&forms.source_body_sha256===FILE_READING_PINS.body,'form edition binding');
 ensure(forms.forms.length===4&&forms.canonical_updates===0&&forms.confirmed_memory===false&&forms.human_review==='pending','four prepared unresolved points');
 ensure(admission.candidate_sha256===FILE_READING_PINS.candidate&&admission.source_body_sha256===FILE_READING_PINS.body&&admission.forms_sha256===FILE_READING_PINS.forms&&admission.source_edition==='author-full-view-r0','crop source edition binding');
 ensure(admission.explicit_visual_inspection===true&&admission.text_offsets_used_for_geometry===false&&admission.generative_processing===false&&admission.historical_confirmation===false&&admission.canonical_updates===0&&admission.confirmed_memory===false&&admission.human_review==='pending'&&admission.new_photographic_views===0&&admission.original_source_modified===false,'manually inspected review crops only');
 ensure(admission.source_object_id===FILE_READING_PINS.object&&admission.source_derivative_sha256===FILE_READING_PINS.overview&&candidate.source_body_sha256===FILE_READING_PINS.body,'crop object binding');
 ensure(JSON.stringify(admission.coordinate_frame)===JSON.stringify(candidate.source_frame)&&admission.coordinate_frame.width===3968&&admission.coordinate_frame.height===2976&&admission.coordinate_frame.transform==='identity','native crop reference frame');
 ensure(admission.regions.length===3&&candidate.regions.length===3&&cropBytes instanceof Map&&cropBytes.size===3,'three crops, no other image');
 const htmlSections=[...formsPage.matchAll(/<section class="full-edition" id="forme-\d">([\s\S]*?)<\/section>/g)];ensure(htmlSections.length===4,'four existing form sections');
 const usedCrops=new Set();
 const points=forms.forms.map((form,index)=>{
  const [line,quote]=expectedForms[index];ensure(form.physical_line===line&&form.quote===quote&&form.source_text_version==='author-full-view-r0'&&form.span.text_version==='author-full-view-r0'&&form.span.units==='unicode-codepoints-half-open','exact expected point and edition');
  const n=Number(line.slice(1));ensure(lines[n-1]===form.line_context_exact,'exact numbered source context');
  const cp=Array.from(body),start=cp.slice(0,form.span.start).join('').split('\n').length;ensure(start===n&&cp.slice(form.span.start,form.span.end).join('')===quote,'exact quote offsets and line, never geometry');
  ensure(form.bbox===null&&form.entity_id===null&&form.reading_status==='unresolved'&&form.identification_status==='unresolved'&&form.qualified_view.source_object_id===FILE_READING_PINS.object&&form.qualified_view.derivative_sha256===FILE_READING_PINS.overview,'unconfirmed source point');
  const french=[...htmlSections[index][1].matchAll(/<li><strong>([^<>]+)<\/strong> — ([^<>]+)<\/li>/g)].map(m=>({reading:m[1],rationale:m[2]}));
  ensure(french.length===form.alternatives.length&&french.every((alt,i)=>alt.reading===form.alternatives[i].reading&&form.alternatives[i].status==='proposed-unaccepted'),'preserve all existing proposals and provenance');
  const matches=admission.regions.filter(region=>region.occurrence_id===form.id);ensure(matches.length<=1,'unique occurrence crop');
  let crop=null;
  if(matches.length){
   const r=matches[0],c=candidate.regions.find(x=>x.id===r.id),b=cropBytes.get(r.file);ensure(c&&r.word_bbox===null&&r.historical_reading_confirmed===false&&r.physical_crop_review==='root-visually-inspected-target-group-and-line','review region, not word bbox or confirmed reading');
   ensure(r.line===line&&r.quote===quote&&r.source_quote===quote&&r.line_context_exact===form.line_context_exact&&JSON.stringify(r.source_span)===JSON.stringify({end:form.span.end,start:form.span.start,text_version:form.span.text_version,units:form.span.units}),'crop exact occurrence context');
   ensure(JSON.stringify(c.rectangle)===JSON.stringify(r.rectangle)&&c.sha256===r.sha256&&c.file===r.file&&c.bytes===r.bytes,'inspected candidate retained');
   ensure(Buffer.isBuffer(b)&&digest(b)===r.sha256&&b.length===r.bytes&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'byte-identical PNG crop');
   const rect=r.rectangle;ensure(Object.values(rect).every(v=>Number.isSafeInteger(v)&&v>=0)&&rect.width>0&&rect.height>0&&rect.left+rect.width<=3968&&rect.top+rect.height<=2976&&b.readUInt32BE(16)===rect.width&&b.readUInt32BE(20)===rect.height,'native rectangle and PNG size');
   const route='/archives/review-crops/p09/'+r.sha256+'.png';ensure(r.public_route===route&&!usedCrops.has(r.file),'fixed unique crop route');usedCrops.add(r.file);
   crop={route,run_file:'review-crops/'+r.sha256+'.png',sha256:r.sha256,bytes:r.bytes,width:rect.width,height:rect.height,sourceFile:r.file,rectangle:{...rect},word_bbox:null,kind:r.region_kind};
  }
  ensure((line==='L07')===(crop===null),'only abbreviation lacks measured crop');
  return {id:'point-'+line.toLowerCase(),line,lineNumber:n,quote,context:form.line_context_exact,sourceOccurrence:form.id,sourceSpan:{...form.span},alternatives:french,crop,status:'pending'};
 });
 ensure(usedCrops.size===3&&points.reduce((n,p)=>n+p.alternatives.length,0)===9,'three images and nine proposals');
 return {kind:'source-file-reading',key:'file:p09:'+FILE_READING_PINS.object,sourceObject:FILE_READING_PINS.object,sourceEdition:'author-full-view-r0',sourceBodySha256:FILE_READING_PINS.body,sourcePhotoSha256:FILE_READING_PINS.overview,body,lines:lines.map((text,index)=>({label:'L'+String(index+1).padStart(2,'0'),text})),lineNumbering:'visible-main-body-baselines-only',scope:'one-photographic-view-not-whole-act',cote:null,canonicalAct:null,humanReview:'pending',confirmedMemory:false,points,preparedPointCount:4,cropCount:3,uncroppedPointCount:1,overviewRoute,sourcePins:{...FILE_READING_PINS}};
}

const head=title=>`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="/assets/archives-integration-lexical.css"><link rel="stylesheet" href="${FILE_ROUTES.css}"></head>`;
const navigation=`<nav class="file-nav" aria-label="Atelier des archives"><a href="${FILE_ROUTES.index}">Lectures par fichier</a><a href="/archives/catalogue/">Catalogue des dossiers</a><a href="/archives/">Atelier</a></nav>`;
export function renderFileLibrary(p){
 return `${head('Lectures par fichier — Archives')}<body class="file-reading"><a class="skip" href="#fichiers">Aller aux fichiers</a><main>${navigation}<header><p class="eyebrow">Archives · lectures</p><h1>Choisir un fichier</h1><p>Ouvrir sa transcription, puis examiner ses points de lecture dans leur ligne.</p><p class="muted">Premier fichier préparé pour cette vue. Les dossiers « E. » restent consultables dans le catalogue.</p></header><section id="fichiers" tabindex="-1" aria-label="Fichiers préparés"><article class="file-entry"><div><p class="eyebrow">Une vue photographique · rattachement à établir</p><h2><a href="${FILE_ROUTES.p09}">Lire P09</a></h2><p>Corps visible · ${p.lines.length} lignes transcrites</p><p class="file-status">Lecture à revoir</p></div><div><p><strong>${p.preparedPointCount} points préparés à revoir</strong></p><p>${p.cropCount} petits extraits d’image · ${p.uncroppedPointCount} cadrage à préparer</p><a href="${FILE_ROUTES.p09}#points-review">Ouvrir les points de P09</a></div></article></section><p class="muted">Une photo peut être une partie d’un acte. Cette entrée ne désigne pas un acte complet.</p></main></body></html>\n`;
}
const renderPoint=p=>`<article class="reading-point" id="${p.id}" tabindex="-1" aria-labelledby="${p.id}-title"><header><p class="eyebrow">${p.line} · lecture à vérifier</p><h3 id="${p.id}-title"><span data-point-quote>${esc(p.quote)}</span></h3></header>${p.crop?`<figure><img src="${p.crop.route}" width="${p.crop.width}" height="${p.crop.height}" alt="Petit extrait autour du groupe proposé ${esc(p.quote)} à la ligne ${p.line}"><figcaption>Extrait de contexte pour la revue.</figcaption></figure>`:'<p class="crop-pending">Cadrage à préparer</p>'}<p class="proposal-label">Suggestions</p><ul class="reading-suggestions">${p.alternatives.map(a=>`<li>${esc(a.reading)}</li>`).join('')}</ul><p><a href="#ligne-${p.line.toLowerCase()}">Revenir à ${p.line} dans la transcription</a></p></article>`;
export function renderFileReading(p){
 const pointsByLine=new Map(p.points.map(point=>[point.line,point]));
 const rows=p.lines.map(line=>{const point=pointsByLine.get(line.label);return `<div class="transcription-line${point?' has-point':''}" id="ligne-${line.label.toLowerCase()}" tabindex="-1"><span class="line-label">${line.label}</span><span class="source-line" data-source-line="${line.label}">${esc(line.text)}</span>${point?`<a class="line-point-link" href="#${point.id}" aria-label="Voir le point de lecture ${line.label}">Voir le point</a>`:''}</div>`;}).join('');
 return `${head('P09 — Transcription et points de lecture')}<body class="file-reading"><a class="skip" href="#transcription">Aller à la transcription</a><main>${navigation}<header class="file-heading"><p class="eyebrow">Une vue photographique · rattachement à établir</p><h1>P09 · corps visible</h1><p class="file-status">Brouillon auteur conservé · lecture à revoir</p><p>21 lignes du corps visibles sur cette vue. Leur numérotation est locale à ce corps ; les annotations et les autres fragments restent séparés.</p><nav class="file-actions" aria-label="Parcourir P09"><a href="#transcription">Lire les 21 lignes</a><a href="#points-review">Voir les 4 points préparés</a><a href="${p.overviewRoute}">Ouvrir la photo d’ensemble</a></nav></header><div class="file-columns"><section class="transcription" id="transcription" tabindex="-1" aria-labelledby="transcription-title"><h2 id="transcription-title">Transcription</h2><p class="muted">Les lacunes et les graphies incertaines sont conservées.</p><div class="transcription-lines">${rows}</div></section><section class="reading-points" id="points-review" tabindex="-1" aria-labelledby="points-title"><h2 id="points-title">4 points préparés à revoir</h2><p class="muted">Trois extraits de contexte. Les suggestions restent non confirmées.</p>${p.points.map(renderPoint).join('')}</section></div><footer class="file-footer"><p><a href="${FILE_ROUTES.index}">Revenir aux fichiers</a> · <a href="/archives/next-readings/versions/p09-full-view-proposed/#full-history">Consulter les versions conservées</a></p></footer></main></body></html>\n`;
}
