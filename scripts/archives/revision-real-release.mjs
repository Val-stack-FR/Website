import {readFile,lstat,realpath} from 'node:fs/promises';
import {join,relative,isAbsolute,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {projectRevisionJoin} from './revision-join.mjs';

const check=(value,message)=>{if(!value)throw Error('Revision real release: '+message);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),contexts=new WeakMap();
const PINS={review:'29801e9dd285a105a912842c86563f42e42b76b0806eed93ef5ae47232512a0a',checksums:'d1dd8eb04207cc1571762385b708c301179c2937202114f7bcdc0721d5936c75',export:'63a74acb6dd978508bda767b97c06d25115bff5b4ae7511da06b3ab42c6fcb4f',binding:'19cffd1e24c956f3014421f50a420875b7652653fb7851d8c33943000a866c1a',input:'072e734d0ffb11d25a60ddc29691f344ddd5d9cfcb39bf00d71c7f3d84816ef5',run:'5c94e2f78f180fca6759f89d8a7fca4b7ddd4f62f42cd08f29e9fe5c26703160',parentCloseout:'e2ac5b6657e9a026fe191ee105bc62a1589318c6ed0a3649f77fcb75362b1436'};
async function physical(path){check(!(await lstat(path)).isSymbolicLink(),'directory link refused');return realpath(path);}
async function bounded(base,name,pin,max=4*1024*1024){
 check(/^[A-Za-z0-9_.-]+$/u.test(name),'unsafe closed filename');const file=join(base,name),stat=await lstat(file),actual=await realpath(file),part=relative(base,actual);
 check(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=max&&part&&!isAbsolute(part)&&part!=='..'&&!part.startsWith('..'+sep),'closed file boundary/type/budget drift');
 const bytes=await readFile(file);if(pin)check(sha(bytes)===pin,'pin drift: '+name);return bytes;
}
function subset(options,ids){
 const selected=new Set(ids),payload=structuredClone(options.payload),bindingProof=structuredClone(options.bindingProof);
 payload.fragments=payload.fragments.filter(value=>value.selection==='excluded'||selected.has(value.id));payload.versions=payload.versions.filter(value=>selected.has(value.fragment_id));
 const vids=new Set(payload.versions.map(value=>value.id));payload.replacement_proposals=payload.replacement_proposals.filter(value=>vids.has(value.from_version_id)&&vids.has(value.to_version_id));
 bindingProof.phase='pilot';bindingProof.bindings=bindingProof.bindings.filter(value=>selected.has(value.new_fragment_id));bindingProof.included_fragment_count=2;bindingProof.version_count=6;bindingProof.proposal_count=payload.replacement_proposals.length;bindingProof.accepted_e113_uncertainty_bindings=bindingProof.accepted_e113_uncertainty_bindings.filter(value=>vids.has(value.version_id));bindingProof.accepted_e113_uncertainty_count=bindingProof.accepted_e113_uncertainty_bindings.length;
 return {...structuredClone(options),phase:'pilot',payload,bindingProof,expectedIncludedIds:[...ids],fragmentBindings:options.fragmentBindings.filter(value=>selected.has(value.fragmentId))};
}
async function load({harnessRoot,parentDirectory,parentCloseoutPath}){
 const harness=await physical(harnessRoot),review=await physical(join(harness,'data/private/coordinator-review/h07-real-20261004-v1')),full=await physical(join(harness,'data/private/revision-bridge/h07-20261004-real-full-v4')),adapter=await physical(join(harness,'data/private/revision-bridge/h07-20261004-real-adapter-v4'));
 const checksumsBytes=await bounded(review,'review-checksums.json',PINS.checksums),checksums=JSON.parse(checksumsBytes);
 check(checksums.format==='review-package-checksums/1.0.0'&&Array.isArray(checksums.files)&&JSON.stringify(checksums.files.map(value=>value.path).sort())===JSON.stringify(['HANDOFF.md','verification.json','verify_h07.py','test-results.txt'].sort()),'independent review closed scope drift');
 for(const entry of checksums.files){const bytes=await bounded(review,entry.path,entry.sha256);check(bytes.length===entry.bytes,'review byte length drift');}
 const reviewBytes=await bounded(review,'verification.json',PINS.review),verification=JSON.parse(reviewBytes),coverage=verification.coverage;
 check(verification.format==='h07-real-independent-review/1.0.0'&&verification.status.startsWith('GO private reader export')&&verification.full_outputs.all_hashes_match===true&&verification.full_outputs.closeout_passed===true&&verification.pilot_outputs.all_hashes_match===true&&verification.pilot_outputs.closeout_passed===true&&verification.full_preflight_manifest_bound===true&&verification.pilot_preflight_manifest_bound===true&&verification.targeted_mapper_tests.passed===9&&verification.targeted_mapper_tests.failed===0,'independent private real GO drift');
 check(coverage.E133===97&&coverage.E113===3&&coverage.included_fragments===100&&coverage.excluded_fragments===1&&coverage.excluded_id==='segment:review-e113-e03'&&coverage.versions===300&&coverage.proposals===130&&coverage.E113_occurrences_preserved===21&&coverage.core_ambiguities_emitted===4&&coverage.E113_occurrences_left_unresolved===17,'accepted H07 coverage drift');
 check(verification.full_outputs.reader_export_sha256===PINS.export&&verification.full_outputs.binding_proof_sha256===PINS.binding&&verification.full_input_manifest_sha256===PINS.input,'independent input/output pin binding drift');
 const sourceBuffers=new Map();for(const [name,pin]of [['reader-export.json',PINS.export],['binding-proof.json',PINS.binding],['run-manifest.json',PINS.run]])sourceBuffers.set(name,await bounded(full,name,pin));
 const manifest=JSON.parse(sourceBuffers.get('run-manifest.json'));check(manifest.phase==='full'&&manifest.scope==='derived-draft'&&manifest.validation_passed===true&&manifest.input_manifest_sha256===PINS.input&&manifest.rights==='unknown'&&manifest.publication==='private'&&manifest.human_review==='pending'&&manifest.canonical_closeout===false,'accepted full run manifest drift');
 for(const output of manifest.outputs){const prefix='data/private/revision-bridge/h07-20261004-real-full-v4/';check(output.relative_path.startsWith(prefix),'full output path scope drift');const name=output.relative_path.slice(prefix.length),bytes=await bounded(full,name,output.sha256);check(bytes.length===output.byte_size,'full output size drift');sourceBuffers.set(name,bytes);}
 const inputBytes=await bounded(adapter,'full-input-manifest.json',PINS.input),payload=JSON.parse(sourceBuffers.get('reader-export.json')),bindingProof=JSON.parse(sourceBuffers.get('binding-proof.json'));
 check(payload.input_pins.manifest_sha256===PINS.input,'export manifest binding drift');
 const parent=await physical(parentDirectory),closeoutBytes=await readFile(parentCloseoutPath);check(sha(closeoutBytes)===PINS.parentCloseout,'parent closeout drift');const closeout=JSON.parse(closeoutBytes);check(closeout.closed_files.length===37,'sealed parent scope drift');
 for(const entry of closeout.closed_files)check(sha(await readFile(entry.file))===entry.sha256,'sealed parent file drift');
 const parentProofBytes=await bounded(parent,'integration-proof.json'),parentProof=JSON.parse(parentProofBytes),parentBuffers=new Map();
 check(parentProof.version==='reader-media-integration/1'&&parentProof.originals_read===false&&parentProof.historical_confirmation===false&&parentProof.publication_approved===false&&parentProof.counts.base_dossiers===2&&parentProof.counts.draft_dossiers===2,'closed parent reader state drift');
 for(const [name,pin]of Object.entries(parentProof.output_hashes))parentBuffers.set(name,await bounded(parent,name,pin,32*1024*1024));
 const derivativeSelection=JSON.parse(parentBuffers.get('draft-derivative-selection.json')),draftProof=JSON.parse(parentBuffers.get('draft-derivative-proof.json'));
 check(draftProof.counts.selected_derivatives===17&&draftProof.counts.occurrences===992&&draftProof.counts.proposals===89,'existing draft corpus cardinality drift');
 const imageBindings=[];
 for(const source of payload.sources.filter(value=>value.kind==='derived-image')){
  check(source.derived_from_ids.length===1,'explicit single photo source required');const photo=payload.sources.find(value=>value.id===source.derived_from_ids[0]);check(photo?.kind==='source-photo'&&photo.logical_uri.startsWith('urn:phd:source-object:'),'explicit source object URI required');
  const objectId=photo.logical_uri.slice('urn:phd:source-object:'.length),existing=derivativeSelection.bindings.find(value=>value.source_object_id===objectId);
  check(existing&&existing.source_sha256===photo.sha256&&existing.derivative_sha256===source.sha256&&source.logical_uri==='urn:phd:sealed-derivative:sha256:'+source.sha256,'H07 full-frame derivative is outside the existing admitted photo set');
  imageBindings.push({photoSourceId:photo.id,derivedImageSourceId:source.id,sourceObjectId:objectId});
 }
 const fragmentBindings=[];
 for(const binding of bindingProof.bindings){
  const e133=binding.lot==='E133',accepted=e133?verification.e133_exact_bindings.find(value=>value.new_fragment_id===binding.new_fragment_id&&value.legacy_id===binding.legacy_id):verification.e113_exact_bindings.find(value=>value.legacy_id===binding.legacy_id&&value.old_segment_id===binding.old_segment_id);
  check(accepted,'explicit independently checked legacy crosswalk missing');
  fragmentBindings.push({fragmentId:binding.new_fragment_id,lotId:e133?'lois-e133':'jeanne-e113',legacyId:binding.legacy_id,baselineLegacyId:e133?accepted.baseline_legacy_id:accepted.old_segment_id,label:'Passage '+(e133?fragmentBindings.filter(value=>value.lotId==='lois-e133').length+1:fragmentBindings.filter(value=>value.lotId==='jeanne-e113').length+1)});
 }
 const options={payload,bindingProof,phase:'full',fragmentBindings,imageBindings,derivativeSelection,expectedIncludedIds:fragmentBindings.map(value=>value.fragmentId),expectedExcludedIds:['fragment:rbh07-e113-excluded-e03']};
 projectRevisionJoin(options);
 const pilotIds=['fragment:rbh07-e133-p1-entry-06-l03',fragmentBindings.find(value=>value.legacyId==='segment:review-e113-p01')?.fragmentId];check(pilotIds.every(value=>options.expectedIncludedIds.includes(value)),'independent 1+1 pilot selection missing');projectRevisionJoin(subset(options,pilotIds));
 const evidence={decision:'GO_PRIVATE_H07_V4',review_sha256:PINS.review,review_checksums_sha256:PINS.checksums,export_sha256:PINS.export,binding_proof_sha256:PINS.binding,full_input_manifest_sha256:PINS.input,full_run_manifest_sha256:PINS.run,parent_closeout_sha256:PINS.parentCloseout,parent_integration_sha256:sha(parentProofBytes),originals_read:false,images_decoded:false,publication_approved:false,historical_confirmation:false,rights:'unknown',human_review:'pending',pilot_selection:pilotIds,full_counts:{included:100,excluded:1,versions:300,proposals:130,accepted_e113_occurrences:21},pin_label_resolution:'The root message called 072e... a run-manifest pin; independent verification and run manifest bind it as the full INPUT manifest. The closed run-manifest pin is 5c94... .'};
 return {options,pilotIds,parentBuffers,parentProofBytes,sourceBuffers,inputBytes,reviewBytes,checksumsBytes,evidence,paths:{harnessRoot:harness,parentDirectory:parent,parentCloseoutPath}};
}
export async function loadRevisionJoinContext(paths){const value=await load(paths),context=Object.freeze({});contexts.set(context,value);return context;}
function data(context){const value=contexts.get(context);check(value,'admitted branded H07 context required');return value;}
export function revisionJoinEvidence(context){return structuredClone(data(context).evidence);}
export function revisionJoinOptions(context,phase){const value=data(context);check(['pilot','full'].includes(phase),'explicit phase required');return phase==='pilot'?subset(value.options,value.pilotIds):structuredClone(value.options);}
export function revisionJoinClosedBuffers(context){const value=data(context);return {parent:new Map([...value.parentBuffers].map(([name,bytes])=>[name,Buffer.from(bytes)])),parentProof:Buffer.from(value.parentProofBytes),source:new Map([...value.sourceBuffers].map(([name,bytes])=>[name,Buffer.from(bytes)])),review:Buffer.from(value.reviewBytes),checksums:Buffer.from(value.checksumsBytes),input:Buffer.from(value.inputBytes)};}
export async function revalidateRevisionJoin(context){const previous=data(context),fresh=await load(previous.paths);check(JSON.stringify(fresh.evidence)===JSON.stringify(previous.evidence),'accepted evidence changed');}
