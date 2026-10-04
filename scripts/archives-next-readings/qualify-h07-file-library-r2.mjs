import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createConnection} from 'node:net';
import assert from 'node:assert/strict';
import {digest,H07_FILE_PINS,H07_FILE_PARENT} from './h07-file-library-adapter.mjs';
const run=resolve('.private/archives-next-readings/h07-file-library-ui-20261004-v1/reviewed-r2');
const json=async name=>JSON.parse(await readFile(join(run,name)));
const write=async(name,value)=>writeFile(join(run,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const pin=b=>({sha256:digest(b),bytes:b.length});
const proofBytes=await readFile(join(run,'build-proof.json'));
assert.equal(digest(proofBytes),'1cb67c3e4c38b15b223c738b34666d547bc9ed6fa69bccfd4cbb1d205a40855f');
const proof=JSON.parse(proofBytes),projection=await json('projection.json'),observations=await json('browser-observations.json');
const pointer=await json('pointer-preview/browser-observations.json');
for(const [name,expected] of Object.entries(proof.outputs))assert.deepEqual(pin(await readFile(join(run,name))),expected,name);
const editions=['first-draft','rereading','modern-french'];
const checkState=(state,file)=>{
 assert(state.scrollWidth<=state.width);assert.equal(state.technical,false);assert.equal(state.images,0);
 for(const panel of state.panels){
  const lines=file.sections.flatMap(s=>s.versions[panel.edition].flatMap(v=>v.lines));
  assert.deepEqual(panel.texts,lines.map(l=>l.text));
  assert.deepEqual(panel.lineLabels,lines.map(l=>String(l.number).padStart(2,'0')));
 }
 assert.equal(state.panels.length,3);assert.equal(state.panels.filter(p=>!p.hidden).length,1);
};
assert.equal(observations.libraryDesktop.entries,3);assert.equal(observations.libraryMobile.entries,3);
assert.equal(observations.libraryMobile.width,390);assert.equal(observations.libraryMobile.height,844);
assert(observations.libraryMobile.scrollWidth<=390);assert.equal(observations.libraryMobile.technical,false);
assert.deepEqual(observations.logs,[]);assert.deepEqual(pointer.logs,[]);
for(const [index,key] of ['e133','e113'].entries()){
 const file=projection.files[index],states=observations.files[key];
 assert.equal(states.desktop.width,1280);assert.equal(states.desktop.height,720);
 assert.equal(states.desktop.previewPoints,3);assert.equal(states.desktop.remainingOpen,false);
 assert.equal(states.desktop.totalPoints,file.counts.points);assert.equal(states.desktop.selected,'Relecture');
 for(const state of Object.values(states).filter(v=>v?.panels))checkState(state,file);
 assert.equal(states.mobileEntry.width,390);assert.equal(states.mobileEntry.height,844);
 assert.equal(states.mobileEntry.previewPoints,3);assert.equal(states.mobileEntry.remainingOpen,false);
 assert.equal(states.mobilePoints.previewPoints,3);assert.equal(states.mobilePoints.remainingOpen,false);
 assert.deepEqual(states.tabs.map(t=>t.key),['Home','End','ArrowLeft']);
 assert.deepEqual(states.tabs.map(t=>t.state.shown[0]),editions.toSorted((a,b)=>['first-draft','modern-french','rereading'].indexOf(a)-['first-draft','modern-french','rereading'].indexOf(b)));
 assert.equal(states.reveal.remainingOpen,true);assert.equal(states.mobileReveal.remainingOpen,true);
 const returned=states.returnFromInitial??states.return;
 assert.equal(returned.selected,'Relecture');assert.equal(returned.hash,'#'+returned.active);
 assert.equal(states.mobileReturn.selected,'Relecture');assert.equal(states.mobileReturn.hash,'#'+states.mobileReturn.active);
 assert(states.mobileReturn.top>=0&&states.mobileReturn.top<844);
 for(const [kind,label] of [['french','Français proposé'],['initial','Transcription initiale'],['rereading','Relecture']]){
  const state=pointer.files[key][kind];checkState(state,file);assert.equal(state.selected,label);assert.equal(state.width,390);assert.equal(state.height,844);
 }
 assert.equal(pointer.files[key].reveal.remainingOpen,true);assert.equal(pointer.files[key].reveal.active,key==='e133'?'point-3':'point-4');
}
for(const name of ['preview-requests.json','pointer-preview/requests.json']){
 const requests=await json(name);assert(requests.length>0);assert(requests.every(r=>r.method==='GET'&&[200,204].includes(r.status)));
 assert(requests.every(r=>!r.route.includes('/api/')&&!/\.(?:jpg|jpeg|png)$/.test(r.route)));
}
const refused=port=>new Promise((ok,bad)=>{
 const s=createConnection({host:'127.0.0.1',port});
 s.setTimeout(2000,()=>{s.destroy();bad(Error('closeout timeout '+port));});
 s.on('connect',()=>{s.destroy();bad(Error('preview still listening '+port));});
 s.on('error',e=>e.code==='ECONNREFUSED'?ok({port,status:e.code}):bad(e));
});
const stopped=[];for(const port of [58311,58623,59257])stopped.push(await refused(port));
const gate={format:'two-source-file-library-browser-gate/1',passed:true,selected_revision:'reviewed-r2',build_proof:pin(proofBytes),desktop:{width:1280,height:720},mobile:{width:390,height:844},checks:{library_three_files:true,source_texts_exact_in_all_six_editions:true,local_transcription_line_numbers_exact:true,keyboard_tabs:true,mobile_click_tabs:true,related_point_groups_revealed:true,return_to_exact_rereading_line:true,no_horizontal_overflow:true,three_initial_point_rows_per_file:true,no_technical_metadata_displayed:true,no_images_or_api_requested:true,console_and_http_clean:true},touch_gesture_emulation:false,root_integration_browser_gate:'pending',preview_sessions_stopped:stopped,observations:pin(await readFile(join(run,'browser-observations.json'))),pointer_observations:pin(await readFile(join(run,'pointer-preview/browser-observations.json')))};
await write('browser-gate.json',gate);
await write('independent-review.json',{format:'two-file-delta-adversarial-review/1',reviewer:'/root/reader_review',model:'gpt-5.6-sol',scope:'static corrected delta; browser qualified separately by parent',findings:[],resolved:[{priority:2,initial_issue:'A same-line point group split between preview and closed remaining points could stay partly hidden.',fix:'Complete related-point IDs unfold all required details before native fragment focus.',groups_checked:['E133 title transcription line 3 points 3–4','E113 transcription line 2 points 1–3','E113 transcription line 3 points 4–7']}],texts_order_regions_and_geometry_unchanged:true,build_proof:pin(proofBytes)});
await write('preview-closeout.json',{format:'two-file-preview-closeout/1',stopped,temporary_tabs_closed:['25','26','27'],viewport_reset:true,root_service_8822_untouched:true});

// Prepare the private extension inventory only after the pilot gate is qualified.
const manifest=await json('inputs/draft-source-manifest.json'),exported=await json('inputs/h07-reader-export.json'),bindings=await json('inputs/h07-binding-proof.json');
const versions=new Map(exported.versions.map(v=>[v.id,v])),sourceMap=new Map(exported.sources.map(s=>[s.id,s]));
const notices=new Map(manifest.objects.map(o=>[o.digital_object_id,{file_key:'file:photo:'+o.digital_object_id,source_object_id:o.digital_object_id,relative_path:o.relative_path,filename:o.relative_path.split('/').at(-1),cote:o.relative_path.includes('/E.133 ')?'E.133':'E.113',source_sha256:o.expected_sha256,expected_bytes:o.expected_byte_size,historical_association:o.association_status,primary_readings:[],corroboration_only_fragment_ids:[],ui_status:'not-prepared',localized_point_count:0}]));
for(const binding of bindings.bindings){
 const version=versions.get(binding.new_fragment_id+':rereading');assert(version);
 const evidence=binding.lot==='E133'?version.image_evidence.filter(e=>e.region.local_view_id===binding.local_view_id):version.image_evidence;
 const sourceIds=[...new Set(evidence.map(e=>e.photo_source_id))];assert.equal(sourceIds.length,1,'one primary photo per included rereading');
 const source=sourceMap.get(sourceIds[0]);assert.equal(source.kind,'source-photo');
 const object=manifest.objects.find(o=>'urn:phd:source-object:'+o.digital_object_id===source.logical_uri);assert(object&&object.expected_sha256===source.sha256);
 const notice=notices.get(object.digital_object_id);
 notice.primary_readings.push({fragment_id:binding.new_fragment_id,version_ids:editions.map(edition=>binding.new_fragment_id+':'+edition),primary_photo_source_id:source.id,local_view_id:binding.local_view_id??null,physical_line_number:null});
 for(const sid of new Set(version.image_evidence.map(e=>e.photo_source_id).filter(sid=>sid!==source.id))){
  const other=sourceMap.get(sid),otherNotice=[...notices.values()].find(n=>'urn:phd:source-object:'+n.source_object_id===other.logical_uri);
  assert(otherNotice);otherNotice.corroboration_only_fragment_ids.push(binding.new_fragment_id);
 }
}
for(const notice of notices.values()){
 const pilot=projection.files.find(f=>f.key===notice.file_key);
 notice.ui_status=pilot?'pilot-browser-qualified':notice.primary_readings.length?'primary-binding-ready-browser-pending':'no-primary-reading-bound';
 notice.display_point_count=pilot?.counts.points??null;notice.pending_crops=pilot?.counts.cropPending??null;
 notice.corroboration_only_fragment_ids=[...new Set(notice.corroboration_only_fragment_ids)];
}
assert.equal(notices.size,17);assert.equal([...notices.values()].filter(n=>n.primary_readings.length).length,6);
assert.equal([...notices.values()].reduce((n,x)=>n+x.primary_readings.length,0),100);
const runtimePath=resolve('.private/archives-integration',H07_FILE_PARENT.name,'site/runtime/archives/selected-data.json');
const runtimeBytes=await readFile(runtimePath);assert.equal(digest(runtimeBytes),'44a70f324fc11ffc3019681b0f63fdc97469cba13d5b0c58fc9db558e780c97a');
const runtime=JSON.parse(runtimeBytes),legacy=Map.groupBy(runtime.drafts.items,x=>x.source_id);
assert.equal(runtime.drafts.items.length,992);assert.equal(legacy.size,40);
const aliases=manifest.source_alias_evidence['lois-e133'].bindings;
const legacyQueue=[...legacy].map(([sourceId,items])=>{
 const shas=[...new Set(items.map(x=>x.source_sha256))];assert.equal(shas.length,1);
 const alias=aliases.find(a=>a.source_id===sourceId&&a.sha256===shas[0]);
 return {source_id:sourceId,source_sha256:shas[0],occurrence_count:items.length,candidate_image_objects:[...new Set(items.map(x=>x.image.object_id))],image_link_statuses:[...new Set(items.map(x=>x.image.link_status))],qualified_text_file_fallback:alias?{file_key:'file:text:'+alias.verified_path,logical_source_file:alias.verified_path,source_sha256:alias.sha256}:null,admission:'deferred; bind actual source file rather than treating source_id as a file',physical_line_number:null,rendered:false};
});
await writeFile(join(run,'inputs/selected-data.json'),runtimeBytes,{flag:'wx'});
const extension={format:'file-library-qualified-extension-plan/1',pilot_gate_passed:true,source_pins:H07_FILE_PINS,legacy_runtime:pin(runtimeBytes),scope:'closed E133/E113 metadata only; not the whole 2989-photo catalogue',photo_files:[...notices.values()],legacy_source_queue:legacyQueue,existing_p09_route:'/archives/fichiers/p09/',counts:{photo_notices:17,primary_reading_bound_files:6,pilot_browser_qualified_files:2,next_bound_files:4,no_primary_reading_bound_files:11,legacy_occurrences_preserved:992,legacy_sources_deferred:40,qualified_text_file_fallback_candidates:legacyQueue.filter(s=>s.qualified_text_file_fallback).length,new_pages_rendered_after_pilot:0},rules:{key_by_exact_photo_object_or_verified_source_text_file:true,never_key_by_snippet:true,never_promote_candidate_folder_link:true,corroboration_photos_not_duplicate_primary_files:true,preserve_all_three_exact_editions:true,physical_numbers_only_if_established:true,restart_transcription_numbers_per_unaligned_passage:true,require_small_browser_gate_before_extension:true,require_measured_photo_regions_before_localized_point_count:true,keep_machine_data_private:true},new_source_or_image_bytes_read:0,root_runtime_modified:false};
await write('extension-plan.json',extension);
await mkdir(join(run,'qualification-code'));
for(const name of ['qualify-h07-file-library-r2.mjs','h07-file-library-pointer-preview.mjs'])await writeFile(join(run,'qualification-code',name),await readFile('scripts/archives-next-readings/'+name),{flag:'wx'});
console.log(JSON.stringify({passed:true,counts:extension.counts,gate:pin(await readFile(join(run,'browser-gate.json')))},null,2));
