import {createHash} from 'node:crypto';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {join,relative,isAbsolute,sep} from 'node:path';
import {prepareAnnexSearchShards,renderAnnexSearchShards} from './render-annex-search.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const check=(value,message)=>{if(!value)throw Error('Annex shards: '+message);};
const PIN=Object.freeze({handoff:'e1736d8cdcb8e061e6c8309d118e66333ab3f7a3efd77fa54c4310cc5becfdec',
  verification:'7a6ce313c9b8ed62192d890dc6f740bc52fd1246789976db54c90a16b0fc180b',
  manifest:'fdd501e42c4077bbd4c4504805ba31938db56f81093b1ce3198b2f5471390942',
  input:'b3ed15242ba42296c44c76f4d54530b4a397eabdde4522c41a3809d36cbb132a',
  core:'08796b0fcc4a35ab86a1ecd475af647f2b39bbd6c56fd32ef5aeb3a7c630d880',
  extension:'ce8ca7d1fca54066801207ed6b15297e6201945c6bf42c25f66a9d29fb152e36'});
const contexts=new WeakMap();
async function root(path){check(!(await lstat(path)).isSymbolicLink(),'directory link refused');return realpath(path);}
async function read(base,name){
  check(typeof name==='string' && !isAbsolute(name) && !/[\\:]/u.test(name) && name.split('/').every(x=>x && x!=='.' && x!=='..'),'unsafe file name');
  const file=join(base,name),info=await lstat(file),actual=await realpath(file),part=relative(base,actual);
  check(info.isFile() && !info.isSymbolicLink() && part && !isAbsolute(part) && part!=='..' && !part.startsWith('..'+sep) && info.size>0 && info.size<=2*1024*1024,'file boundary/type/budget drift');
  return readFile(file);
}
async function pinned(base,name,pin){const bytes=await read(base,name);check(sha(bytes)===pin,name+' pin drift');return JSON.parse(bytes);}
async function load({directory,reviewDirectory}){
  const source=await root(directory),review=await root(reviewDirectory);
  const manifest=await pinned(review,'run-manifest.json',PIN.manifest),input=await pinned(review,'input-manifest.json',PIN.input),verification=await pinned(review,'verification.json',PIN.verification);
  check(sha(await read(review,'HANDOFF.md'))===PIN.handoff,'handoff pin drift');
  const schema=JSON.parse(await read(review,'schema-validation.json')),closeout=JSON.parse(await read(review,'closeout.json'));
  check(manifest.operation==='review' && manifest.run_id==='annexes-10-review-20261004-v2' && manifest.inputs.manifest_sha256===PIN.input
    && manifest.validation.schema_valid===true && manifest.validation.output_hashes_verified===true && manifest.publication.status==='private'
    && manifest.outputs.length===7 && schema.passed===true && schema.errors.length===0 && closeout.passed===true && closeout.problems.length===0
    && closeout.hash_checks.length===7 && closeout.hash_checks.every(x=>x.checked===true && x.result==='match'),'review closeout drift');
  const prefix='data/private/coordinator-review/annexes-10-20261004-v2/',names=[];
  for(const output of manifest.outputs){check(output.uri.startsWith(prefix),'review output scope drift');const name=output.uri.slice(prefix.length);
    check(!name.includes('/') && !names.includes(name),'review duplicate/nesting drift');names.push(name);check(sha(await read(review,name))===output.sha256,'review output hash drift');}
  check(verification.result==='GO_PRIVATE_SEARCH_METADATA' && verification.exact_locators===200 && verification.mentions===20
    && verification.query_cases.length===11 && verification.old_mvp_f_byte_identical===4 && verification.historical_entities_resolved===0
    && verification.originals_read===0 && verification.rights==='unknown' && verification.human_review==='pending','review GO/state drift');
  const sourcePrefix='data/private/archive-import/mvp-f-annexes-10-20261003-v1/';
  for(const [name,pin] of [['query-index.json',PIN.core],['extension/query-index.json',PIN.extension]])
    check(input.files.some(x=>x.uri===sourcePrefix+name && x.sha256===pin),'review does not bind both exact source shards');
  const indexes=[await pinned(source,'query-index.json',PIN.core),await pinned(source,'extension/query-index.json',PIN.extension)];
  const model=prepareAnnexSearchShards(indexes),keys=model.cards.map(x=>x.number);
  check([...keys].sort().join(',')===[...verification.fiche_keys].sort().join(',') && indexes.reduce((n,x)=>n+x.locators.length,0)===200
    && indexes.reduce((n,x)=>n+x.entries.filter(entry=>entry.scope==='name').length,0)===20,'exact two-shard universe drift');
  const evidence={profile:'accepted-private-annex-shards/1',decision:verification.result,review_manifest_sha256:PIN.manifest,review_verification_sha256:PIN.verification,
    review_handoff_sha256:PIN.handoff,input_manifest_sha256:PIN.input,review_outputs:7,originals_read:false,csv_tables_read:false,historical_confirmation:false,
    rights_status:'unknown',human_review:'pending',publication_approved:false,counts:{shards:2,fiches:10,name_mentions:20,locators:200},
    shards:indexes.map((index,i)=>({name:i?'extension':'core',package_id:index.package_id,index_sha256:i?PIN.extension:PIN.core,fiche_keys:index.fiches.map(x=>x.fiche_n)}))};
  return {source,review,indexes,evidence};
}
export async function loadAnnexSearchShards(options){const data=await load(options),context=Object.freeze({});contexts.set(context,data);return context;}
function data(context){const value=contexts.get(context);check(value,'accepted shard context required');return value;}
export function acceptedAnnexEvidence(context){return structuredClone(data(context).evidence);}
export function acceptedAnnexModel(context){return prepareAnnexSearchShards(structuredClone(data(context).indexes));}
export function renderAcceptedAnnexSearch(context){return renderAnnexSearchShards(data(context).indexes);}
export async function revalidateAnnexSearchShards(context){const previous=data(context),current=await load({directory:previous.source,reviewDirectory:previous.review});
  check(JSON.stringify(current.evidence)===JSON.stringify(previous.evidence),'revalidated shard evidence drift');}
