const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');

(async () => {
  const origin = 'http://127.0.0.1:8830';
  const run = resolve('.private/archives-integration/source-eleven-reader-browser-20261004-v28-r2');
  await mkdir(run);
  const ensure = (ok, message) => { if (!ok) throw Error(message); };
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = [], denied = [], stages = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET' || url.origin !== origin) {
      denied.push({ method: request.method(), path: url.pathname }); return route.abort();
    }
    return route.continue();
  });
  const human = async () => {
    ensure(!/\bCLEAN\b|[a-f0-9]{64}|object:path-|\bSHA(?:-256)?\b/u.test(await page.locator('body').innerText()), 'Technical fields visible');
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Body overflow');
  };
  try {
    const response = await page.goto(origin + '/archives/fichiers/');
    ensure(response.status() === 200 && !/unsafe-inline|unsafe-eval/u.test(response.headers()['content-security-policy'] || ''), 'Index/CSP failed');
    ensure(await page.locator('.file-entry').count() === 4, 'Four file journeys required');
    await human();
    await page.getByRole('link', { name: 'Ouvrir le passage', exact: true }).tap();
    await page.waitForURL('**/passage-en-cours/');
    const textAt = id => page.locator('#' + id + ' .line-text').allTextContents();
    const aOriginal = await textAt('original-lines'), aModern = await textAt('modern-lines');
    ensure(aOriginal.length === 6 && aModern.length === 6 && aOriginal[1].includes('57') && aOriginal[5].includes('58'), 'Pilot A changed');
    await page.locator('#reading-edition').selectOption('B');
    const bOriginal = await textAt('original-lines'), bModern = await textAt('modern-lines');
    ensure(bOriginal.length === 6 && bModern.length === 6 && bOriginal[1].includes('Moulbettoy') && !bOriginal.some(line => /57|58/u.test(line)), 'Pilot B changed');
    ensure((await page.locator('.edition-badge').allTextContents()).every(text => text.includes('indépendante')), 'Mixed editions');
    await page.locator('#reading-edition').selectOption('A');
    ensure(JSON.stringify(await textAt('original-lines')) === JSON.stringify(aOriginal) && JSON.stringify(await textAt('modern-lines')) === JSON.stringify(aModern), 'Edition restoration failed');
    for (const panel of ['modern-panel', 'photo-panel', 'original-panel']) {
      await page.locator('[data-panel="' + panel + '"]').tap();
      ensure(await page.locator('#' + panel).evaluate(el => document.activeElement === el && el.getBoundingClientRect().left >= -2 && el.getBoundingClientRect().left < innerWidth), 'Horizontal panel focus failed');
    }
    await page.locator('[data-panel="photo-panel"]').tap();
    await page.locator('#open-crop').tap();
    await page.locator('#crop-image').evaluate(image => image.decode());
    ensure(await page.locator('#crop-image').evaluate(image => image.naturalWidth === 2976 && image.naturalHeight === 710), 'Wrong crop');
    await page.locator('#crop-native').tap();
    ensure(await page.locator('#crop-image').evaluate(image => Math.round(image.getBoundingClientRect().width) === 2976), 'Native zoom failed');
    await page.screenshot({ path: resolve(run, 'crop-native-mobile.png') });
    await page.keyboard.press('Escape');
    ensure(await page.locator('#open-crop').evaluate(el => document.activeElement === el) && !await page.locator('#crop-dialog').evaluate(el => el.open), 'Close/focus failed');
    await human(); stages.push('fourth file → both editions → horizontal panels → native crop → focus');
    await page.locator('#return-ensemble').tap();
    await page.waitForFunction(() => document.getElementById('catalogue-results')?.getAttribute('aria-busy') === 'false');
    ensure(await page.locator('#ensemble-e108-11-14 [data-e108-photo]').count() === 4, 'Four-photo return failed');
    ensure(await page.locator('#e108-eleven-passage-link').count() === 1, 'Reader catalogue link missing or repeated');
    await page.locator('#e108-eleven-passage-link').tap();
    await page.waitForURL('**/passage-en-cours/'); stages.push('catalogue return and link to exact view 11');
    const id = '81f2195b2dd92184859c2301a8da2f1126c3b7e25cdf8b1d1f6684029fa66a45';
    await page.goto(origin + '/archives/textes/fichier/' + id + '/');
    const literal = await page.locator('#preexisting-text').innerText();
    await human();
    ensure(await page.locator('[data-source-file-context="e108-folder"] a').count() === 1, 'Classified folder context missing');
    await page.screenshot({ path: resolve(run, 'source-file-mobile.png'), fullPage: true });
    await page.goto(origin + '/archives/texte/?object_id=object:path-' + id);
    ensure(await page.locator('#preexisting-text').innerText() === literal, 'SSR source text changed');
    await human();
    await page.locator('[data-source-file-context="e108-folder"] a').tap();
    await page.waitForFunction(() => document.getElementById('catalogue-results')?.getAttribute('aria-busy') === 'false');
    ensure(new URL(page.url()).searchParams.get('folder').endsWith('Baronnie de Milesse, dépendant du marquisat de Lavardin'), 'Wrong folder');
    stages.push('old file static and bookmarked HTML → exact classified photo folder');
    await page.goto(origin + '/archives/avancement/');
    const board = await page.locator('body').innerText();
    ensure(board.includes('Quatre fichiers à ouvrir maintenant') && board.includes('25 photographies sont consultables avec zoom.'), 'Board counters changed');
    await human();
    ensure(errors.length === 0 && denied.length === 0, 'Browser/request gate failed');
    await writeFile(resolve(run, 'verification.json'), JSON.stringify({ passed: true, package: 'v28', stages, errors, denied, new_posts: 0, mobile_browser_emulation: true, physical_device_claim: false, previous_reader_routes_not_replayed: true }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, stages: stages.length, new_posts: 0 }));
  } catch (error) {
    await page.screenshot({ path: resolve(run, 'failure.png'), fullPage: true }).catch(() => {});
    await writeFile(resolve(run, 'failure.json'), JSON.stringify({ passed: false, message: error.message, stages, errors, denied }, null, 2) + '\n', { flag: 'wx' }); throw error;
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
