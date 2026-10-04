const { chromium } = require('playwright');
const { mkdir, writeFile, readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
(async () => {
  const origin = process.env.ARCHIVE_CONTEXT_ORIGIN || 'http://127.0.0.1:8830';
  const run = resolve('.private/archives-integration/' + (process.env.ARCHIVE_CONTEXT_RUN || 'h07-context-crops-browser-20261004-v1'));
  const ensure = (ok, message) => { if (!ok) throw Error(message); };
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const mapping = JSON.parse(await readFile('Z:/Codex/repos/PHD-Maine-archives-import/data/private/media-release/h07-two-word-context-crops-20261004-v1/crop-point-route-map.json'));
  const cases = [
    { slug: 'e133-page-1', point: 'point-2', line: 'rereading-passage-0-line-2', source: mapping.records[0] },
    { slug: 'e113-marge-1', point: 'point-4', line: 'rereading-passage-0-line-3', source: mapping.records[1] },
  ];
  await mkdir(run);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), denied = [], errors = [], rows = [];
  let posts = 0;
  const machine = /\bSHA(?:-256)?\b|[a-f0-9]{64}|(?:object|fragment|reading|transcription):[a-z0-9_-]|\.private|\bCLEAN\b/u;
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET') { posts++; return route.abort(); }
    if (url.origin !== origin || (request.resourceType() === 'image' && !cases.some(row => row.source.proposed_public_crop_route === url.pathname))) {
      denied.push({ url: url.pathname, type: request.resourceType() }); return route.abort();
    }
    return route.continue();
  });
  try {
    for (const row of cases) {
      const route = '/archives/fichiers/' + row.slug + '/';
      const response = await page.goto(origin + route);
      ensure(response.status() === 200 && !/unsafe-inline|unsafe-eval/u.test(response.headers()['content-security-policy']), 'File/CSP failed.');
      const sourceHtml = await response.text();
      ensure(!/<style\b|\sstyle=|\son\w+=|<script\b(?![^>]*\bsrc=)/iu.test(sourceHtml), 'Inline executable payload.');
      const targetLink = page.locator('#' + row.line + ' [data-point-target]');
      await targetLink.scrollIntoViewIfNeeded(); await targetLink.tap();
      if (new URL(page.url()).hash !== '#' + row.point) await page.locator('#' + row.point).scrollIntoViewIfNeeded();
      const target = page.locator('#' + row.point), image = target.locator('img');
      await target.scrollIntoViewIfNeeded();
      await image.evaluate(img => img.decode());
      const dimensions = await image.evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight, rendered: img.getBoundingClientRect().width }));
      ensure(dimensions.width === row.source.crop_dimensions[0] && dimensions.height === row.source.crop_dimensions[1] && dimensions.rendered <= 390, 'Native crop dimensions or fit failed.');
      ensure(await target.locator('.point-quote').innerText() === row.source.exact_candidate, 'Wrong point quote.');
      ensure(!await target.innerText().then(text => text.includes('Cadrage à préparer')), 'Selected context still marked missing.');
      ensure(!machine.test(await page.locator('body').innerText()), 'Visible technical metadata.');
      ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow.');
      ensure(await page.locator('#' + row.line + ' [data-source-text]').innerText() === row.source.text_context_exact, 'Transcription changed.');
      const crop = await context.request.get(origin + row.source.proposed_public_crop_route);
      ensure(crop.status() === 200 && hash(await crop.body()) === row.source.crop_sha256, 'Served crop bytes changed.');
      await page.screenshot({ path: resolve(run, row.slug + '-point-mobile.png') });
      await Promise.all([
        page.waitForURL(url => url.pathname === row.source.proposed_public_crop_route),
        target.getByRole('link', { name: 'Voir l’extrait en grand' }).tap(),
      ]);
      ensure(new URL(page.url()).pathname === row.source.proposed_public_crop_route, 'Crop open failed.');
      await page.goBack();
      await page.locator('#' + row.point + ' [data-review-target]').tap();
      ensure(new URL(page.url()).hash === '#' + row.line && await page.locator('#' + row.line).evaluate(el => document.activeElement === el), 'Exact line return/focus failed.');
      rows.push({ file: row.slug, native_crop_exact: true, source_line_exact: true, image_fit_mobile: true, tap_open_and_line_return: true, visible_machine_metadata: 0 });
    }
    ensure(!posts && !errors.length && !denied.length, 'Unexpected requests/errors.');
    await writeFile(resolve(run, 'verification.json'), JSON.stringify({ passed: true, origin, viewport: 390, cases: rows, posts, denied, errors }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, context_crops: rows.length, posts: 0 }));
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
