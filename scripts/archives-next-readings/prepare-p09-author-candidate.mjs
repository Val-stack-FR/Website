import {readFile, writeFile, mkdir, lstat, realpath} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TextDecoder} from 'node:util';
import assert from 'node:assert/strict';
import {composeNextReadingV2, validateNextReadingV2, digest} from './adapter-v2.mjs';

const moduleRoot=dirname(fileURLToPath(import.meta.url));
const readerRoot=resolve(moduleRoot,'../..');
const privateBase=join(readerRoot,'.private/archives-next-readings');
const authorRoot=resolve(readerRoot,'../PHD-Maine-paleography-harness/data/private/transcription-campaign/e99-p09-reading-20261004-v1');
const parentPath=join(readerRoot,'.private/archives-integration/publication-package-20261004-v7/site/dist/archives/index.html');
const sourceObject='object:path-bb85ab737e3b2ef749a76d8b40636202af7b27fd9dea1feace413fc36f43670b';
const derivativeSha='2a7b6be96cff6891a061152cf4e8f25d8a010a1a8697f8d6cc57b2ba76a98c34';
const parentPin={sha256:'d65a001e7f5c508c866b4d0411959dc16287a79a68e18235fdf7a3cc6d0a6d1f',bytes:707452};
const pins={
 'freeze-author.json':{sha256:'37239632e1babe70c48fb12a261b221e23ab984d8c4f2699aa9ee4a4796aed15'},
 'transcription.r0.txt':{sha256:'54bfbd5c2e9889829b70444d6ce1671114424e217681cbf8bcdff6b6e93bef01',bytes:624},
 'transcription.r1.txt':{sha256:'004f052c7e1cb8fd7740f49e592d72b8096bc48a8192026d07cc9f8dc56f9fe9',bytes:638},
 'modern-fr.r1.txt':{sha256:'1f64889c697055a2ce41e863bc323d1736e15b5930ea4af3c86142e9a381b5dc',bytes:676},
 'reading-evidence.json':{sha256:'b802df3bdfe2b544f23251c6513baa0eeeea97e2ccbcb6b753cbe002f67972a1',bytes:5513},
 'roi.json':{sha256:'8d3811b979f06f731a386ff34993c894d9fe11f7f90ad60754a44b4017cf78c1',bytes:2066},
 'preflight-reading.json':{sha256:'7b7eb48864c5f34cf56a90c57b28e77266de23e5acfecfd79b9464f59c667563',bytes:1958},
};
const decode=bytes=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
const json=bytes=>JSON.parse(decode(bytes));
const serialized=value=>Buffer.from(JSON.stringify(value,null,2)+'\n','utf8');
const filePin=bytes=>({sha256:digest(bytes),bytes:bytes.length});
const samePath=(left,right)=>resolve(left).toLowerCase()===resolve(right).toLowerCase();

async function readPinned(path,pin){
 const stat=await lstat(path);
 assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=1048576,'Bounded ordinary input file required');
 assert(samePath(await realpath(path),path),'Input path redirect refused');
 const bytes=await readFile(path);
 assert.equal(digest(bytes),pin.sha256,'Frozen input SHA mismatch: '+path);
 if(pin.bytes!==undefined)assert.equal(bytes.length,pin.bytes,'Frozen input byte count mismatch');
 return bytes;
}
function uncertainties(text,kind){
 const points=[...text],result=[];
 for(let index=0;index<points.length-2;index+=1){
  if(points.slice(index,index+3).join('')==='[…]')result.push({
   id:`uncertainty:p09-author-${kind}-gap${String(result.length+1).padStart(2,'0')}`,
   status:'unresolved',note:'Lecture indécidée ; aucun nombre de mots manquants déduit.',
   span:{coordinate_system:'unicode-codepoints',start:index,end:index+3,exact_text:'[…]'},alternatives:[]
  });
 }
 return result;
}
function textVersion(kind,name,bytes){
 const text=decode(bytes),sourceId='source:p09-author-'+(kind==='diplomatic'?'diplomatic-r1':'modern-fr-r1');
 return {
  id:'text:p09-author-'+(kind==='diplomatic'?'diplomatic-r1':'modern-fr-r1'),kind,
  revision:'r1',text_exact:text,text_sha256_utf8:digest(bytes),utf8_byte_length:bytes.length,
  source_locator:{source_id:sourceId,json_pointer:null,span:{coordinate_system:'unicode-codepoints',start:0,end:[...text].length}},
  uncertainties:uncertainties(text,kind),source_file:name
 };
}
const provenanceFields=new Set(['source_sha256','original_sha256','original_source_sha256','source_file_sha256','view_id','canonical_view_id']);
export function assertP09AbsentOriginalViewMetadata(metadata){
 assert.deepEqual(Object.keys(metadata).sort(),['freeze-author.json','preflight-reading.json','reading-evidence.json','roi.json']);
 const checked=[];
 for(const [name,value]of Object.entries(metadata)){
  for(const field of provenanceFields){
   assert(!Object.hasOwn(value,field)||value[field]===null,'Original/view metadata unexpectedly supplied: '+name+'/'+field);
   checked.push({file:name,path:'/'+field,state:Object.hasOwn(value,field)?'null':'absent'});
  }
  const walk=(object,path)=>{
   if(object===null||typeof object!=='object')return;
   for(const [key,child]of Object.entries(object)){
    const fieldPath=path+'/'+key;
    if(provenanceFields.has(key)){assert.equal(child,null,'Nested original/view metadata unexpectedly supplied: '+name+fieldPath);if(path!=='')checked.push({file:name,path:fieldPath,state:'null'});}
    walk(child,fieldPath);
   }
  };
  walk(value,'');
 }
 return checked;
}
function assertStates(freeze,evidence,roi,preflight){
 assert.equal(freeze.format,'p09-author-before-comparison-freeze/1.0.0');
 assert.equal(freeze.source_object_id,sourceObject);assert.equal(freeze.derivative_sha256,derivativeSha);
 assert.equal(freeze.roi_manifest_sha256,pins['roi.json'].sha256);
 assert.equal(freeze.independent_comparison_read_before_freeze,false);
 assert.equal(freeze.max_contiguous_lines,6);assert.equal(freeze.line_count,6);
 for(const [key,value]of Object.entries({reading_status:'unresolved',human_review:'pending',human_reference:null,CER:null,historical_accuracy:null,memory_written:false,rights_status:'unknown',publication:'private',extension_authorized:false,canonical_closeout:false}))assert.equal(freeze[key],value,'Author freeze state drift: '+key);
 assert.equal(evidence.format,'p09-private-author-reading-evidence/1.0.0');assert.equal(evidence.selected_lines,6);
 assert.equal(evidence.roi_manifest_sha256,pins['roi.json'].sha256);
 assert.equal(evidence.independent_comparison_read,false);assert.equal(evidence.full_reading_or_extension_authorized,false);
 assert.equal(evidence.historical_date,null);assert.equal(evidence.historical_person_id,null);
 assert.deepEqual(evidence.canonical_refs,{document_id:null,act_id:null,witness_id:null,view_id:null,text_id:null});
 assert.equal(evidence.canonical_bbox,null);assert.equal(evidence.human_reference,null);assert.equal(evidence.human_review,'pending');assert.equal(evidence.rights_status,'unknown');assert.equal(evidence.publication,'private');
 assert.equal(roi.format,'p09-six-line-measured-roi/1.0.0');assert.equal(roi.source_object_id,sourceObject);
 assert.equal(roi.digital_object_id,'object:media-'+derivativeSha);assert.equal(roi.derivative_sha256,derivativeSha);
 assert.equal(roi.reference_frame,'native-coded-derivative-raster');assert.equal(roi.canonical_view_id,null);assert.equal(roi.canonical_bbox,null);
 assert.deepEqual(roi.native_dimensions,[3968,2976]);assert.deepEqual(roi.rectangle,{x:450,y:350,width:3518,height:675,x_end_exclusive:3968,y_end_exclusive:1025});
 assert.equal(roi.selection.selected_line_count,6);assert.equal(roi.selection.contiguous,true);assert.equal(roi.extension_authorized,false);
 assert.equal(preflight.format,'p09-private-reading-preflight/1.0.0');assert.equal(preflight.passed,true);assert.equal(preflight.operations_preflight.passed,true);
 assert.equal(preflight.source_object_id,sourceObject);assert.equal(preflight.derivative_sha256,derivativeSha);
 assert.deepEqual(preflight.native_dimensions,[3968,2976]);assert.equal(preflight.browser_reconciliation,'pending');
}
function verifyLiteral(html,attribute,id,text){
 const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\r','&#13;').replaceAll('\n','&#10;');
 const marker=attribute+'="'+id+'"',start=html.indexOf(marker);
 assert(start>=0&&html.indexOf(marker,start+1)===-1,'Exact text block identity missing or duplicated');
 const bodyStart=html.indexOf('>',start)+1,end=html.indexOf('</pre>',bodyStart);
 assert(end>bodyStart,'Exact text block boundary absent');assert.equal(html.slice(bodyStart,end),escape(text),'Literal rendered text drift');
}

/** A fixed author-only preparation. No discovery, reviewer files, pixels, service or browser. */
export async function prepareP09AuthorCandidate({outputPath=join(privateBase,'p09-author-candidate-20261004-v2')}={}){
 const output=resolve(outputPath);assert(samePath(dirname(output),privateBase),'Fresh run must be a direct child of the private base');
 await mkdir(privateBase,{recursive:true});assert(samePath(await realpath(privateBase),privateBase),'Private base redirect refused');
 // mkdir without recursive ensures an existing audit run is never reused or overwritten.
 // Input verification and composition finish before the new directory is created.
 const frozen=await readPinned(join(authorRoot,'freeze-author.json'),pins['freeze-author.json']),freeze=json(frozen);
 const inputs=new Map([['freeze-author.json',frozen]]);
 const remaining=Object.entries(pins).filter(([name])=>name!=='freeze-author.json');
 for(const [name,pin]of remaining){
  const listed=freeze.outputs.filter(value=>value.path===name);assert.equal(listed.length,1,'Author output must have one freeze entry');
  assert.equal(listed[0].sha256,pin.sha256);assert.equal(listed[0].byte_size,pin.bytes);
 }
 const bytes=await Promise.all(remaining.map(([name,pin])=>readPinned(join(authorRoot,name),pin)));
 remaining.forEach(([name],index)=>inputs.set(name,bytes[index]));
 const parentBytes=await readPinned(parentPath,parentPin),parentHtml=decode(parentBytes);
 const evidence=json(inputs.get('reading-evidence.json')),roi=json(inputs.get('roi.json')),preflight=json(inputs.get('preflight-reading.json'));
 const metadata={'freeze-author.json':freeze,'reading-evidence.json':evidence,'roi.json':roi,'preflight-reading.json':preflight};
 const absentMetadataChecks=assertP09AbsentOriginalViewMetadata(metadata);
 assertStates(freeze,evidence,roi,preflight);
 const versions=[textVersion('diplomatic','transcription.r1.txt',inputs.get('transcription.r1.txt')),textVersion('modern-french','modern-fr.r1.txt',inputs.get('modern-fr.r1.txt'))];
 for(const name of ['transcription.r0.txt','transcription.r1.txt','modern-fr.r1.txt'])assert.equal(evidence.text_versions.filter(value=>value.file===name&&value.sha256===pins[name].sha256).length,1,'Author evidence text mapping drift');
 const image={
  qualification:'pending-private-view',derivative_qualification:'root-qualified-private-derivative',source_object_id:sourceObject,view_id:null,view_binding_status:'absent-not-inferred',
  source_sha256:null,source_hash_status:'not-provided',derivative_object_id:roi.digital_object_id,derivative_sha256:derivativeSha,
  route:'/archives/next-readings/media/'+derivativeSha+'.jpg',width:3968,height:2976,canonical_view_id:null,
  limits:'Repère du dérivé prévu : six lignes du corps seulement ; région documentaire native x450, y350, largeur3518, hauteur675. Aucun recadrage ni alignement canonique ne sera appliqué par ce raccord. Orientation historique non établie.'
 };
 const historyBuffer=inputs.get('transcription.r0.txt');
 const reading={
  version:'archive-next-reading/2',scope:'private-candidate',candidate_id:'candidate:p09-author-pilot',fragment_id:'fragment:p09-author-l01-l06',slug:'next-reading-p09-author-pilot',
  visual_admission_status:'pending',review_receipt_sha256:null,browser_gate_allowed:false,
  document_identified:false,canonical_act_id:null,date:null,person_ids:[],historical_confirmation:false,publication_approved:false,human_review:'pending',rights:'unknown',
  limitations:[
   'Proposition de l’auteur sur six lignes ; comparaison indépendante et admission visuelle en attente.',
   'Les lacunes […] et les mots partiels restent exacts ; aucun nombre de mots manquants n’est déduit.',
   'La modernisation conserve l’incertitude : elle n’est pas une traduction complète.',
   'Les expansions de vre en votre restent proposées ; aucune expansion silencieuse du diplomatique.',
   'Entré(e) laisse le genre indécidé ; journal reste le terme historique, sans conversion de surface.',
   'Les formes souille et danti[…]ie n’identifient ni lieux ni personnes.',
   'Date, identité du document, lecture humaine et score de précision non établis.',
   'Le premier brouillon R0 est conservé séparément ; R1 n’est pas une révision acceptée du journal.',
   'La région documentaire est un repère dans le raster natif, sans cadre de mot ni alignement canonique.'
  ],
  sources:versions.map(value=>({id:value.source_locator.source_id,sha256:value.text_sha256_utf8,format:'utf8-text'})),versions,
  history:{id:'text:p09-author-diplomatic-r0',source_id:'source:p09-author-diplomatic-r0',revision:'r0',applied_as_active:false,source_sha256:digest(historyBuffer),text_sha256_utf8:digest(historyBuffer),utf8_byte_length:historyBuffer.length,text_exact:decode(historyBuffer)},
  author_observations:structuredClone(evidence.token_evidence),
  author_metadata:{notation:evidence.notation,reread_changes:evidence.reread_changes,abbreviation_expansions:evidence.abbreviation_expansions,restorations_inserted:evidence.restorations_inserted,modernization_limits:evidence.modernization_limits,canonical_refs:evidence.canonical_refs,blind_reading:evidence.blind_reading},
  photo:{...image,text_fragment_id:'fragment:p09-author-l01-l06',transformation_applied:false,documentary_roi:{reference_frame:roi.reference_frame,native_dimensions:roi.native_dimensions,rectangle:roi.rectangle,canonical_bbox:null,applied:false}}
 };
 const options={enabled:true,parentHtml,parentSha256:parentPin.sha256,reading,sourceBuffers:new Map(versions.map(value=>[value.source_locator.source_id,inputs.get(value.source_file)])),qualifiedImages:[image],historyBuffer};
 const composed=composeNextReadingV2(options);
 assert.deepEqual(composed.lineCounts,[6,6]);assert.equal((parentHtml.match(/class="archive-act(?:\s|")/gu)??[]).length,4);
 assert.equal((composed.html.match(/class="archive-act(?:\s|")/gu)??[]).length,5);
 for(const version of versions)verifyLiteral(composed.html,'data-next-version-id',version.id,version.text_exact);
 verifyLiteral(composed.html,'data-next-history-version-id',reading.history.id,reading.history.text_exact);
 // Remove only the three new insertion spans; every byte of the v7 parent must return.
 const cardStart=composed.html.indexOf('<article class="archive-act next-reading-card"'),cardEnd=composed.html.indexOf('</article>',cardStart)+10;
 const newCard=composed.html.slice(cardStart,cardEnd);
 assert(!/<img\b|\bhref=|data-zoom-|SHA-256 image affichée|Photo de travail — dérivé qualifié/u.test(newCard),'Pending card must not activate or claim displayed media');
 const restored=composed.html.slice(0,cardStart)+composed.html.slice(cardEnd);
 assert.equal(restored.replace('<link rel="stylesheet" href="/assets/archives-next-reading.css" />\n','').replace('<script src="/assets/archives-next-reading.js" defer></script>\n',''),parentHtml);
 const checkNames=[];
 for(const [name,mutate]of [
  ['pending visual receipt cannot be promoted',copy=>{copy.visual_admission_status='accepted';}],
  ['invented canonical view refused',copy=>{copy.photo.canonical_view_id='view:invented';}],
  ['R0 byte drift refused',copy=>{copy.history.text_exact+=' ';}],
  ['ROI application refused',copy=>{copy.photo.documentary_roi.applied=true;}],
  ['display admission cannot reuse derivative qualification',copy=>{copy.photo.qualification='accepted-private-view';}]
 ]){const copy=structuredClone(reading);mutate(copy);assert.throws(()=>validateNextReadingV2({...options,reading:copy}));checkNames.push(name);}
 for(const [index,name]of Object.keys(metadata).entries()){
  const copy=structuredClone(metadata),field=index%2===0?'source_sha256':'view_id';copy[name][field]=index%2===0?'a'.repeat(64):'view:invented';
  assert.throws(()=>assertP09AbsentOriginalViewMetadata(copy));checkNames.push('upstream supplied '+field+' refused in '+name);
 }
 const files=new Map([
  ['reader.html',Buffer.from(composed.html,'utf8')],['card.css',await readFile(join(moduleRoot,'card.css'))],['card.js',await readFile(join(moduleRoot,'card.js'))],
  ['reading-contract.json',serialized(reading)],['planned-photo-binding.json',serialized(image)],
  ...[...inputs].map(([name,bytes])=>['author-'+name,bytes])
 ]);
 const code={};for(const name of ['adapter-v2.mjs','prepare-p09-author-candidate.mjs','card.js','card.css'])code[name]=filePin(await readFile(join(moduleRoot,name)));
 const proof={
  format:'p09-private-author-candidate-preparation/1.0.0',scope:'private-candidate',
  candidate_added:true,visual_admission_status:'pending',review_receipt_sha256:null,browser_gate_allowed:false,
  parent:parentPin,author_inputs:Object.fromEntries([...inputs].map(([name,bytes])=>[name,filePin(bytes)])),
  active_text_hashes:composed.textHashes,active_line_counts:composed.lineCounts,history_text_sha256:composed.historyTextSha256,
  documentary_roi:reading.photo.documentary_roi,photo_binding:image,
  additional_assets:composed.additionalAssets.map(asset=>({...asset,run_file:asset.route.endsWith('.css')?'card.css':'card.js'})),
  checks:{literal_texts_passed:3,parent_byte_identical_after_removing_additions:true,parent_cards:4,candidate_cards:5,pending_card_no_active_media:true,upstream_absent_original_view_metadata:absentMetadataChecks,refusal_checks:checkNames},
  code_pins:code,outputs:Object.fromEntries([...files].map(([name,bytes])=>[name,filePin(bytes)])),
  originals_read:false,image_bytes_read:false,reviewer_reading_read:false,pixels_decoded:false,browser_opened:false,media_copied:false,service_started:false,
  source_original_sha256:null,canonical_view_id:null,canonical_bbox:null,transformation_applied:false,
  historical_confirmation:false,publication_approved:false,human_review:'pending',rights:'unknown',human_decisions:0,memory_written:false,
  other_parent_routes_unchanged:true,previous_3tests_12refusals_rerun:false,
  limitations:['Technical author-only preparation. No independent reading or visual admission receipt consumed.','Reader file and source snapshots are private audit artifacts, not publication assets.','Root must provide an explicit admission receipt before image copy, browser access, or new admitted composition.']
 };
 files.set('candidate-proof.json',serialized(proof));
 const handoff=`# P09 — candidat auteur privé, admission en attente\n\nR1 diplomatique et français modernisé sont reproduits exactement sur six lignes chacun. R0 est accessible dans un détail séparé. Les sept observations de l’auteur et les lacunes restent conservées. Aucune identité/date historique ajoutée.\n\n- Candidat : reader.html (SHA-256 ${digest(files.get('reader.html'))}).\n- Preuve : candidate-proof.json (SHA-256 ${digest(files.get('candidate-proof.json'))}).\n- Parent v7 lu seulement : ${parentPin.sha256}. Ses quatre cartes et tous ses autres bytes sont préservés ; la nouvelle carte est ajoutée à la fin du rail.\n- Sources auteur figées : R1 ${pins['transcription.r1.txt'].sha256} ; moderne ${pins['modern-fr.r1.txt'].sha256} ; R0 ${pins['transcription.r0.txt'].sha256}.\n- Dérivé prévu : ${derivativeSha}, raster3968×2976. Source objet ${sourceObject}. Empreinte original et identifiant de vue non fournis : null explicites.\n- Zone documentaire native x450,y350,w3518,h675 ; applied=false, canonical_bbox=null. Aucun crop/rotation/alignement ajouté.\n- Route proposée : ${image.route}. **Aucun JPEG copié ou lu.**\n- Assets supplémentaires : /assets/archives-next-reading.css ← card.css ; /assets/archives-next-reading.js ← card.js.\n\n**État : visual_admission_status=pending, review_receipt_sha256=null, browser_gate_allowed=false.** Qualification de consultation pending-private-view, distincte de la qualification technique du dérivé. Le panneau Photo est descriptif, sans img, href ni zoom. Aucun navigateur, service, lecture indépendante ou média ouvert pour ce raccord. Attendre le reçu d’admission explicite de Root avant toute copie d’image ou contrôle UI ; conserver ce run intact et préparer un run distinct pour la composition admise. Ne pas exposer author-*.json, les textes source, reading-contract.json ou les preuves comme routes publiques.\n\nPréparation portable : scripts/archives-next-readings/prepare-p09-author-candidate.mjs (inputs auteur et parent v7 épinglés, sortie neuve uniquement). L’adaptateur V2 est indépendant de la préparation synthétique V1 close ; aucun fichier de cette préparation, H07 ou Root n’est modifié. Vérification bornée sur données réelles : trois textes littéraux, six lignes par version active, quatre cartes parentes conservées, ROI descriptive, panneau photo sans image/lien/zoom et neuf refus ciblés. Les champs original SHA et view_id ont été contrôlés absents/null dans les quatre JSON auteur. Les trois tests et douze refus antérieurs ne sont pas rejoués.\n`;
 files.set('HANDOFF.md',Buffer.from(handoff,'utf8'));
 await mkdir(output);
 for(const [name,bytes]of files)await writeFile(join(output,name),bytes,{flag:'wx'});
 const confirmed={};for(const [name,bytes]of files){const written=await readFile(join(output,name));assert(written.equals(bytes));confirmed[name]=filePin(written);}
 assert.equal(digest(await readFile(parentPath)),parentPin.sha256,'Parent changed during preparation');
 return {directory:output,status:'pending',proof_sha256:confirmed['candidate-proof.json'].sha256,reader_sha256:confirmed['reader.html'].sha256,outputs:confirmed,checks:proof.checks};
}

if(process.argv[1]&&samePath(fileURLToPath(import.meta.url),process.argv[1])){
 assert.equal(process.argv.length,2,'This fixed preparation takes no CLI path arguments');
 console.log(JSON.stringify(await prepareP09AuthorCandidate(),null,2));
}
