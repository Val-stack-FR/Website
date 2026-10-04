const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
(async () => {
  const origin = 'http://127.0.0.1:8830';
  const run = resolve('.private/archives-integration/context-galleries-browser-20261004-v1');
  await mkdir(run);
  const ensure = (ok, message) => { if (!ok) throw Error(message); };
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = [], denied = [], reads = [], stages = [], touch = [];
  await page.exposeFunction('__recordGalleryTouch', event => touch.push(event));
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET' || url.origin !== origin) { denied.push({ path: url.pathname, method: request.method() }); return route.abort(); }
    // Only existing public correction GETs use the real local store. Candidate
    // catalogue/retrieval functions continue to run from the new packet.
    if (url.pathname.startsWith('/api/archive/')) {
      const response = await context.request.get('http://127.0.0.1:8822' + url.pathname + url.search);
      reads.push({ path: url.pathname, status: response.status() });
      return route.fulfill({ response });
    }
    return route.continue();
  });
  const human = async () => {
    ensure(!/\bCLEAN\b|[a-f0-9]{64}|object:path-|\bSHA(?:-256)?\b/u.test(await page.locator('body').innerText()), 'Technical metadata visible.');
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Document overflow.');
  };
  const instrument = async locator => locator.evaluate(el => el.addEventListener('pointerdown', event => window.__recordGalleryTouch({ trusted: event.isTrusted, pointer: event.pointerType, id: el.id || el.textContent.trim() })));
  const ready = async () => page.waitForFunction(() => document.getElementById('catalogue-results')?.getAttribute('aria-busy') === 'false');
  try {
    const response = await page.goto(origin + '/archives/fichiers/e113-marge-1/');
    ensure(response.status() === 200 && !/unsafe-inline|unsafe-eval/u.test(response.headers()['content-security-policy']), 'File/CSP failed.');
    const line = 'rereading-passage-0-line-2';
    const sourceLine = 'la Mʳie de la [Rousselière ?] [lacune] tant en';
    ensure(await page.locator('#' + line + ' [data-source-text]').innerText() === sourceLine, 'Exact line changed.');
    ensure(await page.locator('.file-point-context').count() === 3, 'Three E113 contexts missing.');
    for (const [number, quote, sha, width, height] of [
      [1, 'Mʳie', 'cd6c54e03bac9b66e9b3c044ccd98f2b7737e9645bee47afc06480c9bdf2e0f2', 455, 145],
      [2, '[Rousselière ?]', '7ae18bfca06a4c3700801295de51cd6715e46720c8b448c778484ef144a99a8a', 615, 170],
    ]) {
      if (number === 1) await page.locator('#' + line + ' [data-point-target]').tap();
      const point = page.locator('#point-' + number), img = point.locator('img');
      await point.scrollIntoViewIfNeeded(); await img.evaluate(el => el.decode());
      ensure(await point.locator('.point-quote').innerText() === quote, 'Point quote changed.');
      ensure(await img.evaluate((el, dimensions) => el.naturalWidth === dimensions[0] && el.naturalHeight === dimensions[1] && el.getBoundingClientRect().width <= innerWidth, [width, height]), 'Native context dimensions/fit failed.');
      const route = '/archives/review-crops/h07/' + sha + '.png';
      const bytes = await context.request.get(origin + route);
      ensure(bytes.status() === 200 && hash(await bytes.body()) === sha, 'Native served context bytes changed.');
      await human(); await page.screenshot({ path: resolve(run, 'e113-point-' + number + '-mobile.png') });
      const open = point.getByRole('link', { name: 'Voir l’extrait en grand' }); await instrument(open);
      await Promise.all([page.waitForURL(url => url.pathname === route), open.tap()]);
      await page.locator('img').evaluate(el => el.decode());
      ensure(await page.locator('img').evaluate((el, dimensions) => el.naturalWidth === dimensions[0] && el.naturalHeight === dimensions[1], [width, height]), 'Full PNG failed.');
      await page.goBack(); await point.locator('[data-review-target]').tap();
      ensure(new URL(page.url()).hash === '#' + line && await page.locator('#' + line).evaluate(el => document.activeElement === el), 'Exact line return/focus failed.');
    }
    stages.push({ flow: 'e113_two_contexts_native_zoom_and_exact_line_return', points: 2, contexts: 3, native_bytes_exact: true });

    await page.goto(origin + '/archives/fichiers/p09/');
    const margin = page.locator('#p09-margin-open'); await instrument(margin);
    await Promise.all([page.waitForURL(url => url.pathname === '/archives/fichiers/p09/marge/'), margin.tap()]);
    const image = page.locator('#view-image'); await image.evaluate(el => el.decode());
    ensure(await image.evaluate(el => el.naturalWidth === 2976 && el.naturalHeight === 3968 && getComputedStyle(el).transform === 'none'), 'EXIF display dimensions or CSS orientation failed.');
    await human(); await page.screenshot({ path: resolve(run, 'margin-fit-mobile.png') });
    await page.locator('#native').tap();
    ensure(await image.evaluate(el => Math.round(el.getBoundingClientRect().width) === 2976), 'Native display width failed.');
    await page.locator('#viewer').focus(); await page.keyboard.press('-');
    ensure(await page.locator('#viewer').getAttribute('data-zoom') === '50', 'Keyboard zoom failed.');
    await page.keyboard.press('0');
    ensure(await page.locator('#viewer').getAttribute('data-zoom') === 'fit', 'Keyboard fit failed.');
    await Promise.all([page.waitForURL(url => url.hash === '#p09-margin-open'), page.locator('#return-p09').tap()]);
    ensure(await page.locator('#p09-margin-open').evaluate(el => document.activeElement === el), 'Margin return focus failed.');
    ensure(await page.locator('#point-l07 img').count() === 1 && await page.locator('a[href="/archives/fichiers/p09/gauche/reperes/"]').count() === 1, 'P09 previous paths lost.');
    stages.push({ flow: 'p09_margin_open_exif_once_native_keyboard_and_return', display_dimensions: [2976,3968], return_focus: true });

    await page.goto(origin + '/archives/avancement/'); await human();
    ensure((await page.locator('main').innerText()).includes('2 photos consultables sur 4'), 'E108 board state missing.');
    const ensemble = page.locator('main a[href*="ensemble-e108-11-14"]').first(); await instrument(ensemble);
    await Promise.all([page.waitForURL(url => url.hash === '#ensemble-e108-11-14'), ensemble.tap()]); await ready();
    ensure(await page.locator('#ensemble-e108-11-14 .ensemble-views h4').count() === 4 && await page.locator('#ensemble-e108-11-14 [data-e108-photo]').count() === 2, 'E108 exact four/two membership failed.');
    for (const n of ['11','12']) {
      const button = page.locator('[data-e108-photo="' + n + '"]'); await instrument(button); await button.tap();
      const full = page.locator('#e108-photo-full'); await full.evaluate(el => el.decode());
      ensure(await full.evaluate(el => el.naturalWidth === 2976 && el.naturalHeight === 3968 && getComputedStyle(el).transform === 'none'), 'E108 native dimensions/orientation failed.');
      ensure((await page.locator('#e108-photo-title').innerText()).includes(n + '.jpg'), 'Wrong E108 source title.');
      await page.locator('[data-e108-native]').tap();
      ensure(await full.evaluate(el => Math.round(el.getBoundingClientRect().width) === 2976), 'E108 native zoom failed.');
      await page.screenshot({ path: resolve(run, 'e108-' + n + '-native-mobile.png') });
      if (n === '11') await page.locator('[data-e108-close]').tap(); else await page.keyboard.press('Escape');
      ensure(await button.evaluate(el => document.activeElement === el) && !await page.locator('#e108-photo-dialog').evaluate(el => el.open), 'E108 close/focus failed.');
    }
    await page.locator('#catalogue-query').fill('11.jpg');
    const search = page.locator('#catalogue-search button[type="submit"]'); await search.scrollIntoViewIfNeeded(); await instrument(search);
    await search.tap(); await page.waitForURL(url => url.searchParams.get('query') === '11.jpg'); await ready();
    ensure(new URL(page.url()).pathname === '/archives/catalogue/' && await page.locator('#catalogue-results > .catalogue-card').count() === 1 && !await page.locator('[data-ensemble-card]').count(), 'Trusted-touch search did not retain one result.');
    await human(); await page.screenshot({ path: resolve(run, 'e108-touch-search-mobile.png') });
    stages.push({ flow: 'board_to_e108_both_native_photos_close_focus_and_touch_search', exact_members: 4, displayed_photos: 2, partial_search_cards: 1 });
    ensure(touch.filter(event => event.trusted && event.pointer === 'touch').length >= 6 && !errors.length && !denied.length, 'Touch/errors/requests gate failed.');
    await writeFile(resolve(run, 'verification.json'), JSON.stringify({ passed: true, viewport: 390, stages, touch, errors, denied, existing_local_public_correction_gets: reads, new_posts: 0, hosted_backend_qualified: false, physical_device_claim: false }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, flows: 3, trusted_touch_search: true, new_posts: 0 }));
  } catch (error) {
    await page.screenshot({ path: resolve(run, 'failure.png'), fullPage: true }).catch(() => {});
    await writeFile(resolve(run, 'failure.json'), JSON.stringify({ passed: false, message: error.message, stages, errors, denied, touch }, null, 2) + '\n', { flag: 'wx' });
    throw error;
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
