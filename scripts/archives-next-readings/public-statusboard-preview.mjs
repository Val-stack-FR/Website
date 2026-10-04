import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {digest} from './public-statusboard-adapter.mjs';
import {guardRequest} from '../../.private/archives-integration/publication-package-20261004-v24-r2/site/scripts/archives-integration/media-preview.mjs';
const {values}=parseArgs({options:{'proof-sha256':{type:'string'}}}),run=resolve('.private/archives-next-readings/public-statusboard-delta-20261004-v1');
const proofBytes=await readFile(join(run,'build-proof.json'));assert.equal(digest(proofBytes),values['proof-sha256']);const proof=JSON.parse(proofBytes),routes=new Map();
for(const entry of proof.public_routes){const bytes=await readFile(join(run,entry.file));assert.equal(digest(bytes),proof.outputs[entry.file].sha256);routes.set(entry.route,{bytes,type:entry.type});}
const requests=[];let queue=Promise.resolve();const log=x=>{requests.push(x);const text=JSON.stringify(requests,null,2)+'\n';queue=queue.then(()=>writeFile(join(run,'preview-requests.json'),text));};
const server=createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self'; script-src 'none'; img-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const guarded=guardRequest(req,'http://127.0.0.1:'+server.address().port);
 const send=(status,type,bytes=Buffer.alloc(0))=>{log({method:req.method,route:guarded.url?.pathname,status});res.writeHead(status,{'Content-Type':type,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);};
 if(guarded.status){send(guarded.status,'text/plain');return;}
 if(['/favicon.ico','/favicon.svg'].includes(guarded.url.pathname)){send(204,'image/svg+xml');return;}
 const entry=routes.get(guarded.url.pathname);if(!entry||guarded.url.search){send(404,'text/plain');return;}send(200,entry.type,entry.bytes);
});
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;
await writeFile(join(run,'preview-session.json'),JSON.stringify({origin,proof_sha256:digest(proofBytes),scope:'Only statusboard page and stylesheet; link destinations verified against parent files and selected catalogue metadata'},null,2)+'\n',{flag:'wx'});
process.once('SIGINT',()=>{server.closeAllConnections();server.close(()=>void queue.then(()=>process.exit(0)));});console.log(origin+'/archives/avancement/');
