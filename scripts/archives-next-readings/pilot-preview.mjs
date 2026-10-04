import {createServer} from 'node:http';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {guardRequest} from '../archives-integration/media-preview.mjs';
import {digest} from './adapter-v3.mjs';

export async function startP09PilotPreview({directory,proofSha256,port=0}){
 const root=resolve(directory),privateBase=resolve('.private/archives-next-readings');
 assert.equal(dirname(root).toLowerCase(),privateBase.toLowerCase());assert.equal((await realpath(root)).toLowerCase(),root.toLowerCase());
 const proofBytes=await readFile(join(root,'build-proof.json'));assert.equal(digest(proofBytes),proofSha256);const proof=JSON.parse(proofBytes);
 assert.equal(proof.format,'p09-admitted-reader-build/1');assert.equal(proof.status,'accepted-working-pilot');
 assert.equal(proof.admission_sha256,'537ee38eb0ec1bbed43330c5eeac507884982d373b3da18ac50e065728119dbb');
 const preflightBytes=await readFile(join(root,'preflight.json'));assert.equal(digest(preflightBytes),proof.media_preflight_sha256);assert.equal(JSON.parse(preflightBytes).passed,true);
 const entries=[{route:'/archives/',run_file:'reader.html',contentType:'text/html; charset=utf-8'},...proof.selected_assets,...proof.preview_parent_assets];
 assert.equal(proof.selected_assets.length,4);assert.equal(new Set(entries.map(entry=>entry.route)).size,entries.length);
 const routes=new Map();
 for(const entry of entries){assert(entry.route.startsWith('/')&&!entry.route.includes('?')&&!entry.route.includes('..'));assert(/^[A-Za-z0-9_./-]+$/u.test(entry.run_file)&&!entry.run_file.includes('..'));const bytes=await readFile(join(root,entry.run_file));assert.equal(digest(bytes),proof.outputs[entry.run_file].sha256);assert.equal(bytes.length,proof.outputs[entry.run_file].bytes);routes.set(entry.route,{bytes,type:entry.contentType});}
 const requests=[];let auditQueue=Promise.resolve();
 const record=value=>{requests.push(value);const snapshot=JSON.stringify(requests,null,2)+'\n';auditQueue=auditQueue.then(()=>writeFile(join(root,'preview-requests.json'),snapshot));};
 const server=createServer({maxHeaderSize:8192},(request,response)=>{
  response.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Cache-Control','no-store');
  const guarded=guardRequest(request,'http://127.0.0.1:'+server.address().port);
  if(guarded.status){record({method:request.method,status:guarded.status});response.writeHead(guarded.status).end(request.method==='HEAD'?undefined:'Request refused');return;}
  const selected=!guarded.url.search&&routes.get(guarded.url.pathname),status=selected?200:404;
  record({method:request.method,route:guarded.url.pathname,status});
  if(!selected){response.writeHead(404).end(request.method==='HEAD'?undefined:'Not found');return;}
  response.writeHead(200,{'Content-Type':selected.type,'Content-Length':selected.bytes.length});response.end(request.method==='HEAD'?undefined:selected.bytes);
 });
 assert(Number.isSafeInteger(port)&&port>=0&&port<=65535);await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',accept);});
 const origin='http://127.0.0.1:'+server.address().port;
 await writeFile(join(root,'preview-session.json'),JSON.stringify({format:'p09-private-preview/1',origin,proof_sha256:proofSha256,server_sha256:digest(await readFile(new URL(import.meta.url))),route_count:routes.size,static_readonly:true,other_images_served:false,request_log:'preview-requests.json'},null,2)+'\n',{flag:'wx'});
 const flush=()=>auditQueue.then(()=>writeFile(join(root,'preview-requests.json'),JSON.stringify(requests,null,2)+'\n'));
 server.on('close',()=>void flush());
 process.once('SIGINT',()=>server.close(()=>void flush().then(()=>process.exit(0))));
 return {server,origin,flush,url:origin+'/archives/#next-reading-p09-author-pilot'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const {values}=parseArgs({options:{directory:{type:'string'},'proof-sha256':{type:'string'},port:{type:'string',default:'0'}}});console.log((await startP09PilotPreview({directory:values.directory,proofSha256:values['proof-sha256'],port:Number(values.port)})).url);}
