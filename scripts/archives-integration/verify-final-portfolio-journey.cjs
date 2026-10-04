'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const need = (ok, message) => {if (!ok) throw new Error(message);};
const [rootArgument, manifestArgument, outputArgument] = process.argv.slice(2);
need(rootArgument && manifestArgument && outputArgument, 'Explicit built workspace, final manifest and new private output required.');
const root = fs.realpathSync(rootArgument), manifestPath = fs.realpathSync(manifestArgument), output = path.resolve(outputArgument);
need(!fs.existsSync(output), 'Fresh proof output required.');
fs.mkdirSync(output);
const manifestBytes = fs.readFileSync(manifestPath), manifest = JSON.parse(manifestBytes);
need(manifest.format === 'website-final-dist-manifest/1' && manifest.source_candidate_static_pins === 389, 'Qualified final build manifest required.');
const files = new Map(manifest.files.map(file => [file.path, file]));
const configBytes = fs.readFileSync(path.join(root, 'vercel.json')), config = JSON.parse(configBytes);
const headers = config.headers.find(item => item.source === '/(.*)').headers;
const globalCsp = headers.find(item => item.key.toLowerCase() === 'content-security-policy').value;
need(!/unsafe-inline|unsafe-eval/.test(globalCsp), 'Strict final CSP required.');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.woff2':'font/woff2','.ico':'image/x-icon'};
const requests = [], failures = [], stages = [], pageErrors = [], consoleErrors = [], externalRequests = [], platformRequests = [], handlerInvocations = [];
let server, browser;
async function main() {
  const handlers = new Map();
  for (const route of config.rewrites) {
    const destination = new URL(route.destination, 'http://localhost');
    if (destination.pathname.startsWith('/api/archives/')) {
      const modulePath = path.join(root, destination.pathname.slice(1) + '.mjs');
      if (!handlers.has(destination.pathname)) handlers.set(destination.pathname, (await import(pathToFileURL(modulePath).href)).default);
    }
  }
  const rewrites = new Map(config.rewrites.map(item => [item.source,item.destination]));
  server = http.createServer(async (request,response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    requests.push({method:request.method,path:url.pathname});
    for (const item of headers) response.setHeader(item.key,item.value);
    response.setHeader('Cache-Control','no-store');
    const send = (status,type,bytes) => {response.writeHead(status,{'Content-Type':type});response.end(request.method === 'HEAD' ? undefined : bytes);};
    try {
      if (!['GET','HEAD'].includes(request.method)) return send(405,'text/plain','Read-only verification');
      const decoded = decodeURIComponent(url.pathname);
      if (decoded.split('/').some(part => part === '..' || part.startsWith('.')) || decoded.includes('\\')) return send(404,'text/plain','Not found');
      let rel = decoded.slice(1);
      if (!rel || rel.endsWith('/')) rel += 'index.html';
      const pin = files.get(rel);
      if (pin) {
        const bytes = fs.readFileSync(path.join(root,'dist',rel));
        need(bytes.length === pin.size_bytes && hash(bytes) === pin.sha256, 'Final served bytes drift: ' + rel);
        return send(200,types[path.extname(rel)] || 'application/octet-stream',bytes);
      }
      const target = rewrites.get(url.pathname);
      if (target) {
        const destination = new URL(target,'http://localhost');
        const handler = handlers.get(destination.pathname);
        if (handler) {handlerInvocations.push({source:url.pathname,destination:destination.pathname,query:url.search});return await handler(request,response);}
        const staticPin = files.get(destination.pathname.slice(1));
        if (staticPin) {
          const bytes = fs.readFileSync(path.join(root,'dist',staticPin.path));
          need(bytes.length === staticPin.size_bytes && hash(bytes) === staticPin.sha256,'Rewritten static bytes drift.');
          return send(200,types[path.extname(staticPin.path)] || 'application/octet-stream',bytes);
        }
        if (destination.pathname.startsWith('/api/archive/')) return send(503,'application/json',JSON.stringify({error:'hosted_runtime_not_activated',verification_only:true}));
      }
      return send(404,'text/plain','Not found');
    } catch (error) {failures.push(error.message);if (!response.headersSent) send(500,'text/plain','Verification failed');else response.destroy();}
  });
  await new Promise((accept,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',accept);});
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({channel:'msedge',headless:true});
  const context = await browser.newContext({viewport:{width:1280,height:900}});
  await context.route('**/*', route => {const url=route.request().url();if (!url.startsWith(origin)) {externalRequests.push(url);return route.abort();}if(new URL(url).pathname === '/_vercel/insights/script.js'){platformRequests.push(url);return route.abort();}return route.continue();});
  const page = await context.newPage();
  page.on('pageerror',error => pageErrors.push(error.message));
  page.on('console',message => {if (message.type() === 'error') consoleErrors.push(message.text());});
  let response = await page.goto(origin + '/', {waitUntil:'networkidle'});
  need(response.status() === 200 && response.headers()['content-security-policy'] === globalCsp,'Final homepage / CSP failed.');
  const navigation = page.locator('nav[aria-label="primary"]');
  need(await navigation.locator('a[href="/archives/"]').count() === 1,'Homepage primary Archives link missing or duplicated.');
  await page.screenshot({path:path.join(output,'portfolio-home.png'),fullPage:false});
  await navigation.locator('a[href="/archives/"]').click();
  await page.waitForURL(origin + '/archives/');
  await page.waitForLoadState('networkidle');
  stages.push({stage:'built-homepage-to-archives',passed:true,global_csp:globalCsp});
  await page.getByRole('link',{name:'Lectures par fichier',exact:true}).first().click();
  await page.waitForURL(origin + '/archives/fichiers/');
  need(await page.locator('a[href="/archives/fichiers/e108-vue-12/passage-en-cours/"]').count() >= 1,'Fifth file reader missing from final build.');
  await page.locator('a[href="/archives/fichiers/e108-vue-12/passage-en-cours/"]').first().click();
  await page.waitForURL(origin + '/archives/fichiers/e108-vue-12/passage-en-cours/');
  await page.waitForLoadState('networkidle');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,'final-reader-mobile.png'),fullPage:false});
  stages.push({stage:'archives-to-fifth-file-reader',passed:true});
  response = await page.goto(origin + '/archives/catalogue/?query=E.108', {waitUntil:'networkidle'});
  need(response.status() === 200, 'Final actual readonly catalogue handler failed.');
  const catalogueText=await page.locator('body').innerText();
  fs.writeFileSync(path.join(output,'catalogue-visible-text.txt'),catalogueText+'\n',{flag:'wx'});
  need(handlerInvocations.some(item => item.source === '/archives/catalogue/'), 'Catalogue was served from a static snapshot instead of the final handler.');
  need(await page.locator('input[name="query"]').inputValue() === 'E.108', 'Final catalogue query was not retained by the actual handler.');
  stages.push({stage:'final-commonjs-workspace-readonly-handler',passed:true,query:'E.108',query_preserved:true});
  await page.setViewportSize({width:390,height:844});
  response = await page.goto(origin + '/about/',{waitUntil:'networkidle'});
  need(response.status() === 200, 'Real built About route failed.');
  need(await page.locator('#root').innerText(), 'Real built About application is empty.');
  await page.screenshot({path:path.join(output,'built-about-mobile.png'),fullPage:false});
  stages.push({stage:'real-about-assets-render',passed:true});
  for (const target of ['/runtime/archives/selected-data.json','/.private-build/final-dist-manifest.json','/package.json','/REPOSITORY_INSTRUCTIONS.md','/scripts/build-site.js']) {
    const result = await context.request.get(origin + target);need(result.status() === 404,'Private/non-dist path exposed: '+target);
  }
  need(pageErrors.length === 0 && failures.length === 0,'Page or final-byte qualification errors.');
  need(!consoleErrors.some(message => /Content Security Policy|content security policy/.test(message)), 'Final rendered pages violate their CSP.');
  need(requests.every(item => ['GET','HEAD'].includes(item.method)), 'Verification unexpectedly mutated state.');
  const receipt = {format:'root-final-portfolio-journey/1',passed:true,created_at_utc:new Date().toISOString(),workspace:root,manifest_path:manifestPath,manifest_sha256:hash(manifestBytes),vercel_config_sha256:hash(configBytes),stages,requests,actual_handler_invocations:handlerInvocations,page_errors:pageErrors,console_errors:consoleErrors,external_requests_aborted:externalRequests,vercel_platform_analytics_aborted:platformRequests,read_only:true,main_server_untouched:true,hosted_corrections_exercised:false,linux_qualification:false,publication_executed:false,visual_inspection_pending:true};
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({passed:true,stages:stages.length,proof:output})+'\n');
}
main().catch(error => {fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({passed:false,message:error.message,stages,failures,pageErrors,consoleErrors,requests},null,2)+'\n',{flag:'wx'});process.stderr.write(error.stack+'\n');process.exitCode=1;}).finally(async () => {if(browser) await browser.close();if(server){server.closeAllConnections();await new Promise(accept => server.close(accept));}});
