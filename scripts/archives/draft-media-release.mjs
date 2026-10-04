import { createHash } from 'node:crypto';
import { lstat,readFile,readdir,realpath } from 'node:fs/promises';
import { join,dirname,relative,isAbsolute,sep } from 'node:path';
import { createDraftDerivativeBindings,draftBindingsDigest } from './draft-derivative-bindings.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const check=(value,message)=>{if(!value)throw new Error('Draft media release: '+message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const PIN=Object.freeze({checksums:'3ee1c1b464d29b5224b179c66633168f8d8d0d4d61312d9c8afdd52e2e1b6f45',
  receipt:'eaffdd97a0ed4e4e6d09b05cb1b417382dae1f47f09695006ff7ae949cf9e605',
  acceptance_manifest:'1e6a18264f849440e7b238ef6f936036b0bd0dbc23689dea933fe174a9c34e30',
  source_proof:'46c9d05d36a652452a11f77eabed8c7805d6693fc192fbe5deab8a20b96f3c5f',
  union_manifest:'7dd385c1dcbbe8afd31ed4641f13bdecd57765a0111f11a947085de8e6271c5b',
  app1:'1c1884790244b1e30eb945ce58bc93b2e64f390b22a1f9352de2800e9d09402e',
  review:'bf1536c2bfdb98a76eb951c0b5a1d0ab84beb9ec5e7311d53398043d1623828f',
  composition_handoff:'c232af51feca55f408d58e83c3ec15bdfc72e2c71a35e0484e9062239b527c5e',
  composition_verification:'a14065dcaee63db9ad23cb8bf53243e07c41e043c6f1f7fd9d87528f65903418',
  composition_manifest:'43bd1ad487cf45179e66cd542ddf9a51f1d9e1ee74869d136623586f6c40da85',
  composition_input:'909d8ac34841f06ba736ab07922cfd32485bc5606f7188cb0b078d2d2fbfa702'});
const RELEASE='draft-combined-media-release:3fcc105aacdaa979cbbc03c071a54b2d';
export const DRAFT_MEDIA_PILOT_IDS=Object.freeze([
  'object:path-6a629bcc6d41fe871b1a1d7e1656135a3acf49e86dcd837322afddc1d7f378fe', // EXIF omitted
  'object:path-20b766cffd6f36f8f661b63c9b5f971b80f55a72ea13b35b6c0b0788b69a4f84', // EXIF 8
  'object:path-0a717a87e0371fe9110b2365d115dd4a6d2d53d6fe711e66080d3256fcfec8c5' // APP1 EXIF 1
]);
const acceptedContexts=new WeakMap();
const compositionContexts=new WeakMap();
async function safeRoot(path){check(!(await lstat(path)).isSymbolicLink(),'directory link refused');return realpath(path);}
async function safeRead(root,name,maximum=1024*1024){
  check(typeof name==='string' && !isAbsolute(name) && !/[\\:]/u.test(name) && name.split('/').every(part=>part && part!=='.' && part!=='..'),'unsafe file name');
  const file=join(root,name),info=await lstat(file),actual=await realpath(file),part=relative(root,actual);
  check(info.isFile() && !info.isSymbolicLink() && part && !isAbsolute(part) && part!=='..' && !part.startsWith('..'+sep)
    && info.size>0 && info.size<=maximum,'file type, boundary or budget drift');
  return readFile(file);
}
async function pinnedJson(root,name,pin){const bytes=await safeRead(root,name);check(sha(bytes)===pin,name+' pin drift');return JSON.parse(bytes);}
async function loadCompositionReview(directory,expectedBindings){
  const root=await safeRoot(directory),review=await pinnedJson(root,'verification.json',PIN.composition_verification);
  const final=await pinnedJson(root,'run-manifest-final.json',PIN.composition_manifest);
  await pinnedJson(root,'input-manifest.json',PIN.composition_input);
  check(sha(await safeRead(root,'HANDOFF.md'))===PIN.composition_handoff,'composition handoff pin drift');
  const schema=JSON.parse(await safeRead(root,'schema-final.json')),closeout=JSON.parse(await safeRead(root,'closeout-final.json'));
  check(schema.passed===true && schema.manifest_sha256===PIN.composition_manifest && closeout.passed===true
    && closeout.problems.length===0 && closeout.hash_checks.length===10 && closeout.hash_checks.every(item=>item.checked===true && item.result==='match')
    && final.operation==='review' && final.run_id==='coordinator-review-combined-drafts-17-20261004-v1'
    && final.inputs.manifest_sha256===PIN.composition_input && final.outputs.length===10
    && final.validation.schema_valid===true && final.validation.output_hashes_verified===true,'composition closeout drift');
  const prefix='data/private/coordinator-review/combined-drafts-17-20261004-v1/';
  const names=[];
  for(const item of final.outputs){check(item.uri.startsWith(prefix),'composition output scope drift');const name=item.uri.slice(prefix.length);
    check(!name.includes('/') && !names.includes(name),'composition output duplicate/nesting drift');names.push(name);
    check(sha(await safeRead(root,name))===item.sha256,'composition closed output drift');}
  check(review.review_id===final.run_id && review.decision==='GO-TECHNIQUE-BOUNDED-COMPOSITION'
    && review.input_manifest_sha256===PIN.composition_input && review.allowlisted_input_count===259 && review.allowlisted_inputs_rehashed_exactly===259
    && review.originals_opened===false && review.source_pixels_opened_or_decoded===false && review.derivative_decoder_used===false
    && review.composition_tests.count===11 && review.composition_tests.passed===true
    && review.union.candidate_files===23 && review.union.jpeg_count===17 && review.union.json_count===6
    && review.union.candidate_checksums_sha256===PIN.checksums && review.union.final_run_manifest_sha256===PIN.union_manifest
    && review.union.sealed_source_derivative_proof_sha256===PIN.source_proof && review.union.repeat_byte_identical===true
    && review.union.source_binding_count===17 && review.union.unique_source_object_ids===17 && review.union.unique_source_hashes===17 && review.union.unique_derivative_hashes===17
    && review.acceptance_gate.receipt_sha256===PIN.receipt && review.acceptance_gate.receipt_run_manifest_sha256===PIN.acceptance_manifest
    && review.acceptance_gate.app1_review_pin===PIN.app1 && review.acceptance_gate.app1_review_artifacts_pin===PIN.review
    && review.acceptance_gate.technical_acceptance_granted_for_exact_union_pin===true && review.acceptance_gate.frozen_candidate_pending_gate_fields_preserved===true
    && review.acceptance_gate.human_approval==='pending' && review.acceptance_gate.rights==='unknown' && review.acceptance_gate.publication==='inactive'
    && review.bridge_comparison.image_binding_count===17 && review.bridge_comparison.exact_source_id_sha_size_and_lot_match===true && review.bridge_comparison.canonical_view_claims===0
    && review.historical_refusals.v02_records===6 && review.historical_refusals.explicit_replacements===6
    && review.historical_refusals.historical_records_exact===true && review.historical_refusals.refusal_history_erased===false
    && review.candidate_statuses.rights==='unknown' && review.candidate_statuses.human_review==='pending'
    && review.candidate_statuses.approved_for_publication===false && review.candidate_statuses.region_or_bbox_changes===false,'composition GO binding/state drift');
  const rows=review.union.source_bindings;check(rows.length===17 && new Set(rows.map(item=>item.source_object_id)).size===17,'composition tuple cardinality drift');
  for(const expected of expectedBindings){const actual=rows.find(item=>item.source_object_id===expected.source_object_id);
    check(actual && Object.entries(expected).every(([key,value])=>same(actual[key],value)),'composition exact source/derivative tuple drift');}
  return {root,evidence:Object.freeze({decision:review.decision,verification_sha256:PIN.composition_verification,manifest_sha256:PIN.composition_manifest,
    input_manifest_sha256:PIN.composition_input,handoff_sha256:PIN.composition_handoff,candidate_files:23,source_bindings:17,closed_outputs:10})};
}
function minimalOrientationSegment(orientation){
  const buffer=Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000000000000000000','hex');
  buffer.writeUInt16LE(orientation,28);return buffer;
}
function jpegHeader(bytes,orientation,width,height){
  check(bytes.readUInt16BE(0)===0xffd8 && bytes.readUInt16BE(bytes.length-2)===0xffd9,'JPEG envelope/trailer drift');
  let offset=2,dimensions=null,exif=0;
  while(offset<bytes.length-2){
    check(bytes[offset]===0xff,'JPEG marker drift');const marker=bytes[offset+1],length=bytes.readUInt16BE(offset+2),end=offset+2+length;
    check(length>=2 && end<=bytes.length,'JPEG segment bounds');
    if(marker===0xda)break;
    if(marker===0xe1){check(orientation!==null && bytes.subarray(offset,end).equals(minimalOrientationSegment(orientation)),'non-minimal orientation EXIF');exif++;}
    if(marker===0xe0)check(bytes.subarray(offset+4,offset+9).equals(Buffer.from('JFIF\0')),'non-JFIF APP0');
    check(!(marker>=0xe2 && marker<=0xef) && marker!==0xfe,'auxiliary metadata remains');
    if([0xc0,0xc1,0xc2].includes(marker)){check(!dimensions && length>=8,'SOF drift');dimensions=[bytes.readUInt16BE(offset+7),bytes.readUInt16BE(offset+5)];}
    offset=end;
  }
  check(same(dimensions,[width,height]) && exif===(orientation===null?0:1),'coded dimensions or EXIF presence drift');
}
export async function loadDraftMediaRelease({directory,acceptanceDirectory,compositionReviewDirectory,selectedObjectIds=DRAFT_MEDIA_PILOT_IDS}){
  check(selectedObjectIds.length!==17 || compositionReviewDirectory,'independent composition GO required before seventeen-view activation');
  const root=await safeRoot(directory),accepted=await safeRoot(acceptanceDirectory);
  const receipt=await pinnedJson(accepted,'acceptance-receipt.json',PIN.receipt),final=await pinnedJson(accepted,'run-manifest-final.json',PIN.acceptance_manifest);
  check(receipt.receipt_version==='atelier-tuce-combined-draft-acceptance/0.4.1' && receipt.technical_acceptance_granted===true
    && receipt.app1_independent_review==='passed-technical-bounded' && receipt.accepted_union?.checksums_sha256===PIN.checksums
    && receipt.accepted_union.release_id===RELEASE && receipt.accepted_union.source_objects===17 && receipt.accepted_union.candidate_files===23
    && receipt.accepted_union.sealed_source_derivative_proof_sha256===PIN.source_proof
    && receipt.accepted_union.final_manifest_sha256===PIN.union_manifest && receipt.accepted_union.upstream_app1_checksums_sha256===PIN.app1
    && receipt.review?.decision==='GO-DELTA-TECHNIQUE-BOUNDED' && receipt.review.artifact_checksums_sha256===PIN.review,'independent GO binding drift');
  const schema=JSON.parse(await safeRead(accepted,'schema-final.json')),closeout=JSON.parse(await safeRead(accepted,'closeout-final.json'));
  check(schema.passed===true && schema.manifest_sha256===PIN.acceptance_manifest && closeout.passed===true
    && closeout.problems.length===0 && closeout.hash_checks.length===10 && closeout.hash_checks.every(item=>item.checked===true && item.result==='match')
    && final.outputs.length===10 && final.validation.schema_valid===true && final.validation.output_hashes_verified===true,'acceptance closeout drift');
  const prefix='data/private/media-release/combined-drafts-17-acceptance-20261003-v1/';
  for(const item of final.outputs){check(item.uri.startsWith(prefix),'acceptance output scope drift');const name=item.uri.slice(prefix.length);check(!name.includes('/'),'acceptance output nesting drift');check(sha(await safeRead(accepted,name))===item.sha256,'acceptance closed output drift');}
  const sourceProof=await pinnedJson(dirname(root),'sealed-source-derivative-proof.json',PIN.source_proof);
  await pinnedJson(dirname(root),'run-manifest-final.json',PIN.union_manifest);
  const checksums=await pinnedJson(root,'checksums.json',PIN.checksums),files=new Map();
  check(Object.keys(checksums).length===22,'closed candidate hashes required');
  const entries=await readdir(root,{withFileTypes:true});check(entries.length===7 && entries.every(item=>item.name==='media'?item.isDirectory():item.isFile())
    && !(await lstat(join(root,'media'))).isSymbolicLink(),'candidate root tree drift');
  const mediaEntries=await readdir(join(root,'media'),{withFileTypes:true});check(mediaEntries.length===17 && mediaEntries.every(item=>item.isFile()),'closed seventeen JPEGs required');
  const actualNames=[...entries.filter(item=>item.name!=='media').map(item=>item.name),...mediaEntries.map(item=>'media/'+item.name)].sort();
  check(same(actualNames,['checksums.json',...Object.keys(checksums)].sort()),'candidate file tree drift');
  for(const [name,expected] of Object.entries(checksums)){const bytes=await safeRead(root,name,name.startsWith('media/')?32*1024*1024:1024*1024);check(sha(bytes)===expected,'candidate byte hash drift');files.set(name,bytes);}
  const json=name=>JSON.parse(files.get(name)),overlay=json('reader-overlay.json'),manifest=json('media-manifest.json'),allow=json('media-allowlist.json'),credits=json('credits-provenance.json'),quarantine=json('quarantine.json');
  check(same([...allow.files].sort(),actualNames) && allow.files.length===23 && allow.media.length===17
    && overlay.media.length===17 && manifest.objects.length===17 && credits.objects.length===17 && sourceProof.objects.length===17
    && quarantine.objects.length===0 && quarantine.historical_objects.length===6 && quarantine.replacements.length===6,'selection/provenance cardinality drift');
  for(const document of [overlay,manifest,allow,credits,quarantine])check(document.release_id===RELEASE && document.approved_for_publication===false
    && document.human_review==='pending' && document.publication_status==='preparation-not-activated'
    && document.acceptance_gate.acceptance_granted===false && document.acceptance_gate.app1_independent_review==='pending','frozen preparation state drift');
  const bytesByDerivative=new Map(),bindings=[];
  for(const image of overlay.media){
    const item=manifest.objects.find(item=>item.source_object_id===image.source_object_id),proof=sourceProof.objects.find(item=>item.source_object_id===image.source_object_id),credit=credits.objects.find(item=>item.source_object_id===image.source_object_id),allowed=allow.media.find(item=>item.source_object_id===image.source_object_id);
    check(item && proof && credit && allowed && image.object_id===image.source_object_id && image.canonical_view_id===null && image.approved_review_id===null
      && same(image.derivative_of_ids,[image.source_object_id]) && image.digital_object_id==='object:media-'+image.sha256
      && image.media_path==='media/'+image.sha256+'.jpg' && image.media_type==='image/jpeg','source/derivative identity drift');
    for(const record of [image,item,proof,credit,allowed])check(record.source_sha256===image.source_sha256,'source SHA drift');
    for(const record of [image,item,credit])check(record.lot_id===image.lot_id && record.link_status==='candidate-folder-only'
      && record.reading_status==='machine-draft' && record.rights_status==='unknown' && record.approved_review_id===null,'lot or candidate state drift');
    check(item.derivative_sha256===image.sha256 && proof.derivative_sha256===image.sha256 && credit.derivative_sha256===image.sha256 && allowed.sha256===image.sha256
      && item.derivative_byte_size===image.byte_size && allowed.byte_size===image.byte_size && proof.derivative_byte_size===image.byte_size
      && item.reencoding===false && item.raster_transformation==='none' && item.decoded_raster_pixels_equal===true && item.exif_display_pixels_equal===true
      && Object.values(item.canonical_refs).every(value=>value===null) && credit.canonical_view_id===null && credit.credit_status==='pending' && credit.diffusion_authorization==='unknown'
      && proof.upstream_original_hash_proof.bytes_unchanged===true && proof.upstream_original_hash_proof.sha256_before===image.source_sha256 && proof.upstream_original_hash_proof.sha256_after===image.source_sha256
      && proof.upstream_pixel_proof.raster.decoded_pixels_equal===true && proof.upstream_pixel_proof.display.decoded_pixels_equal===true,'derivative proof or review state drift');
    const orientation=image.orientation,number=orientation.derivative_numeric;
    check(same(orientation,item.orientation) && same(orientation,proof.orientation) && orientation.derivative_tag_present===(number!==null)
      && orientation.raster_transform==='none' && orientation.raster_frame==='native-coded-raster' && orientation.reading_bbox_modified===false
      && image.reading_bbox_modified===false && image.upstream_region_frame_reconciliation==='pending','orientation/region evidence drift');
    const bytes=files.get(image.media_path),{width,height}=image.native_dimensions;check(bytes && bytes.length===image.byte_size,'JPEG byte size drift');
    jpegHeader(bytes,number,width,height);bytesByDerivative.set(image.sha256,bytes);
    bindings.push({candidate_view_id:null,canonical_view_id:null,lot_id:image.lot_id,source_object_id:image.source_object_id,source_sha256:image.source_sha256,
      derivative_object_id:image.digital_object_id,derivative_sha256:image.sha256,derivative_byte_size:image.byte_size,
      coded_width:width,coded_height:height,display_width:orientation.display_dimensions_if_exif_honored[0],display_height:orientation.display_dimensions_if_exif_honored[1],exif_orientation:number});
  }
  for(const replacement of quarantine.replacements){const image=overlay.media.find(item=>item.source_object_id===replacement.source_object_id),historical=quarantine.historical_objects.find(item=>item.source_object_id===replacement.source_object_id),review=receipt.review.source_bindings.find(item=>item.source_object_id===replacement.source_object_id);
    check(image && historical && review && replacement.source_sha256===image.source_sha256 && replacement.replacement_derivative_sha256===image.sha256
      && historical.source_sha256===image.source_sha256 && historical.file_emitted===false && review.source_sha256===image.source_sha256 && review.lot_id===image.lot_id,'historical refusal/replacement binding drift');}
  check(selectedObjectIds.length===17?same([...selectedObjectIds].sort(),bindings.map(item=>item.source_object_id).sort()):same(selectedObjectIds,DRAFT_MEDIA_PILOT_IDS),'exact pilot/full selection required');
  const compositionBindings=bindings.map(item=>({source_object_id:item.source_object_id,source_sha256:item.source_sha256,
    source_byte_size:manifest.objects.find(value=>value.source_object_id===item.source_object_id).source_byte_size,
    lot_id:item.lot_id,derivative_sha256:item.derivative_sha256,derivative_byte_size:item.derivative_byte_size,
    native_dimensions:{height:item.coded_height,width:item.coded_width},display_dimensions_if_exif_honored:[item.display_width,item.display_height],derivative_orientation:item.exif_orientation}));
  const composition=selectedObjectIds.length===17 ? await loadCompositionReview(compositionReviewDirectory,compositionBindings) : null;
  const context=createDraftDerivativeBindings({bindings,expectedBindingsSha256:draftBindingsDigest(bindings),bytesByDerivative,selectedObjectIds});
  acceptedContexts.set(context,Object.freeze({version:'accepted-private-draft-media/1',checksums_sha256:PIN.checksums,receipt_sha256:PIN.receipt,
    acceptance_manifest_sha256:PIN.acceptance_manifest,source_proof_sha256:PIN.source_proof,independent_review_sha256:PIN.review,
    historical_refusals:6,replacements:6,originals_read:false,pixels_decoded:false,canonical_view_ids:null,human_review:'pending',rights_status:'unknown',publication_approved:false,
    ...(composition ? {composition_review:composition.evidence} : {})}));
  if(composition)compositionContexts.set(context,{root:composition.root,bindings:compositionBindings});
  return context;
}
export function acceptedDraftMediaEvidence(context){const value=acceptedContexts.get(context);check(value,'accepted bundle context required');return {...value};}
export async function revalidateDraftMediaComposition(context){
  const evidence=acceptedDraftMediaEvidence(context),composition=compositionContexts.get(context);
  if(evidence.composition_review){check(composition,'composition context required');const current=await loadCompositionReview(composition.root,composition.bindings);
    check(same(current.evidence,evidence.composition_review),'composition evidence drift');}
  else check(!composition,'unexpected composition context');
}
