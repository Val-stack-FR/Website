const { chromium } = require('playwright');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const ensure = (ok, message) => { if (!ok) throw Error(message); };
(async () => {
  const origin = process.env.ARCHIVE_HUMAN_ORIGIN || 'http://127.0.0.1:8830';
  const run = resolve('.private/archives-integration/' + (process.env.ARCHIVE_HUMAN_RUN || 'publication-human-metadata-browser-20261004-v1'));
  await mkdir(run);
  const version = process.env.ARCHIVE_HUMAN_VERSION || 'v15';
  const surfaceVersion = version.replace(/-r\d+$/u, '');
  const assembly = JSON.parse(await readFile('.private/archives-integration/publication-package-20261004-' + version + '/assembly.json'));
  const file = Object.keys(assembly.files).find(name => name.startsWith('dist/archives/textes/fichier/') && name.endsWith('/index.html'));
  ensure(file, 'Selected source page required.');
  const objectId = 'object:path-' + file.split('/').at(-2);
  const first = await (await fetch(origin + '/__catalogue_data?query=E.133&page_size=1')).json();
  const record = first.records[0];
  ensure(record?.digitalObjectId && record.provenance && record.logicalPath, 'Machine catalogue metadata must remain available.');
  const folder = record.logicalPath.slice(0, record.logicalPath.lastIndexOf('/'));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = [], external = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(origin)) external.push(request.url()); });
  await page.route('**/*', route => route.request().resourceType() === 'image' ? route.fulfill({ status: 204 }) : route.request().method() === 'POST' ? route.abort() : route.continue());
  const technical = /\bSHA(?:-256)?\b|[a-f0-9]{64}|(?:object|source|segment|occurrence|fragment|package|reading|text|transcription):[a-z0-9_-]|Objet numérique|Origine de la métadonnée|points de code Unicode|identité non créée|préparation non activée|preparation not activated|transcription filename|\.csv|\bCRS\b/iu;
  const checkPage = async route => {
    const response = await page.goto(origin + route); ensure(response.status() === 200, 'Human route failed: ' + route);
    await page.locator('details').evaluateAll(items => items.forEach(item => { item.open = true; }));
    const body = await page.locator('body').innerText(), match = body.match(technical);
    ensure(!match, 'Visible technical metadata on ' + route + ': ' + match?.[0]);
    checks.push({ route, opened_details: true, visible_machine_metadata: 0 });
  };
  let proof;
  try {
    const routes = ['/archives/', '/' + file.slice(5).replace(/index\.html$/, ''), '/archives/texte/?object_id=' + encodeURIComponent(objectId), '/archives/reperes/?q=Tuc%C3%A9', '/archives/formes/', '/archives/next-readings/versions/next-reading-p09-author-pilot/', '/archives/avancement/'];
    if (['v16', 'v17', 'v18', 'v19'].includes(surfaceVersion)) routes.push('/archives/recherche/', '/archives/cartes/extrait/');
    for (const route of routes) await checkPage(route);
    let memoirSearch = null;
    if (['v16', 'v17', 'v18', 'v19'].includes(surfaceVersion)) {
      await page.goto(origin + '/archives/recherche/');
      const links = await page.locator('[data-annex-text-search]').count();
      ensure(links === 10, 'Human name-to-text links lost when hiding memoir metadata.');
      await page.locator('#annex-match').selectOption('contains');
      await page.locator('#annex-query').fill('Tucé');
      await page.locator('#annex-scope').selectOption('name');
      const visible = await page.locator('[data-annex-card]:visible').count();
      ensure(visible > 0 && visible <= 10, 'Memoir name filter failed.');
      ensure(!(await page.locator('body').innerText()).match(technical), 'Memoir metadata returned after filtering.');
      memoirSearch = { name_filter: 'Tucé', matching_cards: visible, source_text_links_retained: links };
    }
    await page.goto(origin + '/archives/'); await page.screenshot({ path: resolve(run, 'main-mobile.png') });
    await page.goto(origin + '/archives/catalogue/?' + new URLSearchParams({ folder, page_size: '20' }));
    await page.waitForFunction(() => document.querySelector('#catalogue-results')?.getAttribute('aria-busy') === 'false');
    if (surfaceVersion === 'v19') {
      ensure(await page.locator('#metric-clean').isHidden() && await page.locator('#metric-links').isHidden(), 'Development metrics remain displayed.');
      ensure(await page.locator('[name="collection_scope"]').isHidden(), 'Internal collection scope remains displayed.');
      ensure(!/Consultation privée|inventaire local|Prévisualisation privée|métadonnées seulement/u.test(await page.locator('body').innerText()), 'Development catalogue labels remain displayed.');
    }
    ensure(await page.locator('.catalogue-card details').count() > 0, 'Expected hydrated photograph card.');
    const inspectCards = async stage => {
      await page.locator('.catalogue-card details').evaluateAll(items => items.forEach(item => { item.open = true; }));
      const body = await page.locator('body').innerText(), match = body.match(technical);
      ensure(!match, 'Hydrated catalogue leaked metadata during ' + stage + ': ' + match?.[0]);
      if (version === 'v19-r2') ensure(!/\bCLEAN\b|Chemin dans le classement/u.test(body), 'Internal catalogue paths remain displayed.');
      ensure(await page.locator('#catalogue-error').isHidden(), 'Catalogue client reports an error during ' + stage);
      const labels = await page.locator('.catalogue-card dt').allTextContents();
      ensure(labels.includes('Fichier') && labels.includes('Texte associé'), 'Useful human card labels lost.');
      return { stage, visible_machine_metadata: 0, human_labels: labels };
    };
    const catalogue = [await inspectCards('initial client render')];
    await page.locator('#catalogue-query').fill(record.fileName.literal);
    await Promise.all([page.waitForResponse(response => response.url().includes('/__catalogue_hierarchy?') && response.status() === 200), page.locator('#catalogue-search button[type="submit"]').tap()]);
    await page.waitForFunction(() => document.querySelector('#catalogue-results')?.getAttribute('aria-busy') === 'false');
    catalogue.push(await inspectCards('real search submission'));
    ensure(new URL(page.url()).searchParams.get('query') === record.fileName.literal, 'Search state not retained.');
    await page.screenshot({ path: resolve(run, 'catalogue-mobile.png'), fullPage: true });
    const archiveFolder = record.logicalPath.split('/').slice(0, 2).join('/');
    await page.goto(origin + '/archives/catalogue/?' + new URLSearchParams({ folder: archiveFolder, page_size: '20' }));
    await page.waitForFunction(() => document.querySelector('#catalogue-results')?.getAttribute('aria-busy') === 'false');
    const next = page.locator('button[data-page="next"]'); ensure(await next.isEnabled(), 'Folder pagination fixture must span at least two pages.');
    await Promise.all([page.waitForResponse(response => response.url().includes('/__catalogue_hierarchy?') && response.status() === 200), next.tap()]);
    await page.waitForFunction(() => document.querySelector('#catalogue-results')?.getAttribute('aria-busy') === 'false');
    ensure(new URL(page.url()).searchParams.get('page') === '2', 'Actual folder pagination did not reach second page.');
    ensure(!(await page.locator('body').innerText()).match(technical), 'Folder pagination leaked metadata.');
    catalogue.push({ stage: 'real next-page folder tap', visible_machine_metadata: 0, page: 2 });
    ensure(errors.length === 0 && external.length === 0, 'Browser error or external request.');
    proof = { passed: true, created_at: new Date().toISOString(), origin, checks, catalogue, memoir_search: memoirSearch, machine_json_metadata_preserved: true, prior_photos_requested: false, new_posts: 0, page_errors: errors, external_requests: external };
  } catch (error) {
    proof = { passed: false, error: error.message, checks, page_errors: errors, external_requests: external };
    await page.screenshot({ path: resolve(run, 'failed-state.png'), fullPage: true }).catch(() => {}); process.exitCode = 1;
  } finally { await browser.close(); await writeFile(resolve(run, 'verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' }); }
  console.log(JSON.stringify(proof.passed ? { passed: true, human_surfaces: checks.length, real_search_pagination: true, machine_metadata_kept: true, new_posts: 0 } : proof));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
