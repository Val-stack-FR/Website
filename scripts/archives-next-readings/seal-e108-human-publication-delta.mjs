import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {digest} from './e108-human-publication-adapter.mjs';
const run=resolve('.private/archives-next-readings/e108-human-publication-delta-20261004-v1');
const pin=b=>({sha256:digest(b),bytes:b.length});
const write=async(name,value)=>writeFile(join(run,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const gateBytes=await readFile(join(run,'browser-gate.json'));
assert.equal(digest(gateBytes),'5e5cc7626e135e63aeded19fdcf862a717a50251e48e8aac84efd3944502f271');
await write('independent-review.json',{
 format:'e108-human-publication-adversarial-review/1',reviewer:'/root/reader_review',model:'gpt-5.6-sol',findings:[],
 scope:'Generated delta and source scripts, then recorded bounded browser observations; no assembled Root gate',
 checks:{root_helper_logic_unchanged_outside_human_paragraph:true,ensemble_css_byte_identical:true,
 hierarchy_hook_exact_id_path_filename_data_attributes_only:true,fetch_urls_links_and_source_rows_unchanged:true,
 ensemble_observer_busy_exact_folder_four_unique_members_and_focus_preserved:true,probable_act_historical_folder_and_unestablished_physical_order_preserved:true,
 desktop_mobile_human_details_and_partial_query_qualified:true,desktop_click_and_mobile_keyboard_return_qualified:true},
 limits:{mobile_direct_touch_not_qualified:true,initial_mobile_click_missed_inline_link_interline:true,chrome_localhost_unavailable:true,
 single_get_guard_refusal_before_route_acceptance_recorded:true,root_assembled_integration_pending:true}
});
await writeFile(join(run,'code-snapshot/seal-e108-human-publication-delta.mjs'),await readFile(new URL(import.meta.url)),{flag:'wx'});
const references={};
for(const name of ['HANDOFF.md','build-proof.json','browser-gate.json','independent-review.json','integration-contract.json','preview-closeout.json'])references[name]=pin(await readFile(join(run,name)));
await write('closeout.json',{
 format:'e108-human-publication-closeout/1',ready_for_root_recomposition:true,root_assembled_integration_pending:true,
 scope:'Minimal E108 human catalogue delta against closed v19-r2; original four-view classification and source rows retained',
 static_and_dynamic_response_projection_ready:true,hierarchy_data_hook_required:true,new_media:0,new_canonical_acts:0,source_photo_bytes_read:0,
 root_runtime_builder_closed_packages_and_databases_modified:false,preview_server_stopped:true,temporary_tab_closed:true,viewport_reset:true,
 original_unsuccessful_mobile_click_evidence_preserved:true,mobile_touch_and_chrome_not_claimed:true,guard_get_refusal_recorded:true,references
});
const entries=[];
const walk=async(dir,prefix='')=>{
 for(const entry of await readdir(dir,{withFileTypes:true})){
  assert(!entry.isSymbolicLink());const name=prefix+entry.name,path=join(dir,entry.name);
  if(entry.isDirectory())await walk(path,name+'/');
  else if(entry.isFile()&&name!=='seal.json')entries.push([name,pin(await readFile(path))]);
 }
};
await walk(run);entries.sort(([a],[b])=>a.localeCompare(b));
await write('seal.json',{format:'immutable-run-seal/1',files:Object.fromEntries(entries),file_count:entries.length});
for(const [name,expected] of entries)assert.deepEqual(pin(await readFile(join(run,name))),expected,name);
console.log(JSON.stringify({closed:true,files:entries.length,handoff:references['HANDOFF.md'],browser_gate:references['browser-gate.json'],seal:pin(await readFile(join(run,'seal.json')))},null,2));
