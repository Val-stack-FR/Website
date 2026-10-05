import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {digest} from './e108-two-photo-adapter.mjs';
import {FULL_FOLDER,FULL_ROUTE} from './e108-full-reader.mjs';
import {projectE108FullReaderLink} from './e108-full-reader-link-projection.mjs';
import {guardRequest} from '../../.private/archives-integration/publication-package-20261004-v28/site/scripts/archives-integration/media-preview.mjs';
const run=resolve('.private/archives-next-readings/e108-11-full-page-reader-ui-20261004-v1'),proofBytes=await readFile(join(run,'build-proof.json')),proof=JSON.parse(proofBytes),routes=new Map();
for(const p of [...proof.public_routes,...proof.parent_assets]){const b=await readFile(join(run,p.file));assert.equal(digest(b),proof.outputs[p.file].sha256);routes.set(p.route,{b,type:p.type});}
const runtime=await import(pathToFileURL(proof.preview_runtime).href),app=runtime.createPublicationRuntime(await runtime.loadPublicationData(join(proof.parent,'site/runtime/archives/selected-data.json'),'44a70f324fc11ffc3019681b0f63fdc97469cba13d5b0c58fc9db558e780c97a'));
const requests=[];let queue=Promise.resolve();const server=createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const g=guardRequest(req,'http://127.0.0.1:'+server.address().port);res.once('finish',()=>{requests.push({method:req.method,route:g.url?.pathname,query:g.url?.search??'',status:res.statusCode});queue=queue.then(()=>writeFile(join(run,'preview-requests.json'),JSON.stringify(requests,null,2)+'\n'));});if(g.status){res.writeHead(g.status).end();return;}
 const {url}=g;if(['/favicon.svg','/favicon.ico'].includes(url.pathname)){res.writeHead(204).end();return;}
 if(['/archives/catalogue/','/__catalogue_hierarchy'].includes(url.pathname)){
  const allowed=new Set(['folder','page','page_size','collection_scope','collection_type','priority','status','query']);if([...url.searchParams.keys()].some(k=>!allowed.has(k))||url.searchParams.get('folder')!==FULL_FOLDER||!['','1'].includes(url.searchParams.get('page')??'')||!['','20'].includes(url.searchParams.get('page_size')??'')||!['','clean'].includes(url.searchParams.get('collection_scope')??'')||['query','collection_type','priority','status'].some(k=>url.searchParams.get(k))){res.writeHead(400,{'Content-Type':'application/json'}).end('{"error":"Parcours hors de la vue 11"}');return;}
  try{const headers={},response={statusCode:200,setHeader:(k,v)=>{headers[k]=v;},writeHead:(s,h)=>{response.statusCode=s;Object.assign(headers,h);},end:b=>{response.body=Buffer.from(b??'');}};await app.handle(req,response,url);for(const[k,v]of Object.entries(headers))res.setHeader(k,v);const body=url.pathname==='/archives/catalogue/'?Buffer.from(projectE108FullReaderLink(url,response.body.toString('utf8'))):response.body;res.setHeader('Content-Length',body.length);res.writeHead(response.statusCode).end(req.method==='HEAD'?undefined:body);}catch(error){console.error(error);res.writeHead(500).end();}return;
 }
 const item=routes.get(url.pathname);if(!item||url.search){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':item.type,'Content-Length':item.b.length}).end(req.method==='HEAD'?undefined:item.b);
});await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;await writeFile(join(run,'preview-session.json'),JSON.stringify({origin,build_proof_sha256:digest(proofBytes),root_main_untouched:true},null,2)+'\n',{flag:'wx'});process.once('SIGINT',()=>{server.closeAllConnections();server.close(()=>void queue.then(()=>process.exit(0)));});console.log(origin+FULL_ROUTE);
