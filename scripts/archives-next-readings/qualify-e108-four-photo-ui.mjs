import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {digest,TWO_PHOTOS} from './e108-two-photo-adapter.mjs';
import {fourPin,NEW_E108_PHOTOS} from './e108-four-photo-composition.mjs';
const run=resolve('.private/archives-next-readings/e108-four-photo-current-parent-delta-20261004-v1');
const json=async n=>JSON.parse(await readFile(join(run,n)));
const write=async(n,x)=>writeFile(join(run,n),JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const proofBytes=await readFile(join(run,'build-proof.json'));
assert.equal(digest(proofBytes),'c36efa633471e9bdb7f4c383e1f9cd086ca59b92eefe8e33169b13310d593df3');
const proof=JSON.parse(proofBytes),obs=await json('browser-observations.json'),session=await json('preview-session.json');
for(const [n,p]of Object.entries(proof.outputs))assert.deepEqual(fourPin(await readFile(join(run,n))),p,n);
assert.equal(proof.inherited_file_count,443);assert.equal(proof.inherited_jpegs,23);assert.equal(proof.total_jpegs,25);
assert.deepEqual(obs.statusboard.metrics,['3','166','2 989']);
assert(obs.statusboard.e108.includes('4 photos consultables sur 4'));
assert(obs.statusboard.e108.includes('Même acte probable, à confirmer'));
assert(obs.statusboard.e108.includes('L’ordre physique et l’identité de l’acte sont à confirmer'));
assert(obs.statusboard.photoCount.includes('25 photographies sont consultables avec zoom.'));
assert.equal(obs.statusboard.visibleTechnical,false);assert(obs.statusboard.scrollWidth<=390);
for(const key of ['ensemble','restored']){
 const state=obs[key];assert.equal(state.groups,1);assert.equal(state.cards,17);assert.equal(state.members.length,4);
 for(const p of [...TWO_PHOTOS,...NEW_E108_PHOTOS]){const m=state.members.find(m=>m.id===p.id);assert(m);assert.equal(m.path,p.path);assert.equal(m.src,p.route);assert.equal(m.title,'Vue '+p.number+' · '+p.filename);}
 assert(state.countText.includes('31 photographies'));assert.equal(state.visibleTechnical,false);assert(state.scrollWidth<=390);
}
for(const p of NEW_E108_PHOTOS){
 for(const mode of ['fit','native']){
  const state=obs['photo'+p.number+'_'+mode];assert.equal(state.width,390);assert.equal(state.height,844);assert.equal(state.dialog.open,true);
  assert.equal(state.dialog.src,p.route);assert.equal(state.dialog.title,'E.108 · '+p.filename);assert.deepEqual(state.dialog.natural,p.dimensions);
  assert.equal(state.dialog.transform,'none');assert.equal(state.dialog.scale,mode);assert(state.scrollWidth<=390);assert.equal(state.visibleTechnical,false);
  if(mode==='native')assert.deepEqual(state.dialog.size,p.dimensions);
 }
 const closed=obs['photo'+p.number+'_closed'];assert.equal(closed.dialog.open,false);assert.equal(closed.dialog.src,null);assert.equal(closed.active,'e108-photo-open-'+p.number);
}
assert.equal(obs.partial13.groups,0);assert.equal(obs.partial13.cards,1);assert.equal(obs.partial13.query,'13.jpg');assert.equal(obs.partial13.members.length,0);
assert.equal(obs.partial13.visibleTechnical,false);assert(obs.partial13.scrollWidth<=390);
assert.equal(obs.restored.query,'');assert.equal(obs.restored.active,'ensemble-e108-11-14');assert.deepEqual(obs.logs,[]);assert.deepEqual(obs.only_opened_photos,[13,14]);
const http=[];
for(const route of ['/archives/catalogue/','/archives/avancement/',...NEW_E108_PHOTOS.map(p=>p.route)]){
 const res=await fetch(session.origin+route,{redirect:'error'});assert.equal(res.status,200);
 const b=Buffer.from(await res.arrayBuffer()),target=route==='/archives/catalogue/'?'dist/archives/catalogue/index.html':route==='/archives/avancement/'?'dist/archives/avancement/index.html':'dist'+route;
 assert.deepEqual(fourPin(b),proof.outputs['composition/'+target]);
 const csp=res.headers.get('content-security-policy');assert(csp&&!/unsafe-inline|unsafe-eval|https?:/.test(csp));http.push({route,status:res.status,...fourPin(b),csp});
}
const partial='/__catalogue_hierarchy?folder='+encodeURIComponent(proof.folder)+'&page_size=20&page=1&query=13.jpg';
const res=await fetch(session.origin+partial,{redirect:'error'});assert.equal(res.status,200);
const bytes=Buffer.from(await res.arrayBuffer()),data=JSON.parse(bytes);assert.equal(data.entries.length,1);assert.equal(data.entries[0].record.digitalObjectId,NEW_E108_PHOTOS[0].id);assert.equal(data.entries[0].record.fileName.literal,'13.jpg');
http.push({route:partial,status:res.status,...fourPin(bytes)});
const negatives=[];
for(const [name,key,value]of [['page','page','2'],['size','page_size','1000'],['unknown','unknown','1'],['scope','collection_scope','other'],['filter','priority','urgent'],['query','query','14.jpg']]){
 const u=new URL(partial,session.origin);u.searchParams.set(key,value);const r=await fetch(u,{redirect:'error'});assert.equal(r.status,400,name);assert.equal(r.headers.get('content-type'),'application/json');const b=Buffer.from(await r.arrayBuffer());assert.deepEqual(JSON.parse(b),{error:'Parcours hors du pilote E10813/14'});
 negatives.push({name,route:u.pathname,query:u.search,status:400,...fourPin(b)});
}
await write('http-gate.json',http);await write('preview-negative-gate.json',{format:'e108-four-preview-scope-gate/1',intentional_rejections:negatives,all_json400:true,get_only:true});
await write('browser-gate.json',{
 format:'e108-four-photo-current-parent-browser-gate/1',build_proof:fourPin(proofBytes),observations:fourPin(await readFile(join(run,'browser-observations.json'))),mobile:{width:390,height:844},
 checks:{statusboard_human_4_of_4_and_total25:true,current_runtime_four_members_four_routes:true,act_probable_physical_order_unconfirmed:true,partial13_keyboard_search_one_card_no_group:true,shortcut_keyboard_restores_17_cards_group_focus:true,new13_14_fit_native_identity_2976_3968:true,new13_14_close_paths_restore_exact_focus:true,no_visible_technical_fields_or_page_overflow:true,console_current_empty:true,actual_static_and_two_new_media_bytes_match_whitelist:true,real_partial_api_source13_exact:true,private_guard_six_out_of_scope_gets_json400:true,old11_12_ui_not_retested:true},
 qualified_activation:obs.activation,only_opened_photos:obs.only_opened_photos,integrated_trusted_touch_gate_passed:false,
 limitation:'Mini gate covers new13/14 and partial13 at390×844 through exact keyboard controls. Root must perform trusted touch qualification on the final assembled preview before main mount. Previous11/12 fit/native UI was not repeated.',
 root_main_mount_executed:false,public_activation:false
});
await writeFile(join(run,'code-snapshot/qualify-e108-four-photo-ui.mjs'),await readFile(new URL(import.meta.url)),{flag:'wx'});
console.log(JSON.stringify({browser_gate:fourPin(await readFile(join(run,'browser-gate.json'))),http_cases:http.length,intentional_negative_gets:negatives.length,root_integrated_touch_pending:true},null,2));
