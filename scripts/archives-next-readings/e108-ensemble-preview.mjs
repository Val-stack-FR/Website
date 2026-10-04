import {createServer} from 'node:http';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {parseArgs} from 'node:util';
import assert from 'node:assert/strict';
import {digest,E108_FIXTURE_SHA256} from './catalogue-ensemble-adapter.mjs';
import {guardRequest} from '../../.private/archives-integration/publication-package-20261004-v11/site/scripts/archives-integration/media-preview.mjs';
import {prepareCatalogue} from '../../.private/archives-integration/publication-package-20261004-v11/site/scripts/archives-catalogue/contract.mjs';
import {buildCatalogueHierarchy,queryCatalogueHierarchy} from '../../.private/archives-integration/publication-package-20261004-v11/site/scripts/archives-catalogue/hierarchy.mjs';

const {values}=parseArgs({options:{'proof-sha256':{type:'string'},port:{type:'string',default:'0'}}});
const attempt=resolve('.private/archives-next-readings/e108-ensemble-ui-20261004-v1'),root=join(attempt,'reviewed-r3');
assert.equal(dirname(attempt).toLowerCase(),resolve('.private/archives-next-readings').toLowerCase());assert.equal(dirname(root).toLowerCase(),attempt.toLowerCase());
assert.equal((await realpath(root)).toLowerCase(),root.toLowerCase());
const proofBytes=await readFile(join(root,'build-proof.json'));
assert.equal(digest(proofBytes),values['proof-sha256']);
const proof=JSON.parse(proofBytes);assert.equal(proof.fixture_sha256,E108_FIXTURE_SHA256);
assert.equal(proof.parent_runtime_sha256,'44a70f324fc11ffc3019681b0f63fdc97469cba13d5b0c58fc9db558e780c97a');
assert.equal(proof.checks.target_media_bindings,0);
const fixedRoutes=[
 ['/archives/catalogue/','catalogue.html','text/html'],
 ['/assets/archives-catalogue-ensemble.css','catalogue-ensemble.css','text/css'],
 ['/assets/archives-catalogue-ensemble.js','catalogue-ensemble.js','text/javascript'],
 ['/styles.css','parent-assets/styles.css','text/css'],
 ['/assets/archives-catalogue.css','parent-assets/assets/archives-catalogue.css','text/css'],
 ['/assets/archives-integration-navigation.css','parent-assets/assets/archives-integration-navigation.css','text/css'],
 ['/assets/archives-hierarchy.js','parent-assets/assets/archives-hierarchy.js','text/javascript']
];
const routes=new Map();
for(const [route,file,type]of fixedRoutes){const path=join(root,file);assert.equal((await realpath(path)).toLowerCase(),path.toLowerCase());const bytes=await readFile(path);assert.equal(digest(bytes),proof.outputs[file].sha256);assert.equal(bytes.length,proof.outputs[file].bytes);routes.set(route,{bytes,type:type+'; charset=utf-8'});}
const runtimeBytes=await readFile(resolve('.private/archives-integration/publication-package-20261004-v11/site/runtime/archives/selected-data.json'));
assert.equal(digest(runtimeBytes),proof.parent_runtime_sha256);
const runtime=JSON.parse(runtimeBytes),model=prepareCatalogue(runtime.catalogue,{inputSha256:runtime.source_pins.catalogue}),hierarchy=buildCatalogueHierarchy(model);
const requests=[];let auditQueue=Promise.resolve();
const log=record=>{requests.push(record);const snapshot=JSON.stringify(requests,null,2)+'\n';auditQueue=auditQueue.then(()=>writeFile(join(root,'preview-requests.json'),snapshot));};
const server=createServer({maxHeaderSize:8192},(request,response)=>{
 response.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Cache-Control','no-store');
 const guarded=guardRequest(request,'http://127.0.0.1:'+server.address().port);
 const finish=(status,type,bytes)=>{log({method:request.method,route:guarded.url?.pathname??null,status});response.writeHead(status,{'Content-Type':type,'Content-Length':bytes.length});response.end(request.method==='HEAD'?undefined:bytes);};
 if(guarded.status){finish(guarded.status,'text/plain',Buffer.from('Request refused'));return;}
 const url=guarded.url;
 if(url.pathname==='/favicon.svg'&&!url.search){log({method:request.method,route:url.pathname,status:204});response.writeHead(204).end();return;}
 if(url.pathname==='/__catalogue_hierarchy'){
  try{const parameters={};for(const [key,value]of url.searchParams){assert(!(key in parameters),'duplicate parameter');parameters[key]=value;}assert(['','CLEAN',proof.folder].includes(parameters.folder??''),'preview folder outside exact gate');const result=queryCatalogueHierarchy(hierarchy,parameters);result.counts.inventory_image_files=model.records.length;result.counts.reader_links=model.records.filter(record=>record.consultation.available).length;finish(200,'application/json; charset=utf-8',Buffer.from(JSON.stringify(result)));}catch{finish(400,'application/json; charset=utf-8',Buffer.from(JSON.stringify({error:'Parcours hors du périmètre de cet aperçu.'})));}return;
 }
 const entry=routes.get(url.pathname);
 if(!entry||(url.search&&url.pathname!=='/archives/catalogue/')){finish(404,'text/plain',Buffer.from('Not found'));return;}
 finish(200,entry.type,entry.bytes);
});
const port=Number(values.port);assert(Number.isSafeInteger(port)&&port>=0&&port<=65535);
await new Promise((ok,bad)=>{server.once('error',bad);server.listen(port,'127.0.0.1',ok);});
const origin='http://127.0.0.1:'+server.address().port;
await writeFile(join(root,'preview-session.json'),JSON.stringify({format:'e108-catalogue-ensemble-preview/1',origin,proof_sha256:values['proof-sha256'],server_sha256:digest(await readFile(new URL(import.meta.url))),static_routes:routes.size,query_routes:1,allowed_folders:['CLEAN',proof.folder],image_bytes_read:0,image_files_copied:0,image_routes:0,parent_runtime_sha256:proof.parent_runtime_sha256,static_readonly:true},null,2)+'\n',{flag:'wx'});
process.once('SIGINT',()=>{server.closeAllConnections();server.close(()=>void auditQueue.then(()=>process.exit(0)));});
console.log(origin+'/archives/catalogue/');
