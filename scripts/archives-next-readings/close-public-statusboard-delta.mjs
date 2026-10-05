import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createConnection} from 'node:net';
import assert from 'node:assert/strict';
import {digest,composePublicStatusboard} from './public-statusboard-adapter.mjs';
const run=resolve('.private/archives-next-readings/public-statusboard-delta-20261004-v1'),parent=resolve('.private/archives-integration/publication-package-20261004-v24-r2');
const pin=b=>({sha256:digest(b),bytes:b.length}),json=async n=>JSON.parse(await readFile(join(run,n)));
const write=async(n,v)=>writeFile(join(run,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const proofBytes=await readFile(join(run,'build-proof.json'));assert.equal(digest(proofBytes),'099f57e0b0b5052eb4744226ba828ae3d3187d596c824c30086601c06efbfbed');
const proof=JSON.parse(proofBytes),observed=await json('browser-observations.json'),evidence=await json('metadata/selected-evidence.json');
for(const [name,expected]of Object.entries(proof.outputs))assert.deepEqual(pin(await readFile(join(run,name))),expected,name);
assert.deepEqual(pin(await readFile(join(parent,'assembly.json'))),proof.parent_assembly);
for(const [name,expected]of Object.entries(proof.sources))assert.deepEqual(pin(await readFile(join(parent,'site',name))),expected,name);
const parentHtml=await readFile(join(run,'metadata/parent-statusboard.html'));
const composed=composePublicStatusboard(parentHtml,await json('public-model.json'));
assert.equal(await readFile(join(run,'avancement.html'),'utf8'),composed.html);
assert(composed.html.includes('<template id="agent-statusboard-metadata" data-parent-snapshot="selected-statusboard">'+composed.parentMain+'</template>'));
assert.equal(evidence.parent_package,'publication-package-20261004-v24-r2');assert.equal(evidence.route_proofs.length,20);
for(const [name,state]of Object.entries(observed)){
 if(!state||!state.width)continue;
 assert([1280,390].includes(state.width));assert(state.scrollWidth<=state.width,name);assert.equal(state.visibleTechnical,false,name);
 assert.equal(state.templateMainCount,1);assert.equal(state.images,0);assert.equal(state.scripts,0);
 assert.equal(state.readingCards.length,3);assert(state.readingCards.every(c=>c.state==='Lecture à revoir'));
 assert.deepEqual(state.priorities,['E.99 — Jean de Tucé, possibilité 1','E.99 — Jean de Tucé, possibilité 2','Bouton — piste « baillée de 1459 »']);
 assert.equal(state.metrics.length,3);assert(state.metrics[0].startsWith('3\n'));assert(state.metrics[1].startsWith('166\n'));assert(state.metrics[1].includes('5 fichiers sans contenu'));assert(state.metrics[2].startsWith('2 989\n'));
 for(const link of state.links)if(!link.href.startsWith('#'))assert(evidence.route_proofs.some(p=>p.href===link.href),link.href);
}
for(const [name,id]of [['mobile_files_keyboard','consultable'],['mobile_review_pointer','relecture'],['mobile_priorities_keyboard','priorites']]){
 const state=observed[name];assert.equal(state.hash,'#'+id);assert(state.sectionTop[id]>=0&&state.sectionTop[id]<50);assert.equal(state.width,390);assert.equal(state.height,844);
}
assert.equal(observed.mobile_skip.hash,'#avancement');assert.equal(observed.mobile_skip.active,'avancement');
assert.deepEqual(observed.logs,[]);assert.equal(observed.destination_pages_not_opened,true);
const requests=await json('preview-requests.json');assert(requests.length>0&&requests.every(r=>r.method==='GET'&&[200,204].includes(r.status)&&['/archives/avancement/','/assets/archives-public-statusboard.css','/favicon.svg','/favicon.ico'].includes(r.route)));
const session=await json('preview-session.json'),port=Number(new URL(session.origin).port);
await new Promise((ok,bad)=>{const socket=createConnection({host:'127.0.0.1',port});socket.setTimeout(2000,()=>{socket.destroy();bad(Error('preview closeout timeout'));});socket.on('connect',()=>{socket.destroy();bad(Error('preview still running'));});socket.on('error',e=>e.code==='ECONNREFUSED'?ok():bad(e));});
await write('browser-gate.json',{format:'public-statusboard-browser-gate/1',passed:true,build_proof:pin(proofBytes),scope:'Statusboard only; destination links verified against selected parent HTML/catalogue, not reopened in browser',
 checks:{desktop_1280_mobile_390:true,correct_file_units_3_166_2989_and_empty_5:true,three_reading_files_to_review:true,e108_probable_without_prepared_photo:true,three_tuce_priority_folders:true,
 no_overflow_or_visible_technical_metadata:true,agent_parent_main_inert:true,section_pointer_and_keyboard_navigation:true,skip_link_focus:true,no_images_scripts_data_or_posts:true,console_and_http_clean:true},
 destination_browser_round_trip_not_claimed:true,root_assembled_gate_pending:true,observations:pin(await readFile(join(run,'browser-observations.json'))),preview_stopped:{port,status:'ECONNREFUSED'},temporary_tab_32_closed:true,viewport_reset:true});
await write('independent-review.json',{format:'public-statusboard-adversarial-review/1',reviewer:'/root/reader_review',model:'gpt-5.6-sol',findings:[],scope:'Source adapter, CSS, model, contract and selected evidence; browser gate separate',
 checks:{exact_v24_r2_pins:true,file_units_distinct:true,no_act_versions_or_validated_reading_counter:true,probable_e108_and_unestablished_order:true,three_priority_folders_as_pistes:true,twenty_destination_proofs:true,
 parent_main_byte_identical_in_inert_template:true,two_static_routes_only:true,no_js_or_media:true,personal_green_ivory:true,no_visible_storage_paths_ids_or_sha:true},root_assembled_gate_pending:true});
await write('preview-closeout.json',{origin:session.origin,status:'ECONNREFUSED',temporary_tab:'32',tab_closed:true,viewport_reset:true,parent_and_root_services_untouched:true});
await writeFile(join(run,'code-snapshot/close-public-statusboard-delta.mjs'),await readFile(new URL(import.meta.url)),{flag:'wx'});
const references={};for(const name of ['HANDOFF.md','build-proof.json','browser-gate.json','independent-review.json','integration-contract.json','preview-closeout.json'])references[name]=pin(await readFile(join(run,name)));
await write('closeout.json',{format:'public-statusboard-closeout/1',ready_for_root_integration:true,parent:'publication-package-20261004-v24-r2',root_assembled_gate_pending:true,
 public_routes:proof.public_routes.map(r=>r.route),new_js_or_media:0,photo_bytes_read:0,agent_data_and_parent_preserved:true,parent_and_live_modified:false,preview_stopped:true,temporary_tab_closed:true,viewport_reset:true,references});
const entries=[];const walk=async(dir,prefix='')=>{for(const d of await readdir(dir,{withFileTypes:true})){assert(!d.isSymbolicLink());const name=prefix+d.name,path=join(dir,d.name);if(d.isDirectory())await walk(path,name+'/');else if(d.isFile()&&name!=='seal.json')entries.push([name,pin(await readFile(path))]);}};await walk(run);entries.sort(([a],[b])=>a.localeCompare(b));
await write('seal.json',{format:'immutable-run-seal/1',files:Object.fromEntries(entries),file_count:entries.length});for(const [name,expected]of entries)assert.deepEqual(pin(await readFile(join(run,name))),expected,name);
console.log(JSON.stringify({closed:true,files:entries.length,handoff:references['HANDOFF.md'],browser_gate:references['browser-gate.json'],seal:pin(await readFile(join(run,'seal.json')))},null,2));
