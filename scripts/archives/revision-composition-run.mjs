import {readFile,writeFile,mkdir,realpath,lstat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer,request as httpRequest} from 'node:http';
import {renderRevisionComposition} from './revision-composition.mjs';
import {projectRevisionJoin} from './revision-join.mjs';
import {revisionJoinEvidence,revisionJoinOptions,revisionJoinClosedBuffers,revalidateRevisionJoin} from './revision-real-release.mjs';
import {createArchivePreview} from './preview-server.mjs';
import {guardRequest} from '../archives-integration/media-preview.mjs';

const check=(value,message)=>{if(!value)throw Error('Revision composition run: '+message);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const CODE=['scripts/archives/revision-join.mjs','scripts/archives/revision-composition.mjs','scripts/archives/revision-real-release.mjs','scripts/archives/revision-composition-run.mjs','js/archives-revision-joins.js','css/archives-revision-joins.css','scripts/archives/preview-server.mjs','scripts/archives-integration/media-preview.mjs'];
const codePins=async()=>Object.fromEntries(await Promise.all(CODE.map(async name=>[name,sha(await readFile(name))])));
async function pilotGate(context,path,pin){
 check(path&&/^[a-f0-9]{64}$/u.test(pin??''),'passed site 1+1 proof required before full composition');
 const bytes=await readFile(path);check(sha(bytes)===pin,'site pilot pin drift');const proof=JSON.parse(bytes),evidence=revisionJoinEvidence(context);
 check(proof.version==='private-revision-ui-pilot/1'&&proof.result==='PASS'&&proof.scope==='private-local'&&proof.accepted_export_sha256===evidence.export_sha256&&proof.accepted_binding_proof_sha256===evidence.binding_proof_sha256&&proof.included_fragments===2&&proof.versions_exact===6&&proof.photos_same_existing_view===true&&proof.old_text_unchanged===true&&proof.proposals_applied===0&&proof.keyboard_passed===true&&proof.mobile_passed===true&&proof.originals_read===false&&proof.human_decisions===0&&proof.publication_approved===false,'site pilot was not qualified for this accepted export');
 check(JSON.stringify(proof.code_hashes)===JSON.stringify(await codePins()),'site pilot code/CSS contract changed before full');
 return {sha256:pin,path:resolve(path)};
}
export async function prepareRevisionCompositionRun({context,phase,outputPath,sitePilotProofPath,sitePilotProofSha256}){
 await revalidateRevisionJoin(context);const pilot=phase==='full'?await pilotGate(context,sitePilotProofPath,sitePilotProofSha256):null,base=await realpath(resolve('.private/archives-mvp')),output=resolve(outputPath);
 check(dirname(output)===base,'fresh composition output must be directly under private archives-mvp');
 const buffers=revisionJoinClosedBuffers(context),options=revisionJoinOptions(context,phase),model=projectRevisionJoin(options),parentHtml=buffers.parent.get('reader.html').toString('utf8'),html=Buffer.from(renderRevisionComposition({parentHtml,...options})),files=new Map();
 for(const [name,bytes]of buffers.parent)files.set(name==='reader.html'?'parent-reader.html':name,bytes);
 files.set('parent-integration-proof.json',buffers.parentProof);files.set('reader.html',html);
 for(const [name,bytes]of buffers.source)files.set('h07-'+name,bytes);
 files.set('h07-review-verification.json',buffers.review);files.set('h07-review-checksums.json',buffers.checksums);files.set('h07-full-input-manifest.json',buffers.input);
 const code=await codePins();await mkdir(output);const hashes={};for(const [name,bytes]of files){await writeFile(join(output,name),bytes,{flag:'wx'});hashes[name]=sha(bytes);}
 const proof={version:'private-revision-reader-composition/1',generated_at:new Date().toISOString(),scope:'private-local',phase,accepted_h07:revisionJoinEvidence(context),site_pilot:pilot,counts:{included_fragments:model.fragments.length,excluded_fragments:model.excluded.length,versions:options.payload.versions.length,proposals:options.payload.replacement_proposals.length,proposals_applied:0,linked_e113_occurrences:options.bindingProof.accepted_e113_uncertainty_count,existing_draft_photographs:17,accepted_monbezon_views:2,old_occurrences:992,old_proposals:89},active_version_id:null,canonical_decisions:[],human_memory:[],originals_read:false,new_photo_origins:false,crop_applied:false,publication_approved:false,historical_confirmation:false,rights:'unknown',human_review:'pending',code_hashes:code,output_hashes:hashes};
 await writeFile(join(output,'integration-proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});return {output,phase,counts:proof.counts,proof_sha256:sha(Buffer.from(JSON.stringify(proof,null,2)+'\n'))};
}
export async function createRevisionCompositionPreview({context,directory,parentConfig}){
 await revalidateRevisionJoin(context);check(!(await lstat(directory)).isSymbolicLink(),'run directory link refused');const run=await realpath(directory),proofBytes=await readFile(join(run,'integration-proof.json')),proof=JSON.parse(proofBytes);
 check(proof.version==='private-revision-reader-composition/1'&&proof.scope==='private-local'&&['pilot','full'].includes(proof.phase)&&proof.active_version_id===null&&Array.isArray(proof.canonical_decisions)&&proof.canonical_decisions.length===0&&Array.isArray(proof.human_memory)&&proof.human_memory.length===0&&proof.originals_read===false&&proof.new_photo_origins===false&&proof.crop_applied===false&&proof.publication_approved===false&&proof.historical_confirmation===false&&proof.rights==='unknown'&&proof.human_review==='pending'&&JSON.stringify(proof.accepted_h07)===JSON.stringify(revisionJoinEvidence(context)),'composition proof/state drift');
 if(proof.phase==='full')check(JSON.stringify(proof.site_pilot)===JSON.stringify(await pilotGate(context,proof.site_pilot?.path,proof.site_pilot?.sha256)),'full pilot binding drift');else check(proof.site_pilot===null,'pilot phase has an unexpected predecessor');
 check(JSON.stringify(proof.code_hashes)===JSON.stringify(await codePins()),'composition code/CSS drift');
 const options=revisionJoinOptions(context,proof.phase),buffers=revisionJoinClosedBuffers(context),html=Buffer.from(renderRevisionComposition({parentHtml:buffers.parent.get('reader.html').toString('utf8'),...options}));
 check(proof.output_hashes['reader.html']===sha(html)&&proof.counts.included_fragments===options.expectedIncludedIds.length&&proof.counts.excluded_fragments===options.expectedExcludedIds.length&&proof.counts.versions===options.payload.versions.length&&proof.counts.proposals===options.payload.replacement_proposals.length&&proof.counts.proposals_applied===0&&proof.counts.linked_e113_occurrences===options.bindingProof.accepted_e113_uncertainty_count&&proof.counts.old_occurrences===992&&proof.counts.old_proposals===89&&proof.counts.existing_draft_photographs===17&&proof.counts.accepted_monbezon_views===2,'composition output/count drift');
 const expected=new Map([...buffers.parent].map(([name,bytes])=>[name==='reader.html'?'parent-reader.html':name,bytes]));
 expected.set('parent-integration-proof.json',buffers.parentProof);expected.set('reader.html',html);
 for(const [name,bytes]of buffers.source)expected.set('h07-'+name,bytes);
 expected.set('h07-review-verification.json',buffers.review);expected.set('h07-review-checksums.json',buffers.checksums);expected.set('h07-full-input-manifest.json',buffers.input);
 check(JSON.stringify(Object.keys(proof.output_hashes).sort())===JSON.stringify([...expected.keys()].sort()),'composition closed output scope drift');
 for(const [name,bytes]of expected)check(proof.output_hashes[name]===sha(bytes),'composition closed buffer drift: '+name);
 for(const [name,pin]of Object.entries(proof.output_hashes)){check(/^[a-z0-9.-]+$/u.test(name)&&!(await lstat(join(run,name))).isSymbolicLink(),'unsafe composition output');check(sha(await readFile(join(run,name)))===pin,'composition file drift: '+name);}
 for(const [name,bytes]of buffers.parent)check(proof.output_hashes[name==='reader.html'?'parent-reader.html':name]===sha(bytes),'closed parent output not preserved');
 check(proof.output_hashes['parent-integration-proof.json']===sha(buffers.parentProof),'closed parent proof not preserved');
 const css=await readFile('css/archives-revision-joins.css'),client=await readFile('js/archives-revision-joins.js');
 check(sha(css)===proof.code_hashes['css/archives-revision-joins.css']&&sha(client)===proof.code_hashes['js/archives-revision-joins.js'],'loaded asset bytes drift');
 // A separately admitted parent owns all unchanged catalogue/search/text/review
 // routes and nineteen existing media views. Its original reader proof is never
 // rewritten to pretend that it sealed the new composed HTML.
 check(sha(await readFile(parentConfig.htmlPath))===sha(buffers.parent.get('reader.html'))&&sha(await readFile(parentConfig.releaseRunProofPath))===sha(buffers.parentProof),'backend parent configuration drift');
 const parent=await createArchivePreview(parentConfig),parentUrl=await parent.listen(0),backend=new URL(parentUrl),routes=new Map([['/css/archives-revision-joins.css',[css,'text/css; charset=utf-8']],['/js/archives-revision-joins.js',[client,'text/javascript; charset=utf-8']]]),pages=new Set(['/','/archives/','/archives/index.html']);
 const server=createServer((req,res)=>{
  const origin='http://127.0.0.1:'+server.address().port,guard=guardRequest(req,origin);
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  if(guard.status){res.writeHead(guard.status).end();return;}
  const path=guard.url.pathname,entry=pages.has(path)?[html,'text/html; charset=utf-8']:routes.get(path);
  if(entry){if(guard.url.search){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':entry[1],'Content-Length':entry[0].length});res.end(req.method==='HEAD'?undefined:entry[0]);return;}
  const upstream=httpRequest({hostname:backend.hostname,port:backend.port,path:guard.url.pathname+guard.url.search,method:req.method,headers:{host:backend.host,...(req.headers.accept?{accept:req.headers.accept}:{}),...(req.headers.origin?{origin:backend.origin}:{})}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on('close',()=>upstream.destroy());upstream.end();
 });
 server.on('close',()=>parent.server.close());
 return {server,async listen(port=0){await new Promise((yes,no)=>{server.once('error',no);server.listen(port,'127.0.0.1',()=>{server.off('error',no);yes();});});return 'http://127.0.0.1:'+server.address().port+'/archives/';}};
}
