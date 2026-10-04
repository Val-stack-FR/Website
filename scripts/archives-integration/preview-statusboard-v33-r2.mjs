import {readFile,writeFile,appendFile,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const out=resolve('.private/archives-integration/publication-package-20261004-v33-r2');
const site=resolve(out,'site'),sha=b=>createHash('sha256').update(b).digest('hex');
const assemblyBytes=await readFile(resolve(out,'assembly.json')),assembly=JSON.parse(assemblyBytes),cache=new Map();
assert.equal(sha(assemblyBytes),'bb677877474a1558b6dec52226a0f1c88bfbcd0af8e123c4232015efd3f6c7ac');
const log=resolve(out,'preview-http.jsonl');await writeFile(log,'',{flag:'wx'});
await writeFile(resolve(out,'preview-snapshot.mjs'),await readFile(new URL(import.meta.url)),{flag:'wx'});
const mime=n=>n.endsWith('.html')?'text/html; charset=utf-8':n.endsWith('.js')?'text/javascript; charset=utf-8':n.endsWith('.css')?'text/css; charset=utf-8':n.endsWith('.png')?'image/png':n.endsWith('.svg')?'image/svg+xml':'application/octet-stream';
const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  try{
    const n='dist'+u.pathname+(u.pathname.endsWith('/')?'index.html':'');
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();}
    else if(u.search||!assembly.files[n]){res.writeHead(404);res.end();}
    else{
      if(!cache.has(n)){const path=resolve(site,n);assert.equal(await realpath(path),path);const b=await readFile(path);assert.equal(sha(b),assembly.files[n].sha256);assert.equal(b.length,assembly.files[n].size_bytes);cache.set(n,b);}
      const b=cache.get(n);res.writeHead(200,{'Content-Type':mime(n),'Content-Length':b.length});res.end(req.method==='HEAD'?undefined:b);
    }
  }catch{if(!res.headersSent)res.writeHead(503);res.end();}
  await appendFile(log,JSON.stringify({method:req.method,path:u.pathname,query:u.search,status:res.statusCode})+'\n');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
await writeFile(resolve(out,'preview-session.json'),JSON.stringify({host:'127.0.0.1',port,pid:process.pid,assembly_sha256:sha(assemblyBytes),scope:'Static statusboard and its E99 reader navigation only',API_imports:0,API_invocations:0,DB_connections:0,main_service_modified:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({port,url:'http://127.0.0.1:'+port+'/archives/avancement/'}));
const stop=async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await writeFile(resolve(out,'preview-stopped.json'),JSON.stringify({closed:true,port,served_assets:[...cache.keys()].map(n=>({path:n,...assembly.files[n]})),main_service_modified:false},null,2)+'\n',{flag:'wx'});console.log('Own statusboard r2 preview closed');process.exit(0);};
process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{if(s.trim()==='stop')void stop();});
