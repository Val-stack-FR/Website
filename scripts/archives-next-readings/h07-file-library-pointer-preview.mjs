import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {digest} from './h07-file-library-adapter.mjs';
import {guardRequest} from '../../.private/archives-integration/publication-package-20261004-v13-r2/site/scripts/archives-integration/media-preview.mjs';
const run=resolve('.private/archives-next-readings/h07-file-library-ui-20261004-v1/reviewed-r2');
const episode=join(run,'pointer-preview');
await mkdir(episode);
const proofBytes=await readFile(join(run,'build-proof.json'));
assert.equal(digest(proofBytes),'1cb67c3e4c38b15b223c738b34666d547bc9ed6fa69bccfd4cbb1d205a40855f');
const proof=JSON.parse(proofBytes),routes=new Map();
for(const route of [...proof.public_routes,...proof.preview_parent_assets]){
 const bytes=await readFile(join(run,route.run_file));
 assert.equal(digest(bytes),proof.outputs[route.run_file].sha256);
 routes.set(route.route,{bytes,type:route.contentType});
}
const requests=[];let queue=Promise.resolve();
const log=x=>{requests.push(x);const data=JSON.stringify(requests,null,2)+'\n';queue=queue.then(()=>writeFile(join(episode,'requests.json'),data));};
const server=createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 const guarded=guardRequest(req,'http://127.0.0.1:'+server.address().port);
 if(guarded.status){log({method:req.method,status:guarded.status});res.writeHead(guarded.status).end();return;}
 const {url}=guarded;
 if(!url.search&&url.pathname==='/favicon.ico'){log({method:req.method,route:url.pathname,status:204});res.writeHead(204).end();return;}
 const entry=!url.search&&routes.get(url.pathname);log({method:req.method,route:url.pathname,status:entry?200:404});
 if(!entry){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':entry.type,'Content-Length':entry.bytes.length});res.end(req.method==='HEAD'?undefined:entry.bytes);
});
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
const origin='http://127.0.0.1:'+server.address().port;
await writeFile(join(episode,'session.json'),JSON.stringify({origin,proof_sha256:digest(proofBytes),script_sha256:digest(await readFile(new URL(import.meta.url))),routes:routes.size,root_service_untouched:true},null,2)+'\n',{flag:'wx'});
process.once('SIGINT',()=>{server.closeAllConnections();server.close(()=>void queue.then(()=>process.exit(0)));});
console.log(origin+'/archives/fichiers/');
