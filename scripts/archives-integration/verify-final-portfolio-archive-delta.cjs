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
need(manifest.format === 'website-final-dist-manifest/1' && manifest.source_candidate_static_pins === 396, 'Qualified final build manifest required.');
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
  await page.setViewportSize({width:390,height:844});
  let response = await page.goto(origin + '/archives/fichiers/', {waitUntil:'networkidle'});
  need(response.status() === 200, 'Final file list failed.');
  const e99 = page.locator('a[href="/archives/fichiers/e99-p08-droite/passage-en-cours/"]').first();
  need(await e99.count() === 1, 'Final E99 link missing.');
  await e99.click();
  await page.waitForURL(origin + '/archives/fichiers/e99-p08-droite/passage-en-cours/');
  await page.waitForLoadState('networkidle');
  need(await page.locator('#original-lines li').count() === 6 && await page.locator('#modern-lines li').count() === 6, 'Final E99 rows missing.');
  await page.locator('#twelve-edition').selectOption('B');
  need((await page.locator('.edition-badge').allTextContents()).every(t => t.includes('Lecture B')), 'Final E99 A/B selection failed.');
  await page.screenshot({path:path.join(output,'final-e99-reader-mobile.png'),fullPage:false});
  stages.push({stage:'final-built-list-to-E99-reader-and-B-edition',passed:true});
  for (const [label,query,total] of [
    ['default-native','',528],
    ['masked-et','?q=et&kind=person_name_candidate&match=exact',0],
    ['Tuce-positive','?q=Tuc%C3%A9&kind=person_name_candidate&match=contains',3]
  ]) {
    response = await page.goto(origin + '/archives/reperes/' + query, {waitUntil:'networkidle'});
    need(response.status() === 200, 'Final lexical route failed: ' + label);
    const status = await page.locator('[role="status"]').innerText();
    need(status.startsWith(String(total) + ' résultat') && status.includes('528 repères'), 'Final lexical count drift: ' + label);
    const visible = await page.locator('body').innerText();
    need(!/(?:mentioncandidate:|Caractères Unicode|Empreinte du fichier source)/.test(visible), 'Technical metadata displayed.');
    need(handlerInvocations.some(item => item.source === '/archives/reperes/'), 'Static shadow prevented actual lexical handler.');
    if (label === 'Tuce-positive') {
      need(await page.locator('input[name="q"]').inputValue() === 'Tucé' && await page.locator('.lexical-card').count() === 3, 'Final query/cards missing.');
      await page.screenshot({path:path.join(output,'final-lexical-mobile.png'),fullPage:false});
    }
    stages.push({stage:'final-commonjs-lexical-'+label,passed:true,total});
  }
  for (const target of ['/runtime/archives/selected-data.json','/.private-build/final-dist-manifest.json','/package.json','/REPOSITORY_INSTRUCTIONS.md','/scripts/build-site.js']) {
    const result = await context.request.get(origin + target);need(result.status() === 404,'Private/non-dist path exposed: '+target);
  }
  need(pageErrors.length === 0 && failures.length === 0,'Page or final-byte qualification errors.');
  need(!consoleErrors.some(message => /Content Security Policy|content security policy/.test(message)), 'Final rendered pages violate their CSP.');
  need(requests.every(item => ['GET','HEAD'].includes(item.method)), 'Verification unexpectedly mutated state.');
  const receipt = {format:'root-final-portfolio-archive-delta/1',passed:true,created_at_utc:new Date().toISOString(),workspace:root,manifest_path:manifestPath,manifest_sha256:hash(manifestBytes),vercel_config_sha256:hash(configBytes),stages,requests,actual_handler_invocations:handlerInvocations,page_errors:pageErrors,console_errors:consoleErrors,external_requests_aborted:externalRequests,vercel_platform_analytics_aborted:platformRequests,read_only:true,main_server_untouched:true,hosted_corrections_exercised:false,linux_qualification:false,publication_executed:false,visual_inspection_pending:true};
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify({passed:true,stages:stages.length,proof:output})+'\n');
}
main().catch(error => {fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({passed:false,message:error.message,stages,failures,pageErrors,consoleErrors,requests},null,2)+'\n',{flag:'wx'});process.stderr.write(error.stack+'\n');process.exitCode=1;}).finally(async () => {if(browser) await browser.close();if(server){server.closeAllConnections();await new Promise(accept => server.close(accept));}});
