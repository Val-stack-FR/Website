import {readFile} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {digest,E108_FOLDER} from './e108-two-photo-adapter.mjs';
export const FOUR_PARENT_SHA='47f3dacee07ccaa0ab9d7c7d00f7fee91d5f4a96673bee9132a9b0f1927d5552';
export const NEW_E108_PHOTOS=Object.freeze([
 {number:13,filename:'13.jpg',id:'object:path-2c0bd5701f3a26bb0b87b867bb9de5bf242c83d45c5e1620fdde87ceb897ce83',sha:'e280c640cd9b4adc971c5f5d081e03c6f40270deae6b5a943b2b1872fc782908',bytes:2521248},
 {number:14,filename:'14.jpg',id:'object:path-dd7e54e1f27a4f6e429919bedf4d3ed75a62e4135ecdab64a308f8ace30c6241',sha:'95548d0bd1caed43b01449d80451e88de12e52c1c375e112286f54f3a7037cce',bytes:2815171}
].map(p=>Object.freeze({...p,path:E108_FOLDER+'/'+p.filename,route:'/archives/media/draft/'+p.sha+'.jpg',dimensions:[2976,3968],exif:1,transform:'identity'})));
export const fourPin=b=>({sha256:digest(b),bytes:b.length});
const TARGET_PINS=Object.freeze({
 'scripts/archives-integration/e108-two-photo-response-projection.mjs':'cd8ff76024f2780ad9aa027689cd1f69f0f500294af14ee39c0d34687805fbeb',
 'dist/assets/archives-e108-two-photo.js':'40d36c2c0197ddd01b952ced173f55a0b93c932a0c76a205d735e7b4760ee0e3',
 'dist/archives/catalogue/index.html':'3aeb2e7e7bc7673c292b056d61ceefc7e52f3ce6cedd7ca5de0d89c34067df94',
 'dist/archives/avancement/index.html':'1528fffe776dcdac33944049ac29172f86a62dd9c0fcb9ffa22e8a4193cb36f8'});
export function extendFourPhotoHelper(parent){
 const source=parent.toString('utf8'),anchor='\n].map(p=>Object.freeze(',pending="ensure((template.match(/aperçu à préparer/g)||[]).length===2,'13 and 14 remain pending');",ready="ensure((template.match(/aperçu à préparer/g)||[]).length===0,'four selected previews admitted');";
 assert.equal(source.split(anchor).length,2);assert.equal(source.split(pending).length,2);
 const entries=',\n'+NEW_E108_PHOTOS.map(p=>" {number:"+p.number+",filename:'"+p.filename+"',id:'"+p.id+"',sha:'"+p.sha+"',bytes:"+p.bytes+'}').join(',\n');
 const next=source.replace(anchor,entries+anchor).replace(pending,ready);assert.equal(next.replace(entries+anchor,anchor).replace(ready,pending),source);
 return {bytes:Buffer.from(next),entries,pending,ready};
}
export function extendFourPhotoClient(parent){const source=parent.toString('utf8'),before="!['11','12'].includes(button.dataset.e108Photo)",after="!['11','12','13','14'].includes(button.dataset.e108Photo)";assert.equal(source.split(before).length,2);const next=source.replace(before,after);assert.equal(next.replace(after,before),source);return Buffer.from(next);}
export function extendFourPhotoStatus(parent){
 const source=parent.toString('utf8'),old='Quatre fichiers sont réunis dans leur dossier d’origine. <strong>2 photos consultables sur 4</strong>. Les aperçus des vues 13 et 14 restent à préparer ; l’ordre physique et l’identité de l’acte sont à confirmer.',next='Quatre fichiers sont réunis dans leur dossier d’origine. <strong>4 photos consultables sur 4</strong>. L’ordre physique et l’identité de l’acte sont à confirmer.',oldCount='<p class="unit-note">23 photographies sont consultables avec zoom.</p>',newCount='<p class="unit-note">25 photographies sont consultables avec zoom.</p>';
 assert.equal(source.split(old).length,2);assert.equal(source.split(oldCount).length,2);assert(source.includes('<h3>E.108 — vues 11 à 14</h3><p class="state">Même acte probable, à confirmer</p><p>'+old+'</p>'));
 const result=source.replace(old,next).replace(oldCount,newCount);assert.equal(result.replace(next,old).replace(newCount,oldCount),source);
 const marker='<template id="agent-statusboard-metadata"';assert.equal(result.slice(result.indexOf(marker)),source.slice(source.indexOf(marker)));assert(result.slice(result.indexOf(marker)).includes('19 vues consultables avec zoom'));
 return Buffer.from(result);
}
export async function composeFourPhotoCurrentParent({parent,admission,independentReview,mediaRoot,baselineAssembly=null,allowDependencyRebase=false}){
 parent=resolve(parent);const assemblyBytes=await readFile(join(parent,'assembly.json')),assembly=JSON.parse(assemblyBytes),sources={},changes=new Map();
 if(digest(assemblyBytes)!==FOUR_PARENT_SHA){
  assert(allowDependencyRebase&&baselineAssembly,'Explicit dependency-only rebase requires frozen baseline assembly');
  const allowed=new Set(['package.json','package-lock.json','pnpm-lock.yaml','yarn.lock']);assert.deepEqual(Object.keys(assembly.files).sort(),Object.keys(baselineAssembly.files).sort());
  for(const [n,p]of Object.entries(baselineAssembly.files))if(!allowed.has(n))assert.deepEqual(assembly.files[n],p,'Non-dependency parent drift '+n);
  assert.equal(assembly.counts.consultable_jpeg_photo_views,23);
 }
 assert.equal(assembly.counts.consultable_jpeg_photo_views,23);
 const readParent=async name=>{const b=await readFile(join(parent,'site',name)),p=assembly.files[name];assert(p,name);assert.equal(digest(b),p.sha256,name);assert.equal(b.length,p.size_bytes,name);if(TARGET_PINS[name])assert.equal(digest(b),TARGET_PINS[name],name);sources[name]=fourPin(b);return b;};
 const goBytes=await readFile(join(admission,'verification.json')),go=JSON.parse(goBytes),reviewBytes=await readFile(join(independentReview,'verification.json')),review=JSON.parse(reviewBytes);
 assert.equal(go.passed,true);assert.equal(go.verdict,'GO_TWO_NEW_E108_DERIVATIVES_FOR_UI_PREPARATION');assert.equal(go.historical_confirmation,false);assert.equal(go.canonical_order,null);assert.equal(go.originals_opened,false);assert.equal(go.records.length,2);assert.equal(digest(reviewBytes),go.independent_review_sha256);assert.equal(review.passed,true);assert.deepEqual(review.blocking_findings,[]);assert.equal(review.originals_opened,0);
 const parentHelper=await readParent('scripts/archives-integration/e108-two-photo-response-projection.mjs'),extended=extendFourPhotoHelper(parentHelper);changes.set('scripts/archives-integration/e108-two-photo-response-projection.mjs',extended.bytes);changes.set('dist/assets/archives-e108-two-photo.js',extendFourPhotoClient(await readParent('dist/assets/archives-e108-two-photo.js')));
 const catalogue=await readParent('dist/archives/catalogue/index.html'),status=await readParent('dist/archives/avancement/index.html');changes.set('dist/archives/avancement/index.html',extendFourPhotoStatus(status));
 const oldModule=await import(pathToFileURL(join(parent,'site/scripts/archives-integration/e108-two-photo-response-projection.mjs')).href),baseHtml=oldModule.restoreE108TwoPhotoResponse(catalogue.toString('utf8'));
 const inheritedJPEGs={};for(const name of Object.keys(assembly.files).filter(n=>n.startsWith('dist/archives/')&&n.endsWith('.jpg'))){await readParent(name);inheritedJPEGs[name]=sources[name];}assert.equal(Object.keys(inheritedJPEGs).length,23);
 for(const photo of NEW_E108_PHOTOS){const item=go.records.find(r=>r.filename===photo.filename),proof=review.records.find(r=>r.filename===photo.filename);assert.equal(item.object_id,photo.id);assert.equal(item.derivative_sha256,photo.sha);assert.equal(item.bytes,photo.bytes);assert.deepEqual(item.dimensions,photo.dimensions);assert.equal(item.EXIF,1);assert.equal(item.root_physically_inspected_derivative,true);assert.equal(item.fresh_decoded_pixels_equal_independent_review,true);assert.equal(proof.source_object_id,photo.id);assert.equal(proof.derivative_sha256,photo.sha);assert.equal(proof.native_and_identity_display_receipts_match,true);
  const b=await readFile(join(mediaRoot,'media',photo.sha+'.jpg'));assert.deepEqual(fourPin(b),{sha256:photo.sha,bytes:photo.bytes});assert(!assembly.files['dist'+photo.route]);changes.set('dist'+photo.route,b);
  const before='<li data-ensemble-object-id="'+photo.id+'" data-ensemble-logical-path="'+photo.path+'"><h4>Vue '+photo.number+' · '+photo.filename+'</h4><p class="catalogue-muted">Photo inventoriée · aperçu à préparer</p></li>';assert.equal(catalogue.toString('utf8').split(before).length,2,'exact current member '+photo.filename);
 }
 for(const name of Object.keys(assembly.files).filter(n=>n.endsWith('.mjs')&&(n.startsWith('scripts/')||n.startsWith('api/')||n.startsWith('runtime/'))))await readParent(name);
 for(const name of ['runtime/archives/selected-data.json','dist/assets/archives-e108-two-photo.css','dist/assets/archives-hierarchy.js','dist/assets/archives-catalogue-ensemble.js'])await readParent(name);
 assert.equal(sources['runtime/archives/selected-data.json'].sha256,'44a70f324fc11ffc3019681b0f63fdc97469cba13d5b0c58fc9db558e780c97a');
 return {parent,assembly,assemblyBytes,sources,changes,baseHtml,catalogue,status,oldModule,readParent,inheritedJPEGs,admission:fourPin(goBytes),independentReview:fourPin(reviewBytes),go,review,extended};
}
export function rebaseFourPreviewRuntime(composition,helperPath){
 const name='scripts/archives-integration/publication-runtime.mjs',source=composition.runtimeBytes.toString('utf8'),imports=[];
 const b=Buffer.from(source.replace(/from '(\.\.?\/[^']+)'/g,(all,spec)=>{const path=spec==='./e108-two-photo-response-projection.mjs'?resolve(helperPath):resolve(dirname(join(composition.parent,'site',name)),spec),url=pathToFileURL(path).href,parentFile=spec==='./e108-two-photo-response-projection.mjs'?null:relative(join(composition.parent,'site'),path).replaceAll('\\','/');if(parentFile)assert(composition.sources[parentFile]);imports.push({specifier:spec,url,parent_file:parentFile});return "from '"+url+"'";}));
 let restore=b.toString('utf8');for(const item of imports)restore=restore.replace("from '"+item.url+"'","from '"+item.specifier+"'");assert.equal(restore,source);return {bytes:b,imports};
}
export {E108_FOLDER};
