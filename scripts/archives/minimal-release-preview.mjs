import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {guardRequest} from '../archives-integration/media-preview.mjs';
import {verifyMinimalRelease} from './prepare-minimal-release.mjs';

export function createMinimalReleasePreview({directory,proofSha256}) {
  const bundle=verifyMinimalRelease(directory,proofSha256);
  const files=new Map(bundle.files);files.set('/archives/',files.get('/archives/index.html'));
  const type=path=>path.endsWith('.jpg')?'image/jpeg':path.endsWith('.css')?'text/css; charset=utf-8':path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8';
  const server=createServer({maxHeaderSize:8192},(request,response)=>{
    response.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Cache-Control','no-store');
    const guarded=guardRequest(request,'http://127.0.0.1:'+server.address().port);
    if(guarded.status){response.setHeader('Connection','close');if(guarded.status===405)response.setHeader('Allow','GET, HEAD');response.writeHead(guarded.status).end(request.method==='HEAD'?undefined:'Request refused');return;}
    const url=guarded.url,bytes=!url.search && files.get(url.pathname);
    if(!bytes){response.writeHead(404).end(request.method==='HEAD'?undefined:'Not found');return;}
    response.writeHead(200,{'Content-Type':type(url.pathname),'Content-Length':bytes.length});response.end(request.method==='HEAD'?undefined:bytes);
  });
  return {server,async listen(port=0){await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.off('error',reject);accept();});});return 'http://127.0.0.1:'+server.address().port+'/archives/';}};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  try {const {values}=parseArgs({options:{directory:{type:'string'},'proof-sha256':{type:'string'},port:{type:'string',default:'8797'}}});const port=Number(values.port);if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Invalid loopback port.');console.log(await createMinimalReleasePreview({directory:values.directory,proofSha256:values['proof-sha256']}).listen(port));}catch(error){console.error('Minimal preview refused: '+error.message);process.exitCode=1;}
}
