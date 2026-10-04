import {createServer} from 'node:http';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {guardRequest} from '../archives-integration/media-preview.mjs';
import {digest,FULL_VIEW_ADMISSION_SHA256} from './adapter-full-view.mjs';

const {values}=parseArgs({options:{'proof-sha256':{type:'string'},port:{type:'string',default:'0'}}});
const root=resolve('.private/archives-next-readings/p09-full-view-20261004-v1');
assert.equal(dirname(root).toLowerCase(),resolve('.private/archives-next-readings').toLowerCase());assert.equal((await realpath(root)).toLowerCase(),root.toLowerCase());
const proofBytes=await readFile(join(root,'build-proof.json'));assert.equal(digest(proofBytes),values['proof-sha256']);const proof=JSON.parse(proofBytes);assert.equal(proof.admission_sha256,FULL_VIEW_ADMISSION_SHA256);
const rootPhotoOrigin='http://127.0.0.1:8822',photoRoute=proof.metadata.photoRoute;
const photoHead=await fetch(rootPhotoOrigin+photoRoute,{method:'HEAD'});assert.equal(photoHead.status,200);assert.equal(photoHead.headers.get('content-length'),'3604434');
const routes=new Map();for(const entry of [{route:'/archives/',run_file:'reader.html',contentType:'text/html; charset=utf-8'},...proof.selected_assets,...proof.preview_parent_assets]){const bytes=await readFile(join(root,entry.run_file));assert.equal(digest(bytes),proof.outputs[entry.run_file].sha256);assert.equal(bytes.length,proof.outputs[entry.run_file].bytes);assert(!routes.has(entry.route));routes.set(entry.route,{bytes,type:entry.contentType});}
const requests=[];let auditQueue=Promise.resolve();const log=record=>{requests.push(record);const snapshot=JSON.stringify(requests,null,2)+'\n';auditQueue=auditQueue.then(()=>writeFile(join(root,'preview-requests.json'),snapshot));};
const server=createServer({maxHeaderSize:8192},(request,response)=>{
 response.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' "+rootPhotoOrigin+"; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Cache-Control','no-store');
 const guarded=guardRequest(request,'http://127.0.0.1:'+server.address().port);
 if(guarded.status){log({method:request.method,status:guarded.status});response.writeHead(guarded.status).end('Request refused');return;}
 if(!guarded.url.search&&guarded.url.pathname===photoRoute){log({method:request.method,route:photoRoute,status:307,existing_root_photo:true});response.writeHead(307,{Location:rootPhotoOrigin+photoRoute}).end();return;}
 const entry=!guarded.url.search&&routes.get(guarded.url.pathname);log({method:request.method,route:guarded.url.pathname,status:entry?200:404});if(!entry){response.writeHead(404).end('Not found');return;}
 response.writeHead(200,{'Content-Type':entry.type,'Content-Length':entry.bytes.length});response.end(request.method==='HEAD'?undefined:entry.bytes);
});
const port=Number(values.port);assert(Number.isSafeInteger(port)&&port>=0&&port<=65535);await new Promise((ok,bad)=>{server.once('error',bad);server.listen(port,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;
await writeFile(join(root,'preview-session.json'),JSON.stringify({format:'p09-full-view-text-preview/1',origin,proof_sha256:values['proof-sha256'],server_sha256:digest(await readFile(new URL(import.meta.url))),static_routes:routes.size,single_photo_redirect:rootPhotoOrigin+photoRoute,photo_files_copied:0,image_bytes_read_by_server:0,other_images_served:false,static_readonly:true},null,2)+'\n',{flag:'wx'});
process.once('SIGINT',()=>server.close(()=>void auditQueue.then(()=>process.exit(0))));console.log(origin+'/archives/#next-reading-p09-author-pilot');
