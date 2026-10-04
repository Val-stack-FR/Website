const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { parseArgs } = require('node:util');
const ensure = (ok, message) => { if (!ok) throw Error(message); };
(async () => {
  const { values } = parseArgs({ options: { origin: { type: 'string' }, run: { type: 'string' } } });
  const origin = new URL(values.origin).origin, run = resolve(values.run), errors = [], denied = [], observations = [];
  await mkdir(run);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const request = route.request();
    if (new URL(request.url()).origin !== origin || request.method() !== 'GET') {
      denied.push({ method: request.method(), path: new URL(request.url()).pathname });
      return route.abort();
    }
    return route.continue();
  });
  const captureBand = async stage => {
    const observed = await page.evaluate(() => {
      const dialog = document.getElementById('context-dialog'), stage = dialog.querySelector('.context-stage');
      const band = dialog.querySelector('.line-group[data-local-line="R03"] polygon.band');
      const rectangle = band.getBoundingClientRect(), viewport = stage.getBoundingClientRect(), image = dialog.querySelector('img');
      return { selected: document.getElementById('dialog-line').value, scale: dialog.dataset.scale,
        native: [image.naturalWidth, image.naturalHeight], imageWidth: image.getBoundingClientRect().width,
        scroll: [stage.scrollLeft, stage.scrollTop], stage: [stage.clientWidth, stage.clientHeight],
        centerError: [rectangle.left + rectangle.width / 2 - viewport.left - stage.clientLeft - stage.clientWidth / 2,
          rectangle.top + rectangle.height / 2 - viewport.top - stage.clientTop - stage.clientHeight / 2] };
    });
    ensure(observed.selected === 'R03' && observed.scale === 'native', 'Selected row must open in native mode');
    ensure(JSON.stringify(observed.native) === '[2150,800]' && Math.abs(observed.imageWidth - 2150) < 1, 'Native context pixels changed');
    ensure(observed.centerError.every(value => Math.abs(value) <= 1), 'Selected manuscript band is not centered');
    observations.push({ stage, ...observed });
  };
  try {
    const response = await page.goto(origin + '/archives/fichiers/e108-vue-12/passage-en-cours/');
    ensure(response.status() === 200 && !/unsafe-inline|unsafe-eval/.test(response.headers()['content-security-policy'] || ''), 'Reader/CSP failed');
    const trigger = page.locator('[data-priority-line="R03"]');
    if (!await trigger.isVisible()) await page.locator('details').filter({ has: trigger }).locator('summary').tap();
    await trigger.tap();
    await page.locator('#context-dialog img').evaluate(image => image.decode());
    await captureBand('difficulty opens native selected band');
    await page.screenshot({ path: resolve(run, 'R03-centered-native-mobile.png') });
    await page.locator('#context-fit').tap();
    ensure(await page.locator('#context-dialog').getAttribute('data-scale') === 'fit', 'Fit mode unavailable');
    await page.locator('#context-native').tap();
    await captureBand('fit then native restores selected band');
    await page.locator('#dialog-return-line').tap();
    await page.waitForFunction(() => document.activeElement === document.querySelector('#original-lines [data-line="R03"]') && !document.getElementById('context-dialog').open);
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page overflows');
    ensure(!/\bCLEAN\b|[a-f0-9]{64}|object:path-|\bSHA(?:-256)?\b/u.test(await page.locator('body').innerText()), 'Technical metadata visible');
    await page.screenshot({ path: resolve(run, 'R03-return-mobile.png') });
    ensure(errors.length === 0 && denied.length === 0, 'Browser or request gate failed');
    await writeFile(resolve(run, 'verification.json'), JSON.stringify({ passed: true, observations, return_focus: 'R03', errors, denied, new_posts: 0, mobile_emulation: true, visual_inspection_pending: true }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, observations: observations.length, new_posts: 0 }));
  } catch (error) {
    await writeFile(resolve(run, 'failure.json'), JSON.stringify({ message: error.message, observations, errors, denied }, null, 2) + '\n', { flag: 'wx' });
    throw error;
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
