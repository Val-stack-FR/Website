import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {composeP09FullView,FULL_VIEW_ADMISSION_SHA256,PILOT_TEXT_PINS,digest} from './adapter-full-view.mjs';

const admissionPath=resolve('.private/archives-integration/p09-full-view-admission-20261004-v1/admission.json');
const parentPath=resolve('.private/archives-integration/publication-package-20261004-v10/site/dist/archives/index.html');
const parentPin='484eca766a69ad6a084acb60d69d3d28ae0a54ad13eed37ffb83fa657995b8e7';
const pilotRoot=resolve('.private/archives-next-readings/p09-admitted-pilot-20261004-v4');
const ownedBase=resolve('.private/archives-next-readings/p09-full-view-20261004-v1');
const output=join(ownedBase,'reviewed-r2');
const pin=bytes=>({sha256:digest(bytes),bytes:bytes.length});
const serialize=value=>Buffer.from(JSON.stringify(value,null,2)+'\n','utf8');
const admitted=(path,p)=>readFile(path).then(bytes=>{assert.equal(digest(bytes),p.sha256,path);if(p.size_bytes!==undefined)assert.equal(bytes.length,p.size_bytes,path);return bytes;});
const admissionBuffer=await admitted(admissionPath,{sha256:FULL_VIEW_ADMISSION_SHA256});
const receipt=JSON.parse(admissionBuffer),sourceBuffers=new Map();
// Only the receipt's pinned text/metadata files are read. No image bytes or original.
for(const [key,p]of Object.entries(receipt.pins)){assert(/^[a-z_]+$/u.test(key));assert(/\.(?:json|txt|md)$/u.test(p.path));sourceBuffers.set(key,await admitted(p.path,p));}
const pilotBuffers=new Map();for(const [name,sha256]of Object.entries(PILOT_TEXT_PINS))pilotBuffers.set(name,await admitted(join(pilotRoot,name),{sha256}));
const parentBytes=await admitted(parentPath,{sha256:parentPin}),parentHtml=parentBytes.toString('utf8');
const options={enabled:true,parentHtml,parentSha256:parentPin,admissionBuffer,admissionSha256:FULL_VIEW_ADMISSION_SHA256,sourceBuffers,pilotBuffers};
const composed=composeP09FullView(options);
assert.equal(composed.activeLineCounts.join(','),'21,21');assert.equal(composed.editionPins.length,10);assert.deepEqual(composed.comparisonRowCounts,[15,8]);
assert.equal((composed.html.match(/class="archive-act(?:\s|")/gu)??[]).length,5);
assert(!/(?:<script(?![^>]*\bsrc=)[^>]*>|\sstyle=|\son(?:click|load|error)=)/iu.test(composed.html+composed.versionsHtml));
const newCard=composed.html.slice(composed.html.indexOf('<article class="archive-act next-reading-card full-reading-card"'),composed.html.indexOf('</article>',composed.html.indexOf('<article class="archive-act next-reading-card full-reading-card"'))+10);
assert(!/(?:[A-Za-z]:[\\/]|\.private[\\/]|\.json\b|(?:object|segment|reading|proposal):|sha-?256)/iu.test(newCard+composed.versionsHtml));
const refused=[];
for(const [name,mutate]of [
 ['trusted receipt changed',copy=>{copy.admissionBuffer=Buffer.from(copy.admissionBuffer.toString('utf8').replace('"reader_line_count": 21','"reader_line_count": 6'));}],
 ['source text changed',copy=>{copy.sourceBuffers=new Map(copy.sourceBuffers);copy.sourceBuffers.set('display_body',Buffer.from('Changed'));}],
 ['pilot R1 substituted by full R0',copy=>{copy.pilotBuffers=new Map(copy.pilotBuffers);copy.pilotBuffers.set('diplomatic.txt',copy.sourceBuffers.get('author_body'));}],
 ['unqualified source added',copy=>{copy.sourceBuffers=new Map(copy.sourceBuffers);copy.sourceBuffers.set('other_image',Buffer.from('Other'));}],
 ['parent drift',copy=>{copy.parentHtml+=' ';}],
 ['no existing P09 card',copy=>{copy.parentHtml=copy.parentHtml.replace('id="next-reading-p09-author-pilot"','id="absent-p09"');copy.parentSha256=digest(Buffer.from(copy.parentHtml));}],
 ['already upgraded parent',copy=>{copy.parentHtml=composed.html;copy.parentSha256=digest(Buffer.from(copy.parentHtml));}]
]){const copy={...options};mutate(copy);assert.throws(()=>composeP09FullView(copy),name);refused.push(name);}
assert.equal(composeP09FullView({...options,enabled:false}).html,parentHtml);
const oldHistoryPath=resolve('.private/archives-integration/publication-package-20261004-v10/site/dist/archives/next-readings/versions/next-reading-p09-author-pilot/index.html');
const oldHistoryBytes=await admitted(oldHistoryPath,{sha256:'40fd7427cad133e61dbe230d3fac72bb36b79fa61c05cdb74579095e0df9e395'});
const files=new Map([['reader.html',Buffer.from(composed.html)],['versions-full.html',Buffer.from(composed.versionsHtml)],['admission.json',admissionBuffer],['recomposition-contract.json',serialize({format:'p09-full-view-recomposition/1',trusted_admission_sha256:FULL_VIEW_ADMISSION_SHA256,parent_sha256:parentPin,parent_bytes:parentBytes.length,source_files:Object.fromEntries([...sourceBuffers.keys()].map(k=>[k,'inputs/'+k+'.'+receipt.pins[k].path.split('.').at(-1)])),pilot_files:Object.fromEntries([...pilotBuffers.keys()].map(k=>[k,'pilot/'+k])),photo_route:composed.photoRoute,photo_file_added:false})]]);
for(const [key,bytes]of sourceBuffers)files.set('inputs/'+key+'.'+receipt.pins[key].path.split('.').at(-1),bytes);
for(const [name,bytes]of pilotBuffers)files.set('pilot/'+name,bytes);
for(const name of ['full-card.css','full-card.js'])files.set(name,await readFile(join('scripts/archives-next-readings',name)));
const parentDist=resolve('.private/archives-integration/publication-package-20261004-v10/site/dist');
const parentAssets=['/styles.css','/css/archives.css','/css/archives-drafts.css','/css/archives-revision-joins.css','/assets/archives-integration-navigation.css','/js/archives-reader.js','/js/archives-drafts.js','/js/archives-revision-joins.js'].map(route=>({route,run_file:'parent-assets'+route,contentType:route.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'}));
for(const asset of parentAssets){assert(parentHtml.includes('"'+asset.route+'"'));const source=resolve(parentDist,'.'+asset.route);assert(source.toLowerCase().startsWith(parentDist.toLowerCase()+'\\'));assert.equal((await realpath(source)).toLowerCase(),source.toLowerCase());files.set(asset.run_file,await readFile(source));}
const codePins={};for(const name of ['adapter-full-view.mjs','prepare-p09-full-view.mjs','full-card.css','full-card.js'])codePins[name]=pin(await readFile(join('scripts/archives-next-readings',name)));
const metadata={...composed};delete metadata.html;delete metadata.versionsHtml;
const proof={format:'p09-full-view-build/1',status:'unconfirmed-comparison-edition',admission_sha256:FULL_VIEW_ADMISSION_SHA256,parent_source:parentPath,parent_sha256:parentPin,parent_bytes:parentBytes.length,reader_sha256:digest(files.get('reader.html')),selected_assets:composed.additionalAssets,preview_parent_assets:parentAssets,metadata,code_pins:codePins,outputs:Object.fromEntries([...files].map(([name,bytes])=>[name,pin(bytes)])),checks:{exact_text_edition_count:10,refusals:refused,parent_restoration_byte_identical:true,other_cards_preserved_byte_identical:true,old_pilot_versions_unchanged:pin(oldHistoryBytes),old_media_route_retained:true,new_image_files:0,image_bytes_read:0,originals_read:0,other_views_read:0,inline_code:false,private_metadata_exposed:false,pilot_files_modified:false,root_files_modified:false,previous_suites_rerun:false},human_review:'pending',historical_confirmation:false,memory_events:0,CER:null,accuracy_score:null,hosted_publication_executed:false,browser_gate_pending:true};
assert.equal(dirname(output).toLowerCase(),ownedBase.toLowerCase());assert.equal((await realpath(ownedBase)).toLowerCase(),ownedBase.toLowerCase());
await mkdir(output);for(const [name,bytes]of files){assert(!name.includes('..')&&!name.includes('\\'));const target=resolve(output,name);assert(target.toLowerCase().startsWith(output.toLowerCase()+'\\'));await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}
await writeFile(join(output,'build-proof.json'),serialize(proof),{flag:'wx'});
console.log(JSON.stringify({directory:output,build_proof:pin(serialize(proof)),reader:pin(files.get('reader.html')),versions:pin(files.get('versions-full.html')),source_pin_count:sourceBuffers.size,retained_pilot_versions:4,new_body_editions:6,image_files_added:0,refusals:refused.length},null,2));
