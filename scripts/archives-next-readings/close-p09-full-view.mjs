import {readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {digest,FULL_VIEW_ADMISSION_SHA256} from './adapter-full-view.mjs';

const base=resolve('.private/archives-next-readings/p09-full-view-20261004-v1'),root=join(base,'reviewed-r2');
const buildSha='c8b8c26fe9daa2f84d4f4299ea8c3fe5662470441551c28627b2adb56c3aaf6b';
const pin=bytes=>({sha256:digest(bytes),bytes:bytes.length});
const save=(name,value)=>writeFile(join(root,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const buildBytes=await readFile(join(root,'build-proof.json'));assert.equal(digest(buildBytes),buildSha);const build=JSON.parse(buildBytes);
const session=JSON.parse(await readFile(join(base,'preview-session.json')));

if(process.argv.includes('--http')){
 const checks=[];
 for(const entry of [{route:'/archives/',run_file:'reader.html'},...build.selected_assets]){
  const response=await fetch(session.origin+entry.route),bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200);assert.deepEqual(pin(bytes),build.outputs[entry.run_file]);
  checks.push({route:entry.route,status:response.status,...pin(bytes),matches_reviewed_r2:true});
 }
 const image=await fetch(session.origin+build.metadata.photoRoute,{method:'HEAD',redirect:'manual'});assert.equal(image.status,307);assert.equal(image.headers.get('location'),session.single_photo_redirect);
 const privateRoute=await fetch(session.origin+'/inputs/author_package.json');assert.equal(privateRoute.status,404);await privateRoute.arrayBuffer();
 await save('http-gate.json',{format:'p09-full-view-bounded-http/1',origin:session.origin,checks,reviewed_r2_bytes_identical_to_served_reader_and_resources:true,single_existing_photo_redirect:{status:307,target:session.single_photo_redirect,image_bytes_read:0},private_source_route_status:404,previous_suites_rerun:false});
 console.log('Bounded exact-output HTTP gate saved.');
}else{
 let stopped=false;try{await fetch(session.origin+'/archives/',{signal:AbortSignal.timeout(2000)});}catch(error){stopped=error.cause?.code==='ECONNREFUSED';}assert(stopped,'Close own preview before sealing');
 for(const [name,expected]of Object.entries(build.outputs))assert.deepEqual(pin(await readFile(join(root,name))),expected,name);
 for(const [name,expected]of Object.entries(build.code_pins))assert.deepEqual(pin(await readFile(join('scripts/archives-next-readings',name))),expected,name);
 for(const [name,expected]of Object.entries(build.outputs))assert.deepEqual(pin(await readFile(join(base,name))),expected,'same pre-review output bytes: '+name);
 const observations=JSON.parse(await readFile(join(base,'browser-observations.json'))),events=observations.events,find=name=>events.find(e=>e.event===name);
 assert(find('desktop-diplomatic').exact&&find('desktop-diplomatic').physicalLines===21&&!find('desktop-diplomatic').overflow);
 assert(find('modern-panel').exact&&find('modern-panel').editorialVisible&&find('keyboard-photo').passed);
 assert(find('ten-versions').count===10&&find('ten-versions').exact&&find('mobile-ten-versions').count===10&&find('mobile-ten-versions').exact&&!find('mobile-ten-versions').documentOverflow);
 assert(find('mobile-return').exact&&find('mobile-return').position.includes('5 / 5')&&find('mobile-modern-keyboard').exact&&find('mobile-modern-keyboard').editorialVisible);
 assert.deepEqual(find('mobile-comparison-link').rowCounts,[15,8]);assert(find('separate-regions').authorDiplomaticCount===7&&find('separate-regions').authorModernCount===7&&find('separate-regions').independentGroupCount===11);
 assert(observations.viewport_reset);
 const reviewBytes=await readFile(join(root,'technical-review.json'));assert.equal(digest(reviewBytes),'26c1dd70cca3475207c952ec91f516a4aa66800e74deca7784d38a75b4fa99d7');
 const screenshots={};for(const name of ['desktop-reading.png','desktop-versions-full.png','mobile-reading.png','mobile-modern.png','mobile-versions-full.png','mobile-comparison.png']){const bytes=await readFile(join(base,name));await copyFile(join(base,name),join(root,name));screenshots[name]=pin(bytes);}
 for(const name of ['browser-observations.json','preview-session.json','preview-requests.json'])await copyFile(join(base,name),join(root,name));
 await save('browser-gate.json',{format:'p09-full-view-mini-browser-gate/1',status:'passed-bounded-text-versions-mobile-keyboard',qualified_build_sha256:buildSha,served_initial_build_sha256:observations.served_build_sha256,exact_output_identity_verified:true,reader_sha256:build.reader_sha256,versions_sha256:build.outputs['versions-full.html'].sha256,observations:pin(await readFile(join(root,'browser-observations.json'))),http_gate:pin(await readFile(join(root,'http-gate.json'))),screenshots,checks:{active_diplomatic_lines:21,active_modern_lines:21,pilot_editions:4,body_editions:6,independent_body_only_l07_l21:true,exact_versions:10,comparison_rows:[15,8],author_zones:7,independent_groups:11,modern_editorial_note_visible:true,keyboard_tabs:true,history_and_comparison_keyboard_links:true,mobile_390px_without_document_overflow:true,comparison_tables_scroll_locally:true,explicit_return_p09_5_of_5:true},pointer_touch_gate:'Root integrated browser test required; no touch PASS claimed by this mini gate.',photo_files_added:0,image_bytes_read_by_build_and_preview_server:0,only_existing_root_photo_redirected:true,preview_stopped:true,previous_suites_rerun:false,publication_executed:false});
 await save('authorization-check.json',{format:'p09-full-view-local-browser-authorization-check/1',initial_auto_review_refusal:'Six-line-only authorization inferred by review',source_thread_id:'01a1014a-ab31-7f43-ad02-769487ace70f',native_read_thread_used:true,human_turns:[{id:'01a10359-26f0-7ab1-8d7b-2a78ed82af37',quote:"Oui mais j'aimerai que tu clarifie ce goal, qu'il soit plus robuste, je vais aller me coucher j'aimerai que tu travailles sans moi"},{id:'01a1041f-3144-7bc3-a6ab-ec1f98eaca69',quote:'Ok update le goal avec un caveat - si tu finis avant, tu lanceras des travaux de transcriptions pertinentes pour avancé côté Tucé.'}],accepted_goal_contract:'C:/Users/Val/Documents/ChatGPT/PERSO/atelier-tuce/planning/mission-autonome-20261004.md',contract_rule:'Étendre après petit gate et ajouter les nouvelles éditions au parcours de consultation, sans écraser les précédentes.',trusted_full_receipt_sha256:FULL_VIEW_ADMISSION_SHA256,retry_approved:true,remaining_browser_approval_block:false,external_publication_executed:false});
 const assets=build.selected_assets.map(a=>({route:a.route,file:a.run_file,...build.outputs[a.run_file]}));
 const handoff=[
  '# Remise P09 — édition proposée du corps de 21 lignes',
  '',
  'Run retenu : '+root.replaceAll('\\','/')+'. La première construction dans le dossier parent reste une tentative pré-revue ; reviewed-r2 est l’incrément sélectionné. Deux constats de revue sont clos : routes/chemins de prévisualisation bornés et zones diplomatiques/modernes jointes par clé. Les HTML et ressources des deux constructions sont identiques octet par octet ; le mini contrôle CUA a porté sur ces octets exacts.',
  '',
  'Parent gelé : publication-package-20261004-v10/site/dist/archives/index.html, '+build.parent_bytes+' octets, SHA-256 '+build.parent_sha256+'. Build retenu : '+buildSha+'. Lecteur proposé : '+build.reader_sha256+'. Reçu full21 : '+FULL_VIEW_ADMISSION_SHA256+'. Revue technique close : 26c1dd70cca3475207c952ec91f516a4aa66800e74deca7784d38a75b4fa99d7.',
  '',
  'Entrée active : nouvelle édition p09-full-comparison-r1-proposed, display_body + display_modern. Il ne s’agit ni du pilote auteur R1, ni du full-r0 auteur. Les textes actifs ont exactement 21 lignes. Les quatre versions pilote sont conservées et les six éditions de corps accessibles : auteur diplomatique/moderne 21 lignes, indépendant diplomatique/moderne L07–L21 seulement (15 lignes), comparaison diplomatique/moderne 21 lignes. Aucun premier-six-lignes nouvellement aveugle revendiqué.',
  '',
  '| Route nouvelle | Fichier sélectionné | SHA-256 | Octets |',
  '| --- | --- | --- | ---: |',
  ...assets.map(a=>'| '+a.route+' | '+a.file+' | '+a.sha256+' | '+a.bytes+' |'),
  '',
  'La carte P09 de /archives/ est remplacée, et ses deux références de ressources passent à full.css/full.js. Les anciennes ressources et la route des quatre versions pilote restent dans le paquet, car cette ancienne page utilise encore son CSS. Root ajoute les trois routes ci-dessus et recalcule ses sommes de paquet ; il conserve la photographie déjà présente et tous ses autres statiques, la carte, les 166 textes et 19 vues anciennes. Aucun JSON interne, chemin Z, reçu, somme ou preuve n’est exposé par les nouveaux HTML.',
  '',
  'Recomposition Root : importer composeP09FullView de scripts/archives-next-readings/adapter-full-view.mjs. Lire admission.json et recomposition-contract.json dans ce run. Construire sourceBuffers depuis contract.source_files (22 buffers, clés du reçu), pilotBuffers depuis contract.pilot_files (4 textes), et passer enabled:true, parentHtml du paquet Root, son SHA-256 calculé, admissionBuffer, admissionSha256='+FULL_VIEW_ADMISSION_SHA256+', sourceBuffers, pilotBuffers. La fonction renvoie html, versionsHtml et additionalAssets ; elle refuse un parent déjà étendu ou une carte/correspondance image inattendue. Elle ne lit pas de fichiers ou d’images. Copier uniquement reader.html recomposé, versions-full.html, full-card.css et full-card.js selon les routes sélectionnées. Le préparateur est épinglé sur v10, refuse les écrasements et ne sert pas de script d’intégration globale.',
  '',
  'Les 22 pins du reçu et les quatre pins pilote sont recontrôlés. La restauration de la carte et des deux références reconstitue le parent byte-identique. Sept refus ciblés couvrent drift reçu/source/parent, substitution full-r0 au pilote, input supplémentaire et double extension. Aucun ancien test H07 ni parcours des 19 photos rejoué.',
  '',
  'Sept zones auteur et onze groupes indépendants restent distincts du corps ; leurs regroupements différents sont déclarés. Le français éditorial indique ses expansions de vre, sa ponctuation et le je ajouté en L12. Lacunes et ? restent exacts ; les trois propositions en L07/L10/L21 n’écrasent aucune source. Comparaison accessible : quinze lignes de corps et huit lignes de correspondance des zones, sans forcer les non-alignements.',
  '',
  'Mini gate : deux textes actifs exacts, dix éditions exactes, mobile 390 px sans débordement de page, tables à défilement local, onglets au clavier, liens versions/comparaison au clavier, retour explicite au document P09 5/5. Le tap/pointeur est à recontrôler par Root dans le paquet intégré ; aucun succès tactile n’est revendiqué ici. Le serveur propre est arrêté ; aucune prévisualisation Root arrêtée. La seule photographie était redirigée vers sa route déjà qualifiée sur Root 8822 : zéro copie, zéro octet image lu par le build ou son serveur.',
  '',
  'L’ouverture locale avait d’abord été refusée par auto-review pour une autorisation estimée limitée au pilote. Le mandat humain a été relu avec read_thread ; il autorise l’extension après petit gate et l’intégration de nouvelles éditions. La même ouverture a ensuite été approuvée. Aucun blocage d’approbation ne reste ; authorization-check.json conserve cette vérification.',
  '',
  'Aucune date, personne, lieu, droit ou identité canonique créée ; revue humaine pending, droits unknown, scores/CER null, mémoire 0, pas de déploiement ni publication hébergée. Le regroupement E.108/11–14 demeure la prochaine correction de catalogue : quatre vues d’un ensemble probable, aucune promotion en acte certain.',
  '',
  'Inventaire scellé et pins finaux : closeout.json. build-proof.json conserve browser_gate_pending=true comme état de construction antérieur au mini contrôle ; browser-gate.json le clôt sans réécrire la preuve.',
  ''
 ].join('\n');await save('HANDOFF.md',handoff);
 const inventory={};async function walk(dir,prefix=''){for(const e of await readdir(dir,{withFileTypes:true})){const name=prefix+e.name;if(e.isDirectory())await walk(join(dir,e.name),name+'/');else if(e.isFile()&&name!=='closeout.json')inventory[name]=pin(await readFile(join(dir,e.name)));}}await walk(root);
 await save('closeout.json',{format:'p09-full-view-handoff-seal/1',status:'ready-for-root-recomposition-and-integrated-pointer-gate',selected_run:root,trusted_receipt_sha256:FULL_VIEW_ADMISSION_SHA256,parent_sha256:build.parent_sha256,build_sha256:buildSha,reader_sha256:build.reader_sha256,selected_assets:assets,inventory,closeout_script_pin:pin(await readFile(new URL(import.meta.url))),preview_stopped:true,pilot_v4_or_adapter_v3_modified:false,root_files_modified:false,new_image_files:0,previous_suites_rerun:false,canonical_promotions:0,memory_events:0,publication_executed:false});
 console.log(JSON.stringify({handoff:pin(await readFile(join(root,'HANDOFF.md'))),browser_gate:pin(await readFile(join(root,'browser-gate.json'))),closeout:pin(await readFile(join(root,'closeout.json'))),file_count:Object.keys(inventory).length},null,2));
}
