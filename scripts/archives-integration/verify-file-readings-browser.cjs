const { chromium } = require('playwright');
const { readFile, mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const ensure = (ok, message) => { if (!ok) throw Error(message); };
(async () => {
  const origin = process.env.ARCHIVE_FILES_ORIGIN || 'http://127.0.0.1:8830';
  const run = resolve('.private/archives-integration/' + (process.env.ARCHIVE_FILES_RUN || 'publication-file-readings-browser-20261004-v1'));
  await mkdir(run);
  const projection = JSON.parse(await readFile('.private/archives-next-readings/h07-file-library-ui-20261004-v1/reviewed-r2/projection.json'));
  const media = JSON.parse(await readFile('C:/Users/Val/Documents/ChatGPT/PERSO/atelier-tuce/planning/media-release/remise-branchement-e133-e113-20261004-v1.json'));
  const images = new Set(media.files.map(file => origin + file.existing_JPEG.route));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), pageErrors = [], external = [], realPosts = [], checks = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(origin)) external.push(request.url()); });
  await page.route('**/*', route => {
    const request = route.request();
    if (request.method() === 'POST') { realPosts.push(request.url()); return route.abort(); }
    if (request.resourceType() === 'image' && !images.has(request.url())) return route.fulfill({ status: 204 });
    return route.continue();
  });
  const machine = /\bSHA(?:-256)?\b|[a-f0-9]{64}|(?:object|source|fragment|reading|text|transcription):[a-z0-9_-]|\.private|\bCLEAN\b/u;
  let proof;
  try {
    const libraryResponse = await page.goto(origin + '/archives/fichiers/');
    ensure(libraryResponse.status() === 200 && await page.locator('.file-entry').count() === 3, 'Three file entries required.');
    ensure(!machine.test(await page.locator('body').innerText()), 'Library exposes machine metadata.');
    ensure(await page.locator('a[href="/archives/fichiers/p09/"]').count() === 1, 'P09 library entry lost.');
    await page.screenshot({ path: resolve(run, 'library-mobile.png') });
    for (const file of projection.files) {
      const mapping = media.files.find(item => item.file_route === file.route);
      ensure(mapping, 'Exact file/photo mapping required.');
      const folder = 'CLEAN/' + file.archivePath.slice(0, file.archivePath.lastIndexOf('/'));
      await page.goto(origin + '/archives/catalogue/?' + new URLSearchParams({ folder, page_size: '20' }));
      await page.waitForFunction(() => document.querySelector('#catalogue-results')?.getAttribute('aria-busy') === 'false');
      ensure(await page.locator('#catalogue-error').isHidden(), 'Catalogue failed to render.');
      const catalogueLink = page.locator('.catalogue-card a[href="' + file.route + '"]');
      ensure(await catalogueLink.count() === 1, 'Exact file action missing or duplicated.');
      await catalogueLink.tap(); await page.waitForURL(origin + file.route);
      ensure((await page.locator('h1').innerText()) === file.filename, 'Wrong source file opened.');
      const observed = {};
      for (const edition of ['first-draft', 'rereading', 'modern-french']) {
        const expected = file.sections.flatMap(section => section.versions[edition].flatMap(version => version.lines.map(line => ({ text: line.text, number: String(line.number).padStart(2, '0') }))));
        await page.locator('[data-file-tab="' + edition + '"]').tap();
        const panel = page.locator('[data-file-panel="' + edition + '"]');
        ensure(await panel.isVisible(), 'Selected edition hidden.');
        const actual = await panel.locator('.transcription-line').evaluateAll(lines => lines.map(line => ({ text: line.querySelector('[data-source-text]').textContent, number: line.querySelector('.line-label').textContent })));
        ensure(JSON.stringify(actual) === JSON.stringify(expected), 'Source text or local numbering changed.');
        observed[edition] = actual.length;
      }
      await page.locator('[data-file-tab="rereading"]').tap();
      const point = file.points[3]; ensure(point, 'A collapsed point is required for this integration check.');
      const trigger = page.locator('#' + point.lineId + ' [data-point-target]');
      await trigger.tap(); ensure(await page.locator('#' + point.id).isVisible(), 'Line did not reveal its collapsed difficulty.');
      await page.locator('#' + point.id + ' [data-review-target]').tap();
      ensure(new URL(page.url()).hash === '#' + point.lineId && await page.locator('#' + point.lineId).isVisible(), 'Return to exact local line failed.');
      if (!await page.locator('.remaining-points').evaluate(element => element.open)) await page.locator('.remaining-points summary').tap();
      const body = await page.locator('body').innerText();
      ensure(!machine.test(body) && body.includes('Cadrage à préparer'), 'Metadata leaked or missing crops presented as ready.');
      ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile horizontal overflow.');
      await page.locator('h1').scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve(run, file.slug + '-mobile.png') });
      const photo = page.locator('.file-photo-link');
      ensure(await photo.getAttribute('href') === mapping.existing_JPEG.route, 'Wrong selected photo link.');
      await photo.tap(); await page.waitForURL(origin + mapping.existing_JPEG.route);
      await page.waitForFunction(() => [...document.images].some(image => image.complete && image.naturalWidth > 0));
      await page.goBack(); await page.locator('h1').waitFor();
      ensure(new URL(page.url()).pathname === file.route, 'Browser return from photo failed.');
      await page.locator('.file-nav a[href="/archives/fichiers/"]').tap(); await page.waitForURL(origin + '/archives/fichiers/');
      checks.push({ file: file.slug, real_catalogue_tap: true, editions_and_local_lines_exact: observed, collapsed_point_and_exact_line_return: true, selected_photo_open_and_return: true, visible_machine_metadata: 0 });
    }
    ensure(!pageErrors.length && !external.length && !realPosts.length, 'Browser error, external request or POST detected.');
    proof = { passed: true, created_at: new Date().toISOString(), origin, checks, source_photos_only: 2, original_photo_qualification_not_replayed: true, page_errors: pageErrors, external_requests: external, real_posts: realPosts };
  } catch (error) { proof = { passed: false, error: error.message, checks, page_errors: pageErrors, external_requests: external, real_posts: realPosts }; }
  finally { await browser.close(); }
  await writeFile(resolve(run, 'verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(proof.passed ? { passed: true, files: checks.length, real_catalogue_photo_line_paths: true, new_posts: 0 } : proof));
  if (!proof.passed) process.exitCode = 1;
})();
