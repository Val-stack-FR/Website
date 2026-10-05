import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projectRevisionJoin,REVISION_EDITIONS} from '../../scripts/archives/revision-join.mjs';
import {renderRevisionComposition} from '../../scripts/archives/revision-composition.mjs';

// Invented in-memory unit data only. No demo, source file or service is created.
const hash=value=>createHash('sha256').update(value,'utf8').digest('hex');
const status={reading:'machine-draft',human_review:'pending',rights:'unknown',publication:'private'};
function input(){
 const photos=Array.from({length:17},(_,n)=>({source_object_id:'object:path-'+hash('source-'+n),source_sha256:hash('source-bytes-'+n),derivative_object_id:'object:media-'+hash('derivative-'+n),derivative_sha256:hash('derivative-'+n),canonical_view_id:null,candidate_view_id:null,lot_id:n<4?'lois-e133':'jeanne-e113',display_width:100,display_height:80}));
 const payload={format:'reader-transcription-versions/0.1.0',scope:'derived-draft',read_only:true,display_order:[...REVISION_EDITIONS],display_labels:{'first-draft':'premier brouillon',rereading:'relecture','modern-french':'français modernisé'},status:{...status},canonical_decisions:[],human_memory:[],sources:[],fragments:[],versions:[],replacement_proposals:[]};
 const fragmentBindings=[],imageBindings=[];
 for(const [n,lotId,photoIndex]of [[0,'lois-e133',0],[1,'jeanne-e113',4]]){
  const fid='fragment:unit-invented-'+n,legacy='segment:unit-new-'+n,old='segment:unit-old-'+n,photo=photos[photoIndex],pid='source:unit-photo-'+n,did='source:unit-image-'+n,tid='source:unit-text-'+n;
  payload.sources.push({id:pid,kind:'source-photo',sha256:photo.source_sha256,simulation:false,rights_status:'unknown',hash_verification:'pinned-metadata',derived_from_ids:[]},{id:did,kind:'derived-image',sha256:photo.derivative_sha256,simulation:false,rights_status:'unknown',hash_verification:'pinned-metadata',derived_from_ids:[pid]},{id:tid,kind:'derived-text',sha256:hash('source-container-'+n),simulation:false,rights_status:'unknown',hash_verification:'local-bytes',derived_from_ids:[]});
  imageBindings.push({photoSourceId:pid,derivedImageSourceId:did,sourceObjectId:photo.source_object_id});
  const versionIds=[];
  for(const [editionIndex,edition]of REVISION_EDITIONS.entries()){
   const text=editionIndex===0?'\nLoys e\u0301\r\n[x?]':editionIndex===1?'Loys [x?] relu':'Formulation inventée.',vid=fid+':'+edition;
   versionIds.push(vid);const points=Array.from(text),start=editionIndex===0?12:0;
   const region=n===0?{bbox_xywh:[1,2,10,12],scope:'invented section metadata',local_view_id:'unit:local',crop_id:'unit:crop',native_bbox_xywh:[1,2,10,12],native_to_display:{opaque:'invented metadata'},display_dimensions:{width:100,height:80},crop_sha256:hash('unit-crop')}:{rect_xyxy:[1,2,10,12],scope:'invented fragment metadata',native_dimensions_observed:[100,80],display_dimensions_observed:[100,80],exif_orientation_observed:null,working_crop_sha256:hash('unit-crop')};
   payload.versions.push({id:vid,fragment_id:fid,edition,label:payload.display_labels[edition],revision_key:vid,source_id:tid,text_exact:text,text_sha256_utf8:hash(text),utf8_byte_length:Buffer.byteLength(text,'utf8'),source_locator:{kind:'json-string',json_pointer:'/invented/'+n+'/'+edition,container_text_sha256_utf8:hash('longer-json-string-'+n+'-'+edition),byte_span:null,span:{start,end:start+points.length,units:'unicode-codepoints-half-open',exact_text:text}},ambiguities:editionIndex===1?[{id:vid+':uncertain',span:{start:5,end:9,units:'unicode-codepoints-half-open',exact_text:'[x?]'},alternatives:['x','indéterminé'],entity_id:null,reading_status:'unresolved',identification_status:'unresolved'}]:[],image_evidence:editionIndex===0?[]:[{photo_source_id:pid,derived_image_source_id:did,canonical_view_id:null,region_frame:'local-oriented-display-pixels',region}],legacy_refs:[legacy,old],status:{...status},entity_id:null,human_decision:null});
  }
  payload.fragments.push({id:fid,selection:'included',active_version_id:null,version_ids:versionIds,legacy_refs:[legacy,old]});fragmentBindings.push({fragmentId:fid,lotId,legacyId:legacy,baselineLegacyId:old,label:'Passage inventé '+(n+1)});
 }
 const excluded='fragment:unit-excluded';payload.fragments.push({id:excluded,selection:'excluded',active_version_id:null,version_ids:[],legacy_refs:['segment:unit-excluded']});
 payload.replacement_proposals.push({id:'proposal:unit-partial',kind:'partial-replacement-proposal',from_version_id:payload.versions[0].id,to_version_id:payload.versions[1].id,from_span:{start:1,end:5,units:'unicode-codepoints-half-open',exact_text:'Loys'},to_span:{start:0,end:4,units:'unicode-codepoints-half-open',exact_text:'Loys'},status:'proposed',applied:false,human_decision:null,entity_id:null});
 const bindingProof={format:'h07-exact-binding-proof/1.0.0',phase:'pilot',passed:true,included_fragment_count:2,excluded_fragment_count:1,version_count:6,proposal_count:1,image_decoding_performed:false,text_normalization_performed:false,canonical_decisions:[],human_memory:[],rights:'unknown',publication:'private',human_review:'pending',bindings:fragmentBindings.map(binding=>({lot:binding.lotId==='lois-e133'?'E133':'E113',legacy_id:binding.legacyId,new_fragment_id:binding.fragmentId,old_segment_id:binding.baselineLegacyId})),accepted_e113_uncertainty_count:1,accepted_e113_uncertainty_bindings:[{version_id:payload.versions[4].id,accepted_occurrence_id:'occurrence:unit-one-candidate',reading_status:'unresolved',identification_status:'unresolved',entity_id:null,human_decision:null,source_alternatives_preserved_exactly:true,original_alternatives:[{reading:null}],original_category:'unit-invented',observed_text:'[x?]',span:{start:5,end:9,units:'unicode-codepoints-half-open'},core_ambiguity_emitted:false,new_ambiguity_id:null}]};
 return {payload,bindingProof,phase:'pilot',fragmentBindings,imageBindings,derivativeSelection:{version:'private-draft-derivative-bindings/1',bindings:photos,selected_object_ids:photos.map(photo=>photo.source_object_id)},expectedIncludedIds:payload.fragments.slice(0,2).map(fragment=>fragment.id),expectedExcludedIds:[excluded]};
}
function parent(options){return `<!doctype html><html><head><title>Invented unit template</title></head><body>${['lois-e133','jeanne-e113'].map(lot=>{const slug='presentation-'+lot;return `<article class="archive-act" id="${slug}" data-act-index="0"><header>Existing dossier</header><section class="draft-fragments" data-draft-fragments><p>OLD-PASSAGE-${lot}</p></section><div class="act-panels"><section><p>OLD-AGGREGATE-${lot}</p></section><section class="act-panel images-panel" aria-labelledby="${slug}-images"><div class="archive-gallery">${options.derivativeSelection.bindings.filter(photo=>photo.lot_id===lot).map(photo=>`<figure><a href="/__archive_draft_derivative/${photo.derivative_sha256}" data-zoom-image="/__archive_draft_derivative/${photo.derivative_sha256}"><img data-draft-object-id="${photo.source_object_id}" src="/__archive_draft_derivative/${photo.derivative_sha256}" /></a></figure>`).join('')}</div></section></div><aside class="uncertainty-note">Existing uncertainty</aside><nav>Existing navigation</nav></article>`;}).join('')}<p>Existing catalogue/search/text routes are untouched.</p></body></html>`;}

test('version projection preserves exact strings and separate baseline provenance; region remains metadata',()=>{
 const options=input(),model=projectRevisionJoin(options);assert.equal(model.fragments.length,2);assert.equal(model.fragments[0].versions[0].text_exact,options.payload.versions[0].text_exact);assert.deepEqual(model.fragments[0].versions[0].image_evidence,[]);assert.equal(model.fragments[0].baselinePhotoBinding,'absent-not-inferred');assert.equal(model.fragments[0].photoBasis,'rereading');assert.equal(model.fragments[0].photos[0].derivative_sha256,options.derivativeSelection.bindings[0].derivative_sha256);assert.equal(model.fragments[0].proposals[0].applied,false);assert.deepEqual(model.excluded,options.expectedExcludedIds);
 model.fragments[0].versions[0].text_exact='changed returned copy';assert.notEqual(options.payload.versions[0].text_exact,'changed returned copy');
});
test('consequential text, identity, legacy, photo and decision mutations are refused',()=>{
 const changes=[
  value=>value.payload.scope='fixture',value=>value.phase='full',value=>value.payload.fragments[0].active_version_id=value.payload.versions[0].id,
  value=>value.payload.versions[0].text_exact=value.payload.versions[0].text_exact.normalize('NFC'),value=>value.payload.versions[1].human_decision={},
  value=>value.fragmentBindings[0].baselineLegacyId='segment:invented-false-old',value=>value.imageBindings[0].sourceObjectId=value.derivativeSelection.bindings[4].source_object_id,
  value=>value.payload.sources[0].sha256='0'.repeat(64),value=>value.payload.versions[1].image_evidence[0].canonical_view_id='view:invented-confirmed',
  value=>value.payload.versions[0].source_locator.byte_span={start:0,end:1},value=>value.payload.versions[1].ambiguities[0].span.start=0,
  value=>value.payload.replacement_proposals[0].applied=true,value=>value.payload.fragments.at(-1).selection='included',value=>value.payload.canonical_decisions='',
  value=>value.payload.versions[0].image_evidence=structuredClone(value.payload.versions[1].image_evidence),value=>value.payload.sources[2].derived_from_ids=[value.payload.sources[1].id],
  value=>value.payload.sources[2].derived_from_ids=[value.payload.sources[2].id],value=>value.payload.versions[1].image_evidence[0].region={},value=>value.payload.versions[1].image_evidence[0].region_frame='native-coded-raster',
  value=>value.bindingProof.accepted_e113_uncertainty_bindings[0].span.start=0,value=>value.bindingProof.accepted_e113_uncertainty_bindings[0].core_ambiguity_emitted=true,
  value=>value.bindingProof.accepted_e113_uncertainty_bindings=[]
 ];for(const change of changes){const value=input();change(value);assert.throws(()=>projectRevisionJoin(value),/Revision join:/u);}
});
test('composition moves each inherited photo once, preserves legacy blocks and isolates both readers',()=>{
 const options=input(),inherited=parent(options),html=renderRevisionComposition({parentHtml:inherited,...options});
 assert.equal([...html.matchAll(/data-revision-join=/gu)].length,2);assert.equal([...html.matchAll(/data-revision-version-id=/gu)].length,6);assert.equal([...html.matchAll(/data-draft-object-id=/gu)].length,17);assert.equal([...html.matchAll(/data-revision-proposal-id=/gu)].length,1);
 for(const lot of ['lois-e133','jeanne-e113']){assert.ok(html.includes('OLD-PASSAGE-'+lot));assert.ok(html.includes('OLD-AGGREGATE-'+lot));assert.ok(html.includes(`id="presentation-${lot}-revision-tab-photos"`));}
 assert.ok(html.includes('&#10;Loys e\u0301&#13;&#10;[x?]'));assert.ok(html.includes('Changements partiels suggérés — non appliqués'));assert.ok(!html.includes('data-revision-fragment-id="fragment:unit-excluded"'));assert.ok(!/\son\w+=|<script(?! src=)|<style/iu.test(html));assert.ok(!html.includes('rect_xyxy'));assert.ok(html.includes('Existing catalogue/search/text routes are untouched.'));
 assert.equal([...html.matchAll(/data-revision-source-occurrence=/gu)].length,1);assert.ok(html.includes('Empreinte du texte exact'));assert.ok(html.includes('Empreinte du conteneur texte'));assert.ok(html.includes('reading&quot;: null'));
 assert.throws(()=>renderRevisionComposition({parentHtml:html,...options}),/unmodified/u);
 assert.throws(()=>renderRevisionComposition({parentHtml:inherited.replace('<aside class="uncertainty-note">','<aside>'),...options}),/boundary/u);
});
