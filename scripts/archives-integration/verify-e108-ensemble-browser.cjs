const { chromium } = require('playwright');
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const { resolve } = require('node:path');
(async () => {
  const origin = process.env.ARCHIVE_E108_ORIGIN || 'http://127.0.0.1:8830';
  const run = resolve('.private/archives-integration/' + (process.env.ARCHIVE_E108_RUN || 'e108-integrated-browser-20261004-v1'));
  await mkdir(run);
  const contract = JSON.parse(await readFile('.private/archives-next-readings/e108-touch-shortcut-20261004-v1/integration-contract.json'));
  const folder = contract.folder;
  const ensure = (ok, message) => { if (!ok) throw Error(message); };
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), denied = [], errors = [], stages = [], events = [];
  await page.exposeFunction('__recordE108Event', event => events.push(event));
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET' || url.origin !== origin || request.resourceType() === 'image') { denied.push({ path: url.pathname, method: request.method(), type: request.resourceType() }); return route.abort(); }
    return route.continue();
  });
  const partial = origin + '/archives/catalogue/?' + new URLSearchParams({ folder, query: '11.jpg' });
  const ready = async () => page.waitForFunction(() => document.getElementById('catalogue-results')?.getAttribute('aria-busy') === 'false');
  const checkGroup = async () => {
    await page.locator('#ensemble-e108-11-14').waitFor(); await ready();
    const group = page.locator('#ensemble-e108-11-14');
    ensure(await group.locator('.ensemble-views h4').allTextContents().then(values => values.join('|') === ['11', '12', '13', '14'].map(n => `Vue ${n} · ${n}.jpg`).join('|')), 'Four exact ordered filenames missing.');
    ensure(await group.innerText().then(text => text.includes('Même acte probable, à confirmer')), 'Uncertainty missing.');
    ensure(await page.locator('#catalogue-results > .catalogue-card').count() === 17, 'Partial page filled or wrong group size.');
    ensure(new URL(page.url()).hash === '#ensemble-e108-11-14' && !new URL(page.url()).searchParams.get('query'), 'Search reset/hash missing.');
    ensure(await group.evaluate(el => document.activeElement === el), 'Group focus missing.');
    await group.locator('summary').tap();
    ensure(!/\bCLEAN\b|[a-f0-9]{64}|object:path-|\bSHA(?:-256)?\b/u.test(await page.locator('body').innerText()), 'Technical metadata displayed.');
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow.');
  };
  try {
    const response = await page.goto(partial); await ready();
    ensure(response.status() === 200 && !/unsafe-inline|unsafe-eval/u.test(response.headers()['content-security-policy']), 'Query response/CSP failed.');
    ensure(await page.locator('#catalogue-results > .catalogue-card').count() === 1 && !await page.locator('[data-ensemble-card]').count(), 'Partial result incorrectly completed.');
    const link = page.locator('#e108-ensemble-link'); await link.scrollIntoViewIfNeeded();
    const box = await link.boundingBox(); ensure(box.height >= 44, 'Hitbox below minimum.');
    await page.evaluate(() => { for (const type of ['pointerdown', 'pointerup', 'click']) document.getElementById('e108-ensemble-link').addEventListener(type, event => window.__recordE108Event({ type: event.type, trusted: event.isTrusted, pointer: event.pointerType })); });
    const eventsPromise = page.waitForURL(url => url.hash === '#ensemble-e108-11-14');
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await eventsPromise;
    ensure(events.some(event => event.type === 'pointerdown' && event.trusted && event.pointer === 'touch'), 'Native trusted touch not observed.');
    await checkGroup();
    await page.screenshot({ path: resolve(run, 'e108-touch-mobile.png') });
    stages.push({ action: 'center_trusted_touch', events, cards: 17, members: 4, partial_before: 1, focus_and_search_reset: true });
    await page.goto(partial); await ready(); await page.locator('#e108-ensemble-link').focus();
    await Promise.all([page.waitForURL(url => url.hash === '#ensemble-e108-11-14'), page.keyboard.press('Enter')]);
    await checkGroup(); stages.push({ action: 'keyboard_enter', cards: 17, members: 4, focus_and_search_reset: true });
    const h07 = await context.request.get(origin + '/assets/archives-hierarchy.js');
    ensure((await h07.text()).includes('const fileReadingRoutes = Object.freeze(') && (await h07.text()).includes("'Lire les transcriptions'"), 'H07 client actions lost.');
    ensure(!denied.length && !errors.length, 'Unexpected requests or page errors.');
    await writeFile(resolve(run, 'verification.json'), JSON.stringify({ passed: true, origin, viewport: 390, stages, h07_hooks_preserved: true, errors, denied, posts: 0, images_opened: 0 }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, trusted_touch_and_enter: true, exact_members: 4, posts: 0 }));
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
