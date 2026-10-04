import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createConnection} from 'node:net';
import assert from 'node:assert/strict';
import {digest,E108_HUMAN_PINS} from './e108-human-publication-adapter.mjs';

const run=resolve('.private/archives-next-readings/e108-human-publication-delta-20261004-v1');
const pin=b=>({sha256:digest(b),bytes:b.length});
const json=async name=>JSON.parse(await readFile(join(run,name)));
const write=async(name,value)=>writeFile(join(run,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const proofBytes=await readFile(join(run,'build-proof.json'));
assert.equal(digest(proofBytes),'1ddc7666d3f89c536e822d4497a7639257230ecae9df609be1da6c63f4b6bcce');
const proof=JSON.parse(proofBytes),observed=await json('browser-observations.json');
const keyboard=(await json('browser-shortcut-keyboard.json')).observation;
const followup=await json('browser-shortcut-followup.json');
const fixture=await json('inputs/ensemble.json');
for(const [name,expected] of Object.entries(proof.outputs))assert.deepEqual(pin(await readFile(join(run,name))),expected,name);
const intact=state=>{
 assert.equal(state.groups,1);assert.equal(state.cards,17);assert.equal(state.busy,'false');
 assert.equal(state.images,0);assert.equal(state.visibleTechnical,false);assert(state.scrollWidth<=state.width);
};
for(const name of ['desktop','desktopDetails','mobile','mobileDetails']){
 const state=observed[name];intact(state);assert.equal(state.error,null);
 assert.deepEqual(state.members,fixture.members.map(m=>({id:m.object_id,path:m.logical_path,label:'Vue '+Number(m.filename.replace('.jpg',''))+' · '+m.filename})));
 assert(state.groupText.includes('Même acte probable, à confirmer'));
 assert(state.groupText.includes('Ordre physique non établi.'));
}
for(const name of ['desktopDetails','mobileDetails']){
 assert.equal(observed[name].detailsOpen,true);
 assert(observed[name].groupText.includes('Archives › Photos des Archives › E.108'));
}
for(const name of ['partial','partialDetails']){
 assert.equal(observed[name].groups,0);assert.equal(observed[name].cards,1);
 assert.deepEqual(observed[name].cardTitles,['11.jpg']);assert.equal(observed[name].visibleTechnical,false);
}
intact(keyboard);intact(followup.desktop_click_from_query_11_jpg);
for(const state of [keyboard,followup.desktop_click_from_query_11_jpg]){
 assert.equal(state.query,'');assert.equal(state.active,'ensemble-e108-11-14');assert.equal(state.hash,'#ensemble-e108-11-14');
}
assert(followup.desktop_click_from_query_11_jpg.groupTop>followup.desktop_click_from_query_11_jpg.searchBottom);
assert.equal(followup.mobile_inline_click_geometry.centerIsLink,false);
assert.equal(followup.mobile_inline_click_geometry.centerHit.tag,'P');
assert.equal(followup.mobile_inline_click_geometry.rects.length,2);
assert.equal(followup.mobile_click_from_filter_validated,false);
assert.equal(observed.shortcut.groups,0); // Keep the initial missed click as an unsuccessful observation.
assert.deepEqual(observed.logs,[]);assert.deepEqual(followup.logs,[]);
const requests=await json('preview-requests.json');
const allowed=new Set([...proof.public_routes,...proof.parent_assets].map(x=>x.route).concat('/__catalogue_hierarchy','/favicon.svg','/favicon.ico'));
const guardRefusals=requests.filter(r=>r.status===403&&r.route===undefined);
assert.equal(guardRefusals.length,1);
assert(requests.length>0&&requests.every(r=>r.method==='GET'&&([200,204].includes(r.status)&&allowed.has(r.route)||guardRefusals.includes(r))));
assert.equal((await json('source-gets.json')).length,3);
const session=await json('preview-session.json'),port=Number(new URL(session.origin).port);
await new Promise((ok,bad)=>{
 const socket=createConnection({host:'127.0.0.1',port});
 socket.setTimeout(2000,()=>{socket.destroy();bad(Error('preview closeout timeout'));});
 socket.on('connect',()=>{socket.destroy();bad(Error('preview still running'));});
 socket.on('error',e=>e.code==='ECONNREFUSED'?ok():bad(e));
});
const parent=resolve('.private/archives-integration/publication-package-20261004-v19-r2');
assert.equal(digest(await readFile(join(parent,'site/dist/archives/catalogue/index.html'))),E108_HUMAN_PINS.parent);
assert.equal(digest(await readFile(join(parent,'site/dist/assets/archives-hierarchy.js'))),E108_HUMAN_PINS.hierarchy);
assert.equal(digest(await readFile('.private/archives-integration/e108-response-projection-20261004-v1/e108-response-projection-runtime.mjs')),E108_HUMAN_PINS.helper);
await write('browser-gate.json',{
 format:'e108-human-publication-browser-gate/1',passed:true,build_proof:pin(proofBytes),
 scope:'Only modified E108 hooks, frozen cleaned v19-r2 catalogue responses; assembled Root publication pending',
 checks:{desktop_mobile_exact_four_members:true,human_folder_in_open_details:true,probable_act_and_filename_order_preserved:true,
 partial_query_not_filled:true,desktop_click_restores_unfiltered_group_and_focus:true,mobile_keyboard_restores_unfiltered_group_and_focus:true,
 desktop_title_below_sticky_search:true,no_horizontal_overflow:true,no_visible_ids_storage_paths_sha_or_provenance:true,no_images_or_media_requests:true,console_and_accepted_http_routes_clean:true},
 limits:{mobile_click_from_filter:'Unvalidated: inline wrapped link bounding-box centre hits its parent paragraph; original unsuccessful observation preserved',
 chrome:'Localhost rejected by browser client; no Chrome conclusion',guard_refusals:{count:1,method:'GET',status:403,route_not_accepted:true,request_origin_not_logged:true},actual_touch_gesture_emulation:false,root_assembled_integration_pending:true},
 observations:Object.fromEntries(await Promise.all(['browser-observations.json','browser-shortcut-keyboard.json','browser-shortcut-followup.json'].map(async name=>[name,pin(await readFile(join(run,name)))]))),
 preview_stopped:{port,status:'ECONNREFUSED'},temporary_tab_30_closed:true,viewport_reset:true
});
await write('preview-closeout.json',{origin:session.origin,status:'ECONNREFUSED',temporary_tab:'30',tab_closed:true,viewport_reset:true,root_service_and_other_tabs_untouched:true});
await writeFile(join(run,'code-snapshot/close-e108-human-publication-delta.mjs'),await readFile(new URL(import.meta.url)),{flag:'wx'});
console.log(JSON.stringify({browser_gate:pin(await readFile(join(run,'browser-gate.json'))),preview_stopped:port,ready_for_bounded_review:true},null,2));
