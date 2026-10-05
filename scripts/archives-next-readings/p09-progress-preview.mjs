import {createServer} from 'node:http';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {digest,P09_PROGRESS_ASSEMBLY_SHA} from './p09-progress-adapter.mjs';
import {guardRequest} from '../../.private/archives-integration/publication-package-20261004-v12-r2/site/scripts/archives-integration/media-preview.mjs';

const {values}=parseArgs({options:{'proof-sha256':{type:'string'},port:{type:'string',default:'0'}}}),root=resolve('.private/archives-next-readings/p09-progress-ui-20261004-v1');
assert.equal(dirname(root).toLowerCase(),resolve('.private/archives-next-readings').toLowerCase());assert.equal((await realpath(root)).toLowerCase(),root.toLowerCase());
const proofBytes=await readFile(join(root,'build-proof.json'));assert.equal(digest(proofBytes),values['proof-sha256']);const proof=JSON.parse(proofBytes);assert.equal(proof.parent_assembly_sha256,P09_PROGRESS_ASSEMBLY_SHA);
const fixed=[['/archives/avancement/','progress.html','text/html'],['/assets/archives-p09-progress.css','p09-progress.css','text/css'],['/assets/archives-integration-lexical.css','parent-assets/assets/archives-integration-lexical.css','text/css'],['/assets/archives-integration-navigation.css','parent-assets/assets/archives-integration-navigation.css','text/css']];
const routes=new Map();for(const [route,file,type]of fixed){const path=join(root,file);assert.equal((await realpath(path)).toLowerCase(),path.toLowerCase());const bytes=await readFile(path);assert.equal(digest(bytes),proof.outputs[file].sha256);assert.equal(bytes.length,proof.outputs[file].bytes);routes.set(route,{bytes,type:type+'; charset=utf-8'});}
const requests=[];let auditQueue=Promise.resolve();const log=record=>{requests.push(record);const snapshot=JSON.stringify(requests,null,2)+'\n';auditQueue=auditQueue.then(()=>writeFile(join(root,'preview-requests.json'),snapshot));};
const server=createServer({maxHeaderSize:8192},(request,response)=>{
 response.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'none'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Cache-Control','no-store');
 const guarded=guardRequest(request,'http://127.0.0.1:'+server.address().port);
 if(guarded.status){log({method:request.method,status:guarded.status});response.writeHead(guarded.status).end('Request refused');return;}
 const {url}=guarded;if(!url.search&&['/favicon.ico','/favicon.svg'].includes(url.pathname)){log({method:request.method,route:url.pathname,status:204});response.writeHead(204).end();return;}
 const entry=!url.search&&routes.get(url.pathname);log({method:request.method,route:url.pathname,status:entry?200:404});if(!entry){response.writeHead(404).end('Not found');return;}
 response.writeHead(200,{'Content-Type':entry.type,'Content-Length':entry.bytes.length});response.end(request.method==='HEAD'?undefined:entry.bytes);
});
const port=Number(values.port);assert(Number.isSafeInteger(port)&&port>=0&&port<=65535);await new Promise((ok,bad)=>{server.once('error',bad);server.listen(port,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;
await writeFile(join(root,'preview-session.json'),JSON.stringify({format:'p09-progress-static-preview/1',origin,proof_sha256:values['proof-sha256'],server_sha256:digest(await readFile(new URL(import.meta.url))),static_routes:4,image_routes:0,image_bytes_read:0,script_routes:0,query_routes:0,static_readonly:true},null,2)+'\n',{flag:'wx'});
process.once('SIGINT',()=>{server.closeAllConnections();server.close(()=>void auditQueue.then(()=>process.exit(0)));});console.log(origin+'/archives/avancement/#p09-progress');
