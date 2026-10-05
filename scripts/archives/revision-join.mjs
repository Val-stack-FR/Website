import {createHash} from 'node:crypto';

const check=(value,message)=>{if(!value)throw Error('Revision join: '+message);};
const sha=/^[a-f0-9]{64}$/u,id=/^[a-z][a-z0-9:._-]{2,159}$/u;
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');
export const REVISION_EDITIONS=['first-draft','rereading','modern-french'];
const labels={'first-draft':'premier brouillon',rereading:'relecture','modern-french':'français modernisé'};
function index(values,label){check(Array.isArray(values),'missing '+label);const result=new Map();for(const value of values){check(id.test(value?.id??'')&&!result.has(value.id),'duplicate/invalid '+label);result.set(value.id,value);}return result;}
function state(value){check(value?.reading==='machine-draft'&&value.human_review==='pending'&&value.rights==='unknown'&&value.publication==='private','state promotion refused');}
function span(value,text){const points=Array.from(text);check(value?.units==='unicode-codepoints-half-open'&&Number.isSafeInteger(value.start)&&Number.isSafeInteger(value.end)&&value.start>=0&&value.end>=value.start&&value.end<=points.length&&points.slice(value.start,value.end).join('')===value.exact_text,'version-relative Unicode span drift');}
function region(value,lot){
 check(value?.region_frame==='local-oriented-display-pixels'&&value.region&&typeof value.region==='object'&&!Array.isArray(value.region),'documentary oriented region required');
 const r=value.region,fields=lot==='lois-e133'?['bbox_xywh','scope','local_view_id','crop_id','native_bbox_xywh','native_to_display','display_dimensions','crop_sha256']:['rect_xyxy','scope','native_dimensions_observed','display_dimensions_observed','exif_orientation_observed','working_crop_sha256'];
 check(JSON.stringify(Object.keys(r).sort())===JSON.stringify([...fields].sort())&&typeof r.scope==='string'&&r.scope.length>0&&r.scope.length<=1000,'documentary region field scope drift');
 const four=vector=>Array.isArray(vector)&&vector.length===4&&vector.every(n=>Number.isSafeInteger(n)&&n>=0);
 const opaque=value=>value!==null&&((typeof value==='object'&&JSON.stringify(value).length<=4000)||(typeof value==='string'&&value.length>0&&value.length<=4000));
 if(lot==='lois-e133')check(four(r.bbox_xywh)&&r.bbox_xywh[2]>0&&r.bbox_xywh[3]>0&&four(r.native_bbox_xywh)&&r.native_bbox_xywh[2]>0&&r.native_bbox_xywh[3]>0&&typeof r.local_view_id==='string'&&r.local_view_id.length>0&&typeof r.crop_id==='string'&&r.crop_id.length>0&&sha.test(r.crop_sha256)&&opaque(r.native_to_display)&&opaque(r.display_dimensions),'E133 documentary region drift');
 else check(four(r.rect_xyxy)&&r.rect_xyxy[2]>r.rect_xyxy[0]&&r.rect_xyxy[3]>r.rect_xyxy[1]&&opaque(r.native_dimensions_observed)&&opaque(r.display_dimensions_observed)&&[null,1,2,3,4,5,6,7,8].includes(r.exif_orientation_observed)&&sha.test(r.working_crop_sha256),'E113 documentary region drift');
 // Matrices and dimension metadata have no narrower published shape here.
 // They are required, bounded, opaque and pinned by admission, never applied.
}
function locator(value,version,source){
 check(value?.span?.units==='unicode-codepoints-half-open'&&value.span.exact_text===version.text_exact&&Number.isSafeInteger(value.span.start)&&Number.isSafeInteger(value.span.end)&&value.span.start>=0&&value.span.end-value.span.start===Array.from(version.text_exact).length,'source locator Unicode drift');
 if(value.kind==='json-string'){
  // The hash belongs to the containing JSON string, which may be longer than
  // this version's slice. Exact absolute offsets are inherited from the admitted
  // binding proof; they cannot be reassigned to an associated raw text file.
  check(typeof value.json_pointer==='string'&&value.json_pointer.startsWith('/')&&!/~(?:[^01]|$)/u.test(value.json_pointer)&&value.byte_span===null&&sha.test(value.container_text_sha256_utf8),'JSON string locator drift');
 }else{
  check(value.kind==='utf8-text'&&value.json_pointer===null&&value.container_text_sha256_utf8===source.sha256&&Number.isSafeInteger(value.byte_span?.start)&&Number.isSafeInteger(value.byte_span?.end)&&value.byte_span.start>=0&&value.byte_span.end-value.byte_span.start===version.utf8_byte_length,'UTF-8 text locator drift');
 }
}

// This pure projection is not an admission gate. The caller must first admit
// the exact export and explicit crosswalk under a new independent real GO.
// It never reads source files, copies a missing edition or reconstructs a text.
export function projectRevisionJoin({payload,bindingProof,phase,fragmentBindings,imageBindings,derivativeSelection,expectedIncludedIds,expectedExcludedIds}){
 check(payload?.format==='reader-transcription-versions/0.1.0'&&payload.scope==='derived-draft'&&payload.read_only===true,'real read-only export required');
 check(['pilot','full'].includes(phase),'explicit pilot/full phase required');state(payload.status);
 check(JSON.stringify(payload.display_order)===JSON.stringify(REVISION_EDITIONS)&&JSON.stringify(payload.display_labels)===JSON.stringify(labels),'edition order/labels drift');
 check(Array.isArray(payload.canonical_decisions)&&payload.canonical_decisions.length===0&&Array.isArray(payload.human_memory)&&payload.human_memory.length===0,'human decision/memory refused');
 const count=phase==='pilot'?2:100;
 check(Array.isArray(expectedIncludedIds)&&expectedIncludedIds.length===count&&new Set(expectedIncludedIds).size===count&&Array.isArray(expectedExcludedIds)&&expectedExcludedIds.length>=1&&new Set(expectedExcludedIds).size===expectedExcludedIds.length&&!expectedExcludedIds.some(value=>expectedIncludedIds.includes(value)),'independent selection drift');
 const sources=index(payload.sources,'source'),fragments=index(payload.fragments,'fragment'),versions=index(payload.versions,'version'),proposals=index(payload.replacement_proposals,'proposal');
 check(fragments.size===expectedIncludedIds.length+expectedExcludedIds.length&&versions.size===count*3,'closed fragment/version universe drift');
 for(const source of sources.values())check(['source-photo','derived-image','derived-text'].includes(source.kind)&&sha.test(source.sha256)&&source.simulation===false&&source.rights_status==='unknown'&&['local-bytes','pinned-metadata'].includes(source.hash_verification)&&Array.isArray(source.derived_from_ids)&&source.derived_from_ids.every(value=>sources.has(value)),'real source descriptor drift');
 const ancestry=new Map(),visiting=new Set();
 function touchesImage(sourceId){if(ancestry.has(sourceId))return ancestry.get(sourceId);check(!visiting.has(sourceId),'source graph cycle');visiting.add(sourceId);const source=sources.get(sourceId);let value=source.kind!=='derived-text';for(const parent of source.derived_from_ids)value=touchesImage(parent)||value;visiting.delete(sourceId);ancestry.set(sourceId,value);return value;}
 for(const source of sources.values())touchesImage(source.id);
 check(bindingProof?.format==='h07-exact-binding-proof/1.0.0'&&bindingProof.phase===phase&&bindingProof.passed===true&&bindingProof.included_fragment_count===count&&bindingProof.excluded_fragment_count===expectedExcludedIds.length&&bindingProof.version_count===versions.size&&bindingProof.proposal_count===proposals.size&&bindingProof.image_decoding_performed===false&&bindingProof.text_normalization_performed===false&&Array.isArray(bindingProof.canonical_decisions)&&bindingProof.canonical_decisions.length===0&&Array.isArray(bindingProof.human_memory)&&bindingProof.human_memory.length===0&&bindingProof.rights==='unknown'&&bindingProof.publication==='private'&&bindingProof.human_review==='pending','linked exact-binding proof drift');
 check(Array.isArray(bindingProof.bindings)&&bindingProof.bindings.length===count&&Array.isArray(bindingProof.accepted_e113_uncertainty_bindings)&&bindingProof.accepted_e113_uncertainty_bindings.length===bindingProof.accepted_e113_uncertainty_count&&(phase!=='full'||bindingProof.accepted_e113_uncertainty_count===21),'linked E113 occurrence coverage drift');
 check(Array.isArray(fragmentBindings)&&fragmentBindings.length===count&&Array.isArray(imageBindings),'explicit bounded crosswalk required');
 const bindings=new Map();
 for(const binding of fragmentBindings){check(expectedIncludedIds.includes(binding.fragmentId)&&!bindings.has(binding.fragmentId)&&['lois-e133','jeanne-e113'].includes(binding.lotId)&&typeof binding.legacyId==='string'&&binding.legacyId.length>0&&typeof binding.baselineLegacyId==='string'&&binding.baselineLegacyId.length>0&&typeof binding.label==='string'&&binding.label.length>0&&binding.label.length<=200,'fragment crosswalk drift');bindings.set(binding.fragmentId,binding);}
 // Two new excerpts can reference distinct spans of the same old source. A
 // shared old reference is not an identity merge or a new reader-fragment ID.
 check(fragmentBindings.filter(value=>value.lotId==='lois-e133').length===(phase==='pilot'?1:97)&&fragmentBindings.filter(value=>value.lotId==='jeanne-e113').length===(phase==='pilot'?1:3),'lot selection drift');
 check(derivativeSelection?.version==='private-draft-derivative-bindings/1'&&Array.isArray(derivativeSelection.bindings)&&derivativeSelection.bindings.length===17&&Array.isArray(derivativeSelection.selected_object_ids)&&derivativeSelection.selected_object_ids.length===17&&new Set(derivativeSelection.selected_object_ids).size===17,'existing full photo selection required');
 const photos=new Map();
 for(const photo of derivativeSelection.bindings){check(!photos.has(photo.source_object_id)&&derivativeSelection.selected_object_ids.includes(photo.source_object_id)&&sha.test(photo.source_sha256)&&sha.test(photo.derivative_sha256)&&photo.derivative_object_id==='object:media-'+photo.derivative_sha256&&photo.canonical_view_id===null,'existing photo identity drift');photos.set(photo.source_object_id,photo);}
 const imageMap=new Map();
 for(const binding of imageBindings){
  const key=binding.photoSourceId+'|'+binding.derivedImageSourceId,photo=sources.get(binding.photoSourceId),derived=sources.get(binding.derivedImageSourceId),existing=photos.get(binding.sourceObjectId);
  check(!imageMap.has(key)&&photo?.kind==='source-photo'&&derived?.kind==='derived-image'&&existing&&photo.sha256===existing.source_sha256&&derived.sha256===existing.derivative_sha256&&derived.derived_from_ids.includes(photo.id),'explicit photo/source/derivative crosswalk drift');
  imageMap.set(key,existing);
 }
 const grouped=new Map(expectedIncludedIds.map(value=>[value,[]]));
 for(const version of versions.values()){
  state(version.status);check(version.entity_id===null&&version.human_decision===null&&grouped.has(version.fragment_id)&&REVISION_EDITIONS.includes(version.edition)&&version.label===labels[version.edition]&&id.test(version.revision_key??''),'version identity/edition promotion');
  check(typeof version.text_exact==='string'&&hash(version.text_exact)===version.text_sha256_utf8&&Buffer.byteLength(version.text_exact,'utf8')===version.utf8_byte_length,'exact text/hash/bytes drift');
  const source=sources.get(version.source_id);check(source?.kind==='derived-text','text provenance required');locator(version.source_locator,version,source);
  if(version.edition==='first-draft')check(!touchesImage(source.id),'old text has an inferred photo/image ancestor');
  check(Array.isArray(version.legacy_refs)&&version.legacy_refs.includes(bindings.get(version.fragment_id).legacyId),'version legacy crosswalk drift');
  check(Array.isArray(version.ambiguities),'ambiguities required');for(const ambiguity of version.ambiguities){check(ambiguity.entity_id===null&&ambiguity.reading_status==='unresolved'&&ambiguity.identification_status==='unresolved'&&Array.isArray(ambiguity.alternatives)&&ambiguity.alternatives.length>=2,'ambiguity promotion');span(ambiguity.span,version.text_exact);}
  check(Array.isArray(version.image_evidence)&&version.image_evidence.length<=13&&(version.edition==='first-draft'?version.image_evidence.length===0:version.image_evidence.length>=1),'photo evidence contract drift');
  for(const image of version.image_evidence){const existing=imageMap.get(image.photo_source_id+'|'+image.derived_image_source_id),lot=bindings.get(version.fragment_id).lotId;check(existing&&existing.lot_id===lot&&image.canonical_view_id===null&&image.simulation!==true,'photo must use the existing same-lot full frame');region(image,lot);}
  grouped.get(version.fragment_id).push(version);
 }
 const included=[];
 for(const fragment of fragments.values()){
  check(fragment.active_version_id===null&&Array.isArray(fragment.version_ids)&&Array.isArray(fragment.legacy_refs),'active version/fragment contract drift');
  if(expectedExcludedIds.includes(fragment.id)){check(fragment.selection==='excluded'&&fragment.version_ids.length===0&&!grouped.has(fragment.id),'excluded fragment has content');continue;}
  const items=grouped.get(fragment.id),binding=bindings.get(fragment.id);
  check(fragment.selection==='included'&&items&&items.length===3&&fragment.version_ids.length===3&&new Set(fragment.version_ids).size===3&&items.every(value=>fragment.version_ids.includes(value.id))&&new Set(items.map(value=>value.edition)).size===3&&fragment.legacy_refs.includes(binding.legacyId),'three distinct editions and explicit fragment identity required');
  const ordered=REVISION_EDITIONS.map(edition=>items.find(value=>value.edition===edition));
  check([...fragment.legacy_refs,...ordered[0].legacy_refs].includes(binding.baselineLegacyId),'baseline legacy reference differs from explicit lineage');
  const exactBinding=bindingProof.bindings.filter(value=>value.new_fragment_id===fragment.id&&value.legacy_id===binding.legacyId);check(exactBinding.length===1&&exactBinding[0].lot===(binding.lotId==='lois-e133'?'E133':'E113')&&(binding.lotId!=='jeanne-e113'||exactBinding[0].old_segment_id===binding.baselineLegacyId),'linked proof fragment crosswalk drift');
  check(JSON.stringify(ordered[1].image_evidence)===JSON.stringify(ordered[2].image_evidence),'rereading/modern photo evidence differs');
  included.push({id:fragment.id,...binding,versions:ordered,proposals:[],linkedUncertainties:[],photoBasis:'rereading',baselinePhotoBinding:'absent-not-inferred',photos:ordered[1].image_evidence.map(image=>({...imageMap.get(image.photo_source_id+'|'+image.derived_image_source_id)}))});
 }
 for(const proposal of proposals.values()){
  const from=versions.get(proposal.from_version_id),to=versions.get(proposal.to_version_id);
  check(proposal.kind==='partial-replacement-proposal'&&proposal.status==='proposed'&&proposal.applied===false&&proposal.human_decision===null&&proposal.entity_id===null&&from&&to&&from.id!==to.id&&from.fragment_id===to.fragment_id,'replacement remains proposed within one included fragment');span(proposal.from_span,from.text_exact);span(proposal.to_span,to.text_exact);included.find(value=>value.id===from.fragment_id).proposals.push(proposal);
 }
 const occurrenceIds=new Set();
 for(const occurrence of bindingProof.accepted_e113_uncertainty_bindings){
  const version=versions.get(occurrence.version_id),fragment=included.find(value=>value.id===version?.fragment_id);
  check(version?.edition==='rereading'&&fragment?.lotId==='jeanne-e113'&&typeof occurrence.accepted_occurrence_id==='string'&&!occurrenceIds.has(occurrence.accepted_occurrence_id)&&occurrence.reading_status==='unresolved'&&occurrence.identification_status==='unresolved'&&occurrence.entity_id===null&&occurrence.human_decision===null&&occurrence.source_alternatives_preserved_exactly===true&&Array.isArray(occurrence.original_alternatives)&&typeof occurrence.original_category==='string'&&typeof occurrence.observed_text==='string'&&typeof occurrence.core_ambiguity_emitted==='boolean','linked unresolved occurrence drift');
  occurrenceIds.add(occurrence.accepted_occurrence_id);span({...occurrence.span,exact_text:occurrence.observed_text},version.text_exact);
  if(occurrence.core_ambiguity_emitted)check(version.ambiguities.some(value=>value.id===occurrence.new_ambiguity_id),'emitted core ambiguity missing');else check(occurrence.new_ambiguity_id===null,'non-emitted source occurrence has invented ambiguity');
  fragment.linkedUncertainties.push(occurrence);
 }
 return structuredClone({phase,fragments:expectedIncludedIds.map(value=>included.find(fragment=>fragment.id===value)),excluded:[...expectedExcludedIds],status:payload.status});
}
