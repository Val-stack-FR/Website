import {createServer} from 'node:http';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {digest} from './p09-tonal-reading-adapter.mjs';
import {guardRequest} from '../../.private/archives-integration/publication-package-20261004-v13-r2/site/scripts/archives-integration/media-preview.mjs';
const {values}=parseArgs({options:{'proof-sha256':{type:'string'}}});const run=resolve('.private/archives-next-readings/p09-tonal-reading-ui-20261004-v1');
const proofBytes=await readFile(join(run,'build-proof.json'));assert.equal(digest(proofBytes),values['proof-sha256']);const proof=JSON.parse(proofBytes),routes=new Map();
for(const entry of [{route:proof.preview_route,run_file:proof.preview_file,contentType:'text/html; charset=utf-8'},...proof.public_routes.filter(r=>r.contentType!=='text/html; charset=utf-8'),...proof.parent_assets]){
 const path=resolve(run,entry.run_file);assert.equal((await realpath(path)).toLowerCase(),path.toLowerCase());const bytes=await readFile(path);assert.equal(digest(bytes),proof.outputs[entry.run_file].sha256);routes.set(entry.route,{bytes,type:entry.contentType});
}
const crop=proof.existing_crop_readonly,bytes=await readFile(crop.path);assert.equal(digest(bytes),crop.sha256);assert.equal(bytes.length,crop.bytes);routes.set(crop.route,{bytes,type:'image/png'});
const requests=[];let queue=Promise.resolve();const log=x=>{requests.push(x);const data=JSON.stringify(requests,null,2)+'\n';queue=queue.then(()=>writeFile(join(run,'preview-requests.json'),data));};
const server=createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const guarded=guardRequest(req,'http://127.0.0.1:'+server.address().port);if(guarded.status){log({method:req.method,status:guarded.status});res.writeHead(guarded.status).end();return;}
 const {url}=guarded;if(!url.search&&['/favicon.ico','/favicon.svg'].includes(url.pathname)){log({method:req.method,route:url.pathname,status:204});res.writeHead(204).end();return;}
 const entry=!url.search&&routes.get(url.pathname);log({method:req.method,route:url.pathname,status:entry?200:404});if(!entry){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':entry.type,'Content-Length':entry.bytes.length});res.end(req.method==='HEAD'?undefined:entry.bytes);
});
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;
await writeFile(join(run,'preview-session.json'),JSON.stringify({origin,proof_sha256:digest(proofBytes),preview_scope:'L04 only, same generated card and parent styles',static_routes:routes.size,image_routes:1,api_routes:0,root_service_untouched:true},null,2)+'\n',{flag:'wx'});
process.once('SIGINT',()=>{server.closeAllConnections();server.close(()=>void queue.then(()=>process.exit(0)));});console.log(origin+proof.preview_route+'#point-l04');
