import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {adaptArchiveExport,assertPrivateIgnoredOutput} from './render-reader.mjs';
import {bindReaderMedia,loadReaderMediaRelease,readerMediaSelection,readerMediaRoutes} from './reader-media-release.mjs';

const root=fileURLToPath(new URL('../..',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const encode=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const ensure=(condition,message)=>{if(!condition)throw new Error('Minimal release: '+message);};
const escape=value=>String(value).replace(/[&<>"']/gu,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])).replace(/\r/gu,'&#13;');
const readerSha='c037723e0a90b5b03f3e535d3781bb49ae6e99e99da5e719c2cf09d5af09226c';
const candidateId='candidate:atelier-47958c7faa376f7e4729edd9babe9b40';
const normalBrowserLimits=Object.freeze([
  'IAB screenshots are JPEG; lossless pixel comparison is not available in this browser. The external browser refused this localhost page.',
  'Mobile hover decoration can briefly scale a thumbnail; no orientation or encoded-raster transform is introduced.'
]);
const fixedFiles=['archives/index.html','archives/manifest.json','archives/assets/consultation.css','archives/assets/consultation.js','favicon.svg'];
const forbidden=/(?:[CZ]:[\\/]|PHD_CORPUS_ROOT|source_object_id|source_sha256|approved_review_id|view_id|object:path-|candidate:|text:atelier|localhost|127\.0\.0\.1|CLEAN\/|\.private|PHD-Maine|workbook|library|E\.133|E\.113|E\.108|C07)/iu;

export function projectMinimalDossier(model) {
  const dossiers=model.dossiers.filter(item=>item.candidateId===candidateId);
  ensure(dossiers.length===1,'one exact Monbezon dossier required.');
  const dossier=dossiers[0];
  ensure(dossier.texts.length===1 && dossier.images.length===2 && dossier.identificationStatus==='candidate' && dossier.readingStatus==='unreviewed' && dossier.dateClaims.length===0 && dossier.documentId===null && dossier.actId===null,'unchanged partial candidate profile required.');
  const text=dossier.texts[0];
  ensure(text.extent==='PARTIAL' && text.readingStatus==='unreviewed' && text.translation===null,'partial original and absent translation required.');
  ensure(dossier.images.every(item=>item.associationStatus==='accepted' && item.derivativeSha256 && item.rightsStatus==='unknown'),'verified pending-rights images required.');
  // Only these editorial fields cross the candidate's display boundary.
  return {slug:'monbezon-e76',title:dossier.label,reference:'E.76',reference_basis:'transcription-filename',historical_identification:'unconfirmed',date:null,reading_status:'unreviewed',extent:'partial',original:text.literal,translation:null,images:dossier.images.map((image,index)=>({label:'Vue '+(index+1),href:image.mediaUrl,sha256:image.derivativeSha256,width:image.width,height:image.height,rights_status:'unknown',credits:null}))};
}

function renderCandidate(dossier) {
  const figures=dossier.images.map(image=>`<figure><a class="photo-link" href="${escape(image.href)}" data-release-zoom="${escape(image.href)}" data-release-label="${escape(image.label)}"><img src="${escape(image.href)}" width="${image.width}" height="${image.height}" alt="${escape(image.label)} du dossier Guillaume de Monbezon"><span>Agrandir ${escape(image.label.toLowerCase())}</span></a><figcaption>${escape(image.label)} · photographie liée au dossier</figcaption></figure>`).join('\n');
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Archives · Guillaume de Monbezon — Valérian Teissier</title><meta name="description" content="Consultation de travail d’un dossier d’archives : transcription partielle et deux vues photographiques."><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'"><link rel="canonical" href="https://valerianteissier.com/archives/"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/archives/assets/consultation.css"><script src="/archives/assets/consultation.js" defer></script></head>
<body id="top"><a class="skip" href="#dossier">Aller au dossier</a><header class="site-header"><a href="#top">Valérian Teissier</a><span>Archives · atelier Tucé</span></header>
<main><section class="intro"><p class="eyebrow">Archives en cours de lecture</p><h1>Consulter les pièces.</h1><p class="lead">Les photographies, la transcription et ses incertitudes, réunies dans leur dossier.</p><p class="notice">Version de travail · diffusion en préparation</p></section>
<article id="dossier"><header class="dossier-header"><p class="eyebrow">Un dossier · deux vues photographiques</p><h2>${escape(dossier.title)}</h2><p>Intitulé et cote E.76 repris du nom de transcription. Identification historique à confirmer ; date non renseignée.</p><ul class="states" aria-label="État du dossier"><li>Lecture partielle · non relue</li><li>Deux vues liées</li><li>Droits et crédits à documenter</li></ul><nav aria-label="Dans ce dossier"><a href="#transcription">Transcription</a><a href="#photos">Photographies</a><a href="#traduction">Français moderne</a></nav></header>
<div class="reading-grid"><section id="transcription" aria-labelledby="transcription-title"><p class="eyebrow">01 · Texte importé</p><h3 id="transcription-title">Transcription originale</h3><p class="section-note">Les graphies, lacunes et retours à la ligne sont conservés. Cette lecture reste à revoir.</p><div class="literal">${escape(dossier.original)}</div></section><section id="photos" aria-labelledby="photos-title"><p class="eyebrow">02 · Même dossier</p><h3 id="photos-title">Photographies</h3><p class="section-note">Deux vues associées à cette transcription. Elles ne constituent pas deux actes distincts.</p><div class="gallery">${figures}</div></section></div>
<section id="traduction" class="translation" aria-labelledby="translation-title"><p class="eyebrow">03 · Français moderne</p><h3 id="translation-title">Traduction absente</h3><p>Aucune version en français moderne n’est fournie pour ce dossier.</p></section></article>
<footer><p>Travail en cours. Les droits de diffusion et les crédits des photographies restent à documenter. Cette préparation ne vaut pas autorisation de publication.</p><a href="/archives/manifest.json">État de cette consultation</a></footer></main>
<dialog id="release-zoom" aria-labelledby="zoom-title"><div class="zoom-toolbar"><h2 id="zoom-title">Vue photographique</h2><button id="zoom-size" type="button" aria-pressed="false">Taille réelle</button><button id="zoom-close" type="button">Fermer</button></div><div id="zoom-scroll"><img id="zoom-image" alt=""></div><p>Utilisez les barres de défilement en taille réelle. Échap ferme l’image.</p></dialog>
</body></html>\n`;
}

export function verifyNormalBrowserGate(gate,normalBytes,selectionBytes) {
  const normal=JSON.parse(normalBytes),selection=JSON.parse(selectionBytes);
  ensure(gate.version==='reader-media-browser-verification/1' && gate.passed===true && gate.desktop===true && gate.mobile===true && gate.two_image_zooms===true && gate.run_integration_sha256===sha(normalBytes) && gate.selection_sha256===sha(selectionBytes),'qualified normal reader gate required.');
  ensure(gate.publication_approved===false && gate.rights_review==='pending' && gate.h05?.same_verified_derivative===true && gate.h05.display_geometry_equal===true && gate.h05.visual_review_passed===true && gate.h05.exact_word_alignment===false && JSON.stringify(gate.h05.native_frame)==='[3968,2976]' && JSON.stringify(gate.h05.context_box)==='[648,756,3127,564]','H05/native frame or pending state differs.');
  ensure(gate.h05.new_lossless_pixel_equality_proven===false && JSON.stringify(gate.limits)===JSON.stringify(normalBrowserLimits),'browser capture limits must remain explicit and unchanged.');
  ensure(normal.version==='reader-media-integration/1' && normal.scope==='private-local' && normal.originals_read===false && normal.source_views_reidentified===false && normal.historical_confirmation===false && normal.publication_approved===false && normal.rights_review==='pending' && normal.input_hashes.reader===readerSha && normal.output_hashes['media-release-selection.json']===sha(selectionBytes) && JSON.stringify(normal.bindings)===JSON.stringify(selection.bindings),'normal integration binding differs.');
}

export async function prepareMinimalRelease({readerPath,mediaDirectory,normalDirectory,browserGatePath,outputPath}) {
  const normal=assertPrivateIgnoredOutput(normalDirectory),output=assertPrivateIgnoredOutput(outputPath);
  ensure(!existsSync(output),'new ignored preparation directory required.');
  const normalBytes=readFileSync(join(normal,'integration-proof.json')),selectionBytes=readFileSync(join(normal,'media-release-selection.json')),gateBytes=readFileSync(browserGatePath);
  verifyNormalBrowserGate(JSON.parse(gateBytes),normalBytes,selectionBytes);
  const context=await loadReaderMediaRelease(mediaDirectory),selection=readerMediaSelection(context);
  ensure(JSON.stringify(JSON.parse(selectionBytes))===JSON.stringify(selection),'frozen two-image selection differs.');
  const readerBytes=readFileSync(readerPath);ensure(sha(readerBytes)===readerSha,'immutable reader input required.');
  const dossier=projectMinimalDossier(bindReaderMedia(adaptArchiveExport(JSON.parse(readerBytes)),context));
  const manifest={version:'archives-minimal-consultation/1',state:'prepared-unpublished',publication_approved:false,rights_status:'unknown',rights_review:'pending',credits_review:'pending',dossiers:[dossier]};
  const files=new Map([['archives/index.html',Buffer.from(renderCandidate(dossier))],['archives/manifest.json',encode(manifest)],['archives/assets/consultation.css',readFileSync(new URL('release-candidate.css',import.meta.url))],['archives/assets/consultation.js',readFileSync(new URL('release-candidate.js',import.meta.url))],['favicon.svg',readFileSync(join(root,'favicon.svg'))]]);
  for(const [url,entry] of readerMediaRoutes(context))files.set(url.slice(1),entry.bytes);
  for(const [name,bytes] of files)if(!name.endsWith('.jpg'))ensure(!forbidden.test(bytes.toString('utf8')),'internal or excluded content in '+name);
  mkdirSync(join(output,'public'),{recursive:true});
  const hashes={};for(const [name,bytes] of files){mkdirSync(join(output,'public',name,'..'),{recursive:true});writeFileSync(join(output,'public',name),bytes,{flag:'wx'});hashes[name]=sha(bytes);}
  const proof={version:'archives-minimal-preparation/1',prepared_at:new Date().toISOString(),state:'prepared-unpublished',originals_read:false,publication_approved:false,rights_status:'unknown',rights_review:'pending',credits_review:'pending',historical_confirmation:false,dossier_count:1,media_count:2,input_hashes:{reader:readerSha,media_checksums:selection.checksums_sha256,normal_integration:sha(normalBytes),browser_verification:sha(gateBytes)},source_derivative_bindings:selection.bindings,text_sha256:sha(dossier.original),public_file_hashes:hashes,excluded:['C07','E.108','E.133','E.113','reading-library','internal-manifests','physical-locators','private-photographic-metadata'],limits:[...normalBrowserLimits]};
  const proofBytes=encode(proof);writeFileSync(join(output,'preparation-proof.json'),proofBytes,{flag:'wx'});
  verifyMinimalRelease(output,sha(proofBytes));
  return {output,proof_sha256:sha(proofBytes),public_files:files.size,dossiers:1,images:2,publication_approved:false};
}

export function verifyMinimalRelease(directory,proofSha256) {
  const base=assertPrivateIgnoredOutput(directory),proofBytes=readFileSync(join(base,'preparation-proof.json'));
  ensure(/^[a-f0-9]{64}$/u.test(proofSha256) && sha(proofBytes)===proofSha256,'explicit preparation proof hash required.');
  const proof=JSON.parse(proofBytes);
  ensure(proof.version==='archives-minimal-preparation/1' && proof.state==='prepared-unpublished' && proof.originals_read===false && proof.publication_approved===false && proof.rights_status==='unknown' && proof.rights_review==='pending' && proof.credits_review==='pending' && proof.historical_confirmation===false && proof.dossier_count===1 && proof.media_count===2 && proof.input_hashes.reader===readerSha,'private preparation profile differs.');
  ensure(JSON.stringify(proof.limits)===JSON.stringify(normalBrowserLimits),'preparation browser limits differ.');
  const expected=[...fixedFiles,...proof.source_derivative_bindings.map(item=>item.media_url.slice(1))].sort();
  ensure(expected.length===7 && new Set(expected).size===7 && JSON.stringify(Object.keys(proof.public_file_hashes).sort())===JSON.stringify(expected),'closed seven-file allowlist required.');
  const publicRoot=join(base,'public'),actual=[];
  function walk(directory) {
    const info=lstatSync(directory);ensure(!info.isSymbolicLink() && realpathSync(directory)===resolve(directory),'symlink or reparse point refused.');
    if(info.isDirectory()){for(const entry of readdirSync(directory))walk(join(directory,entry));return;}
    ensure(info.isFile(),'non-regular file refused.');
    const name=relative(publicRoot,directory).split(sep).join('/');ensure(name && !isAbsolute(name) && !name.startsWith('../'),'public path escape.');actual.push(name);
  }
  walk(publicRoot);ensure(JSON.stringify(actual.sort())===JSON.stringify(expected),'extra or missing public file.');
  const files=new Map();
  for(const name of expected){const bytes=readFileSync(join(publicRoot,name));ensure(sha(bytes)===proof.public_file_hashes[name],'file hash differs: '+name);if(!name.endsWith('.jpg'))ensure(!forbidden.test(bytes.toString('utf8')),'internal content in '+name);files.set('/'+name,bytes);}
  const manifest=JSON.parse(files.get('/archives/manifest.json'));
  ensure(manifest.version==='archives-minimal-consultation/1' && manifest.state==='prepared-unpublished' && manifest.publication_approved===false && manifest.rights_status==='unknown' && manifest.rights_review==='pending' && manifest.credits_review==='pending' && manifest.dossiers.length===1,'display manifest profile differs.');
  const dossier=manifest.dossiers[0];ensure(dossier.slug==='monbezon-e76' && dossier.translation===null && dossier.date===null && dossier.reading_status==='unreviewed' && dossier.historical_identification==='unconfirmed' && dossier.extent==='partial' && sha(dossier.original)===proof.text_sha256 && dossier.images.length===2,'dossier text or state differs.');
  for(const [index,image] of dossier.images.entries()){const item=proof.source_derivative_bindings[index];ensure(image.href===item.media_url && image.sha256===item.derivative_sha256 && image.width===3968 && image.height===2976 && image.rights_status==='unknown' && image.credits===null && sha(files.get(image.href))===item.derivative_sha256,'display media binding differs.');}
  const html=files.get('/archives/index.html').toString('utf8');
  ensure(!/<(?:script|style)\b[^>]*>\s*[^<\s]/iu.test(html) && !/\s(?:style|on\w+)\s*=/iu.test(html) && !/unsafe-(?:inline|eval)/iu.test(html),'inline active content refused.');
  ensure(html.includes(`<div class="literal">${escape(dossier.original)}</div>`) && html.includes('<html lang="fr">') && html.includes('https://valerianteissier.com/archives/'),'static literal, language or canonical differs.');
  for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gu)){const value=match[1];if(value==='https://valerianteissier.com/archives/')continue;if(value.startsWith('#')){ensure(html.includes(`id="${value.slice(1)}"`),'missing fragment target.');continue;}ensure(files.has(value),'link outside closed tree: '+value);}
  return {files,proof,proofSha256,manifest};
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {const {values}=parseArgs({options:Object.fromEntries(['reader','media','normal','browser-gate','output'].map(name=>[name,{type:'string'}]))});for(const name of ['reader','media','normal','browser-gate','output'])ensure(values[name],'required --'+name);console.log(await prepareMinimalRelease({readerPath:values.reader,mediaDirectory:values.media,normalDirectory:values.normal,browserGatePath:values['browser-gate'],outputPath:values.output}));}catch(error){console.error(error.message);process.exitCode=1;}
}
