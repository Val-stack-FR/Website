import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {digest,composePublicStatusboard,PUBLIC_STATUSBOARD_PARENT_SHA} from './public-statusboard-adapter.mjs';
const parent=resolve('.private/archives-integration/publication-package-20261004-v24-r2'),run=resolve('.private/archives-next-readings/public-statusboard-delta-20261004-v1');
const pin=b=>({sha256:digest(b),bytes:b.length}),serialize=x=>Buffer.from(JSON.stringify(x,null,2)+'\n'),outputs=new Map(),sources={};
const assemblyBytes=await readFile(join(parent,'assembly.json'));assert.equal(digest(assemblyBytes),'aaa8b5c87cd7a7baf6d2d33489d0955f7f8940a8055789b76258ebaba9e61a11');
const assembly=JSON.parse(assemblyBytes);
const read=async name=>{const b=await readFile(join(parent,'site',name));assert.equal(digest(b),assembly.files[name].sha256,name);assert.equal(b.length,assembly.files[name].size_bytes,name);sources[name]=pin(b);return b;};
const parentHtml=await read('dist/archives/avancement/index.html');assert.equal(digest(parentHtml),PUBLIC_STATUSBOARD_PARENT_SHA);
const dataBytes=await read('runtime/archives/selected-data.json'),data=JSON.parse(dataBytes),library=await read('dist/archives/fichiers/index.html');
const records=data.catalogue.records;assert.equal(records.length,2989);assert.equal(records.filter(r=>r.collection_scope==='clean'&&r.media_type.startsWith('image/')).length,2989);assert.equal(new Set(records.map(r=>r.digital_object_id)).size,2989);
assert.equal(data.text_records.length,166);assert.equal(data.text_records.filter(r=>r.source_empty).length,5);assert.equal(assembly.counts.texts,166);
assert.equal((library.toString('utf8').match(/class="file-entry"/g)||[]).length,3);
const files=[
 {reference:'Une vue · rattachement à établir',label:'Corps visible (P09)',href:'/archives/fichiers/p09/',points_href:'/archives/fichiers/p09/#points-review',summary:'21 lignes de transcription préparées.',next:'4 points à revoir · 3 petits extraits · 1 cadrage à préparer'},
 {reference:'E.133 · Dossier Louis de Tucé',label:'Page 1.jpg',href:'/archives/fichiers/e133-page-1/',points_href:'/archives/fichiers/e133-page-1/#points-review',summary:'10 passages préparés · 37 lignes de transcription.',next:'Trois éditions de travail et leurs difficultés à comparer.'},
 {reference:'E.113 · Dossier Jeanne de Tucé',label:'Marge (1).jpg',href:'/archives/fichiers/e113-marge-1/',points_href:'/archives/fichiers/e113-marge-1/#points-review',summary:'Un fragment préparé · 4 lignes de transcription.',next:'Trois éditions de travail et leurs difficultés à comparer.'}
];
for(const f of files){const page=await read('dist'+f.href+'index.html');assert(page.toString('utf8').includes('id="points-review"'));assert(library.toString('utf8').includes(f.href));}
for(const text of ['21 lignes','37 lignes de transcription','4 lignes de transcription'])assert(library.toString('utf8').includes(text));
const folders=[...new Set(records.map(r=>r.logical_path.slice(0,r.logical_path.lastIndexOf('/'))))];
const folder=predicate=>{const found=folders.filter(predicate);assert.equal(found.length,1);return found[0];};
const first=folder(p=>p.endsWith('/Jean de Tucé possibilité 1')),second=folder(p=>p.endsWith('/Jean de Tucé possibilité 2'));
const bouton=folder(p=>p.includes('André Bouton')&&p.includes('04.06.1459 - Baillée à toujoursmais'));
const catalogueHref=path=>'/archives/catalogue/?folder='+encodeURIComponent(path);
const catalogue=await read('dist/archives/catalogue/index.html');
const ensembleHref=catalogue.toString('utf8').match(/id="e108-ensemble-link" href="([^"]+)"/)?.[1];assert(ensembleHref?.endsWith('#ensemble-e108-11-14'));
const ensembleFolder=new URL(ensembleHref,'https://local.invalid').searchParams.get('folder');
const ensembleMembers=records.filter(r=>r.logical_path.slice(0,r.logical_path.lastIndexOf('/'))===ensembleFolder&&['11.jpg','12.jpg','13.jpg','14.jpg'].includes(r.file_name.literal));
assert.equal(ensembleMembers.length,4);assert(ensembleMembers.every(r=>r.consultation.available===false));assert.equal(assembly.e108.same_act_probable_unconfirmed,true);
const model={format:'public-statusboard-selection/1',counts:{prepared_reading_files:3,preexisting_text_files:166,empty_preexisting_text_files:5,catalogue_image_files:2989},files,
 ensemble:{view_count:4,href:ensembleHref,classification:'same act probable, unconfirmed',jpeg_available:false},
 priorities:[
 {title:'E.99 — Jean de Tucé, possibilité 1',reason:'Poursuivre une piste liée à Tucé, en gardant les passages incertains visibles.',next:'Comparer les textes disponibles avant d’étendre un premier passage lisible.',href:catalogueHref(first)},
 {title:'E.99 — Jean de Tucé, possibilité 2',reason:'Examiner cette seconde piste dans son propre dossier.',next:'Reprendre le cadrage et choisir un petit passage lisible pour une relecture.',href:catalogueHref(second)},
 {title:'Bouton — piste « baillée de 1459 »',reason:'Une piste pour les transmissions et les droits liés à Tucé.',next:'Vérifier la nature de la pièce avant de choisir la méthode de lecture.',href:catalogueHref(bouton)}
 ]};
const result=composePublicStatusboard(parentHtml,model);assert(result.agentMetadataPreserved);assert(result.html.includes('<template id="agent-statusboard-metadata"'));assert.throws(()=>composePublicStatusboard(Buffer.from(result.html),model));
const active=result.html.replace(/<template\b[\s\S]*?<\/template>/g,'');assert(!/<script\b|\sstyle=|\son[a-z]+=/i.test(active));assert(!/SHA256|object:path|\.private|[a-f0-9]{64}|CLEAN\/|runner/i.test(active.replace(/<[^>]*>/g,'')));
const links=[...active.matchAll(/href="([^"]+)"/g)].map(m=>m[1].replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
const routeProofs=[];
for(const href of new Set(links)){const url=new URL(href,'https://local.invalid');if(href.startsWith('#')||url.pathname==='/assets/archives-public-statusboard.css')continue;
 const name='dist'+url.pathname+(url.pathname.endsWith('/')?'index.html':'');const b=await read(name);
 if(url.hash)assert(b.toString('utf8').includes('id="'+url.hash.slice(1)+'"'),name+' '+url.hash);
 if(url.searchParams.has('folder'))assert(records.some(r=>r.logical_path.startsWith(url.searchParams.get('folder')+'/')));
 routeProofs.push({href,target:name,...pin(b),fragment_verified:!!url.hash,folder_verified:url.searchParams.has('folder')});
}
const todoPath='C:/Users/Val/Documents/ChatGPT/PERSO/atelier-tuce/TODO.md',statePath='C:/Users/Val/Documents/ChatGPT/PERSO/atelier-tuce/ETAT.md';
const todo=await readFile(todoPath,'utf8'),state=await readFile(statePath,'utf8');
outputs.set('inputs/latest-todo-excerpt.md',Buffer.from(todo.split(/\r?\n/).slice(0,29).join('\n')+'\n'));
outputs.set('inputs/latest-state-excerpt.md',Buffer.from(state.split(/\r?\n/).slice(0,10).join('\n')+'\n'));
outputs.set('metadata/parent-statusboard.html',parentHtml);outputs.set('metadata/selected-evidence.json',serialize({parent_package:'publication-package-20261004-v24-r2',assembly:pin(assemblyBytes),selected_runtime:pin(dataBytes),counts:model.counts,files:files.map(f=>({href:f.href,units:'file and transcription lines, not complete acts'})),ensemble:{folder:ensembleFolder,members:ensembleMembers.map(r=>({id:r.digital_object_id,path:r.logical_path,filename:r.file_name.literal,consultation_available:r.consultation.available})),probable_only:true},priorities:[first,second,bouton],route_proofs:routeProofs,sources}));
outputs.set('public-model.json',serialize(model));outputs.set('avancement.html',Buffer.from(result.html));outputs.set('public-statusboard.css',await readFile('scripts/archives-next-readings/public-statusboard.css'));
for(const name of ['public-statusboard-adapter.mjs','public-statusboard.css','prepare-public-statusboard-delta.mjs','public-statusboard-preview.mjs'])outputs.set('code-snapshot/'+name,await readFile('scripts/archives-next-readings/'+name));
const contract={format:'public-statusboard-delta/1',parent_package:'publication-package-20261004-v24-r2',parent_assembly:pin(assemblyBytes),parent_statusboard:pin(parentHtml),
 public_routes:[{route:'/archives/avancement/',file:'avancement.html',type:'text/html; charset=utf-8'},{route:'/assets/archives-public-statusboard.css',file:'public-statusboard.css',type:'text/css; charset=utf-8'}],
 composition:'Replace only the selected static statusboard page and add its scoped external stylesheet; keep agent statusboard source in inert template and private metadata',
 agent_statusboard_data_unchanged:true,agent_parent_main_preserved_in_inert_template:true,unit_counts_verified:true,version_or_act_completion_count_displayed:false,historical_validation_claimed:false,new_media_or_js:0,parent_and_live_modified:false,root_assembled_gate_pending:true};
outputs.set('integration-contract.json',serialize(contract));await mkdir(run);
for(const [name,b]of outputs){const target=join(run,name);await mkdir(dirname(target),{recursive:true});await writeFile(target,b,{flag:'wx'});}
const proof={format:'public-statusboard-build/1',parent_assembly:pin(assemblyBytes),sources,outputs:Object.fromEntries([...outputs].map(([name,b])=>[name,pin(b)])),public_routes:contract.public_routes,checks:{counts_3_files_166_text_files_2989_image_files:true,empty_text_files_5:true,e108_4_members_without_consultation_link:true,all_link_destinations_and_fragments_or_folders_verified:true,parent_agent_main_preserved:true,no_inline_code_or_visible_technical_metadata:true,no_media_read_or_new_js:true,no_root_mutations:true},browser_gate_pending:true};
const proofBytes=serialize(proof);await writeFile(join(run,'build-proof.json'),proofBytes,{flag:'wx'});console.log(JSON.stringify({run,proof:pin(proofBytes),counts:model.counts,links:routeProofs.length},null,2));
