import {readFile,writeFile,mkdir,lstat,realpath} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,sep,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {renderRevisionFixture,prepareRevisionFixture} from './revision-reader.mjs';
import {guardRequest} from '../archives-integration/media-preview.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const check=(value,message)=>{if(!value)throw Error('Revision fixture: '+message);};
const PIN={export:'c1dd21e3a46291e78c6485467712267416bf4f4d9e6968c762be6e6a864e543a',verification:'cd0df999eb3918a91e683e179a299473760a91d8ea2bb40ca2140786a60d0890',handoff:'8a9d6ebdd86b147372a6e2a7d9ee285ba032e11b6137b13b7c44f0336a5c4703',checksums:'0234c220e28f8aee94d6d80d551ebd1bff9e4d38bf1e437891d39944e973e160'};
const contexts=new WeakMap();
const CODE=['scripts/archives/revision-reader.mjs','scripts/archives/revision-fixture.mjs','js/archives-revisions.js','css/archives-revisions.css','scripts/archives-integration/media-preview.mjs'];
async function root(path){check(!(await lstat(path)).isSymbolicLink(),'directory links refused');return realpath(path);}
async function bounded(base,name,pin){check(/^[A-Za-z0-9.-]+$/u.test(name),'unsafe input name');const file=join(base,name),stat=await lstat(file),actual=await realpath(file),part=relative(base,actual);check(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=1024*1024&&part&&!isAbsolute(part)&&part!=='..'&&!part.startsWith('..'+sep),'input type/budget/boundary drift');const bytes=await readFile(file);if(pin)check(sha(bytes)===pin,name+' pin drift');return bytes;}
async function load({directory,reviewDirectory}){
 const source=await root(directory),review=await root(reviewDirectory),checksums=JSON.parse(await bounded(review,'checksums.json',PIN.checksums));
 check(checksums.algorithm==='sha256'&&JSON.stringify(Object.keys(checksums.files).sort())===JSON.stringify(['review.py','test-results.txt','verification.json','HANDOFF.md'].sort()),'independent review scope drift');
 for(const [name,pin]of Object.entries(checksums.files))await bounded(review,name,pin);
 check(checksums.files['verification.json']===PIN.verification&&checksums.files['HANDOFF.md']===PIN.handoff,'independent GO pins drift');
 const verification=JSON.parse(await bounded(review,'verification.json',PIN.verification));
 check(verification.result==='GO_FIXTURES_ONLY'&&verification.tests_passed===33&&verification.schema_valid===true&&verification.closeout_passed===true&&verification.all_21_closeout_output_hashes_match===true&&verification.real_inputs_parsed===false&&verification.real_go_received===false&&verification.images_decoded===false&&verification.included_fragments===3&&verification.excluded_fragments===1&&verification.versions===9&&verification.proposals_applied===0&&verification.canonical_decisions===0&&verification.human_memory===0,'fixture GO/count/state drift');
 const bytes=await bounded(source,'reader-export.json',PIN.export),payload=JSON.parse(bytes);
 for(const [name,pin]of Object.entries(verification.checked_hashes)){
  check(['reader-export.json','preflight.json','code-pins.json','input-manifest.json'].includes(name),'fixture input scope drift');await bounded(source,name,pin);
 }
 check(verification.checked_hashes['reader-export.json']===PIN.export&&payload.input_pins.manifest_sha256===verification.checked_hashes['input-manifest.json']&&payload.input_pins.code_pins_sha256===verification.checked_hashes['code-pins.json']&&payload.input_pins.preflight_sha256===verification.checked_hashes['preflight.json'],'fixture input binding drift');
 prepareRevisionFixture(payload);
 return {source,review,payload,evidence:{decision:'GO_FIXTURES_ONLY',export_sha256:PIN.export,review_verification_sha256:PIN.verification,review_handoff_sha256:PIN.handoff,review_checksums_sha256:PIN.checksums,input_pins:payload.input_pins,originals_read:false,images_decoded:false,real_connection_validated:false,scope:'fixture',counts:{included_fragments:3,excluded_fragments:1,versions:9,proposals:2,proposals_applied:0},reading:'machine-draft',human_review:'pending',rights:'unknown',publication:'private'}};
}
export async function loadRevisionFixture(options){const value=await load(options),context=Object.freeze({});contexts.set(context,value);return context;}
function data(context){const value=contexts.get(context);check(value,'accepted fixture context required');return value;}
export function revisionFixtureEvidence(context){return structuredClone(data(context).evidence);}
export function revisionFixtureModel(context){return prepareRevisionFixture(structuredClone(data(context).payload));}
async function revalidate(context){const previous=data(context),current=await load({directory:previous.source,reviewDirectory:previous.review});check(JSON.stringify(current.evidence)===JSON.stringify(previous.evidence),'accepted fixture evidence drift');return current;}
async function codePins(assetsRoot){return Object.fromEntries(await Promise.all(CODE.map(async name=>[name,sha(await readFile(join(assetsRoot,name)))])));}
export async function prepareRevisionFixtureRun({fixtureContext,outputPath,assetsRoot=process.cwd()}){
 const accepted=await revalidate(fixtureContext),base=await realpath(resolve('.private/archives-mvp')),output=resolve(outputPath);
 check(dirname(output)===base,'new fixture output must be directly inside private archives-mvp');
 const html=Buffer.from(renderRevisionFixture(accepted.payload)),pins=await codePins(await realpath(assetsRoot));await mkdir(output);
 await writeFile(join(output,'reader.html'),html,{flag:'wx'});
 const proof={version:'private-revision-fixture-reader/1',generated_at:new Date().toISOString(),scope:'fixture',accepted_fixture:accepted.evidence,output_hashes:{'reader.html':sha(html)},code_hashes:pins,active_version_id:null,canonical_decisions:[],human_memory:[],publication_approved:false};
 await writeFile(join(output,'integration-proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});return {output,fragments:3,versions:9,photograph_pixels:false};
}
export async function createRevisionFixturePreview({fixtureContext,directory,assetsRoot=process.cwd()}){
 const accepted=await revalidate(fixtureContext),run=await root(directory),assets=await realpath(assetsRoot),proof=JSON.parse(await bounded(run,'integration-proof.json'));
 check(proof.version==='private-revision-fixture-reader/1'&&proof.scope==='fixture'&&proof.active_version_id===null&&Array.isArray(proof.canonical_decisions)&&proof.canonical_decisions.length===0&&Array.isArray(proof.human_memory)&&proof.human_memory.length===0&&proof.publication_approved===false&&JSON.stringify(proof.accepted_fixture)===JSON.stringify(accepted.evidence),'run proof/state/evidence drift');
 check(JSON.stringify(proof.code_hashes)===JSON.stringify(await codePins(assets)),'code pin drift');
 const html=await bounded(run,'reader.html',proof.output_hashes?.['reader.html']);check(sha(html)===sha(Buffer.from(renderRevisionFixture(accepted.payload))),'rendered edition drift');
 const pages=new Map([['/',html],['/demo/versions/',html],['/demo/versions/index.html',html]]);
 const css=await readFile(join(assets,'css/archives-revisions.css')),client=await readFile(join(assets,'js/archives-revisions.js'));check(sha(css)===proof.code_hashes['css/archives-revisions.css']&&sha(client)===proof.code_hashes['js/archives-revisions.js'],'asset pin drift');
 const routes=new Map([['/css/archives-revisions.css',[css,'text/css; charset=utf-8']],['/js/archives-revisions.js',[client,'text/javascript; charset=utf-8']]]);
 const server=createServer((request,response)=>{
  const origin='http://127.0.0.1:'+server.address().port,guard=guardRequest(request,origin);
  response.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  if(guard.status){response.writeHead(guard.status).end();return;}if(guard.url.search){response.writeHead(404).end();return;}
  const name=guard.url.pathname,entry=pages.has(name)?[pages.get(name),'text/html; charset=utf-8']:routes.get(name);if(!entry){response.writeHead(404).end();return;}
  response.writeHead(200,{'Content-Type':entry[1],'Content-Length':entry[0].length});response.end(request.method==='HEAD'?undefined:entry[0]);
 });
 return {server,async listen(port=0){await new Promise((yes,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',()=>{server.off('error',no);yes();});});return 'http://127.0.0.1:'+server.address().port+'/demo/versions/';}};
}
