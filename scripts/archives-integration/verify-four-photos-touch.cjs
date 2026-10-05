const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
(async () => {
  const origin = 'http://127.0.0.1:8830', run = resolve('.private/archives-integration/four-photos-touch-20261004-v27');
  await mkdir(run);
  const ensure = (ok, message) => { if (!ok) throw Error(message); };
  const sha = b => createHash('sha256').update(b).digest('hex');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), touches = [], denied = [], errors = [], stages = [];
  await page.exposeFunction('__fourPhotoTouch', e => touches.push(e));
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET' || url.origin !== origin) { denied.push({ method: request.method(), path: url.pathname }); return route.abort(); }
    return route.continue();
  });
  const instrument = locator => locator.evaluate(el => el.addEventListener('pointerdown', e => window.__fourPhotoTouch({ trusted: e.isTrusted, type: e.pointerType, id: el.id || el.textContent.trim() })));
  const ready = () => page.waitForFunction(() => document.getElementById('catalogue-results')?.getAttribute('aria-busy') === 'false');
  const human = async () => {
    ensure(!/\bCLEAN\b|[a-f0-9]{64}|object:path-|\bSHA(?:-256)?\b/u.test(await page.locator('body').innerText()), 'Technical fields visible');
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflow');
  };
  try {
    const response = await page.goto(origin + '/archives/avancement/');
    ensure(response.status() === 200 && !/unsafe-inline|unsafe-eval/u.test(response.headers()['content-security-policy']), 'Board or CSP failed');
    const visible = await page.locator('body').innerText();
    ensure(visible.includes('25 photographies sont consultables avec zoom.') && visible.includes('4 photos consultables sur 4'), 'Visible counters missing');
    await human(); await page.screenshot({ path: resolve(run, 'board-mobile.png'), fullPage: true });
    const link = page.locator('main a[href*="ensemble-e108-11-14"]').first(); await instrument(link);
    await Promise.all([page.waitForURL(url => url.hash === '#ensemble-e108-11-14'), link.tap()]); await ready();
    ensure(await page.locator('#ensemble-e108-11-14 .ensemble-views h4').count() === 4 && await page.locator('#ensemble-e108-11-14 [data-e108-photo]').count() === 4, 'Four-photo group missing');
    for (const [n, hash] of [['13', 'e280c640cd9b4adc971c5f5d081e03c6f40270deae6b5a943b2b1872fc782908'], ['14', '95548d0bd1caed43b01449d80451e88de12e52c1c375e112286f54f3a7037cce']]) {
      const button = page.locator('[data-e108-photo="' + n + '"]'); await instrument(button); await button.tap();
      const image = page.locator('#e108-photo-full'); await image.evaluate(el => el.decode());
      ensure(await image.evaluate(el => el.naturalWidth === 2976 && el.naturalHeight === 3968 && getComputedStyle(el).transform === 'none'), 'Native dimensions/orientation failed');
      ensure((await page.locator('#e108-photo-title').innerText()).includes(n + '.jpg'), 'Wrong photo');
      const bytes = await context.request.get(origin + '/archives/media/draft/' + hash + '.jpg');
      ensure(bytes.status() === 200 && sha(await bytes.body()) === hash, 'Exact selected image changed');
      await page.locator('[data-e108-native]').tap();
      ensure(await image.evaluate(el => Math.round(el.getBoundingClientRect().width) === 2976), 'Native zoom failed');
      await page.screenshot({ path: resolve(run, 'view-' + n + '-native-mobile.png') });
      if (n === '13') await page.locator('[data-e108-close]').tap(); else await page.keyboard.press('Escape');
      ensure(await button.evaluate(el => document.activeElement === el) && !await page.locator('#e108-photo-dialog').evaluate(el => el.open), 'Close/focus failed');
      stages.push({ photo: n, native_bytes_exact: true, display_dimensions: [2976,3968], trusted_touch_open: true, focus_return: true });
    }
    await page.locator('#catalogue-query').fill('13.jpg');
    const search = page.locator('#catalogue-search button[type="submit"]'); await search.scrollIntoViewIfNeeded(); await instrument(search);
    await search.tap(); await page.waitForURL(url => url.searchParams.get('query') === '13.jpg'); await ready();
    ensure(await page.locator('#catalogue-results > .catalogue-card').count() === 1 && !await page.locator('[data-ensemble-card]').count(), 'Partial query did not keep one result');
    await human(); await page.screenshot({ path: resolve(run, 'partial-search-mobile.png') });
    ensure(touches.filter(e => e.trusted && e.type === 'touch').length >= 4 && !errors.length && !denied.length, 'Trusted touch/errors/request gate failed');
    await writeFile(resolve(run, 'verification.json'), JSON.stringify({ passed: true, package: 'v27', stages, touches, errors, denied, new_posts: 0, prior_11_12_not_retested: true, physical_device_claim: false, hosted_platform_qualified: false }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, new_photos: 2, visible_photos: 25, partial_query_cards: 1, new_posts: 0 }));
  } catch (e) {
    await page.screenshot({ path: resolve(run, 'failure.png'), fullPage: true }).catch(() => {});
    await writeFile(resolve(run, 'failure.json'), JSON.stringify({ passed: false, message: e.message, stages, touches, errors, denied }, null, 2) + '\n', { flag: 'wx' }); throw e;
  } finally { await context.close(); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
