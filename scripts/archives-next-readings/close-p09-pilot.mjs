import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve('.private/archives-next-readings/p09-admitted-pilot-20261004-v4');
const buildPin='0b5c927a2dc288c9a6c08e5efe8d23895cb991ec496025bfce1a8ca49f8eb0e4';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pin=bytes=>({sha256:sha(bytes),bytes:bytes.length});
const save=(name,value)=>writeFile(join(root,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const buildBytes=await readFile(join(root,'build-proof.json'));
assert.equal(sha(buildBytes),buildPin);
const build=JSON.parse(buildBytes);
const session=JSON.parse(await readFile(join(root,'preview-session.json')));

if(process.argv.includes('--http')){
 const results=[];
 for(const entry of [{route:'/archives/',run_file:'reader.html'},...build.selected_assets]){
  const response=await fetch(session.origin+entry.route);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(response.status,200);assert.deepEqual(pin(bytes),build.outputs[entry.run_file]);
  results.push({method:'GET',route:entry.route,status:response.status,...pin(bytes),matches_build:true});
 }
 for(const [method,route,expected] of [['HEAD','/archives/',200],['GET','/build-proof.json',404],['GET','/archives/next-readings/media/not-selected.jpg',404],['POST','/archives/',405]]){
  const response=await fetch(session.origin+route,{method});assert.equal(response.status,expected);
  results.push({method,route,status:response.status});await response.arrayBuffer();
 }
 await save('http-gate.json',{format:'p09-bounded-http-gate/1',origin:session.origin,results,all_expected:true,previous_suites_rerun:false});
 console.log('Bounded HTTP gate saved.');
}else{
 let stopped=false;try{await fetch(session.origin+'/archives/',{signal:AbortSignal.timeout(2000)});}catch(error){stopped=error.cause?.code==='ECONNREFUSED';}assert(stopped,'Own preview must be stopped before sealing its request log');
 await save('preview-stop.json',{format:'p09-own-preview-stop/1',origin:session.origin,connection_refused:true,own_session_id:99776,other_services_stopped:false});
 for(const [name,expected]of Object.entries(build.outputs))assert.deepEqual(pin(await readFile(join(root,name))),expected,name);
 for(const [name,expected]of Object.entries(build.code_pins))assert.deepEqual(pin(await readFile(join('scripts/archives-next-readings',name))),expected,name);
 const observations=JSON.parse(await readFile(join(root,'browser-observations.json')));
 const events=observations.events,find=name=>events.find(e=>e.event===name);
 assert(find('corrected-desktop').exact&&find('corrected-desktop').titleWidth===846);
 assert(find('modern-click').exact);
 assert(find('photo-decoded').complete&&find('zoom-open').open&&find('zoom-escape').closed);
 assert.equal(find('versions-page').versions.length,4);assert(find('versions-page').versions.every(v=>v.exact));
 assert(find('mobile-r1').exact&&!find('mobile-r1').overflow&&find('mobile-photo-decoded').complete);
 assert(find('mobile-versions-qualified').allExact&&find('mobile-versions-qualified').count===4);
 assert(find('mobile-history-keyboard-enter').passed&&observations.viewport_reset);
 const limitations=[
  'Mobile pointer click on the versions link did not navigate during this episode. Enter on the same link worked; the four-version mobile route and explicit return were verified. Pointer navigation remains unqualified.',
  'Browser Back returned to the inherited reader first card (1 / 5); the explicit Revenir au document link returned to P09 (5 / 5). No inherited navigation code was changed.',
  'The earlier mobile-versions event used an empty collection and is invalid; mobile-versions-qualified replaces it with exactly four checked blocks. mobile-versions.png is not an accepted versions screenshot.',
  'This preview intentionally serves only the one qualified P09 photograph; other parent image routes are unavailable and were not qualified.'
 ];
 const screenshots={};for(const name of ['desktop-r1.png','desktop-photo.png','desktop-zoom.png','desktop-versions.png','mobile-r1.png','mobile-photo.png','mobile-versions-qualified.png'])screenshots[name]=pin(await readFile(join(root,name)));
 await save('browser-gate.json',{format:'p09-six-line-browser-closeout/1',status:'bounded-checks-passed-with-navigation-limitations',build_sha256:buildPin,reader_sha256:build.reader_sha256,observations:pin(await readFile(join(root,'browser-observations.json'))),http_gate:pin(await readFile(join(root,'http-gate.json'))),screenshots,checks:{six_lines_r1_exact:true,six_lines_modern_exact:true,four_versions_exact:true,photo_native_dimensions:[3968,2976],zoom_and_escape:true,tab_keyboard:true,mobile_390px_no_horizontal_overflow:true,history_keyboard_enter:true,explicit_return:true,header_grid_corrected:true,viewport_reset:true,mobile_history_pointer_navigation:false},limitations,dev_logs_count:observations.dev_logs.length,previous_suites_rerun:false,full_view_extension_read:false,historical_confirmation:false,human_review:'pending',publication_approved:false});
 const assets=build.selected_assets.map(a=>({route:a.route,file:a.run_file,...build.outputs[a.run_file]}));
 const lines=[
  '# Remise P09 — pilote figé de six lignes',
  '',
  'Dossier retenu : '+root.replaceAll('\\','/')+'. Statut : contrôles bornés réussis, avec limites de navigation consignées. Ne pas présenter la navigation mobile au pointeur comme qualifiée. Seule la variante auteur R1 et son français modernisé sont actifs ; les lectures R0 et indépendante restent distinctes dans les versions. Aucun texte L07–L21 ou nouvelle vue complète n’a été lu ni substitué.',
  '',
  'Parent utilisé : publication-package-20261004-v8/site/dist/archives/index.html, '+build.parent_bytes+' octets, SHA-256 '+build.parent_sha256+'. Parent v7 antérieur : SHA-256 d65a001e7f5c508c866b4d0411959dc16287a79a68e18235fdf7a3cc6d0a6d1f (707452 octets). La remise est à recomposer par Root sur son v9 préparé ; reader.html est une preuve sur v8 et ne doit pas remplacer la page v9.',
  '',
  'Build : '+buildPin+'. Lecteur : '+build.reader_sha256+'. Admission Root : '+build.admission_sha256+'. La preuve de construction conserve browser_gate_pending=true comme état antérieur au contrôle ; browser-gate.json clôt la vérification sans modifier cette preuve.',
  '',
  '| Route sélectionnée | Fichier privé à copier | SHA-256 | Octets |',
  '| --- | --- | --- | ---: |',
  ...assets.map(a=>'| '+a.route+' | '+a.file+' | '+a.sha256+' | '+a.bytes+' |'),
  '',
  'Ces quatre routes sont les seules additions proposées. Les huit parent-assets sont un instantané de prévisualisation ; Root conserve ses 320 statiques v9. Aucun contrat JSON, reçu, texte brut, preuve, capture ou journal privé ne doit être ajouté à la liste publique de routes.',
  '',
  '| Entrée figée | Fichier | SHA-256 |',
  '| --- | --- | --- |',
  ...['reading-contract.json','photo-binding.json','diplomatic.txt','modern-french.txt','author-r0.txt','independent-working-text-r0.txt','independent-reading-frozen-r0.json','independent-freeze-receipt.json','root-admission.json','input-manifest.json','preflight.json'].map(name=>'| '+name+' | '+name+' | '+build.outputs[name].sha256+' |'),
  '',
  'Recomposition : importer composeNextReadingV3 depuis scripts/archives-next-readings/adapter-v3.mjs. Passer enabled:true, le parentHtml v9 et son SHA-256 exact calculé par Root, reading=reading-contract.json, qualifiedImages=[photo-binding.json], historyBuffer=author-r0.txt, independentBuffer=independent-working-text-r0.txt, admissionBuffer=root-admission.json et admissionSha256='+build.admission_sha256+'. Construire sourceBuffers (Map) depuis reading.versions : clé version.source_locator.source_id, valeur diplomatic.txt ou modern-french.txt selon version.kind. Utiliser le html retourné ; copier les quatre fichiers sélectionnés et inscrire explicitement leurs routes dans la liste v9. Ne pas relancer le préparateur : il est épinglé sur v8 et refuse l’écrasement de ce dossier.',
  '',
  'Code épinglé :',
  ...Object.entries(build.code_pins).map(([name,p])=>'- '+name+' : '+p.sha256+' ('+p.bytes+' octets).'),
  '',
  'Image : une seule copie dérivée qualifiée, SHA-256 '+build.photo_binding.derivative_sha256+', 3968 × 2976. Préflight neuf réussi avant accès à ses octets : '+build.media_preflight_sha256+'. Le SHA-256 de l’original '+build.photo_binding.source_sha256+' est une référence rapportée, non recalculée ; aucun original ni autre image n’a été relu. view_id et canonical_view_id restent null. ROI documentaire x450/y350/3518×675, appliqué=false ; aucun recadrage ni rotation.',
  '',
  'Contrôles retenus : six lignes R1 et moderne exactes ; quatre versions exactes ; image décodée et zoom/Escape ; sélection des onglets au clavier ; affichage 390 px sans débordement ; grille d’en-tête corrigée (titre 846 px sur bureau). La revue technique a clos les deux constats V2 puis les trois constats V3 ; l’ajout de la cellule d’en-tête est validé dans ce V4. Les sept refus ciblés du build sont conservés ; aucune ancienne batterie H07, aucun parcours des 19 photos et aucun framework nouveau.',
  '',
  'Limites observées :',
  ...limitations.map(value=>'- '+value),
  '',
  'La prévisualisation propre '+session.origin+' est arrêtée après capture des preuves ; aucune autre prévisualisation Root n’est arrêtée. Les essais précédents restent disponibles mais ne sont pas sélectionnés : pending V1/V2, admitted V1 (préflight refusé avant image), V2 (avant corrections), V3 (avant correction de grille).',
  '',
  'Aucune identité, date, nature d’acte, exactitude historique ou validation humaine n’est confirmée. Droits inconnus ; publication non approuvée ; mémoire documentaire 0. Les fichiers et sommes finales sont dans closeout.json.',
  ''
 ];
 await save('HANDOFF.md',lines.join('\n'));
 const inventory={};
 async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory())await walk(join(dir,entry.name),name+'/');else if(entry.isFile()&&name!=='closeout.json')inventory[name]=pin(await readFile(join(dir,entry.name)));}}
 await walk(root);
 await save('closeout.json',{format:'p09-six-line-handoff-seal/1',status:'frozen-ready-for-root-recomposition-with-navigation-limitations',selected_directory:root,build_sha256:buildPin,parent_v8_sha256:build.parent_sha256,reader_sha256:build.reader_sha256,selected_assets:assets,inventory,closeout_script_pin:pin(await readFile(new URL(import.meta.url))),preview_stopped:true,old_reader_and_synthetic_suites_rerun:false,root_files_modified:false,full_view_extension_read:false,historical_confirmation:false,publication_approved:false,limitations});
 console.log(JSON.stringify({handoff:pin(await readFile(join(root,'HANDOFF.md'))),browser_gate:pin(await readFile(join(root,'browser-gate.json'))),closeout:pin(await readFile(join(root,'closeout.json'))),file_count:Object.keys(inventory).length},null,2));
}
