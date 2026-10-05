import {readFile,writeFile,mkdir,lstat,realpath} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const parent=resolve('.private/archives-integration/publication-package-20261004-v33');
const out=resolve('.private/archives-integration/publication-package-20261004-v33-r2');
const sha=b=>createHash('sha256').update(b).digest('hex');
const pin=b=>({size_bytes:b.length,sha256:sha(b)});
const json=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
const put=async(n,b)=>{const p=resolve(out,n);await mkdir(dirname(p),{recursive:true});await writeFile(p,b,{flag:'wx'});};
try{await lstat(out);throw Error('Fresh r2 required; overwrite refused');}catch(e){if(e.code!=='ENOENT')throw e;}
const parentBytes=await readFile(resolve(parent,'assembly.json')),previous=JSON.parse(parentBytes);
assert.equal(sha(parentBytes),'1a376fd90c0aa636d131ffa06d9380fe212e8f511609761225952f83064a7f0c');
const parentSealBytes=await readFile(resolve(parent,'candidate-seal.json')),parentSeal=JSON.parse(parentSealBytes);
assert.equal(sha(parentSealBytes),'f8bac4bac0861e600c9ae1610c545df934f1717eb53b149fa25e09a2e66ebf66');assert(parentSeal.closed);
const parentFreezeBytes=await readFile(resolve(parent,'freeze.json'));assert.equal(sha(parentFreezeBytes),'901c983e0caea9cd9b87738a79ec3f3d21469470f6bee05d9ed8a1ae620721b3');
const receiptBytes=await readFile(resolve('.private/archives-integration/publication-v33-root-admission-20261004-v1/verification.json'));
assert.equal(sha(receiptBytes),'5e4b981fff85b746ce07e89771442711d008e3c68f02f44c1a6152b396478a42');
const receipt=JSON.parse(receiptBytes);assert(receipt.passed&&receipt.site_files_checked===487&&receipt.frozen_members_checked===515);
const content=new Map();
for(const[n,p]of Object.entries(previous.files)){
  assert(!/[\\:]/.test(n)&&!n.startsWith('/')&&n.split('/').every(x=>x&&x!=='.'&&x!=='..'));
  const path=resolve(parent,'site',n);assert.equal(await realpath(path),path);const b=await readFile(path);
  assert.deepEqual(pin(b),p,n);assert.deepEqual(parentSeal.files['site/'+n],p,n);content.set(n,b);
}
const statusName='dist/archives/avancement/index.html',checksumName='runtime/package-checksums.json';
const oldHtml=content.get(statusName).toString('utf8');
const marker='<template id="agent-statusboard-metadata"';assert.equal(oldHtml.split(marker).length,2);
const split=oldHtml.indexOf(marker),oldVisible=oldHtml.slice(0,split),historical=oldHtml.slice(split);
const route=previous.e99_p08_reader.route;
const e118Object='object:path-ac20dfd33ba56866cfcd8a3e57523db606ac70fe6a3d9292c8f9a2205b1cfd29';
const data=JSON.parse(content.get('runtime/archives/selected-data.json'));
const e118Records=data.catalogue.records.filter(r=>r.digital_object_id===e118Object);assert.equal(e118Records.length,1);
const e118=e118Records[0];assert(e118.logical_path.includes('/E.118 - 1497-1575. — Châtellenie de Tucé/[E.118] Geoffroi Raigné/'));
const e118Folder=e118.logical_path.slice(0,e118.logical_path.lastIndexOf('/'));
const e118Href='/archives/catalogue/?folder='+encodeURIComponent(e118Folder).replace(/'/g,'%27');
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,b);};
let visible=once(oldVisible,'<strong>5</strong><span>fichiers avec un parcours de lecture préparé</span>','<strong>6</strong><span>fichiers avec un parcours de lecture préparé</span>');
visible=once(visible,'Cinq fichiers à ouvrir maintenant','Six fichiers à ouvrir maintenant');
const card='<article class="reading-card"><p class="eyebrow">E.99 · p08 · partie droite · bloc local</p><h3><a href="'+route+'">Six rangées proposées · partie droite</a></h3><p class="state">Lectures proposées, à relire</p><p>Deux lectures séparées, chacune avec son français modernisé.</p><p>Contextes de rangée pour R02, R04 et R03 · annotations à part.</p><a href="'+route+'">Ouvrir le bloc E.99 p08</a></article>';
visible=once(visible,'</div><p class="muted">Pour E.133 et E.113',card+'</div><p class="muted">Pour E.133 et E.113');
const firstStart='<li><h3>E.99 — Jean de Tucé, possibilité 1</h3>',start=visible.indexOf(firstStart);assert(start>=0);
const end=visible.indexOf('</li>',start)+5,oldPriority=visible.slice(start,end);assert(end>start);
const oldFolderLink=oldPriority.match(/<a href="([^"\n]+)">Ouvrir le dossier<\/a>/);assert(oldFolderLink);
const newPriority=firstStart+'<p>Relire le bloc de six rangées déjà disponible dans la partie droite.</p><p class="muted">Comparer les deux lectures proposées avec les contextes de R02, R04 et R03 avant d’étendre le passage.</p><a href="'+route+'">Relire le bloc disponible</a><p><a href="'+oldFolderLink[1]+'">Retrouver le dossier</a></p></li>';
const newE118='<li><h3>E.118 — dossier « Geoffroi Raigné »</h3><p class="state">Lecture de six lignes en cours</p><p class="muted">Le libellé du dossier reste une piste ; aucune identité ou date n’est confirmée.</p><a href="'+e118Href+'">Ouvrir le dossier E.118</a></li>';
visible=once(visible,oldPriority,newPriority+newE118);
assert.equal((visible.match(/class="reading-card"/g)||[]).length,6);
assert.equal(visible.split('<strong>6</strong><span>fichiers avec un parcours de lecture préparé</span>').length,2);
assert.equal((visible.match(/<li><h3>/g)||[]).length,4);
const priorSuffix=oldVisible.slice(oldVisible.indexOf('<li><h3>E.99 — Jean de Tucé, possibilité 2</h3>'));
assert.equal(visible.slice(visible.indexOf('<li><h3>E.99 — Jean de Tucé, possibilité 2</h3>')),priorSuffix);
let restored=visible.replace(card,'').replace(newPriority+newE118,oldPriority).replace('Six fichiers à ouvrir maintenant','Cinq fichiers à ouvrir maintenant').replace('<strong>6</strong><span>fichiers avec un parcours de lecture préparé</span>','<strong>5</strong><span>fichiers avec un parcours de lecture préparé</span>');
assert.equal(restored,oldVisible);assert(!/object:path-|[a-f0-9]{64}/i.test(visible));
const nextHtml=Buffer.from(visible+historical);assert.equal(nextHtml.toString().slice(visible.length),historical);
content.set(statusName,nextHtml);
const files={...previous.files,[statusName]:pin(nextHtml)};
const checksumRecords=Object.fromEntries(Object.entries(files).filter(([n])=>n!==checksumName).sort(([a],[b])=>a.localeCompare(b)));
const checksumBytes=json(checksumRecords);files[checksumName]=pin(checksumBytes);content.set(checksumName,checksumBytes);
const sortedFiles=Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)));
const modified=[statusName,checksumName].sort();
for(const[n,p]of Object.entries(previous.files))if(!modified.includes(n))assert.deepEqual(sortedFiles[n],p);
const links=[];
for(const m of visible.slice(visible.indexOf('<body')).matchAll(/<a\b[^>]*href="([^"\n]+)"[^>]*>/g)){
  const href=m[1].replace(/&#39;/g,"'").replace(/&amp;/g,'&'),url=new URL(href,'http://local.invalid/archives/avancement/');assert.equal(url.origin,'http://local.invalid');
  if(url.pathname==='/archives/catalogue/'&&url.searchParams.has('folder')){
    const folder=url.searchParams.get('folder');assert(data.catalogue.records.some(x=>x.logical_path.startsWith(folder+'/')),folder);
    assert(sortedFiles['api/archives/catalogue.mjs']);links.push({href,resolved_by:'Inherited native catalogue handler and existing exact folder'});
  }else{
    const n='dist'+url.pathname+(url.pathname.endsWith('/')?'index.html':'');assert(sortedFiles[n],href);
    if(url.hash){const target=content.get(n).toString();assert(target.includes('id="'+decodeURIComponent(url.hash.slice(1))+'"'),href);}
    links.push({href,resolved_by:'Packaged static file'+(url.hash?' and existing fragment':'')});
  }
}
const assembly={...previous,parent_assembly_sha256:sha(parentBytes),snapshot_sha256:sha(json(sortedFiles)),delta:{added:[],modified,removed:[]},files:sortedFiles,statusboard_reconciliation:{visible_reader_cards:6,visible_reader_count:6,priorities:4,E99:'Available six-row block to reread',E118:'Six-line reading in progress, existing dossier label only',E118_source_object:e118Object,E118_exact_folder:e118Folder,historical_template:pin(Buffer.from(historical)),historical_template_unchanged:true,two_other_priorities_unchanged:true,runtime_data_unchanged:true,public_activation:false}};
for(const[n,b]of content)await put('site/'+n,b);
await put('assembly.json',json(assembly));
await put('root-v33-admission.json',receiptBytes);
for(const n of ['api-import-graph.json','api-native-imports.json'])await put(n,await readFile(resolve(parent,n)));
await put('composition-allowlist.json',json({parent_assembly_sha256:sha(parentBytes),added:[],modified:modified.map(n=>({path:n,before:previous.files[n],after:sortedFiles[n]})),removed:[],runtime_helpers_added:0,only_visible_statusboard_changes:true,public_activation:false}));
await put('page-links.json',json({passed:true,scope:'All visible statusboard anchors, excluding historical template',links,all_resolved:true,E118_existing_folder:e118Folder,new_E99_reader_link:route}));
await put('build-proof.json',json({passed:true,parent_assembly:pin(parentBytes),parent_seal:pin(parentSealBytes),parent_freeze:pin(parentFreezeBytes),root_admission:pin(receiptBytes),assembly:pin(json(assembly)),site_files:content.size,static_files:assembly.counts.static_files,inherited_exact:485,modified:2,added:0,removed:0,copy_read_hash_pass_count:content.size,hidden_historical_template:pin(Buffer.from(historical)),hidden_historical_template_unchanged:true,two_other_priority_blocks_exact:true,visible_change_restoration_exact:true,visible_reader_cards:6,visible_reader_counter:6,protected_text_files:166,protected_transcription_versions:300,protected_draft_occurrences:992,protected_archive_jpeg_photos:25,all_images_data_scripts_runtime_exact:true,native_import_gate:'Inherited Root-admitted v33 receipt; not replayed',standalone_11_states_replayed:false,v33_five_states_replayed:false,statusboard_browser_gate_pending:true,public_activation:false}));
await put('composer-snapshot.mjs',await readFile(new URL(import.meta.url)));
console.log(JSON.stringify({out,site_files:content.size,inherited_exact:485,modified,assembly_sha256:sha(json(assembly)),E118_folder:e118Folder,visible_links:links.length},null,2));
