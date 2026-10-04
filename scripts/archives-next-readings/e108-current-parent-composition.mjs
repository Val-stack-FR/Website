import {readFile} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {digest,TWO_PHOTOS,E108_FOLDER} from './e108-two-photo-adapter.mjs';
export const CURRENT_PARENT_SHA='b5508c432ec18116f4073481e00ee36d9ad941e45cadd9ed38c7db028d58a25b';
export const PRIOR_SEAL_SHA='54af0fa3b489a2a25943bd640c176d4521965cba61b4f615dec9abefb7968b09';
export const pin=b=>({sha256:digest(b),bytes:b.length});
const statusBefore='Quatre fichiers sont réunis dans leur dossier d’origine. Leurs aperçus photographiques restent à préparer ; l’ordre physique et l’identité de l’acte sont à confirmer.';
const statusAfter='Quatre fichiers sont réunis dans leur dossier d’origine. <strong>2 photos consultables sur 4</strong>. Les aperçus des vues 13 et 14 restent à préparer ; l’ordre physique et l’identité de l’acte sont à confirmer.';
export function patchE108Statusboard(bytes){
 const html=bytes.toString('utf8');assert.equal(html.split(statusBefore).length,2,'unique current E108 status paragraph');
 assert(html.includes('<h3>E.108 — vues 11 à 14</h3><p class="state">Même acte probable, à confirmer</p><p>'+statusBefore+'</p>'));
 const next=html.replace(statusBefore,statusAfter);assert.equal(next.replace(statusAfter,statusBefore),html);return Buffer.from(next);
}
export function patchE108Runtime(bytes){
 const source=bytes.toString('utf8'),anchor="import { projectE108CatalogueResponse } from './e108-human-response-projection.mjs';",addition="\nimport { projectE108TwoPhotoResponse } from './e108-two-photo-response-projection.mjs';";
 assert.equal(source.split(anchor).length,2);const before=source.match(/^  return projectE108CatalogueResponse[^\r\n]+;/m)?.[0];assert(before);assert.equal(source.split(before).length,2);
 const after='  return projectE108TwoPhotoResponse(url, '+before.slice('  return '.length,-1)+');';
 const next=source.replace(anchor,anchor+addition).replace(before,after);assert.equal(next.replace(addition,'').replace(after,before),source);
 return {bytes:Buffer.from(next),edits:{anchor,addition,before,after}};
}
export async function composeE108CurrentParent({parent,prior,admission}){
 parent=resolve(parent);prior=resolve(prior);admission=resolve(admission);const sources={},changes=new Map();
 const assemblyBytes=await readFile(join(parent,'assembly.json'));assert.equal(digest(assemblyBytes),CURRENT_PARENT_SHA);const assembly=JSON.parse(assemblyBytes);
 const readParent=async name=>{const bytes=await readFile(join(parent,'site',name)),expected=assembly.files[name];assert(expected,name);assert.equal(digest(bytes),expected.sha256,name);assert.equal(bytes.length,expected.size_bytes,name);sources[name]=pin(bytes);return bytes;};
 const sealBytes=await readFile(join(prior,'seal.json'));assert.equal(digest(sealBytes),PRIOR_SEAL_SHA);const seal=JSON.parse(sealBytes),readPrior=async name=>{const bytes=await readFile(join(prior,name));assert.deepEqual(pin(bytes),seal.files[name],name);return bytes;};
 const admissionBytes=await readFile(join(admission,'verification.json')),go=JSON.parse(admissionBytes),admissionHandoff=await readFile(join(admission,'HANDOFF.md'));
 assert.equal(go.passed,true);assert.equal(go.verdict,'GO-TWO-SELECTED-E108-DERIVATIVES-FOR-UI-INTEGRATION');assert.equal(go.historical_confirmation,false);assert.equal(go.canonical_act_id,null);assert.equal(go.physical_order_confirmed,false);assert.equal(go.records.length,2);assert.equal(go.integrated_trusted_touch_gate_pending,true);
 const projectionBytes=await readPrior('e108-two-photo-response-projection.mjs');changes.set('scripts/archives-integration/e108-two-photo-response-projection.mjs',projectionBytes);
 const runtimeParent=await readParent('scripts/archives-integration/publication-runtime.mjs'),runtime=patchE108Runtime(runtimeParent);changes.set('scripts/archives-integration/publication-runtime.mjs',runtime.bytes);
 const catalogueParent=await readParent('dist/archives/catalogue/index.html'),template=catalogueParent.toString('utf8').match(/<template id="e108-ensemble-template"[\s\S]*?<\/template>\n/)?.[0];assert.equal(template,(await readPrior('inputs/parent-template.html')).toString('utf8'),'current template still exact; never copy old full HTML');
 const projection=await import(pathToFileURL(join(prior,'e108-two-photo-response-projection.mjs')).href),catalogue=projection.projectE108TwoPhotoResponse('/archives/catalogue/',catalogueParent.toString('utf8'));assert.equal(projection.restoreE108TwoPhotoResponse(catalogue),catalogueParent.toString('utf8'));changes.set('dist/archives/catalogue/index.html',Buffer.from(catalogue));
 const statusParent=await readParent('dist/archives/avancement/index.html');changes.set('dist/archives/avancement/index.html',patchE108Statusboard(statusParent));
 changes.set('dist/assets/archives-e108-two-photo.css',await readPrior('e108-two-photo.css'));changes.set('dist/assets/archives-e108-two-photo.js',await readPrior('e108-two-photo.js'));
 for(const photo of TWO_PHOTOS){const record=go.records.find(r=>r.filename===photo.filename);assert.equal(record?.source_object_id,photo.id);assert.equal(record.derivative_sha256,photo.sha);assert.deepEqual(record.native_dimensions,photo.dimensions);assert.equal(record.exif,1);assert.equal(record.transform,'identity');assert.equal(record.root_derivative_visually_inspected,true);const bytes=await readPrior('media/'+photo.sha+'.jpg');assert.deepEqual(pin(bytes),{sha256:photo.sha,bytes:photo.bytes});changes.set('dist'+photo.route,bytes);}
 // Only code/data and the affected pages/assets are read. Other selected photos
 // and reading artifacts are inherited through the exact eight-file overlay.
 for(const name of Object.keys(assembly.files).filter(n=>n.endsWith('.mjs')&&(n.startsWith('scripts/')||n.startsWith('api/')||n.startsWith('runtime/'))))await readParent(name);
 const dataBytes=await readParent('runtime/archives/selected-data.json');assert.equal(digest(dataBytes),'44a70f324fc11ffc3019681b0f63fdc97469cba13d5b0c58fc9db558e780c97a');
 for(const name of ['dist/assets/archives-hierarchy.js','dist/assets/archives-catalogue-ensemble.js','dist/assets/archives-catalogue-ensemble.css','dist/assets/archives-public-statusboard.css'])await readParent(name);
 assert.equal(changes.size,8);const whitelist=[...changes].map(([target,bytes])=>({target,action:assembly.files[target]?'replace':'add',before:assembly.files[target]?{sha256:assembly.files[target].sha256,bytes:assembly.files[target].size_bytes}:null,after:pin(bytes)}));assert.equal(whitelist.filter(w=>w.action==='replace').length,3);
 const preservation=Object.fromEntries(Object.entries(assembly.files).filter(([n])=>!changes.has(n)).map(([n,p])=>[n,{sha256:p.sha256,bytes:p.size_bytes,disposition:'inherited byte-identical; absent from mutation whitelist'}]));
 assert(Object.keys(preservation).some(n=>n.includes('/p09/gauche/reperes/')));assert(Object.keys(preservation).some(n=>n.includes('archives-p09-left21/')));assert(Object.keys(preservation).some(n=>n.includes('api/archives/')));
 return {parent,assembly,assemblyBytes,priorSeal:pin(sealBytes),admission:{verification:pin(admissionBytes),handoff:pin(admissionHandoff),go},sources,changes,whitelist,preservation,runtimeEdits:runtime.edits,readParent,dataBytes,template,statusParent,catalogueParent,projection};
}
export async function rebasePreviewRuntime(composition,projectionPath){
 const name='scripts/archives-integration/publication-runtime.mjs',source=composition.changes.get(name).toString('utf8'),rebased=[];
 const bytes=Buffer.from(source.replace(/from '(\.\.?\/[^']+)'/g,(all,specifier)=>{
  const target=specifier==='./e108-two-photo-response-projection.mjs'?resolve(projectionPath):resolve(dirname(join(composition.parent,'site',name)),specifier),url=pathToFileURL(target).href;rebased.push({specifier,url,parent_file:specifier==='./e108-two-photo-response-projection.mjs'?null:relative(join(composition.parent,'site'),target).replaceAll('\\','/')});return "from '"+url+"'";
 }));
 let restored=bytes.toString('utf8');for(const item of rebased){restored=restored.replace("from '"+item.url+"'","from '"+item.specifier+"'");if(item.parent_file)assert(composition.sources[item.parent_file],'verified current parent import');}
 assert.equal(restored,source);return {bytes,imports:rebased,private_only:true};
}
export {E108_FOLDER,TWO_PHOTOS};
