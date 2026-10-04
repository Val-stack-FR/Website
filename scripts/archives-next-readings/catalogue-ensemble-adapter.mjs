import {createHash} from 'node:crypto';
import {TextDecoder} from 'node:util';
export const E108_FIXTURE_SHA256='d44fb6fd5b506b8505236097348d1ed05698aaf2bbfe784458d709ce72167c75';
export const E108_ENSEMBLE_DOM_ID='ensemble-e108-11-14';
export const ENSEMBLE_ASSETS=[
 {route:'/assets/archives-catalogue-ensemble.css',file:'scripts/archives-next-readings/catalogue-ensemble.css',run_file:'catalogue-ensemble.css',contentType:'text/css; charset=utf-8'},
 {route:'/assets/archives-catalogue-ensemble.js',file:'scripts/archives-next-readings/catalogue-ensemble.js',run_file:'catalogue-ensemble.js',contentType:'text/javascript; charset=utf-8'}
];
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const ensure=(value,message)=>{if(!value)throw Error('E108 ensemble: '+message);};
const decode=bytes=>new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(bytes);
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const exactIds=[
 'object:path-e0c18ef5953b98f7ff6fdfd06777d11b54efb93f25a326ed02078eaea0f9aa0d',
 'object:path-e27a33af0418957a376f23b55948fafb1192f7adb8e2c60a0cf19dda52dfa314',
 'object:path-2c0bd5701f3a26bb0b87b867bb9de5bf242c83d45c5e1620fdde87ceb897ce83',
 'object:path-dd7e54e1f27a4f6e429919bedf4d3ed75a62e4135ecdab64a308f8ace30c6241'
];

// Four occurrences from one closed fixture; no file, image, database or web access.
export function projectE108Ensemble({fixtureBuffer,fixtureSha256,mediaCheckBuffer,mediaCheckSha256}){
 ensure(fixtureSha256===E108_FIXTURE_SHA256&&Buffer.isBuffer(fixtureBuffer)&&digest(fixtureBuffer)===fixtureSha256,'trusted closed fixture pin required');
 ensure(Buffer.isBuffer(mediaCheckBuffer)&&/^[a-f0-9]{64}$/u.test(mediaCheckSha256??'')&&digest(mediaCheckBuffer)===mediaCheckSha256,'media-check bytes/pin required');
 const fixture=JSON.parse(decode(fixtureBuffer)),check=JSON.parse(decode(mediaCheckBuffer));
 ensure(fixture.contract==='catalogue-ensemble-candidate/0.1.0'&&fixture.record_type==='provisional_ensemble_candidate'&&fixture.members.length===4,'exact provisional fixture scope required');
 ensure(fixture.ensemble_hypothesis.status==='probable_unconfirmed'&&fixture.ensemble_hypothesis.historically_verified===false&&fixture.ensemble_hypothesis.label==='même acte probable, à confirmer','same-act hypothesis promoted');
 ensure(fixture.canonical_act_id===null&&fixture.text_associations.length===0&&fixture.person_associations.length===0&&fixture.physical_order===null&&fixture.physical_order_status==='not_proven','unresolved associations promoted');
 ensure(fixture.source_scope.collection==='CLEAN'&&fixture.source_scope.folder_label==='Source en intégralité page 1 à 30','source folder drift');
 const folder=fixture.source_scope.logical_directory.replace(/\/$/u,'');
 ensure(folder==='CLEAN/Photos des Archives/E.108 - 1470. — Baronnie de Milesse, dépendant du marquisat de Lavardin/Source en intégralité page 1 à 30','exact E108 folder required');
 ensure(check.format==='e108-existing-media-check/1'&&check.image_bytes_read===0&&check.selected_media_bindings.length===0&&check.member_checks.length===4,'unqualified media/other scope supplied');
 const members=fixture.members.map((member,index)=>{
  const checked=check.member_checks[index];
  ensure(member.object_id===exactIds[index]&&member.filename===(index+11)+'.jpg'&&member.nominal_order===index+11&&fixture.nominal_order[index]===member.object_id&&member.provenance.inventory_line_number===1693+index,'exact four member/nominal order drift');
  ensure(member.logical_path===folder+'/'+member.filename&&member.physical_order===null&&member.content_sha256===null&&member.rights_status==='unknown','member provenance/physical status drift');
  ensure(checked.object_id===member.object_id&&checked.logical_path===member.logical_path&&checked.catalogue_match_count===1&&checked.consultation_available===false&&checked.consultation_href===null&&checked.qualified_media_route===null,'member media check mismatch or invention');
  return {objectId:member.object_id,filename:member.filename,logicalPath:member.logical_path,nominalOrder:member.nominal_order,physicalOrder:null,mediaState:'preview-not-prepared',photoRoute:null};
 });
 return {kind:'ensemble-candidate',ensembleId:fixture.ensemble_id,domId:E108_ENSEMBLE_DOM_ID,folder,folderLabel:fixture.source_scope.folder_label,title:'E.108 — vues 11 à 14',hypothesis:fixture.ensemble_hypothesis.label,nominalOrderLabel:'Ordre des noms de fichiers : 11 → 12 → 13 → 14. Ordre physique non établi.',members,physicalOrder:null,canonicalActId:null,textAssociations:[],personAssociations:[],folderHref:'/archives/catalogue/?folder='+encodeURIComponent(folder)+'#'+E108_ENSEMBLE_DOM_ID};
}

// Optional direct integration at the existing catalogue response boundary.
// Pagination/filters are respected: a group is made only when all four are present.
export function groupE108CatalogueEntries(entries,selectedFolder,ensemble){
 ensure(Array.isArray(entries)&&ensemble.kind==='ensemble-candidate'&&ensemble.members.length===4,'catalogue projection inputs required');
 if(selectedFolder!==ensemble.folder)return {entries,groupCount:0,reason:'different-folder'};
 const chosen=[];
 for(const member of ensemble.members){const matches=entries.filter(e=>e.kind==='file'&&e.record.digitalObjectId===member.objectId);ensure(matches.length<=1,'duplicate member on current catalogue page');if(matches.length===0)return {entries,groupCount:0,reason:'incomplete-current-page'};const entry=matches[0];ensure(entry.record.logicalPath===member.logicalPath&&entry.record.fileName.literal===member.filename,'catalogue member path/name mismatch');chosen.push(entry);}
 const chosenSet=new Set(chosen),first=entries.findIndex(e=>chosenSet.has(e));
 return {entries:entries.flatMap((entry,i)=>i===first?[{kind:'ensemble-candidate',ensemble}]:chosenSet.has(entry)?[]:[entry]),groupCount:1,reason:'four-exact-members'};
}

function renderCard(ensemble){return `<article class="catalogue-card catalogue-ensemble" id="${ensemble.domId}" data-ensemble-card tabindex="-1" aria-labelledby="${ensemble.domId}-title"><p class="catalogue-kicker">Ensemble proposé · 4 vues</p><h3 id="${ensemble.domId}-title">${escape(ensemble.title)}</h3><p class="ensemble-hypothesis">Même acte probable, à confirmer</p><p>Dossier source : <strong>${escape(ensemble.folderLabel)}</strong></p><p class="catalogue-muted">Hypothèse de regroupement proposée par Val. Le dossier d’origine est conservé ; l’identité de l’acte reste à confirmer.</p><p>${escape(ensemble.nominalOrderLabel)}</p><ol class="ensemble-views" aria-label="Les quatre vues de l’ensemble">${ensemble.members.map(member=>`<li data-ensemble-object-id="${escape(member.objectId)}" data-ensemble-logical-path="${escape(member.logicalPath)}"><h4>Vue ${member.nominalOrder} · ${member.filename}</h4><p class="catalogue-muted">Photo inventoriée · aperçu à préparer</p></li>`).join('')}</ol><details><summary>Classement et limites du regroupement</summary><p>${escape(ensemble.folder)}</p><p>Les quatre fichiers sont connus par leur classement. Aucun lien avec une transcription ou une personne n’est établi. L’ordre affiché vient des noms de fichiers.</p></details></article>`;}
export function composeE108Catalogue({enabled=false,parentHtml,parentSha256,...inputs}){
 ensure(typeof enabled==='boolean'&&typeof parentHtml==='string'&&digest(Buffer.from(parentHtml))===parentSha256,'parent catalogue pin drift');
 if(!enabled)return {html:parentHtml,additionalAssets:[],added:false};
 const ensemble=projectE108Ensemble(inputs);ensure(!parentHtml.includes('data-ensemble-card')&&!parentHtml.includes('e108-ensemble-template'),'ensemble already projected');
 const anchor='<aside class="catalogue-notice" aria-label="Limites du catalogue">';ensure(parentHtml.split(anchor).length===2&&parentHtml.split('</head>').length===2,'catalogue landmarks absent or duplicated');
 const intro=`<aside class="catalogue-ensemble-entry" aria-label="Ensemble proposé E.108"><p><a id="e108-ensemble-link" href="${escape(ensemble.folderHref)}">E.108 — consulter les vues 11 à 14 ensemble</a></p><p>Un ensemble probable · quatre vues · même acte à confirmer.</p></aside>\n      `;
 const template=`<template id="e108-ensemble-template" data-ensemble-folder="${escape(ensemble.folder)}">${renderCard(ensemble)}</template>\n`;
 const css='<link rel="stylesheet" href="/assets/archives-catalogue-ensemble.css">\n',js='<script src="/assets/archives-catalogue-ensemble.js" defer></script>\n';
 let html=parentHtml.replace(anchor,intro+anchor).replace('</head>',css+'</head>').replace('</body>',template+js+'</body>');
 ensure(html.replace(intro,'').replace(template,'').replace(css,'').replace(js,'')===parentHtml,'unrelated catalogue bytes changed');
 return {html,ensemble,added:true,additionalAssets:structuredClone(ENSEMBLE_ASSETS),parentPreservedAfterRemovingAdditions:true,photoRoutesAdded:0,imageFilesAdded:0};
}
