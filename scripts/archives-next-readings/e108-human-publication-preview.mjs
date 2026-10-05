import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {digest} from './e108-human-publication-adapter.mjs';
import {guardRequest} from '../../.private/archives-integration/publication-package-20261004-v19-r2/site/scripts/archives-integration/media-preview.mjs';
const {values}=parseArgs({options:{'proof-sha256':{type:'string'}}}),run=resolve('.private/archives-next-readings/e108-human-publication-delta-20261004-v1');
const proofBytes=await readFile(join(run,'build-proof.json'));assert.equal(digest(proofBytes),values['proof-sha256']);const proof=JSON.parse(proofBytes),routes=new Map();
const read=async n=>{const b=await readFile(join(run,n));assert.equal(digest(b),proof.outputs[n].sha256);return b;};
for(const route of [...proof.public_routes,...proof.parent_assets])routes.set(route.route,{bytes:await read(route.run_file),type:route.contentType});
const dynamic=await read('dynamic-e108.html'),all=await read('inputs/hierarchy-e108-all.json'),partial=await read('inputs/hierarchy-e108-partial.json');
const requests=[];let queue=Promise.resolve();const log=x=>{requests.push(x);const text=JSON.stringify(requests,null,2)+'\n';queue=queue.then(()=>writeFile(join(run,'preview-requests.json'),text));};
const server=createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const guarded=guardRequest(req,'http://127.0.0.1:'+server.address().port),send=(status,type,bytes=Buffer.alloc(0))=>{log({method:req.method,route:guarded.url?.pathname,status,query:guarded.url?.search??''});res.writeHead(status,{'Content-Type':type,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);};
 if(guarded.status){send(guarded.status,'text/plain');return;}const {url}=guarded;
 if(['/favicon.ico','/favicon.svg'].includes(url.pathname)){send(204,'image/svg+xml');return;}
 if(url.pathname==='/__catalogue_hierarchy'){
  if(url.searchParams.get('folder')!==proof.folder||!['','11.jpg'].includes(url.searchParams.get('query')??'')){send(400,'application/json',Buffer.from('{"error":"Parcours hors du mini-gate E.108"}'));return;}
  send(200,'application/json',url.searchParams.get('query')==='11.jpg'?partial:all);return;
 }
 if(url.pathname==='/archives/catalogue/'&&url.searchParams.get('folder')===proof.folder){send(200,'text/html; charset=utf-8',dynamic);return;}
 const entry=routes.get(url.pathname);if(!entry||url.search){send(404,'text/plain');return;}send(200,entry.type,entry.bytes);
});
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;
await writeFile(join(run,'preview-session.json'),JSON.stringify({origin,proof_sha256:digest(proofBytes),scope:'E108 current-page all and partial source responses only',image_routes:0,root_service_untouched:true},null,2)+'\n',{flag:'wx'});
process.once('SIGINT',()=>{server.closeAllConnections();server.close(()=>void queue.then(()=>process.exit(0)));});console.log(origin+'/archives/catalogue/?folder='+encodeURIComponent(proof.folder)+'#ensemble-e108-11-14');
