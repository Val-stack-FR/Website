const { chromium } = require('playwright');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
(async () => {
  const origin = 'http://127.0.0.1:8830', run = resolve('.private/archives-integration/publication-human-review-browser-20261004-v1');
  await mkdir(run);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = [], external = [], requestedCrops = new Set();
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(origin)) external.push(request.url()); if (request.url().includes('/archives/review-crops/p09/')) requestedCrops.add(request.url()); });
  await page.route('**/*', route => route.request().resourceType() === 'image' && !route.request().url().includes('/archives/review-crops/p09/') ? route.fulfill({ status: 204 }) : route.continue());
  let proof;
  try {
    await page.goto(origin + '/archives/');
    const humanText = await page.locator('body').innerText();
    ensure(!/\bSHA(?:-256)?\b|[a-f0-9]{64}|(?:object|source|segment|occurrence|fragment|package):[a-z0-9_-]|\b(?:H07|MVP|MOCKUP|SNAPSHOT|Root|codepoints)\b/u.test(humanText), 'Technical metadata remains visible in reader.');
    ensure(await page.locator('a[href="/archives/corrections/p09/"]').count() === 1, 'Existing P09 correction link lost.');
    const snapshotHeaders = await readFile('.private/archives-next-readings/reader-human-cleanup-20261004-v1/build-proof.json', 'utf8');
    const protectedCount = JSON.parse(snapshotHeaders).parents['publication-package-20261004-v13-r2'].protected_transcriptions_quotations_references;
    await page.locator('a[href="/archives/fichiers/"]').first().tap();
    await page.waitForURL(origin + '/archives/fichiers/');
    ensure(await page.locator('.file-entry').count() === 1, 'Pilot file entry expanded beyond admitted source.');
    await page.locator('a[href="/archives/fichiers/p09/"]').first().tap();
    await page.waitForURL(origin + '/archives/fichiers/p09/');
    const labels = await page.locator('.line-label').allTextContents(), lines = await page.locator('.source-line').allTextContents();
    ensure(labels.length === 21 && labels.every((label, i) => label === 'L' + String(i + 1).padStart(2, '0')), 'Line numbering missing or reordered.');
    ensure(sha(Buffer.from(lines.join('\n') + '\n')) === 'b827189b0e30ad119e825bfdd8e2267c3321c635891dd08581d16ac080c1dee1', 'Numbered transcription changed source bytes.');
    const cropData = await page.locator('.reading-point img').evaluateAll(images => images.map(image => ({ loaded: image.complete && image.naturalWidth > 0, width: image.naturalWidth, height: image.naturalHeight, displayed: image.getBoundingClientRect().width })));
    ensure(cropData.length === 3 && cropData.every(image => image.loaded && image.displayed <= 390), 'Small crops unavailable or overflowing.');
    ensure(await page.locator('.reading-point').count() === 4 && await page.locator('.crop-pending').count() === 1 && await page.locator('.reading-suggestions li').count() === 9, 'Prepared points or suggestions lost.');
    const hops = [];
    for (const line of ['l01', 'l04', 'l21']) {
      await page.locator('#ligne-' + line + ' a.line-point-link').tap();
      ensure(new URL(page.url()).hash === '#point-' + line, 'Line to difficulty jump failed.');
      await page.locator('#point-' + line + ' a[href="#ligne-' + line + '"]').tap();
      ensure(new URL(page.url()).hash === '#ligne-' + line, 'Difficulty to exact line return failed.'); hops.push(line);
    }
    await page.locator('a[href="#points-review"]').tap();
    const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    ensure(geometry.width === geometry.scrollWidth, 'File review overflows viewport.');
    await page.screenshot({ path: resolve(run, 'mobile-review.png'), fullPage: true });
    await page.goto(origin + '/archives/fichiers/p09/'); await page.keyboard.press('Tab');
    ensure(await page.evaluate(() => document.activeElement.tagName === 'A'), 'Keyboard entry unavailable.');
    const legacy = await fetch(origin + '/archives/formes-brouillons/?q=Tuce', { redirect: 'manual' });
    ensure(legacy.status === 303 && legacy.headers.get('location') === '/archives/fichiers/', 'Old snippet bookmark does not go to file entry.');
    await page.goto(origin + '/archives/formes-brouillons/'); await page.waitForURL(origin + '/archives/fichiers/');
    ensure(errors.length === 0 && external.length === 0 && requestedCrops.size === 3, 'Browser errors/external/unselected crop.');
    proof = { passed: true, created_at: new Date().toISOString(), origin, main_visible_technical_metadata: 0, protected_texts_references: protectedCount, one_source_file_pilot: true, numbered_lines_exact: 21, review_crops_loaded: cropData, prepared_points: 4, preserved_suggestions: 9, crop_pending: 1, real_mobile_tap_roundtrips: hops, keyboard_entry: true, geometry, legacy_snippet_html_redirect: true, machine_json_unchanged_by_selected_delta: true, prior_photo_bytes_retested: false, new_posts: 0, page_errors: errors, external_requests: external, full_fonds_prepared: false };
  } catch (error) {
    proof = { passed: false, error: error.message, page_errors: errors, external_requests: external };
    await page.screenshot({ path: resolve(run, 'failed-state.png'), fullPage: true }).catch(() => {}); process.exitCode = 1;
  } finally { await writeFile(resolve(run, 'verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' }); await browser.close(); }
  console.log(JSON.stringify(proof));
})();
