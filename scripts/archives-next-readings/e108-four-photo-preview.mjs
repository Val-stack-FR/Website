import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {digest} from './e108-two-photo-adapter.mjs';
import {guardRequest} from '../../.private/archives-integration/publication-package-20261004-v26-r3/site/scripts/archives-integration/media-preview.mjs';
const {values}=parseArgs({options:{'proof-sha256':{type:'string'}}}),run=resolve('.private/archives-next-readings/e108-four-photo-current-parent-delta-20261004-v1'),proofBytes=await readFile(join(run,'build-proof.json'));assert.equal(digest(proofBytes),values['proof-sha256']);const proof=JSON.parse(proofBytes),routes=new Map();
const read=async n=>{const b=await readFile(join(run,n));assert.equal(digest(b),proof.outputs[n].sha256);return b;};
for(const p of proof.parent_assets)routes.set(p.route,{b:await read(p.file),type:p.type});
for(const p of proof.whitelist.filter(p=>p.target.startsWith('dist/'))){const route=p.target.endsWith('/index.html')?p.target.slice(4,-10):p.target.slice(4);routes.set(route,{b:await read('composition/'+p.target),type:p.target.endsWith('.jpg')?'image/jpeg':(p.target.endsWith('.js')?'text/javascript':'text/html')+'; charset=utf-8'});}
// The inherited 11/12 thumbnails may load with the unchanged four-view group.
// Serve only their pinned derivatives, without reopening or retesting their UI.
for(const sha of ['4c40849b1b278127a1aa7b967115764230d83effe71842878e10617c88007e72','8847b4a64de43dff2aeed631674b7bdfe94884e5a2c5c7c8f5ce0f437fa2e0c7']){const name='dist/archives/media/draft/'+sha+'.jpg',b=await readFile(join(proof.parent,'site',name));assert.equal(digest(b),proof.sources[name].sha256);routes.set(name.slice(4),{b,type:'image/jpeg'});}
await read('private-preview-runtime.mjs');const module=await import(pathToFileURL(join(run,'private-preview-runtime.mjs')).href),data=await module.loadPublicationData(join(proof.parent,'site/runtime/archives/selected-data.json'),'44a70f324fc11ffc3019681b0f63fdc97469cba13d5b0c58fc9db558e780c97a'),app=module.createPublicationRuntime(data);
const requests=[];let queue=Promise.resolve();const server=createServer(async(req,res)=>{res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const g=guardRequest(req,'http://127.0.0.1:'+server.address().port);res.once('finish',()=>{requests.push({method:req.method,route:g.url?.pathname,status:res.statusCode,query:g.url?.search??''});const b=JSON.stringify(requests,null,2)+'\n';queue=queue.then(()=>writeFile(join(run,'preview-requests.json'),b));});if(g.status){res.writeHead(g.status).end();return;}const {url}=g;if(['/favicon.svg','/favicon.ico'].includes(url.pathname)){res.writeHead(204).end();return;}
 if(['/archives/catalogue/','/__catalogue_hierarchy'].includes(url.pathname)&&(url.search||url.pathname.startsWith('/__'))){
  const allowed=new Set(['folder','query','page','page_size','collection_scope','collection_type','priority','status']);
  if([...url.searchParams.keys()].some(k=>!allowed.has(k))||url.searchParams.get('folder')!==proof.folder||!['','13.jpg'].includes(url.searchParams.get('query')??'')||!['','1'].includes(url.searchParams.get('page')??'')||!['','20'].includes(url.searchParams.get('page_size')??'')||!['','clean'].includes(url.searchParams.get('collection_scope')??'')||['priority','status','collection_type'].some(k=>url.searchParams.get(k))){res.writeHead(400,{'Content-Type':'application/json'}).end('{"error":"Parcours hors du pilote E10813/14"}');return;}
  try{await app.handle(req,res,url);}catch{res.writeHead(500).end();}return;
 }
 const item=routes.get(url.pathname);if(!item||url.search){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':item.type,'Content-Length':item.b.length}).end(req.method==='HEAD'?undefined:item.b);
});await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;await writeFile(join(run,'preview-session.json'),JSON.stringify({origin,proof_sha256:digest(proofBytes),only_new13_14_gate:true,root_main_untouched:true},null,2)+'\n',{flag:'wx'});process.once('SIGINT',()=>{server.closeAllConnections();server.close(()=>void queue.then(()=>process.exit(0)));});console.log(origin+'/archives/avancement/#relecture');
