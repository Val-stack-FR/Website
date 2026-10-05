const {chromium}=require('playwright');
const {mkdir,writeFile,readFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const {parseArgs}=require('node:util');
const {createHash}=require('node:crypto');
(async()=>{
 const {values}=parseArgs({options:{origin:{type:'string'},run:{type:'string'}}});const origin=values.origin,run=resolve(values.run),stages=[],denied=[],errors=[];
 const ensure=(ok,message)=>{if(!ok)throw Error(message);};await mkdir(run);
 const browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(u.origin!==origin||req.method()!=='GET'){denied.push({method:req.method(),path:u.pathname});return route.abort();}return route.continue();});
 const human=async()=>{ensure(!/\bCLEAN\b|[a-f0-9]{64}|object:path-|\bSHA(?:-256)?\b/u.test(await page.locator('body').innerText()),'Technical metadata visible');ensure(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflow');};
 try{
  const response=await page.goto(origin+'/archives/fichiers/');ensure(response.status()===200&&response.headers()['content-security-policy']&&!/unsafe-inline|unsafe-eval/u.test(response.headers()['content-security-policy']),'Index/CSP failed');ensure(await page.locator('.file-entry').count()===5,'Five file journeys required');
  await page.locator('.file-entry a[href="/archives/fichiers/e108-vue-12/passage-en-cours/"]').first().tap();await page.waitForURL('**/e108-vue-12/passage-en-cours/');
  const texts=async id=>page.locator('#'+id+' .line-text').allTextContents();const originalA=await texts('original-lines'),modernA=await texts('modern-lines');ensure(originalA.length===6&&modernA.length===6,'Six lines required');
  await page.locator('#twelve-edition').selectOption('B');ensure((await texts('original-lines')).length===6&&(await texts('modern-lines')).length===6,'B edition missing');ensure((await page.locator('.edition-badge').allTextContents()).every(t=>t.includes('indépendante')),'Edition badge mismatch');
  await page.locator('#twelve-edition').selectOption('A');ensure(JSON.stringify(await texts('original-lines'))===JSON.stringify(originalA)&&JSON.stringify(await texts('modern-lines'))===JSON.stringify(modernA),'A restoration failed');
  for(const id of ['twelve-modern-panel','twelve-photo-panel','twelve-original-panel']){await page.locator('[data-panel="'+id+'"]').tap();ensure(await page.locator('#'+id).evaluate(el=>document.activeElement===el&&el.getBoundingClientRect().left>=-2&&el.getBoundingClientRect().left<innerWidth),'Panel navigation failed');}
  stages.push('fifth file → six original/modern lines A/B/A → three horizontal panels');
  const trigger=page.locator('[data-priority-line="R03"]');
  if(!await trigger.isVisible())await page.locator('details').filter({has:trigger}).locator('summary').tap();
  await trigger.tap();await page.locator('#context-dialog img').evaluate(image=>image.decode());ensure(await page.locator('#context-dialog img').evaluate(image=>image.naturalWidth===2150&&image.naturalHeight===800),'Wrong context');
  ensure(await page.locator('#dialog-line').inputValue()==='R03','Priority line not selected');await page.locator('#context-native').tap();ensure(await page.locator('#context-dialog img').evaluate(image=>Math.round(image.getBoundingClientRect().width)===2150),'Native image size failed');await page.screenshot({path:resolve(run,'R03-context-mobile.png')});
  await page.locator('#dialog-return-line').tap();await page.waitForFunction(()=>document.activeElement===document.querySelector('#original-lines [data-line="R03"]')&&!document.querySelector('#context-dialog').open);await human();
  stages.push('third-line difficulty → native exact context → return/focus to R03');
  await page.getByRole('link',{name:'Revenir à l’ensemble E.108 · vues 11 à 14',exact:true}).tap();await page.waitForFunction(()=>document.getElementById('catalogue-results')?.getAttribute('aria-busy')==='false');
  ensure(await page.locator('#ensemble-e108-11-14 [data-e108-photo]').count()===4,'Four-photo group changed');
  const twelve=page.locator('a[href="/archives/fichiers/e108-vue-12/passage-en-cours/"]');ensure(await twelve.count()===1,'Dynamic catalogue new link missing/repeated');ensure(await page.locator('a[href="/archives/fichiers/e108-vue-11/"]').count()===1&&await page.locator('a[href="/archives/fichiers/e108-vue-11/passage-en-cours/"]').count()===1,'View11 links changed');await twelve.tap();await page.waitForURL('**/e108-vue-12/passage-en-cours/');await human();stages.push('return catalogue four-photo group → both view11 links retained → exact view12 link');
  await page.goto(origin+'/archives/avancement/');await human();const board=await page.locator('body').innerText();ensure(board.includes('Cinq fichiers')&&board.includes('25 photographies sont consultables avec zoom.'),'Public counters incorrect');
  ensure(errors.length===0&&denied.length===0,'Browser/request gate failed');
  await writeFile(resolve(run,'verification.json'),JSON.stringify({passed:true,package:'v31',origin,stages,new_posts:0,errors,denied,whole_photo_count:25,file_journeys:5,human_validation:false,mobile_emulation:true,physical_device_claim:false},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({passed:true,stages:stages.length,new_posts:0}));
 }catch(e){await page.screenshot({path:resolve(run,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(resolve(run,'failure.json'),JSON.stringify({passed:false,message:e.message,stages,errors,denied},null,2)+'\n',{flag:'wx'});throw e;}finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
