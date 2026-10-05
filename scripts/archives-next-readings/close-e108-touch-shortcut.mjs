import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createConnection} from 'node:net';
import assert from 'node:assert/strict';
import {digest,E108_TOUCH_RULE,restoreE108TouchShortcutCss} from './e108-touch-shortcut-adapter.mjs';
const run=resolve('.private/archives-next-readings/e108-touch-shortcut-20261004-v1');
const pin=b=>({sha256:digest(b),bytes:b.length});
const json=async n=>JSON.parse(await readFile(join(run,n)));
const write=async(n,v)=>writeFile(join(run,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const proofBytes=await readFile(join(run,'build-proof.json'));assert.equal(digest(proofBytes),'5112b48cf3443c9cc62e40a4b721030c80bcb2e24454362798022cce31423be7');
const proof=JSON.parse(proofBytes),observed=await json('browser-observations.json');
for(const [name,expected]of Object.entries(proof.outputs))assert.deepEqual(pin(await readFile(join(run,name))),expected,name);
assert(restoreE108TouchShortcutCss(await readFile(join(run,'catalogue-ensemble.css'))).equals(await readFile(join(run,'inputs/parent-ensemble.css'))));
assert.equal((await readFile(join(run,'touch-shortcut-rule.css'),'utf8')),E108_TOUCH_RULE);
const parentHtml=await readFile(join(run,'inputs/parent-dynamic-e108.html'),'utf8');
assert.equal((await readFile(join(run,'preview.html'),'utf8')).replace('<script src="/__touch-shortcut-probe.js" defer></script>\n',''),parentHtml);
const href=parentHtml.match(/<a\b[^>]*\bid="e108-ensemble-link"[^>]*href="([^"]+)"/)?.[1];
assert.equal(observed.before.href,href);assert.equal(observed.before.display,'block');assert.equal(observed.before.minHeight,'44px');
assert.equal(observed.before.rects.length,1);assert(observed.before.box.height>=44);assert(observed.before.box.width>=44);assert.equal(observed.before.centerIsLink,true);
assert.equal(observed.before.query,'11.jpg');assert.equal(observed.before.cards,1);assert.equal(observed.before.groups,0);
for(const state of [observed.trusted_pointer_after,observed.keyboard_after]){
 assert.equal(state.width,390);assert.equal(state.height,844);assert(state.scrollWidth<=state.width);
 assert.equal(state.query,'');assert.equal(state.groups,1);assert.equal(state.cards,17);assert.equal(state.busy,'false');
 assert.equal(state.active,'ensemble-e108-11-14');assert.equal(state.hash,'#ensemble-e108-11-14');
 assert(state.countText.includes('31 photographies'));assert.equal(state.images,0);assert.equal(state.visibleTechnical,false);
}
const members=(await json('inputs/ensemble.json')).members;
assert.deepEqual(observed.trusted_pointer_after.members,members.map(m=>({id:m.object_id,path:m.logical_path,label:'Vue '+Number(m.filename.replace('.jpg',''))+' · '+m.filename})));
const pointer=observed.trusted_pointer_after.events;
assert.deepEqual(pointer.map(e=>e.type),['pointerdown','pointerup','click']);
for(const event of pointer){
 assert.equal(event.isTrusted,true);assert.equal(event.pointerType,'mouse');assert.equal(event.targetTag,'A');assert.equal(event.href,href);
 assert.equal(event.queryBefore,'11.jpg');assert(Math.abs(event.clientX-(event.box.x+event.box.width/2))<=1);assert(Math.abs(event.clientY-(event.box.y+event.box.height/2))<=1);
}
const keyboard=observed.keyboard_after.events.slice(pointer.length);
assert.deepEqual(keyboard.map(e=>e.type),['keydown','click']);assert.equal(keyboard[0].key,'Enter');
assert(keyboard.every(e=>e.isTrusted&&e.pointerType===null&&e.queryBefore==='11.jpg'));
assert.equal(observed.real_touch_event_verified,false);assert(!observed.trusted_pointer_after.events.some(e=>e.pointerType==='touch'));
assert.deepEqual(observed.logs,[]);
const requests=await json('preview-requests.json');
const routes=new Set(['/archives/catalogue/','/assets/archives-hierarchy.js','/assets/archives-catalogue-ensemble.js','/assets/archives-catalogue-ensemble.css','/__touch-shortcut-probe.js','/styles.css','/assets/archives-integration-navigation.css','/assets/archives-catalogue.css','/assets/archives-human-catalogue-public-labels.css','/__catalogue_hierarchy','/favicon.svg','/favicon.ico']);
assert(requests.length>0&&requests.every(r=>r.method==='GET'&&[200,204].includes(r.status)&&routes.has(r.route)));
const session=await json('preview-session.json'),port=Number(new URL(session.origin).port);
await new Promise((ok,bad)=>{const socket=createConnection({host:'127.0.0.1',port});socket.setTimeout(2000,()=>{socket.destroy();bad(Error('closeout timeout'));});socket.on('connect',()=>{socket.destroy();bad(Error('preview still running'));});socket.on('error',e=>e.code==='ECONNREFUSED'?ok():bad(e));});
const parentRun=resolve('.private/archives-next-readings/e108-human-publication-delta-20261004-v1');
assert.equal(digest(await readFile(join(parentRun,'seal.json'))),proof.parent_seal.sha256);
for(const name of ['catalogue-ensemble.css','catalogue-ensemble.js','archives-hierarchy.js','dynamic-e108.html'])assert.equal(digest(await readFile(join(parentRun,name))),name==='catalogue-ensemble.css'?digest(await readFile(join(run,'inputs/parent-ensemble.css'))):name==='dynamic-e108.html'?digest(Buffer.from(parentHtml)):proof.outputs[name].sha256);
await write('browser-gate.json',{
 format:'e108-touch-shortcut-browser-gate/1',build_proof:pin(proofBytes),native_pointer_gate_passed:true,keyboard_gate_passed:true,requested_real_touch_gate_passed:false,
 mobile:{width:390,height:844,target_width:observed.before.box.width,target_height:observed.before.box.height,display:'block',min_height:'44px',centre_hits_link:true},
 pointer:{event_sequence:['pointerdown','pointerup','click'],isTrusted:true,pointerType:'mouse',centre_activation:true,query_before:'11.jpg',query_after:'',cards_before:1,cards_after:17,groups_after:1,focus:'ensemble-e108-11-14',hash:'#ensemble-e108-11-14'},
 checks:{href_and_product_html_js_unchanged:true,exact_four_members_preserved:true,count_31_preserved:true,keyboard_checked_separately:true,no_overflow_or_visible_technical_fields:true,private_probe_excluded_from_public_change:true,no_media_post_or_root_mutation:true,console_and_http_clean:true},
 limitation:'Available CUA browser controls deliver trusted mouse pointer events. No touch input API is exposed; no pointerType touch or physical touchscreen tap is claimed. The requested real touch gate remains pending.',
 root_v20_h07_hierarchy_kept:true,root_assembled_gate_pending:true,preview_stopped:{port,status:'ECONNREFUSED'},temporary_tab_31_closed:true,viewport_reset:true,
 observations:pin(await readFile(join(run,'browser-observations.json')))
});
await write('preview-closeout.json',{origin:session.origin,status:'ECONNREFUSED',tab:'31',tab_closed:true,viewport_reset:true,root_live_and_closed_parent_untouched:true});
await writeFile(join(run,'code-snapshot/close-e108-touch-shortcut.mjs'),await readFile(new URL(import.meta.url)),{flag:'wx'});
const references={};for(const name of ['HANDOFF.md','build-proof.json','browser-gate.json','independent-review.json','integration-contract.json','preview-closeout.json'])references[name]=pin(await readFile(join(run,name)));
await write('closeout.json',{format:'e108-touch-shortcut-closeout/1',css_delta_ready_for_root_integration:true,requested_real_touch_gate_complete:false,native_mouse_centre_and_keyboard_qualified:true,
 root_v20_h07_hierarchy_not_replaced:true,root_live_and_closed_parent_modified:false,public_change:'Only scoped CSS shortcut rectangle',private_probe_not_deployable:true,preview_stopped:true,references});
const entries=[];const walk=async(dir,prefix='')=>{for(const d of await readdir(dir,{withFileTypes:true})){assert(!d.isSymbolicLink());const name=prefix+d.name,path=join(dir,d.name);if(d.isDirectory())await walk(path,name+'/');else if(d.isFile()&&name!=='seal.json')entries.push([name,pin(await readFile(path))]);}};await walk(run);entries.sort(([a],[b])=>a.localeCompare(b));
await write('seal.json',{format:'immutable-run-seal/1',files:Object.fromEntries(entries),file_count:entries.length});
for(const [name,expected]of entries)assert.deepEqual(pin(await readFile(join(run,name))),expected,name);
console.log(JSON.stringify({closed:true,files:entries.length,real_touch_gate_complete:false,handoff:references['HANDOFF.md'],browser_gate:references['browser-gate.json'],seal:pin(await readFile(join(run,'seal.json')))},null,2));
