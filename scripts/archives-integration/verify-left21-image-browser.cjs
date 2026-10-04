const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
(async () => {
  const origin = 'http://127.0.0.1:8830', run = resolve('.private/archives-integration/left21-image-browser-20261004-v1');
  await mkdir(run);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), responses = [];
  page.on('response', response => responses.push({ path: new URL(response.url()).pathname, status: response.status() }));
  try {
    await page.goto(origin + '/archives/fichiers/p09/gauche/reperes/#D21');
    await page.waitForFunction(() => document.documentElement.dataset.activeLine === 'D21');
    await page.locator('#image-display').scrollIntoViewIfNeeded();
    const photo = await page.locator('#image-display image').evaluate(el => ({ href: el.href.baseVal, width: el.width.baseVal.value, height: el.height.baseVal.value }));
    if (photo.href !== '/assets/archives-p09-left21/crop.png' || photo.width !== 2626 || photo.height !== 3300) throw Error('Selected raster dimensions/route differ.');
    await page.waitForFunction(() => [...performance.getEntriesByType('resource')].some(entry => entry.name.endsWith('/assets/archives-p09-left21/crop.png') && entry.responseEnd > 0));
    const reply = await context.request.get(origin + photo.href), bytes = await reply.body();
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (reply.status() !== 200 || hash !== 'eb2564c7bf9996582a40333aaae5d9237d04aa363032079a10973d5fe7b0c4e7') throw Error('Selected served PNG changed.');
    await page.screenshot({ path: resolve(run, 'selected-d21-image-mobile.png') });
    await writeFile(resolve(run, 'verification.json'), JSON.stringify({ passed: true, viewport: 390, selected: 'D21', photo, served_png_sha256: hash, source_loaded_in_browser: true, responses, new_posts: 0 }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, selected_source_loaded: true, native_dimensions: [2626,3300], new_posts: 0 }));
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
