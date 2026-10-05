import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {digest} from './e108-two-photo-adapter.mjs';
import {guardRequest} from '../../.private/archives-integration/publication-package-20261004-v25/site/scripts/archives-integration/media-preview.mjs';
const {values}=parseArgs({options:{'proof-sha256':{type:'string'}}}),run=resolve('.private/archives-next-readings/e108-two-photo-current-parent-delta-20261004-v1');
const proofBytes=await readFile(join(run,'build-proof.json'));assert.equal(digest(proofBytes),values['proof-sha256']);const proof=JSON.parse(proofBytes),routes=new Map();
const read=async name=>{const b=await readFile(join(run,name));assert.equal(digest(b),proof.outputs[name].sha256);return b;};
for(const item of proof.parent_assets)routes.set(item.route,{bytes:await read(item.file),type:item.type});
for(const item of proof.whitelist.filter(w=>w.target.startsWith('dist/'))){const route=item.target==='dist/archives/catalogue/index.html'?'/archives/catalogue/':item.target==='dist/archives/avancement/index.html'?'/archives/avancement/':item.target.slice(4);routes.set(route,{bytes:await read('composition/'+item.target),type:item.target.endsWith('.jpg')?'image/jpeg':(item.target.endsWith('.js')?'text/javascript':item.target.endsWith('.css')?'text/css':'text/html')+'; charset=utf-8'});}
await read('private-preview-runtime.mjs');const module=await import(pathToFileURL(join(run,'private-preview-runtime.mjs')).href),prepared=await module.loadPublicationData(join(proof.parent,'site/runtime/archives/selected-data.json'),'44a70f324fc11ffc3019681b0f63fdc97469cba13d5b0c58fc9db558e780c97a'),app=module.createPublicationRuntime(prepared);
const requests=[];let queue=Promise.resolve();const log=x=>{requests.push(x);const b=JSON.stringify(requests,null,2)+'\n';queue=queue.then(()=>writeFile(join(run,'preview-requests.json'),b));};
const server=createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 const guarded=guardRequest(req,'http://127.0.0.1:'+server.address().port);res.once('finish',()=>log({method:req.method,route:guarded.url?.pathname,status:res.statusCode,query:guarded.url?.search??''}));
 if(guarded.status){res.writeHead(guarded.status).end();return;}const {url}=guarded;
 if(['/favicon.ico','/favicon.svg'].includes(url.pathname)){res.writeHead(204).end();return;}
 // Exercise the composed, real current-parent runtime for query HTML and JSON.
 if(['/archives/catalogue/','/__catalogue_hierarchy'].includes(url.pathname)&&(url.search||url.pathname.startsWith('/__'))){
  if(url.searchParams.get('folder')!==proof.folder||!['','11.jpg'].includes(url.searchParams.get('query')??'')||url.searchParams.get('page')&&url.searchParams.get('page')!=='1'||url.searchParams.get('page_size')&&url.searchParams.get('page_size')!=='20'){res.writeHead(400,{'Content-Type':'application/json'}).end('{"error":"Parcours hors du pilote"}');return;}
  try{await app.handle(req,res,url);}catch{res.writeHead(500).end();}return;
 }
 const item=routes.get(url.pathname);if(!item||url.search){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':item.type,'Content-Length':item.bytes.length}).end(req.method==='HEAD'?undefined:item.bytes);
});
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;
await writeFile(join(run,'preview-session.json'),JSON.stringify({origin,proof_sha256:digest(proofBytes),scope:'Eight-file v25 overlay; real composed runtime query catalogue/JSON; static statusboard and exact two admitted derivatives only',root_main_modified:false},null,2)+'\n',{flag:'wx'});
process.once('SIGINT',()=>{server.closeAllConnections();server.close(()=>void queue.then(()=>process.exit(0)));});console.log(origin+'/archives/avancement/#relecture');
