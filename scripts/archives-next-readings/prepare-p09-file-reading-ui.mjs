import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import assert from 'node:assert/strict';
import {digest,FILE_READING_PINS,FILE_ROUTES,projectP09File,renderFileLibrary,renderFileReading} from './file-reading-adapter.mjs';

const run=resolve('.private/archives-next-readings/p09-file-reading-ui-20261004-v1');
const parent=resolve('.private/archives-integration/publication-package-20261004-v12-r2');
const cropRoot=resolve('.private/archives-integration/p09-word-review-crops-20261004-v1');
const authorRoot=resolve('.private/archives-next-readings/p09-full-view-20261004-v1/reviewed-r2/inputs');
const formsPath=resolve('../PHD-Maine-paleography-harness/data/private/p09-form-projection-mvp-20261004-v1/run02/forms.json');
const serialize=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
const pin=bytes=>({sha256:digest(bytes),bytes:bytes.length});
const selectedRead=async(path,sha)=>{const bytes=await readFile(path);assert.equal(digest(bytes),sha,path);return bytes;};
const [assemblyBytes,bodyBytes,evidenceBytes,formsBytes,formsPageBytes,admissionBytes,candidateBytes]=await Promise.all([
 selectedRead(join(parent,'assembly.json'),FILE_READING_PINS.assembly),selectedRead(join(authorRoot,'author_body.txt'),FILE_READING_PINS.body),selectedRead(join(authorRoot,'author_evidence.json'),FILE_READING_PINS.evidence),selectedRead(formsPath,FILE_READING_PINS.forms),selectedRead(join(parent,'site/dist/archives/formes/p09/index.html'),FILE_READING_PINS.formsPage),selectedRead(join(cropRoot,'root-admission.json'),FILE_READING_PINS.admission),selectedRead(join(cropRoot,'candidate.json'),FILE_READING_PINS.candidate)
]);
const admission=JSON.parse(admissionBytes),assembly=JSON.parse(assemblyBytes),cropBytes=new Map();
for(const r of admission.regions){assert.match(r.file,/^[a-z0-9-]+\.png$/);assert(!cropBytes.has(r.file));cropBytes.set(r.file,await selectedRead(join(cropRoot,r.file),r.sha256));}
const options={assemblyBytes,bodyBytes,evidenceBytes,formsBytes,formsPageBytes,admissionBytes,candidateBytes,cropBytes},p=projectP09File(options);
const index=Buffer.from(renderFileLibrary(p)),page=Buffer.from(renderFileReading(p));
const refusalChecks=[];
for(const [name,change]of [
 ['wrong body edition',copy=>{copy.bodyBytes=Buffer.from('comparison r1');}],
 ['crop pixel drift',copy=>{copy.cropBytes=new Map(copy.cropBytes);const [name,bytes]=copy.cropBytes.entries().next().value,b=Buffer.from(bytes);b[b.length-1]^=1;copy.cropBytes.set(name,b);}],
 ['extra image asset',copy=>{copy.cropBytes=new Map(copy.cropBytes);copy.cropBytes.set('overview.jpg',Buffer.from('extra'));}],
 ['uninspected crop admission',copy=>{const a=JSON.parse(copy.admissionBytes);a.explicit_visual_inspection=false;copy.admissionBytes=serialize(a);}]
]){const copy={...options};change(copy);assert.throws(()=>projectP09File(copy));refusalChecks.push(name);}
assert.equal(p.lines.map(l=>l.text).join('\n')+'\n',bodyBytes.toString('utf8'));
assert.equal(p.lines.length,21);assert.equal(p.points.filter(point=>point.crop).length,3);
assert.equal(p.points.find(point=>!point.crop).quote,'vre');assert.equal(p.canonicalAct,null);assert.equal(p.cote,null);
const outputs=new Map([['library.html',index],['p09.html',page],['file-reading.css',await readFile('scripts/archives-next-readings/file-reading.css')],['projection.json',serialize(p)],['inputs/assembly.json',assemblyBytes],['inputs/author_body.txt',bodyBytes],['inputs/author_evidence.json',evidenceBytes],['inputs/forms.json',formsBytes],['inputs/forms-page.html',formsPageBytes],['inputs/root-admission.json',admissionBytes],['inputs/candidate.json',candidateBytes]]);
const publicRoutes=[{route:FILE_ROUTES.index,run_file:'library.html',contentType:'text/html; charset=utf-8'},{route:FILE_ROUTES.p09,run_file:'p09.html',contentType:'text/html; charset=utf-8'},{route:FILE_ROUTES.css,run_file:'file-reading.css',contentType:'text/css; charset=utf-8'}];
for(const point of p.points){if(point.crop){const c=point.crop,b=cropBytes.get(c.sourceFile);outputs.set(c.run_file,b);publicRoutes.push({route:c.route,run_file:c.run_file,contentType:'image/png',source_asset_sha256:c.sha256});}}
const cssRoute='/assets/archives-integration-lexical.css',cssFile='dist'+cssRoute,cssBytes=await selectedRead(join(parent,'site',cssFile),assembly.files[cssFile].sha256);outputs.set('parent-assets/lexical.css',cssBytes);
const parentAssets=[{route:cssRoute,run_file:'parent-assets/lexical.css',contentType:'text/css; charset=utf-8',sha256:digest(cssBytes)}];
for(const html of [index.toString(),page.toString()]){
 assert(!/<script\b|\sstyle\s*=|\son[a-z]+\s*=/i.test(html));
 assert(!/\.private|Z:\\|C:\\|object:path-|source_span|candidate_sha256|canonicalAct|word_bbox/.test(html));
}
assert.equal((page.toString().match(/<img /g)||[]).length,3);assert(!index.includes(Buffer.from('<img ')));
const codePins={};for(const name of ['file-reading-adapter.mjs','file-reading.css','prepare-p09-file-reading-ui.mjs','p09-file-reading-preview.mjs','close-p09-file-reading-ui.mjs']){const b=await readFile(join('scripts/archives-next-readings',name));codePins[name]=pin(b);outputs.set('code-snapshot/'+name,b);}
const contract={format:'p09-file-reading-ui-integration/1',parent_package:'publication-package-20261004-v12-r2',parent_assembly_sha256:FILE_READING_PINS.assembly,model:'file → locally numbered transcription → four prepared points',routes:publicRoutes,required_existing_assets:parentAssets,required_existing_links:[{route:p.overviewRoute,sha256:FILE_READING_PINS.overview,bytes:3604434},{route:'/archives/catalogue/'},{route:'/archives/'},{route:'/archives/next-readings/versions/p09-full-view-proposed/#full-history'}],source_file_key:p.key,source_edition:p.sourceEdition,source_body_sha256:p.sourceBodySha256,crop_admission_sha256:FILE_READING_PINS.admission,prepared_points:4,retained_proposals:9,review_crop_assets:3,new_photographic_views:0,whole_act_claim:false,canonical_updates:0,confirmed_memory:false,cote:null,manuscript_global_numbering:false,existing_files_replaced:[],disable:'Omit the six new public files. All parent bytes remain unchanged.',public_allowlist_only:true,preview_is_static_only:true,root_navigation_integration_required:true};
outputs.set('integration-contract.json',serialize(contract));
const proof={format:'p09-file-reading-ui-build/1',parent_assembly_sha256:FILE_READING_PINS.assembly,source_pins:FILE_READING_PINS,source_file_key:p.key,source_edition:p.sourceEdition,numbering:p.lineNumbering,counts:{source_files:1,source_body_lines:21,prepared_points:4,proposals:9,review_crop_assets:3,crop_pending:1,new_photographic_views:0,public_html:2,public_css:1,public_scripts:0,existing_files_replaced:0},public_routes:publicRoutes,preview_parent_assets:parentAssets,outputs:Object.fromEntries([...outputs].map(([name,b])=>[name,pin(b)])),code_pins:codePins,checks:{r0_body_byte_identical:true,local_physical_line_numbers_evidenced:true,quote_line_and_unicode_spans_exact:true,no_offset_based_image_geometry:true,manual_crop_byte_identical:true,png_dimensions_match_rectangle:true,source_frame_identity:true,word_bbox_null:true,fourth_point_no_image:true,nine_suggestions_and_provenance_preserved:true,no_private_metadata_in_public:true,no_inline_code_or_styles:true,source_file_not_whole_act:true,cote_not_invented:true,photo_overview_not_read_or_copied:true,root_inputs_unchanged:true,canonical_updates:0,human_review:'pending',confirmed_memory:false,refusal_checks:refusalChecks},browser_gate_pending:true,publication_executed:false};
assert.equal(dirname(run).toLowerCase(),resolve('.private/archives-next-readings').toLowerCase());assert.equal((await realpath(dirname(run))).toLowerCase(),dirname(run).toLowerCase());await mkdir(run);
for(const [name,b]of outputs){const path=resolve(run,name);assert(path.toLowerCase().startsWith(run.toLowerCase()+'\\'));await mkdir(dirname(path),{recursive:true});await writeFile(path,b,{flag:'wx'});}
const proofBytes=serialize(proof);await writeFile(join(run,'build-proof.json'),proofBytes,{flag:'wx'});
console.log(JSON.stringify({run,build_proof:pin(proofBytes),counts:proof.counts,public_routes:publicRoutes.map(x=>x.route),browser_gate:'pending'},null,2));
