import {readFile,writeFile,mkdir,readdir,realpath} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {connect} from 'node:net';
import assert from 'node:assert/strict';

const out=resolve('.private/archives-integration/publication-package-20261004-v33');
const parent=resolve('.private/archives-integration/publication-package-20261004-v32-r2');
const standalone=resolve('.private/archives-next-readings/e99-p08-six-line-reader-addon-20261004-v1');
const sha=b=>createHash('sha256').update(b).digest('hex');
const pin=b=>({size_bytes:b.length,sha256:sha(b)});
const read=async n=>readFile(resolve(out,n));
const parse=async n=>JSON.parse(await read(n));
const json=x=>Buffer.from(JSON.stringify(x,null,2)+'\n');
try{await read('candidate-seal.json');throw Error('Closed candidate must remain immutable');}catch(e){if(e.code!=='ENOENT')throw e;}
const put=async(n,b)=>{try{const existing=await read(n);assert(existing.equals(b),'Unsealed resumed metadata differs: '+n);return;}catch(e){if(e.code!=='ENOENT')throw e;}await mkdir(dirname(resolve(out,n)),{recursive:true});await writeFile(resolve(out,n),b,{flag:'wx'});};
const putJson=async(n,x)=>put(n,json(x));
const assemblyBytes=await read('assembly.json'),assembly=JSON.parse(assemblyBytes);
assert.equal(sha(assemblyBytes),'1a376fd90c0aa636d131ffa06d9380fe212e8f511609761225952f83064a7f0c');
const evidence=await parse('source-evidence.json');
const session=await parse('preview-session.json');
assert.equal(session.port,53030);
assert.equal(session.assembly_sha256,sha(assemblyBytes));
const reader=assembly.e99_p08_reader;
const folder=new URL(reader.return_to,'http://local.invalid').searchParams.get('folder');

if(process.argv[2]==='http'){
  const results=[];
  for(const n of assembly.delta.added){
    const path=n.slice(4).replace(/index\.html$/,'');
    const response=await fetch('http://127.0.0.1:'+session.port+path);
    assert.equal(response.status,200,path);
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.deepEqual(pin(bytes),assembly.files[n],path);
    results.push({method:'GET',path,status:200,pin:pin(bytes)});
  }
  const path='/__catalogue_hierarchy?folder='+encodeURIComponent(folder);
  const response=await fetch('http://127.0.0.1:'+session.port+path);
  assert.equal(response.status,200);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.deepEqual(pin(bytes),evidence.runtime_responses.find(x=>x.route===path).pin);
  const data=JSON.parse(bytes);
  results.push({method:'GET',path,status:200,pin:pin(bytes),top_level_keys:Object.keys(data),parent_response_byte_identical:true});
  await putJson('http-integration-gate.json',{passed:true,requests:results,POST_count:0,context_API_calls:0,DB_connections:0,scope:'Seven new assets and exact-folder inherited native hierarchy response'});
  console.log(JSON.stringify({passed:true,requests:results.length,POST_count:0}));
  process.exit(0);
}
assert.equal(process.argv[2],'close');
const stopped=await parse('preview-stopped.json');
assert(stopped.closed&&stopped.port===session.port);
const closedPort=await new Promise((finish,reject)=>{
  const socket=connect({host:'127.0.0.1',port:session.port});
  socket.once('connect',()=>{socket.destroy();reject(Error('Own preview still open'));});
  socket.once('error',e=>{assert.equal(e.code,'ECONNREFUSED');finish(true);});
  socket.setTimeout(2000,()=>{socket.destroy();reject(Error('Own preview port check timed out'));});
});
const states=await parse('browser-observations.json'),consoleLog=await parse('browser-console.json'),cleanup=await parse('browser-cleanup.json');
assert.equal(states.length,5);assert.equal(consoleLog.length,0);assert(cleanup.closed&&cleanup.viewport_reset&&!cleanup.user_tabs_touched);
for(const s of states){assert.deepEqual(s.viewport,[390,844]);assert(s.pageWidth<=390&&!s.technicalVisible);}
const state=name=>{const s=states.find(x=>x.name===name);assert(s,name);return s;};
assert.equal(state('list-six-files').fileCards,6);
for(const name of ['reader-from-list','reader-from-catalogue']){
  const s=state(name);assert.equal(new URL(s.url).pathname,reader.route);assert.equal(s.originalLines,6);assert.equal(s.modernLines,6);
  assert.deepEqual(s.priorities,['R02','R04','R03']);assert.equal(new URL(s.back,'http://local.invalid').searchParams.get('folder'),folder);
}
const native=state('integrated-R02-native').dialog;
assert(native.open&&native.context==='R02'&&native.line==='R02'&&native.scale==='native');
assert.deepEqual(native.natural,[3968,271]);assert.deepEqual(native.rendered,native.natural);assert(native.centerError.every(x=>Math.abs(x)<=1));
assert.equal(native.title,'Rangée R02 — contexte photographique de la rangée, bords conservés.');
const back=state('returned-exact-folder');assert.equal(new URL(back.url).searchParams.get('folder'),folder);
assert.deepEqual(back.photoTitles,['Marge.jpg','Partie droite.jpg','Partie gauche.jpg',"Vue d'ensemble.jpg"]);
assert.equal(back.readerLinks.length,1);assert.equal(back.readerLinks[0].id,'e99-p08-reader-link');assert.equal(back.readerLinks[0].parentTitle,'Partie droite.jpg');
const requests=(await read('preview-http.jsonl')).toString().trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));
assert(requests.every(x=>['GET','HEAD'].includes(x.method)));
const incidentalRequests=requests.filter(x=>x.status!==200);
assert(incidentalRequests.every(x=>x.path==='/favicon.ico'&&x.status===404));
assert(!requests.some(x=>x.path.includes('context')&&x.path.startsWith('/api/')));
assert((await parse('http-integration-gate.json')).passed);
const pictureNames=['R02-native-confirmed-mobile.png','catalogue-link-confirmed-mobile.png'];
const picturePins=Object.fromEntries(await Promise.all(pictureNames.map(async n=>[n,pin(await read(n))])));
await putJson('browser-integration-gate.json',{
  passed:true,states_observed:states.length,scope:'List → reader → R02 native → exact catalogue folder; catalogue link → reader',
  exact_folder:folder,unique_catalogue_link_on:'Partie droite.jpg',six_lines_in_each_text:true,priority_rows:['R02','R04','R03'],
  R02_native_dimensions:[3968,271],R02_center_error:native.centerError,word_bbox:null,word_alignment:false,
  screenshots:picturePins,visually_inspected:true,console_errors:0,console_warnings:0,HTTP_request_count:requests.length,incidental_HTTP_requests:incidentalRequests,POST_count:0,
  own_preview_closed:closedPort,own_tab_closed:true,viewport_reset:true,
  earlier_captures:{'R02-native-mobile.png':'Capture showed the priorities panel, not the modal; retained as incidental evidence and excluded from the qualified screenshot set.','catalogue-return-mobile.png':'Capture showed the catalogue header; retained as incidental evidence.','full_page_capture':'Failed before any navigation; successful viewport captures used.'},
  standalone_11_states_replayed:false,main_service_touched:false,context_API_calls:0,DB_connections:0,public_activation:false
});

const receiptPath=resolve('.private/archives-integration/e99-reader-root-admission-20261004-v1/verification.json');
const receiptBytes=await readFile(receiptPath),receipt=JSON.parse(receiptBytes);
assert.equal(sha(receiptBytes),'a3f1d4fbe4bfa127cd8cdd3c32a5561e53400b8c025bc3531f08e971311a26e5');
assert(receipt.passed&&receipt.frozen_outputs_checked===118&&!receipt.public_main_activated);
assert.equal(receipt.freeze_sha256,evidence.reader_freeze.sha256);assert.equal(receipt.public_assets.length,7);
await put('root-reader-admission.json',receiptBytes);
const parentAssemblyBytes=await readFile(resolve(parent,'assembly.json')),previous=JSON.parse(parentAssemblyBytes);
assert.equal(sha(parentAssemblyBytes),evidence.parent_assembly.sha256);
assert.equal(sha(await readFile(resolve(parent,'candidate-seal.json'))),evidence.parent_seal.sha256);
assert.equal(sha(await readFile(resolve(standalone,'freeze.json'))),evidence.reader_freeze.sha256);
const allow=await parse('composition-allowlist.json');
assert.deepEqual(assembly.delta.added,allow.added.map(x=>x.path));assert.deepEqual(assembly.delta.modified,allow.modified.map(x=>x.path));assert.equal(assembly.delta.removed.length,0);
const walk=async(dir,prefix='')=>{let list=[];for(const e of await readdir(dir,{withFileTypes:true})){assert(!e.isSymbolicLink());const n=prefix+e.name;if(e.isDirectory())list.push(...await walk(resolve(dir,e.name),n+'/'));else{assert(e.isFile());list.push(n);}}return list.sort();};
const siteFiles=await walk(resolve(out,'site'));assert.deepEqual(siteFiles,Object.keys(assembly.files).sort());assert.equal(siteFiles.length,487);
for(const n of siteFiles){const p=resolve(out,'site',n);assert.equal(await realpath(p),p);assert.deepEqual(pin(await readFile(p)),assembly.files[n],n);}
const inherited=Object.keys(previous.files).filter(n=>!assembly.delta.modified.includes(n));assert.equal(inherited.length,477);
for(const n of inherited)assert.deepEqual(assembly.files[n],previous.files[n],n);
for(const n of assembly.delta.modified){const a=allow.modified.find(x=>x.path===n);assert.deepEqual(a.before,previous.files[n]);assert.deepEqual(a.after,assembly.files[n]);}
const checksums=await parse('site/runtime/package-checksums.json');assert.equal(Object.keys(checksums).length,486);assert(!Object.hasOwn(checksums,'runtime/package-checksums.json'));
for(const[n,p]of Object.entries(checksums))assert.deepEqual(p,assembly.files[n]);
const imports=await parse('api-native-imports.json'),graph=await parse('api-import-graph.json');
assert(imports.passed&&imports.entrypoints.length===11&&imports.local_modules===61&&imports.all_native_modules===75&&imports.schema_refs.length===2);
assert.equal(Object.keys(graph).length,61);assert.equal(siteFiles.filter(n=>n.endsWith('.mjs')).length,75);
assert.equal(sha(await read('api-import-graph.json')),sha(await readFile(resolve(parent,'api-import-graph.json'))));
for(const ref of imports.schema_refs)assert.deepEqual(ref.pin,assembly.files[ref.target]);
assert.equal(sha(await read('composer-snapshot.mjs')),sha(await readFile(resolve('scripts/archives-integration/add-publication-e99-reader-v33.mjs'))));
const textNames=siteFiles.filter(n=>/^dist\/archives\/textes\/fichier\/[a-f0-9]{64}\/index.html$/.test(n));assert.equal(textNames.length,166);
const jpgNames=siteFiles.filter(n=>n.endsWith('.jpg'));assert.equal(jpgNames.length,29);assert.equal(jpgNames.filter(n=>n.startsWith('dist/archives/')).length,25);assert.deepEqual(jpgNames,Object.keys(previous.files).filter(n=>n.endsWith('.jpg')).sort());
const datasets=await parse('site/runtime/archives/selected-data.json');assert.equal(datasets.text_records.length,166);assert.equal(datasets.drafts.items.length,992);
const target=datasets.catalogue.records.filter(x=>x.digital_object_id===reader.source_object_id);assert.equal(target.length,1);assert.equal(target[0].logical_path,reader.logical_path);assert.equal(target[0].consultation.available,false);
await putJson('adversarial-review.json',{status:'GO pre-closure',reviewer:'/root/reader_review',model:'gpt-5.6-sol',independent_review_completed:true,observed:{site_files:487,inherited_exact:477,added:7,modified:3,removed:0,static_files:396,text_files:166,jpeg_photos:25,API_entries:11,all_native_modules:75,reachable_modules:61,relative_schema_refs:2,checksum_records:486},closing_requests_satisfied:['Root admission receipt copied and pinned','Mini browser integration passed','Final 487-file physical inventory matches assembly','Preservation and composition recorded'],new_lexical_validation:false});
await putJson('repair-note.json',{scope:'Unsealed candidate authoring and proof capture only',first_composer_history:'history/first-composer.mjs',repair:'Response mock now starts at statusCode 200, matching Node response behavior. First failure was only in the bounded comparison harness; the copied site files were already complete.',targeted_resume:true,parent_recopy:false,standalone_gate_replayed:false,site_assets_changed_during_resume:false,screenshot_repair:'Qualified modal and catalogue-card captures replace stale incidental screenshot claims; incidental files retained.',closure_harness_repairs:['First closure guard treated the browser automatic favicon.ico 404 as a failure. No closure files had yet been written. Guard now allows only this recorded incidental request; all integration assets and routes must still succeed.','Next guard initially counted all 29 JPEGs as archive photos; four are inherited book covers. Correct check confirms 25 archive JPEGs, 29 total, all byte-identical to parent. Only the deterministic browser gate and exact Root receipt had been written before that assertion; resume accepts them only if byte-identical.']});
await putJson('preservation.json',{passed:true,parent_assembly_sha256:sha(parentAssemblyBytes),physical_site_files_checked:487,inherited_exact:477,protected:{text_HTML_files:166,runtime_text_records:166,transcription_count_300:'Inherited dataset and historical statusboard preserved byte for byte; no new independent total computed',draft_occurrences:992,consultable_jpeg_photos:25,runtime_dataset:assembly.files['runtime/archives/selected-data.json'],API_modules_and_graph:'byte identical',source_catalogue_record:'byte identical, consultation.available remains false'},file_readers:6,statusboard_count:5,statusboard_inherited:true,statusboard_count_reconciliation:'Deferred to Root; outside this seven-asset and two-link scope',main_v32_mount_touched:false,final_portfolio_touched:false,store_touched:false,port_8822_touched:false,standalone_freeze_unchanged:true,parent_package_unchanged:true,public_activation:false});
await putJson('composition.json',{passed:true,assembly_sha256:sha(assemblyBytes),parent_assembly_sha256:sha(parentAssemblyBytes),parent_seal_sha256:evidence.parent_seal.sha256,root_admission_receipt:pin(receiptBytes),reader_freeze_sha256:evidence.reader_freeze.sha256,site_files:487,static_files:396,inherited_exact:477,added:allow.added,modified:allow.modified,removed:[],runtime_helpers_added:0,API_entries:11,reachable_local_modules:61,all_native_modules:75,relative_schema_refs:2,file_readers:6,new_consultable_jpeg:false,private_only:true,exact_source_object:reader.source_object_id,exact_logical_path:reader.logical_path,catalogue_link_guards:['digitalObjectId','logicalPath'],exact_return_folder:folder,canonical_act_id:null,human_validation:false,new_lexical_validation:false,new_blind_independence_claim:false,public_activation:false});
await putJson('verification.json',{passed:true,scope:'Private v33 E99 reader mini integration on closed v32-r2',assembly_sha256:sha(assemblyBytes),site_files_checked:487,static_files:396,inherited_exact:477,added:7,modified:3,removed:0,root_reader_admission:pin(receiptBytes),native_import_gate:pin(await read('api-native-imports.json')),browser_integration_gate:pin(await read('browser-integration-gate.json')),HTTP_gate:pin(await read('http-integration-gate.json')),adversarial_review:'GO pre-closure; closing requests satisfied',preservation_passed:true,POST_count:0,own_preview_closed:true,own_browser_tab_closed:true,viewport_reset:true,human_validation:false,new_lexical_validation:false,main_activation:false,public_activation:false});
await put('HANDOFF.md',Buffer.from(`# Lot privé v33 — lecteur E.99 p08\n\nLot fermé pour inspection et composition par Root. Le site principal et le portfolio n’ont pas été montés ou modifiés.\n\nParent fermé : publication-package-20261004-v32-r2, assembly ${sha(parentAssemblyBytes)}. Assembly v33 : ${sha(assemblyBytes)}. Le lecteur autonome reste gelé à ${evidence.reader_freeze.sha256}. Reçu d’admission Root recopié exactement dans root-reader-admission.json : ${sha(receiptBytes)}.\n\n487 fichiers de site, dont 396 statiques. 477 fichiers hérités sont identiques ; sept assets du lecteur sont ajoutés. Les seuls fichiers modifiés sont la liste des lectures, le client du catalogue et le manifeste des empreintes. Aucun helper d’exécution n’est ajouté. Les 11 points d’entrée natifs sont importables ; le graphe compte 61 modules locaux atteignables, 75 modules natifs au total et deux références de données relatives résolues.\n\nLe sixième lecteur est accessible à ${reader.route}. Dans le catalogue, un lien est ajouté uniquement lorsque l’identifiant ET le chemin de Partie droite.jpg correspondent au contrat E.99 p08. Le retour retrouve exactement le dossier « Jean de Tucé possibilité 1 », avec Marge.jpg, Partie droite.jpg, Partie gauche.jpg et Vue d’ensemble.jpg.\n\nMini parcours observé sur mobile : liste de six lecteurs → six lignes et leur français modernisé → contexte R02 à taille réelle → dossier exact ; le lien du catalogue ouvre aussi le lecteur. Cinq états structurés, deux captures qualifiées inspectées, zéro erreur de console, zéro POST. L’aperçu propre au lot sur le port 53030 est arrêté et son onglet est fermé. Les captures initiales incidentelles sont conservées mais exclues des preuves qualifiées ; browser-integration-gate.json l’explique.\n\nLes 166 fichiers de texte, le jeu de données portant les 300 transcriptions historiques et les 992 occurrences de brouillons sont conservés. Les 25 JPEG consultables restent identiques. Les quatre PNG sont des contextes de rangée ; ils ne créent pas une nouvelle photographie entière consultable. Le statut de consultation de Partie droite.jpg reste false. Le tableau d’avancement hérité mentionne encore cinq lecteurs ; sa réconciliation éventuelle relève de Root et n’était pas une modification autorisée ici.\n\nLes rangées R02, R04 et R03 sont des contextes photographiques avec leurs bords, sans localisation de mot. Les lectures A/B, leurs annotations et leur statut candidat restent distincts. Aucun rattachement d’acte, identité, préférence de lecture, validation humaine ou qualification d’indépendance aveugle n’est ajouté. Le texte et les sept assets sont ceux admis par Root ; aucune validation lexicale nouvelle n’est revendiquée.\n\nLe contrôle contradictoire pré-clôture est GO. La clôture a contrôlé physiquement les 487 fichiers contre l’assembly, et les 486 entrées du manifeste hors auto-empreinte. preservation.json, composition.json et verification.json donnent les détails. candidate-seal.json contient les empreintes de tout ce lot hors lui-même et freeze.json ; freeze.json fixe ensuite le sceau et ces exclusions explicites. Aucun fichier fermé ne doit être retouché.\n`, 'utf8'));
await put('closure-snapshot.mjs',await readFile(new URL(import.meta.url)));
const packetFiles=await walk(out);assert(!packetFiles.includes('candidate-seal.json')&&!packetFiles.includes('freeze.json'));
const sealed={};for(const n of packetFiles)sealed[n]=pin(await read(n));
const seal={closed:true,scope:'Private v33 E99 integration',candidate_assembly_sha256:sha(assemblyBytes),parent_assembly_sha256:sha(parentAssemblyBytes),file_count:packetFiles.length,self_exclusions:['candidate-seal.json','freeze.json'],files:sealed,activated:false};
await putJson('candidate-seal.json',seal);
await putJson('freeze.json',{state:'closed-private',candidate_seal:pin(await read('candidate-seal.json')),assembly:pin(assemblyBytes),HANDOFF:pin(await read('HANDOFF.md')),verification:pin(await read('verification.json')),file_count:packetFiles.length+1,seal_exclusions:['candidate-seal.json','freeze.json'],freeze_self_excluded:true,public_activation:false});
console.log(JSON.stringify({passed:true,out,site_files:487,packet_files:packetFiles.length+2,assembly:pin(assemblyBytes),seal:pin(await read('candidate-seal.json')),freeze:pin(await read('freeze.json')),HANDOFF:pin(await read('HANDOFF.md')),verification:pin(await read('verification.json'))},null,2));
