const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
(async () => {
  const origin = 'http://127.0.0.1:8830';
  const run = resolve('.private/archives-integration/' + (process.env.ARCHIVE_PROGRESS_RUN || 'review-progress-browser-20261004-v1'));
  await mkdir(run);
  const ensure = (ok, message) => { if (!ok) throw Error(message); };
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), denied = [], errors = [], touch = [], backendReads = [], stages = [];
  await page.exposeFunction('__recordProgressTouch', data => touch.push(data));
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET' || url.origin !== origin) { denied.push({ path: url.pathname, method: request.method() }); return route.abort(); }
    // The temporary assembled server has no private store configuration. Reuse
    // only public GET responses from the running local stores; no POST or seed.
    if (url.pathname.startsWith('/api/')) {
      const response = await context.request.get('http://127.0.0.1:8822' + url.pathname + url.search);
      backendReads.push({ path: url.pathname, status: response.status() });
      return route.fulfill({ response });
    }
    return route.continue();
  });
  const humanPage = async () => {
    ensure(!/\bCLEAN\b|[a-f0-9]{64}|object:path-|\bSHA(?:-256)?\b/u.test(await page.locator('body').innerText()), 'Technical metadata visible.');
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow.');
  };
  try {
    const response = await page.goto(origin + '/archives/avancement/');
    ensure(response.status() === 200 && !/unsafe-inline|unsafe-eval/u.test(response.headers()['content-security-policy']), 'Board or CSP failed.');
    await humanPage();
    const text = await page.locator('main').innerText();
    ensure(/166/u.test(text) && /2[\s\u00a0\u202f]?989/u.test(text) && text.includes('4 petits extraits'), 'Current units/context count missing.');
    await page.screenshot({ path: resolve(run, 'board-mobile.png'), fullPage: true });
    const file = page.locator('main a[href="/archives/fichiers/p09/"]').first();
    await file.evaluate(el => el.addEventListener('pointerdown', event => window.__recordProgressTouch({ trusted: event.isTrusted, pointer: event.pointerType })));
    await Promise.all([page.waitForURL(url => url.pathname === '/archives/fichiers/p09/'), file.tap()]);
    ensure(touch.some(event => event.trusted && event.pointer === 'touch'), 'Trusted touch not observed.');
    const point = page.locator('#point-l07'); await point.scrollIntoViewIfNeeded();
    const crop = '/archives/review-crops/p09/dbef599e83664a5547488333a6275a00de3bfa506b063a9fa737fcf1a8223700.png';
    await point.locator('img').evaluate(el => el.decode());
    ensure(await point.locator('img').evaluate(el => el.naturalWidth === 760 && el.naturalHeight === 165), 'L07 exact native dimensions missing.');
    ensure((await point.innerText()).includes('vre') && (await point.innerText()).includes('vostre') && !(await point.innerText()).includes('Cadrage à préparer'), 'L07 point binding changed.');
    await humanPage(); await page.screenshot({ path: resolve(run, 'l07-mobile.png') });
    await Promise.all([page.waitForURL(url => url.pathname === crop), point.locator('a[href="' + crop + '"]').tap()]);
    await page.locator('img').evaluate(el => el.decode());
    ensure(await page.locator('img').evaluate(el => el.naturalWidth === 760 && el.naturalHeight === 165), 'Enlarged PNG differs.');
    await page.goBack();
    await Promise.all([page.waitForURL(url => url.hash === '#ligne-l07'), page.locator('#point-l07 a[href="#ligne-l07"]').tap()]);
    ensure(await page.locator('#ligne-l07').isVisible(), 'Return to transcription line failed.');
    stages.push({ flow: 'board_to_p09_to_l07_crop_and_line', trusted_touch: true, crop_native_dimensions: [760,165] });

    await Promise.all([page.waitForURL(url => url.pathname === '/archives/fichiers/p09/gauche/reperes/'), page.locator('a[href="/archives/fichiers/p09/gauche/reperes/"]').tap()]);
    await page.locator('[data-line="D01"]').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('[data-line="D01"]').disabled);
    ensure(await page.locator('[data-line]').count() === 21, '21 local line choices missing.');
    for (const id of ['D01', 'D10', 'D21']) {
      await page.locator('[data-line="' + id + '"]').tap();
      ensure(await page.evaluate(id => document.documentElement.dataset.activeLine === id && document.getElementById('active-marker').getAttribute('display') === 'inline', id), 'Line selection failed: ' + id);
      ensure(await page.locator('[data-reading]:visible').count() === 1, 'More than one reading shown.');
    }
    await humanPage(); await page.screenshot({ path: resolve(run, 'left21-mobile.png') });
    await page.keyboard.press('Escape');
    ensure(await page.evaluate(() => document.documentElement.dataset.activeLine === 'none'), 'Escape did not clear.');
    await page.locator('[data-line="D10"]').focus(); await page.keyboard.press('Enter');
    ensure(await page.evaluate(() => document.documentElement.dataset.activeLine === 'D10'), 'Keyboard selection failed.');
    await page.locator('#clear-selection').focus(); await page.keyboard.press('Enter');
    ensure(await page.evaluate(() => document.documentElement.dataset.activeLine === 'none'), 'Keyboard clear failed.');
    stages.push({ flow: 'p09_to_left21_select_and_clear', local_lines: 21, tested: ['D01','D10','D21'], touch_and_keyboard: true });

    await page.goto(origin + '/archives/avancement/');
    const ensemble = page.locator('main a[href*="ensemble-e108-11-14"]').first();
    await Promise.all([page.waitForURL(url => url.hash === '#ensemble-e108-11-14'), ensemble.tap()]);
    await page.locator('#ensemble-e108-11-14').waitFor();
    ensure(await page.locator('#ensemble-e108-11-14 .ensemble-views h4').count() === 4, 'Board link lost E108 members.');
    await humanPage(); stages.push({ flow: 'board_to_e108', exact_members: 4, probable_unconfirmed: true });
    ensure(!errors.length && !denied.length, 'Unexpected request or page error.');
    await writeFile(resolve(run, 'verification.json'), JSON.stringify({ passed: true, viewport: 390, stages, errors, denied, backend_public_gets_relayed: backendReads, new_posts: 0, physical_device_claim: false }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, flows: stages.length, touch_and_keyboard: true, new_posts: 0 }));
  } catch (error) {
    await page.screenshot({ path: resolve(run, 'failure.png'), fullPage: true }).catch(() => {});
    await writeFile(resolve(run, 'failure.json'), JSON.stringify({ passed: false, message: error.message, errors, denied, stages }, null, 2) + '\n', { flag: 'wx' });
    throw error;
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
