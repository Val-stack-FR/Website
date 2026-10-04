const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
(async () => {
  const origin = 'http://127.0.0.1:8830';
  const run = resolve('.private/archives-integration/readable-filenames-browser-20261004-r2');
  await mkdir(run);
  const query = '/archives/reperes/?' + new URLSearchParams({ q: 'Tucé', kind: 'person_name_candidate', match: 'contains' });
  const expected = ["Vue d'ensemble.txt", 'Note E.133.TXT', 'E.108 - 1470 - Louis de Tucé - PARTIEL.txt'];
  const ensure = (ok, message) => { if (!ok) throw Error(message); };
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), denied = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET' || url.origin !== origin) { denied.push({ path: url.pathname, method: request.method() }); return route.abort(); }
    return route.continue();
  });
  try {
    const response = await page.goto(origin + query);
    ensure(response.status() === 200 && !/unsafe-inline|unsafe-eval/u.test(response.headers()['content-security-policy']), 'Query response or CSP failed.');
    await page.locator('main').waitFor();
    for (const summary of await page.locator('details > summary').all()) {
      if (await summary.evaluate(el => !el.parentElement.open)) await summary.tap();
    }
    const fields = await page.locator('dt').evaluateAll(elements => elements.filter(el => el.textContent.trim() === 'Fichier').map(el => el.nextElementSibling?.textContent.trim()));
    ensure(fields.length === expected.length && expected.every(name => fields.includes(name)), 'Three selected filenames missing: ' + JSON.stringify(fields));
    const visible = await page.locator('body').innerText();
    ensure(!/\bCLEAN\b|[a-f0-9]{64}|object:path-|\bSHA(?:-256)?\b/u.test(visible), 'Technical source metadata displayed.');
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow.');
    const links = await page.locator('main a[href]').evaluateAll(elements => elements.map(el => ({ label: el.textContent.trim(), href: el.getAttribute('href') })));
    ensure(links.filter(link => /\/archives\/textes\//u.test(link.href)).length >= 3, 'Historical source links missing.');
    await page.screenshot({ path: resolve(run, 'tuce-query-mobile.png'), fullPage: true });
    ensure(!denied.length && !errors.length, 'Unexpected request or page error.');
    await writeFile(resolve(run, 'verification.json'), JSON.stringify({ passed: true, origin, query, viewport: 390, details_opened: true, filenames: fields, source_links: links.filter(link => /\/archives\/textes\//u.test(link.href)), visible_metadata_absent: true, no_horizontal_overflow: true, errors, denied, new_posts: 0 }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, filenames: fields, real_query: true, new_posts: 0 }));
  } catch (error) {
    await page.screenshot({ path: resolve(run, 'failure-mobile.png'), fullPage: true }).catch(() => {});
    await writeFile(resolve(run, 'failure.json'), JSON.stringify({ passed: false, message: error.message, errors, denied }, null, 2) + '\n', { flag: 'wx' });
    throw error;
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
