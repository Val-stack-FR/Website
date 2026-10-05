import {createServer} from 'node:http';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {digest,FILE_READING_PINS} from './file-reading-adapter.mjs';
import {guardRequest} from '../../.private/archives-integration/publication-package-20261004-v12-r2/site/scripts/archives-integration/media-preview.mjs';
const {values}=parseArgs({options:{'proof-sha256':{type:'string'},port:{type:'string',default:'0'}}}),run=resolve('.private/archives-next-readings/p09-file-reading-ui-20261004-v1');
assert.equal((await realpath(run)).toLowerCase(),run.toLowerCase());const proofBytes=await readFile(join(run,'build-proof.json'));assert.equal(digest(proofBytes),values['proof-sha256']);const proof=JSON.parse(proofBytes);assert.equal(proof.parent_assembly_sha256,FILE_READING_PINS.assembly);
const routes=new Map();for(const r of [...proof.public_routes,...proof.preview_parent_assets]){assert(!routes.has(r.route));const path=resolve(run,r.run_file);assert(path.toLowerCase().startsWith(run.toLowerCase()+'\\'));assert.equal((await realpath(path)).toLowerCase(),path.toLowerCase());const b=await readFile(path),p=proof.outputs[r.run_file];assert.equal(digest(b),p.sha256);assert.equal(b.length,p.bytes);routes.set(r.route,{bytes:b,type:r.contentType});}
const requests=[];let queue=Promise.resolve();const log=entry=>{requests.push(entry);const body=JSON.stringify(requests,null,2)+'\n';queue=queue.then(()=>writeFile(join(run,'preview-requests.json'),body));};
const server=createServer({maxHeaderSize:8192},(request,response)=>{
 response.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'none'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Cache-Control','no-store');
 const guarded=guardRequest(request,'http://127.0.0.1:'+server.address().port);if(guarded.status){log({method:request.method,status:guarded.status});response.writeHead(guarded.status).end('Request refused');return;}
 const {url}=guarded;if(!url.search&&['/favicon.ico','/favicon.svg'].includes(url.pathname)){log({method:request.method,route:url.pathname,status:204});response.writeHead(204).end();return;}
 const entry=!url.search&&routes.get(url.pathname);log({method:request.method,route:url.pathname,status:entry?200:404});if(!entry){response.writeHead(404).end('Not found');return;}
 response.writeHead(200,{'Content-Type':entry.type,'Content-Length':entry.bytes.length});response.end(request.method==='HEAD'?undefined:entry.bytes);
});
const port=Number(values.port);assert(Number.isSafeInteger(port)&&port>=0&&port<=65535);await new Promise((ok,bad)=>{server.once('error',bad);server.listen(port,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;
await writeFile(join(run,'preview-session.json'),JSON.stringify({format:'p09-file-reading-static-preview/1',origin,proof_sha256:values['proof-sha256'],server_sha256:digest(await readFile(new URL(import.meta.url))),static_routes:routes.size,image_routes:3,source_photo_routes:0,script_routes:0,query_routes:0,static_readonly:true,root_service_untouched:true},null,2)+'\n',{flag:'wx'});
process.once('SIGINT',()=>{server.closeAllConnections();server.close(()=>void queue.then(()=>process.exit(0)));});console.log(origin+'/archives/fichiers/');
