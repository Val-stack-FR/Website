import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createConnection} from 'node:net';
import assert from 'node:assert/strict';
import {digest,TONAL_READING_PINS,TONAL_READING_ROUTES} from './p09-tonal-reading-adapter.mjs';
const run=resolve('.private/archives-next-readings/p09-tonal-reading-ui-20261004-v1'),pin=b=>({sha256:digest(b),bytes:b.length});
const json=async n=>JSON.parse(await readFile(join(run,n))),write=async(n,v)=>writeFile(join(run,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const proofBytes=await readFile(join(run,'build-proof.json'));assert.equal(digest(proofBytes),'b6e041ce49e1dc19134f48abe9a67b7d4c4e1deb2c01eb8b90bdb1d1fa4f7b19');const proof=JSON.parse(proofBytes),observed=await json('browser-observations.json'),projection=await json('inputs/p09-projection.json'),point=projection.points.find(p=>p.id==='point-l04');
for(const [name,expected]of Object.entries(proof.outputs))assert.deepEqual(pin(await readFile(join(run,name))),expected,name);
assert.deepEqual(observed.logs,[]);assert.equal(observed.sourceTexts.line,point.context);assert.equal(observed.sourceTexts.quote,point.quote);assert.deepEqual(observed.sourceTexts.suggestions,point.alternatives.map(a=>a.reading));
assert.equal(observed.sourceTexts.browserOverlayStyle,'codex-browser-sidebar-comments-root');
const intact=state=>{
 assert.equal(state.helpOpen,true);assert.equal(state.mountedComponents,1);assert.equal(state.templatePresent,false);assert.equal(state.zoom,'fit');assert.equal(state.controlsOpen,false);
 assert.equal(state.contrast,'1');assert.equal(state.brightness,'1');assert.equal(state.gray,false);assert.equal(state.error,null);
 for(const pane of state.panels){assert.equal(pane.filter,'none');assert.equal(pane.panX,0);assert.equal(pane.panY,0);assert(pane.viewportScrollWidth<=pane.viewportWidth+1);assert(Math.abs(pane.imageWidth-pane.viewportWidth)<=1);assert(Math.abs(pane.imageHeight-pane.imageWidth*165/530)<=2);}
};
for(const [label,size]of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
 const states=observed[label];assert.equal(states.initial.helpOpen,false);assert.equal(states.initial.mountedComponents,0);assert.equal(states.initial.templatePresent,true);assert.equal(states.initial.images.length,1);
 for(const state of Object.values(states)){
  assert.equal(state.width,size.width);assert.equal(state.height,size.height);assert(state.scrollWidth<=state.width);assert.equal(state.uniqueIds,true);assert.equal(state.visibleTechnical,false);assert.equal(state.error,null);
  assert(state.images.every(image=>image.src===TONAL_READING_ROUTES.crop&&image.complete&&image.naturalWidth===530&&image.naturalHeight===165));
  assert(state.panels.filter(Boolean).every(p=>p.complete&&p.naturalWidth===530&&p.naturalHeight===165));
 }
 intact(states.open);intact(states.reset);
}
assert.equal(observed.desktop.adjusted.panels[0].filter,'none');assert.equal(observed.desktop.adjusted.panels[1].filter,'contrast(1.05) brightness(0.95) grayscale(1)');
assert.equal(observed.desktop.zoom.zoom,'300');assert(observed.desktop.zoom.panels.every(p=>p.imageWidth===1590));
for(const [state,pan]of [[observed.desktop.panIntact,48],[observed.desktop.panProcessed,96],[observed.mobile.pan,96]])assert(state.panels.every(p=>p.panX===pan));
assert.equal(observed.mobile.zoom.zoom,'200');assert(observed.mobile.zoom.panels.every(p=>p.imageWidth===1060));
assert.equal(observed.mobile.beforeClose.contrast,'1.05');assert.equal(observed.mobile.closed.helpOpen,false);assert.equal(observed.mobile.closed.mountedComponents,1);intact(observed.mobile.reopened);
assert.equal(observed.mobile.return.hash,'#ligne-l04');assert.equal(observed.mobile.return.active,'ligne-l04');
const requests=await json('preview-requests.json');assert(requests.length>0&&requests.every(r=>r.method==='GET'&&[200,204].includes(r.status)));
assert.deepEqual([...new Set(requests.filter(r=>r.route.endsWith('.png')).map(r=>r.route))],[TONAL_READING_ROUTES.crop]);
const session=await json('preview-session.json'),port=Number(new URL(session.origin).port);
await new Promise((ok,bad)=>{const s=createConnection({host:'127.0.0.1',port});s.setTimeout(2000,()=>{s.destroy();bad(Error('preview closeout timeout'));});s.on('connect',()=>{s.destroy();bad(Error('preview still running'));});s.on('error',e=>e.code==='ECONNREFUSED'?ok():bad(e));});
assert.equal(digest(await readFile(proof.existing_crop_readonly.path)),TONAL_READING_PINS.crop);
const componentPath=resolve('.private/archives-integration/digital-paleography-tonal-preview-20261004-r2');
for(const [name,key]of [['index.html','component'],['comparison.css','css'],['comparison.js','js'],['display-contract.json','contract']])assert.equal(digest(await readFile(join(componentPath,name))),TONAL_READING_PINS[key]);
assert.equal(digest(await readFile('.private/archives-next-readings/p09-file-reading-ui-20261004-v1/p09.html')),TONAL_READING_PINS.p09);
await write('browser-gate.json',{format:'p09-l04-tonal-reading-browser-gate/1',passed:true,build_proof:pin(proofBytes),scope:'focused L04 wrapper, same generated difficulty card and parent styles; Root assembled reader pending',desktop:{width:1280,height:900},mobile:{width:390,height:844},checks:{original_excerpt_only_until_requested:true,lazy_mount_and_unique_ids:true,full_paired_excerpts_in_fit:true,controls_closed_by_default:true,keyboard_open_filters_zoom_pan_reset:true,mobile_click_open_zoom_pan_reset:true,intact_panel_never_filtered:true,paired_pan_both_directions:true,reset_fit_neutral_zero_pan_closed_controls:true,reopen_resets_without_duplicate_mount:true,return_exact_l04_line_focus:true,source_quote_context_and_two_suggestions_unchanged:true,no_horizontal_overflow:true,no_visible_technical_metadata:true,no_demo_css:true,console_and_http_clean:true,existing_l04_image_only:true,no_post_or_api:true},actual_touch_gesture_emulation:false,reading_gain_asserted:false,browser_overlay_inline_style:'Codex comments overlay only; product HTML contains no inline styles',observations:pin(await readFile(join(run,'browser-observations.json'))),preview_stopped:{port,status:'ECONNREFUSED'},temporary_tab_28_closed:true,viewport_reset:true});
await write('independent-review.json',{format:'p09-l04-tonal-reading-adversarial-review/1',reviewer:'/root/reader_review',model:'gpt-5.6-sol',scope:'static generated delta and source scripts; no browser conclusion',findings:[],checks:{parent_sha_pinned_and_restorable:true,twenty_one_lines_and_three_other_cards_unchanged:true,l04_crop_quote_two_suggestions_return_preserved:true,component_r2_css_js_byte_identical:true,preview_css_absent:true,lazy_template_clone_mount_remove:true,unique_document_ids:39,reset_on_open_fit_filters_neutral_pan_zero_controls_closed:true,no_media_write_api_post_or_gain_claim:true},root_parent_integration_still_pending:true});
await write('preview-closeout.json',{format:'p09-l04-tonal-reading-preview-closeout/1',origin:session.origin,status:'ECONNREFUSED',temporary_tab:'28',tab_closed:true,viewport_reset:true,root_service_8822_untouched:true});
await writeFile(join(run,'code-snapshot/close-p09-tonal-reading-ui.mjs'),await readFile(new URL(import.meta.url)),{flag:'wx'});
const references={};for(const name of ['HANDOFF.md','build-proof.json','browser-gate.json','independent-review.json','integration-contract.json','preview-closeout.json'])references[name]=pin(await readFile(join(run,name)));
await write('closeout.json',{format:'p09-l04-tonal-reading-closeout/1',ready_for_root_recomposition:true,root_integration_gate_pending:true,public_routes:proof.public_routes.map(r=>r.route),new_source_images:0,new_crop_assets:0,source_png_and_component_reverified_unchanged:true,root_runtime_or_closed_library_files_modified:false,preview_server_stopped:true,temporary_tab_closed:true,viewport_reset:true,canonical_updates:0,reading_gain_asserted:false,references});
const entries=[];const walk=async(dir,prefix='')=>{for(const d of await readdir(dir,{withFileTypes:true})){assert(!d.isSymbolicLink());const name=prefix+d.name,path=join(dir,d.name);if(d.isDirectory())await walk(path,name+'/');else if(d.isFile()&&name!=='seal.json')entries.push([name,pin(await readFile(path))]);}};await walk(run);const files=Object.fromEntries(entries.sort(([a],[b])=>a.localeCompare(b)));await write('seal.json',{format:'immutable-run-seal/1',files,file_count:entries.length});
for(const [name,expected]of entries)assert.deepEqual(pin(await readFile(join(run,name))),expected,name);
console.log(JSON.stringify({closed:true,files:entries.length,handoff:references['HANDOFF.md'],browser_gate:references['browser-gate.json'],seal:pin(await readFile(join(run,'seal.json')))},null,2));
