import {readFile,writeFile,mkdir,lstat,realpath} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {TextDecoder} from 'node:util';
import assert from 'node:assert/strict';
import {composeNextReadingV3,validateNextReadingV3,digest} from './adapter-v3.mjs';

const moduleRoot=dirname(fileURLToPath(import.meta.url)),repo=resolve(moduleRoot,'../..');
const base=join(repo,'.private/archives-next-readings');
const author=resolve(repo,'../PHD-Maine-paleography-harness/data/private/transcription-campaign/e99-p09-reading-20261004-v1');
const independent=resolve(author,'../e99-p09-independent-20261004-v1');
const harness=resolve(repo,'../PHD-Maine-paleography-harness');
const mediaRoot=resolve(repo,'../PHD-Maine-archives-import/data/private/media-release/e99-two-prepared-20261004-v1/candidate');
const admissionPath=join(repo,'.private/archives-integration/p09-pilot-admission-20261004-v1/admission.json');
const admissionSha='537ee38eb0ec1bbed43330c5eeac507884982d373b3da18ac50e065728119dbb';
const inputSha='85f47a2c5b8bd3a76a7c878f17af89e235de7f5d3a5c7f9999988834994cec91';
const frozenSha='15e3ac0475e36469e94a3c50598e78d4de540df3ec25b53ac018a9e7d742c38c';
const independentTextSha='a1512a6b2c4d6a591378a511e75036aee06de9e169c31b99c28be3a15cecac95';
const parentDirectory=join(repo,'.private/archives-integration/publication-package-20261004-v8/site/dist');
const parentPath=join(parentDirectory,'archives/index.html');
const parentSha='4ba4bef46b591ab3b9627f1cf2b91ecb5ac4d894a272a36adcf7690c81521674';
const prepared=join(base,'p09-author-candidate-20261004-v2');
const pin=bytes=>({sha256:digest(bytes),bytes:bytes.length});
const decode=bytes=>new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
const json=bytes=>JSON.parse(decode(bytes));
const serialize=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const safePath=(actual,expected)=>resolve(actual).toLowerCase()===resolve(expected).toLowerCase();
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const literal=value=>escape(value).replaceAll('\r','&#13;').replaceAll('\n','&#10;');
async function read(path,expectedSha,max=1048576){
 const stat=await lstat(path);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=max);assert(safePath(await realpath(path),path));
 const bytes=await readFile(path);if(expectedSha)assert.equal(digest(bytes),expectedSha,'Input pin mismatch: '+path);return bytes;
}
function versionsPage(reading){
 const items=[{label:'Premier brouillon de l’auteur',...reading.history},{label:'Lecture indépendante proposée',...reading.independent_history},{label:'Variante relue par l’auteur',...reading.versions[0]},{label:'Français modernisé de la variante auteur',...reading.versions[1]}];
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Versions de la lecture de travail</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/css/archives.css"><link rel="stylesheet" href="/assets/archives-next-reading.css"></head><body><main class="next-reading-content"><p><a href="/archives/#${reading.slug}">Revenir au document</a></p><h1>Versions de la lecture de travail</h1><p>Les lectures concurrentes restent non résolues. Aucun nom, date, lieu ou type d’acte n’est confirmé ; aucune lecture humaine validée.</p>${items.map(value=>`<section><h2>${value.label}</h2><pre class="next-reading-text" data-history-version-id="${escape(value.id)}" data-text-sha256="${value.text_sha256_utf8}">${literal(value.text_exact)}</pre><details><summary>Source de cette version</summary><p>${escape(value.id)}</p><p>SHA-256 du texte exact : ${value.text_sha256_utf8}</p></details></section>`).join('')}<p><a href="/archives/#${reading.slug}">Revenir au document</a></p></main></body></html>`;
}

export async function prepareP09AdmittedPilot({outputPath=join(base,'p09-admitted-pilot-20261004-v4')}={}){
 const output=resolve(outputPath);assert(safePath(dirname(output),base));assert(safePath(await realpath(base),base));
 const admissionBytes=await read(admissionPath,admissionSha),admission=json(admissionBytes);
 const oldProofBytes=await read(join(prepared,'candidate-proof.json'),'44c2ba1435d5ff4971a7d91a22ba3c2eb44e1aebbc0ff30b7bccab2648abfefb');
 const oldProof=json(oldProofBytes),readingBytes=await read(join(prepared,'reading-contract.json'),oldProof.outputs['reading-contract.json'].sha256),reading=json(readingBytes);
 const inputBytes=await read(join(author,'input-manifest.json'),inputSha),input=json(inputBytes),selected=input.selected_derivative;
 const frozenBytes=await read(join(independent,'independent-reading-frozen-r0.json'),frozenSha),frozen=json(frozenBytes);
 const independentBytes=await read(join(independent,'independent-working-text-r0.txt'),independentTextSha);
 const independentFreeze=await read(join(independent,'independent-freeze-receipt.json'),admission.pins.independent_freeze.sha256);
 const freeze=json(independentFreeze);
 assert.equal(freeze.reading_sha256,frozenSha);assert.equal(freeze.author_output_opened_before_freeze,false);assert.equal(freeze.human_confirmed,false);
 assert.equal(frozen.source_object_id,selected.source_object_id);assert.equal(frozen.derived_sha256,selected.expected_sha256);assert.equal(frozen.line_count,6);
 assert.equal(frozen.independent_of_author_text,true);assert.equal(frozen.author_text_seen,false);assert.equal(frozen.human_review,'pending');assert.equal(frozen.rights,'unknown');assert.equal(frozen.publication,'private');
 // The exported text has its own final LF; the frozen JSON field has no terminal LF.
 assert.equal(decode(independentBytes),frozen.diplomatic+'\n');
 assert.equal(selected.source_original_hash_recomputed,false);assert.equal(frozen.source_sha256_reference_only,selected.source_sha256_reported);
 assert.equal(selected.expected_sha256,admission.extension_derivative_sha256);assert.equal(selected.source_object_id,admission.extension_source_object_id);
 const parentBytes=await read(parentPath,parentSha),parentHtml=decode(parentBytes);
 const historyBuffer=await read(join(author,'transcription.r0.txt'),admission.pins.author_r0.sha256);
 const sourceBuffers=new Map();
 for(const version of reading.versions){const filename=version.kind==='diplomatic'?'transcription.r1.txt':'modern-fr.r1.txt';sourceBuffers.set(version.source_locator.source_id,await read(join(author,filename),version.text_sha256_utf8));}
 reading.version='archive-next-reading/3';reading.scope='private-admitted-pilot';reading.visual_admission_status='accepted-working-pilot';reading.review_receipt_sha256=admissionSha;reading.browser_gate_allowed=true;reading.pilot=true;reading.expected_line_count=6;
 reading.limitations[0]='Variante de travail de l’auteur sur six lignes, admise au lecteur après comparaison ; désaccords non résolus.';
 reading.history_href='/archives/next-readings/versions/'+reading.slug+'/';
 reading.independent_history={id:frozen.reading_id,applied_as_active:false,text_exact:decode(independentBytes),text_sha256_utf8:independentTextSha,utf8_byte_length:independentBytes.length,frozen_reading_sha256:frozenSha,status:'machine-draft',human_review:'pending'};
 const image={...reading.photo};delete image.text_fragment_id;delete image.transformation_applied;delete image.documentary_roi;
 image.qualification='accepted-private-view';image.source_sha256=selected.source_sha256_reported;image.source_hash_status='reported-not-recomputed';image.source_original_hash_recomputed=false;
 image.limits='Vue entière de travail. L’extrait proposé porte sur six lignes du corps, repérées dans le raster natif ; aucune transformation ni identification historique ajoutée.';
 reading.photo={...reading.photo,...image};
 const options={enabled:true,parentHtml,parentSha256:parentSha,reading,sourceBuffers,qualifiedImages:[image],historyBuffer,independentBuffer:independentBytes,admissionBuffer:admissionBytes,admissionSha256:admissionSha};
 const composed=composeNextReadingV3(options),historyHtml=versionsPage(reading);
 const refusalChecks=[];
 for(const [name,mutate]of [
  ['Root receipt pin drift refused',copy=>{copy.review_receipt_sha256='0'.repeat(64);}],
  ['independent text drift refused',copy=>{copy.independent_history.text_exact+=' ';}],
  ['history URL off local route refused',copy=>{copy.history_href='https://example.org/';}],
  ['canonical promotion refused',copy=>{copy.canonical_act_id='act:invented';}],
  ['pilot contraction refused',copy=>{copy.expected_line_count=5;}],
  ['extension without a new counted receipt refused',copy=>{copy.expected_line_count=7;}]
 ]){const copy=structuredClone(reading);mutate(copy);assert.throws(()=>validateNextReadingV3({...options,reading:copy}));refusalChecks.push(name);}
 const inventedViewReading=structuredClone(reading),inventedViewImage=structuredClone(image);
 inventedViewReading.photo.view_id=inventedViewImage.view_id='view:invented';inventedViewReading.photo.view_binding_status=inventedViewImage.view_binding_status='provided';
 assert.throws(()=>validateNextReadingV3({...options,reading:inventedViewReading,qualifiedImages:[inventedViewImage]}));refusalChecks.push('coherently invented noncanonical view ID refused');
 assert.deepEqual(composed.lineCounts,[6,6]);assert.equal((composed.html.match(/class="archive-act(?:\s|")/gu)??[]).length,5);
 const newStart=composed.html.indexOf('<article class="archive-act next-reading-card"'),newEnd=composed.html.indexOf('</article>',newStart)+10;
 const restored=composed.html.slice(0,newStart)+composed.html.slice(newEnd);
 assert.equal(restored.replace('<link rel="stylesheet" href="/assets/archives-next-reading.css" />\n','').replace('<script src="/assets/archives-next-reading.js" defer></script>\n',''),parentHtml);
 // Only the exact derivative in the frozen author input can be selected.
 assert.equal(selected.relative_path,'media/'+selected.expected_sha256+'.jpg');
 const mediaPath=join(mediaRoot,selected.relative_path);assert(safePath(await realpath(mediaRoot),mediaRoot));assert(safePath(await realpath(mediaPath),mediaPath));
 const mediaStat=await lstat(mediaPath);assert(mediaStat.isFile()&&!mediaStat.isSymbolicLink()&&mediaStat.size===selected.expected_byte_size&&mediaStat.size<=4*1024*1024);
 const opsPath=join(harness,'ops/Test-PhdPreflight.ps1');await read(opsPath,'a64276ae1be0c655645cf0ea1777d4bbd80c3f0888092794dbfc818632bd4a5f');
 await mkdir(output);
 const manifest={format:'p09-admitted-reader-preflight/1',admission_sha256:admissionSha,parent_sha256:parentSha,author_input_sha256:inputSha,selected_derivative:selected,originals:0,other_images:0,transforms:0,network:0};
 await writeFile(join(output,'input-manifest.json'),serialize(manifest),{flag:'wx'});
 // Trust only this already-authorized checkout for the helper's read-only Git queries.
 // The exception is process-local; no global configuration or repository is changed.
 const ops=spawnSync('pwsh',['-NoProfile','-File',opsPath,'-InputManifest',join(output,'input-manifest.json')],{cwd:harness,env:{...process.env,PHD_CORPUS_ROOT:mediaRoot,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:harness},encoding:'utf8',windowsHide:true});
 const preflight=JSON.parse(ops.stdout);await writeFile(join(output,'preflight.json'),serialize(preflight),{flag:'wx'});
 assert.equal(ops.status,0,'Preflight failed: '+ops.stderr);assert.equal(preflight.passed,true);
 assert.equal(preflight.input_manifest_sha256,digest(serialize(manifest)));
 // First byte access to P09 image occurs strictly after the new preflight is written.
 const mediaBytes=await read(mediaPath,selected.expected_sha256,4*1024*1024);assert.equal(mediaBytes.length,selected.expected_byte_size);
 const files=new Map([
  ['input-manifest.json',serialize(manifest)],['preflight.json',serialize(preflight)],
  ['reader.html',Buffer.from(composed.html)],['versions.html',Buffer.from(historyHtml)],['card.css',await read(join(moduleRoot,'card.css'))],['card.js',await read(join(moduleRoot,'card.js'))],
  ['media/'+selected.expected_sha256+'.jpg',mediaBytes],['reading-contract.json',serialize(reading)],['photo-binding.json',serialize(image)],
  ['root-admission.json',admissionBytes],['author-input-manifest.json',inputBytes],['independent-reading-frozen-r0.json',frozenBytes],['independent-working-text-r0.txt',independentBytes],['independent-freeze-receipt.json',independentFreeze],
  ['author-r0.txt',historyBuffer],...reading.versions.map(value=>[value.kind+'.txt',sourceBuffers.get(value.source_locator.source_id)])
 ]);
 const assets=composed.additionalAssets.map(asset=>({...asset,run_file:asset.route.endsWith('.css')?'card.css':'card.js'}));
 assets.push({route:reading.history_href,run_file:'versions.html',contentType:'text/html; charset=utf-8'},{route:image.route,run_file:'media/'+image.derivative_sha256+'.jpg',contentType:'image/jpeg'});
 const previewAssets=[];
 const parentRoutes=[...new Set([...parentHtml.matchAll(/(?:src|href)="([^"?]+\.(?:css|js))"/gu)].map(match=>match[1]))];
 for(const route of parentRoutes){assert(/^\/[A-Za-z0-9_./-]+\.(css|js)$/u.test(route)&&!route.includes('..'));const bytes=await read(join(parentDirectory,route.slice(1)));const runFile='parent-assets/'+route.slice(1);files.set(runFile,bytes);previewAssets.push({route,run_file:runFile,contentType:route.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});}
 const codePins={};for(const name of ['adapter-v3.mjs','prepare-p09-admitted-pilot.mjs','card.css','card.js'])codePins[name]=pin(await read(join(moduleRoot,name)));
 const proof={format:'p09-admitted-reader-build/1',status:'accepted-working-pilot',admission_sha256:admissionSha,parent_sha256:parentSha,parent_bytes:parentBytes.length,reader_sha256:digest(files.get('reader.html')),history_href:reading.history_href,text_hashes:composed.textHashes,independent_text_sha256:independentTextSha,history_r0_sha256:digest(historyBuffer),line_counts:composed.lineCounts,photo_binding:image,documentary_roi:reading.photo.documentary_roi,selected_assets:assets,preview_parent_assets:previewAssets,code_pins:codePins,outputs:Object.fromEntries([...files].map(([name,bytes])=>[name,pin(bytes)])),checks:{parent_byte_identical_after_removing_additions:true,independent_frozen_text_plus_terminal_lf_exact:true,refusals:refusalChecks},media_preflight_sha256:digest(serialize(preflight)),media_files_read:1,media_bytes:mediaBytes.length,originals_read:false,other_images_read:0,transformation_applied:false,historical_confirmation:false,human_review:'pending',rights:'unknown',publication_approved:false,browser_gate_pending:true,root_files_modified:false,previous_suites_rerun:false};
 files.set('build-proof.json',serialize(proof));
 await mkdir(join(output,'media'));
 for(const [name,bytes]of files){if(name.startsWith('parent-assets/'))await mkdir(dirname(join(output,name)),{recursive:true});if(!['input-manifest.json','preflight.json'].includes(name))await writeFile(join(output,name),bytes,{flag:'wx'});assert((await readFile(join(output,name))).equals(bytes));}
 assert.equal(digest(await readFile(parentPath)),parentSha);return {directory:output,proof_sha256:digest(files.get('build-proof.json')),reader_sha256:proof.reader_sha256,selected_assets:assets,checks:proof.checks};
}
if(process.argv[1]&&safePath(fileURLToPath(import.meta.url),process.argv[1])){assert.equal(process.argv.length,2);console.log(JSON.stringify(await prepareP09AdmittedPilot(),null,2));}
