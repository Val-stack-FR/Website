import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateCoverageObject } from '../archives-catalogue/adapt-coverage.mjs';

const privateIndexes = new WeakMap();
const SHA = /^[a-f0-9]{64}$/u;
const OBJECT = /^object:path-[a-f0-9]{64}$/u;
const PREFIXES = { occurrence_id: 'text-occurrence:', transcription_id: 'transcription:', text_digital_object_id: 'digital-object:' };
const FIELDS = ['act_id', 'catalogue_discovery_status', 'document_id', 'encoding_provenance', 'format', 'modern_french', 'object_id', 'occurrence_id', 'photo_ids', 'publication_status', 'review_status', 'rights_status', 'source_byte_size', 'source_empty', 'source_encoding', 'source_sha256', 'text', 'text_digital_object_id', 'transcription_id'];
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const escape = value => String(value).replace(/[&<>"']/gu, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
// Character references preserve CR exactly; a div avoids pre's first-LF stripping.
const literalHtml = value => escape(value).replaceAll('\r','&#13;');
const count = value => Number(value).toLocaleString('fr-FR');
const order = new Intl.Collator('fr', { numeric:true, sensitivity:'variant' });
const compare = (a,b) => order.compare(a.name,b.name) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const validUnicode = value => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
const logicalPath = path => {
  ensure(typeof path === 'string' && path.length <= 1200 && path.startsWith('CLEAN/') && !/[\\:\u0000-\u001f\u007f]/u.test(path) && validUnicode(path) && path.split('/').every(part=>part && part!=='.' && part!=='..'), 'Unsafe CLEAN text path.');
  return path;
};
const readBounded = (path, limit) => {
  const info=statSync(path); ensure(info.isFile() && info.size <= limit, 'Text derivative exceeds input budget.');
  const bytes=readFileSync(path); ensure(bytes.length <= limit && bytes.length === info.size, 'Text derivative changed size.'); return bytes;
};
const lines = bytes => {
  const source = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
  ensure(!source.startsWith('\ufeff'), 'Unexpected derivative BOM.');
  const rows=source.split(/\r?\n/u); if(rows.at(-1)==='') rows.pop();
  ensure(rows.length>0 && rows.every(Boolean), 'Invalid derivative JSONL.'); return rows.map(JSON.parse);
};

/** Exact object-ID joins; no name matching, canonical promotion or original reads. */
export function buildPreexistingTextIndex(records, coverage, { indexSha256, coverageSha256, objectIds=null }={}) {
  ensure(SHA.test(indexSha256) && SHA.test(coverageSha256), 'Pinned input hashes required.');
  ensure(Array.isArray(records) && records.length>0 && records.length<=500 && Array.isArray(coverage) && coverage.length<=20_000, 'Invalid private text index size.');
  const coverageById=new Map();
  for(const [i,entry] of coverage.entries()) { validateCoverageObject(entry,i); ensure(!coverageById.has(entry.object_id), 'Duplicate coverage object ID.'); coverageById.set(entry.object_id,entry); }
  const texts=new Map(), identities=new Set(), contentObjects=new Map(), digitalIdsByContent=new Map(), seenPaths=new Set(); let totalBytes=0;
  for(const entry of records) {
    ensure(entry && Object.keys(entry).length===FIELDS.length && FIELDS.every(key=>Object.hasOwn(entry,key)), 'Unexpected private text fields.');
    ensure(entry.format==='private-c07-reader-text/0.1.0' && OBJECT.test(entry.object_id) && !texts.has(entry.object_id), 'Invalid or duplicate text object ID.');
    ensure(entry.act_id===null && entry.document_id===null && entry.modern_french===null && Array.isArray(entry.photo_ids) && entry.photo_ids.length===0 && entry.publication_status==='private' && entry.rights_status==='unknown' && entry.review_status==='preexisting-unreviewed' && ['unknown','candidate_name_lead','existing_text'].includes(entry.catalogue_discovery_status), 'Text publication or historical state overstated.');
    for(const [field,prefix] of Object.entries(PREFIXES)) { ensure(typeof entry[field]==='string' && entry[field].startsWith(prefix) && SHA.test(entry[field].slice(prefix.length)) && (field==='text_digital_object_id' || !identities.has(entry[field])), 'Invalid or duplicate text occurrence identity.'); if(field!=='text_digital_object_id') identities.add(entry[field]); }
    ensure(typeof entry.text==='string' && entry.text.length<=100_000 && validUnicode(entry.text) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(entry.text), 'Invalid literal text.');
    totalBytes+=Buffer.byteLength(entry.text); ensure(totalBytes<=4*1024*1024, 'Private text budget exceeded.');
    ensure(SHA.test(entry.source_sha256) && Number.isSafeInteger(entry.source_byte_size) && entry.source_byte_size>=0 && entry.source_byte_size<=1024*1024 && typeof entry.source_empty==='boolean' && entry.source_empty===(entry.text.length===0) && entry.source_empty===(entry.source_byte_size===0), 'Invalid text source hash, size or empty state.');
    ensure(['utf-8-sig','windows-1252'].includes(entry.source_encoding) && entry.encoding_provenance && ['unvalidated_hypothesis','declared_by_input_manifest'].includes(entry.encoding_provenance.status) && entry.encoding_provenance.validated_as_authentic_reading===false && typeof entry.encoding_provenance.basis==='string' && entry.encoding_provenance.basis.length<=1000, 'Unsupported encoding provenance.');
    const source=coverageById.get(entry.object_id);
    ensure(source && source.collection==='CLEAN' && source.extension?.toLowerCase()==='.txt' && source.sha256===entry.source_sha256 && source.size_bytes===entry.source_byte_size && source.status===entry.catalogue_discovery_status, 'Exact catalogue object/hash/size/state join failed.');
    const content=contentObjects.get(entry.text_digital_object_id);
    ensure(!content || (content.source_sha256===entry.source_sha256 && content.source_byte_size===entry.source_byte_size && content.text===entry.text && content.source_encoding===entry.source_encoding), 'Shared text digital object has divergent content.'); contentObjects.set(entry.text_digital_object_id,entry);
    const path=logicalPath(source.logical_path);
    ensure(!seenPaths.has(path), 'Duplicate exact text path.'); seenPaths.add(path);
    const contentKey=entry.source_sha256+':'+entry.source_byte_size+':'+entry.source_encoding+':'+sha(Buffer.from(entry.text));
    ensure(!digitalIdsByContent.has(contentKey) || digitalIdsByContent.get(contentKey)===entry.text_digital_object_id, 'Identical text content has divergent digital object IDs.'); digitalIdsByContent.set(contentKey,entry.text_digital_object_id);
    // Whitelist the projection. No upstream path/encoding auxiliary fields leak.
    texts.set(entry.object_id, Object.freeze({ ...Object.fromEntries(FIELDS.filter(key=>!['encoding_provenance','photo_ids'].includes(key)).map(key=>[key,entry[key]])), photo_ids:Object.freeze([]), encoding_provenance:Object.freeze({status:entry.encoding_provenance.status,validated_as_authentic_reading:false}), logical_path:path, file_name:path.split('/').at(-1) }));
  }
  const selected=objectIds===null ? [...texts.keys()] : objectIds;
  ensure(Array.isArray(selected) && selected.length>0 && selected.length<=500 && new Set(selected).size===selected.length && selected.every(id=>texts.has(id)), 'Invalid explicit text selection.');
  const selectedTexts=new Map(selected.map(id=>[id,texts.get(id)]));
  const folders=new Map([['CLEAN',{path:'CLEAN',name:'CLEAN',children:new Set(),files:[],descendants:0}]]);
  for(const entry of selectedTexts.values()) {
    const parts=entry.logical_path.split('/');
    for(let depth=1;depth<parts.length;depth++) {
      const path=parts.slice(0,depth).join('/');
      if(!folders.has(path)) folders.set(path,{path,name:parts[depth-1],children:new Set(),files:[],descendants:0});
      folders.get(path).descendants++;
      if(depth>1) folders.get(parts.slice(0,depth-1).join('/')).children.add(path);
    }
    folders.get(parts.slice(0,-1).join('/')).files.push(entry);
  }
  const token=Object.freeze({format:'private-c07-reader-index/0.1.0'});
  privateIndexes.set(token,{texts:selectedTexts,folders,indexSha256,coverageSha256,inventoryCount:records.length});
  return token;
}

export function loadPreexistingTextIndex({ indexPath,indexSha256,coverageDirectory,coverageChecksumsSha256,objectIds=null }) {
  ensure(SHA.test(indexSha256) && SHA.test(coverageChecksumsSha256), 'Explicit private text input pins required.');
  const index=readBounded(indexPath,8*1024*1024), checks=readBounded(join(coverageDirectory,'checksums.json'),64*1024), catalogue=readBounded(join(coverageDirectory,'catalogue.jsonl'),64*1024*1024);
  ensure(sha(index)===indexSha256 && sha(checks)===coverageChecksumsSha256, 'Private text index or catalogue checksums hash changed.');
  const expected=JSON.parse(checks.toString('utf8')); ensure(expected['catalogue.jsonl']===sha(catalogue), 'Coverage catalogue hash changed.');
  return buildPreexistingTextIndex(lines(index),lines(catalogue),{indexSha256,coverageSha256:sha(catalogue),objectIds});
}

const dataFor = index => { const data=privateIndexes.get(index); ensure(data,'Verified private text index required.'); return data; };
const textHref = id => '/archives/texte/?object_id='+encodeURIComponent(id);
const folderHref = (folder,query='',page=1,pageSize=20) => '/archives/textes/?'+new URLSearchParams({folder,query,page:String(page),page_size:String(pageSize)});
const parameters = (params,allowed) => {
  ensure(params instanceof URLSearchParams && params.toString().length<=4096,'Invalid text request.');
  const result={}; for(const [key,value] of params) { ensure(allowed.includes(key) && !Object.hasOwn(result,key),'Unexpected or duplicate text parameter.'); result[key]=value; } return result;
};
const integer = (value,fallback,max) => { if(value===undefined) return fallback; ensure(/^\d+$/u.test(value) && Number.isSafeInteger(Number(value)) && Number(value)>=1 && Number(value)<=max,'Invalid text pagination.'); return Number(value); };
const breadcrumbs = (path,query='',pageSize=20) => '<nav class="catalogue-breadcrumbs" aria-label="Classement des textes">'+path.split('/').map((name,i)=>`<a href="${escape(folderHref(path.split('/').slice(0,i+1).join('/'),query,1,pageSize))}">${escape(name)}</a>`).join('')+'</nav>';
const shell = (title,content) => `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${escape(title)} — atelier privé</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/assets/archives-catalogue.css"></head><body class="catalogue-page archive-preexisting-page"><div class="page"><main class="catalogue-main"><header class="catalogue-hero"><div><p class="catalogue-kicker">Consultation privée</p><h1>${escape(title)}</h1></div><p>Textes préexistants conservés dans leur classement d’origine.</p></header><nav class="catalogue-actions" aria-label="Vues de l’atelier"><a href="/archives/catalogue/">Photographies et dossiers</a><a href="/archives/textes/">Textes préexistants</a><a href="/archives/">Lecteur d’archives</a></nav>${content}</main></div></body></html>`;
const notice = '<aside class="catalogue-notice"><strong>Texte préexistant · à relire</strong><p>Le fichier peut être une transcription, une note ou un document de travail. Sa lecture historique et ses droits restent à vérifier.</p></aside>';

export function renderPreexistingTexts(index,params=new URLSearchParams()) {
  const data=dataFor(index), request=parameters(params,['folder','query','page','page_size']);
  const folder=request.folder || 'CLEAN'; if(folder!=='CLEAN') logicalPath(folder);
  ensure(data.folders.has(folder),'Unknown private text folder.');
  const query=request.query ?? ''; ensure(query.length<=100 && validUnicode(query),'Text search too long.');
  const needle=query.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr');
  const matches=entry=>!needle || entry.logical_path.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr').includes(needle);
  const selected=data.folders.get(folder), matched=[...data.texts.values()].filter(matches);
  const children=[...selected.children].filter(path=>matched.some(entry=>entry.logical_path.startsWith(path+'/'))).map(path=>({...data.folders.get(path),kind:'folder'})).sort(compare);
  const files=selected.files.filter(matches).map(entry=>({kind:'file',path:entry.logical_path,name:entry.file_name,entry})).sort(compare);
  const units=[...children,...files], page=integer(request.page,1,500), size=integer(request.page_size,20,50), pages=Math.max(1,Math.ceil(units.length/size));
  ensure(page<=pages,'Text page outside results.');
  const cards=units.slice((page-1)*size,page*size).map(item=>item.kind==='folder' ? `<article class="catalogue-card"><p class="catalogue-kicker">Dossier du classement</p><h3><a href="${escape(folderHref(item.path,query,1,size))}">${escape(item.name)}</a></h3><p>${count(item.descendants)} fichiers texte dans ce dossier et ses sous-dossiers</p></article>` : `<article class="catalogue-card"><p class="catalogue-kicker">Fichier texte · à relire</p><h3 class="catalogue-photo-title"><a href="${escape(textHref(item.entry.object_id))}">${escape(item.name)}</a></h3><p>${item.entry.source_empty ? 'Fichier vide' : 'Texte original disponible'} · traduction française moderne absente</p><p class="catalogue-path">${escape(item.path)}</p></article>`).join('');
  const pagination='<nav class="catalogue-pagination" aria-label="Pagination des textes">'+(page>1 ? `<a href="${escape(folderHref(folder,query,page-1,size))}">Page précédente</a>`:'')+`<span>Page ${count(page)} sur ${count(pages)}</span>`+(page<pages ? `<a href="${escape(folderHref(folder,query,page+1,size))}">Page suivante</a>`:'')+'</nav>';
  return shell('Textes préexistants',notice+`<p>${count(data.texts.size)} fichiers accessibles · ${count(data.inventoryCount)} fichiers TXT inventoriés dans CLEAN.</p><form class="catalogue-search" method="get" action="/archives/textes/"><input type="hidden" name="folder" value="${escape(folder)}"><div class="catalogue-field catalogue-field--query"><label for="text-query">Rechercher un fichier ou un dossier</label><input type="search" id="text-query" name="query" maxlength="100" value="${escape(query)}"></div><div class="catalogue-field"><label for="text-size">Éléments par page</label><select id="text-size" name="page_size"><option value="20"${size===20?' selected':''}>20</option><option value="50"${size===50?' selected':''}>50 maximum</option></select></div><button type="submit">Rechercher</button></form>`+breadcrumbs(folder,query,size)+`<h2>${escape(selected.name)}</h2><p>${count(children.length)} sous-dossiers · ${count(files.length)} fichiers texte directement dans ce dossier.</p><section class="catalogue-results">${cards || '<p>Aucun fichier ne correspond à cette recherche.</p>'}</section>`+pagination);
}

export function renderPreexistingText(index,params) {
  const data=dataFor(index), request=parameters(params,['object_id']);
  ensure(OBJECT.test(request.object_id),'Exact text object ID required.');
  const entry=data.texts.get(request.object_id); if(!entry) return null;
  const folder=entry.logical_path.slice(0,entry.logical_path.lastIndexOf('/'));
  return shell(entry.file_name,notice+breadcrumbs(folder)+`<p class="catalogue-path">${escape(entry.logical_path)}</p><section aria-labelledby="original-heading"><h2 id="original-heading">Texte original</h2>${entry.source_empty ? '<p class="catalogue-notice">Fichier vide : aucun texte dans cette occurrence.</p>' : `<div class="archive-preexisting-literal" id="preexisting-text">${literalHtml(entry.text)}</div>`}</section><section><h2>Français moderne</h2><p>Aucune traduction française moderne disponible pour ce fichier.</p></section><details class="catalogue-provenance"><summary>Origine et statut du fichier</summary><dl>${[['Objet numérique',entry.object_id],['Occurrence textuelle',entry.occurrence_id],['Transcription',entry.transcription_id],['Objet numérique du texte',entry.text_digital_object_id],['SHA-256 source',entry.source_sha256],['Taille source',count(entry.source_byte_size)+' octets'],['Encodage',entry.source_encoding],['Provenance de l’encodage',entry.encoding_provenance.status],['État de lecture','preexisting-unreviewed · lecture historique non validée'],['Droits','unknown · consultation privée'],['SHA-256 de l’index',data.indexSha256],['SHA-256 du catalogue',data.coverageSha256]].map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><p>Aucun acte, document, lien photo, date ou identité historique attribué par ce raccord.</p></details>`);
}
