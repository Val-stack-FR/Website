import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {digest} from './e108-touch-shortcut-adapter.mjs';
import {guardRequest} from '../../.private/archives-integration/publication-package-20261004-v19-r2/site/scripts/archives-integration/media-preview.mjs';
const {values}=parseArgs({options:{'proof-sha256':{type:'string'}}}),run=resolve('.private/archives-next-readings/e108-touch-shortcut-20261004-v1');
const proofBytes=await readFile(join(run,'build-proof.json'));assert.equal(digest(proofBytes),values['proof-sha256']);const proof=JSON.parse(proofBytes);
const read=async name=>{const b=await readFile(join(run,name));assert.equal(digest(b),proof.outputs[name].sha256);return b;};
const routes=new Map();
for(const [route,name,type]of [['/archives/catalogue/','preview.html','text/html'],['/assets/archives-hierarchy.js','archives-hierarchy.js','text/javascript'],['/assets/archives-catalogue-ensemble.js','catalogue-ensemble.js','text/javascript'],['/assets/archives-catalogue-ensemble.css','catalogue-ensemble.css','text/css'],['/__touch-shortcut-probe.js','private-probe.js','text/javascript'],['/styles.css','parent-assets/styles.css','text/css'],...['archives-integration-navigation','archives-catalogue','archives-human-catalogue-public-labels'].map(n=>['/assets/'+n+'.css','parent-assets/assets/'+n+'.css','text/css'])])routes.set(route,{bytes:await read(name),type:type+'; charset=utf-8'});
const all=await read('inputs/hierarchy-e108-all.json'),partial=await read('inputs/hierarchy-e108-partial.json');
const requests=[];let queue=Promise.resolve();
const log=entry=>{requests.push(entry);const text=JSON.stringify(requests,null,2)+'\n';queue=queue.then(()=>writeFile(join(run,'preview-requests.json'),text));};
const server=createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const guarded=guardRequest(req,'http://127.0.0.1:'+server.address().port);
 const send=(status,type,bytes=Buffer.alloc(0))=>{log({method:req.method,route:guarded.url?.pathname,status,query:guarded.url?.search??''});res.writeHead(status,{'Content-Type':type,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);};
 if(guarded.status){send(guarded.status,'text/plain');return;}
 const {url}=guarded;
 if(['/favicon.ico','/favicon.svg'].includes(url.pathname)){send(204,'image/svg+xml');return;}
 if(url.pathname==='/__catalogue_hierarchy'){
  if(url.searchParams.get('folder')!==proof.folder||!['','11.jpg'].includes(url.searchParams.get('query')??'')){send(400,'application/json');return;}
  send(200,'application/json',url.searchParams.get('query')==='11.jpg'?partial:all);return;
 }
 const entry=routes.get(url.pathname);if(!entry||url.search&&(url.pathname!=='/archives/catalogue/'||url.searchParams.get('folder')!==proof.folder)){send(404,'text/plain');return;}
 send(200,entry.type,entry.bytes);
});
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});const origin='http://127.0.0.1:'+server.address().port;
await writeFile(join(run,'preview-session.json'),JSON.stringify({origin,proof_sha256:digest(proofBytes),scope:'E108 shortcut pointer/keyboard gate; CSS-only product change',private_probe:true,root_services_untouched:true},null,2)+'\n',{flag:'wx'});
process.once('SIGINT',()=>{server.closeAllConnections();server.close(()=>void queue.then(()=>process.exit(0)));});
console.log(origin+'/archives/catalogue/?folder='+encodeURIComponent(proof.folder)+'&query=11.jpg');
