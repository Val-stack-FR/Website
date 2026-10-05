import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadMediaBundle } from '../archives-integration/media-preview.mjs';

const contexts=new WeakMap();
const ensure=(condition,message)=>{if(!condition)throw new Error('Reader media release: '+message);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const MANIFEST_SHA='499fbd384020fd315b70331f3f5ec71534b7ff615230ef6bde1faa222e3f5c20';
export async function loadReaderMediaRelease(directory) {
  // Consume the coordinator's frozen verifier without changing its method or files.
  const bundle=await loadMediaBundle(directory);
  const bytes=await readFile(join(directory,'media-manifest.json'));
  ensure(sha(bytes)===MANIFEST_SHA,'prepared manifest changed.');
  const manifest=JSON.parse(bytes), selections=[];
  for(const item of bundle.overlay.media) {
    const source=manifest.objects.find(entry=>entry.source_object_id===item.view_id);
    ensure(source && source.source_object_id===item.source_digital_object_id && source.derivative_sha256===item.sha256 && source.derivative_byte_size===item.byte_size && source.approved_review_id===bundle.overlay.approved_review_id && source.decoded_pixels_equal===true && source.image_data.auxiliary_metadata_absent===true && source.image_data.trailer_absent===true && Object.entries(source.transformations).every(([key,value])=>value===(key==='metadata_and_auxiliary_removal')),'source/derivative method binding differs.');
    selections.push(Object.freeze({source_object_id:source.source_object_id,source_sha256:source.source_sha256,source_byte_size:source.source_byte_size,view_id:item.view_id,approved_review_id:source.approved_review_id,derivative_object_id:item.digital_object_id,derivative_sha256:item.sha256,derivative_byte_size:item.byte_size,media_url:item.media_url,width:item.dimensions.width,height:item.dimensions.height,reference_frame:'native-coded-raster',raster_transform:'none',rights_status:'unknown',rights_review:'pending',publication_approved:false,historical_orientation:'unknown'}));
  }
  ensure(selections.length===2,'exactly two Monbezon images required.');
  const token=Object.freeze({version:'reader-verified-media-release/1'});
  contexts.set(token,{bundle,selections:Object.freeze(selections),candidateId:bundle.overlay.candidate_id});return token;
}
const get=token=>{const value=contexts.get(token);ensure(value,'verified media context required.');return value;};
export const readerMediaSelection=token=>({version:'reader-verified-media-selection/1',checksums_sha256:get(token).bundle.checksumSha256,publication_status:'preparation-not-activated',rights_review:'pending',publication_approved:false,bindings:get(token).selections.map(item=>({...item}))});
export const readerMediaRoutes=token=>new Map([...get(token).bundle.routes].map(([path,bytes])=>[path,{bytes:Buffer.from(bytes),contentType:'image/jpeg',size:bytes.length}]));

export function bindReaderMedia(viewModel,token) {
  const data=get(token);ensure(viewModel.sourcePublication?.approvedForPublication===false,'pending-rights reader required.');
  const seen=new Set();
  const dossiers=viewModel.dossiers.map(dossier=>({...dossier,images:dossier.images.map(image=>{
    const binding=data.selections.find(item=>item.view_id===image.viewId);
    if(!binding)return image;
    ensure(dossier.candidateId===data.candidateId && image.digitalObjectId===binding.source_object_id && image.sha256===binding.source_sha256 && image.reviewId===binding.approved_review_id && image.associationStatus==='accepted' && !seen.has(image.viewId),'accepted source view identity drift.');seen.add(image.viewId);
    return Object.freeze({...image,sourceImageObjectId:binding.source_object_id,sourceSha256:binding.source_sha256,derivativeSha256:binding.derivative_sha256,derivativeObjectId:binding.derivative_object_id,mediaUrl:binding.media_url,width:binding.width,height:binding.height,referenceFrame:binding.reference_frame,rasterTransform:'none',rightsStatus:'unknown',publicationStatus:'preparation-not-activated'});
  })}));
  ensure(seen.size===2,'both accepted source views must be present.');return {...viewModel,dossiers};
}
export function bindOccurrenceMedia(model,token) {
  const binding=get(token).selections.find(item=>item.view_id===model.viewId);
  ensure(binding && binding.source_object_id===model.sourceId && binding.source_sha256===model.sourceSha256 && binding.width===model.width && binding.height===model.height,'H05 source/native frame mismatch.');
  return {...model,mediaUrl:binding.media_url,derivativeSha256:binding.derivative_sha256,derivativeObjectId:binding.derivative_object_id,referenceFrame:binding.reference_frame};
}
export function verifyReaderMediaHtml(html,selection) {
  ensure(selection.version==='reader-verified-media-selection/1' && selection.bindings.length===2,'exact release selection required.');
  const tags=[...String(html).matchAll(/<img\b[^>]*\bdata-source-view-id="[^"]+"[^>]*>/gu)].map(match=>match[0]);
  ensure(tags.length===2,'two typed source/derivative image tags required.');
  for(const item of selection.bindings) {
    const tag=tags.find(tag=>tag.includes(`data-source-view-id="${item.view_id}"`));
    ensure(tag && tag.includes(`data-source-sha256="${item.source_sha256}"`) && tag.includes(`data-derivative-sha256="${item.derivative_sha256}"`) && tag.includes(`src="${item.media_url}"`) && tag.includes(`width="${item.width}"`) && tag.includes(`height="${item.height}"`) && !String(html).includes('/__archive_media/'+item.source_sha256),'rendered source/derivative binding differs.');
  }
  return true;
}
