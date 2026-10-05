const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { parseArgs } = require('node:util');
const { createHash } = require('node:crypto');

(async () => {
  const { values } = parseArgs({ options: { origin: { type: 'string' }, run: { type: 'string' }, mode: { type: 'string' } } });
  const origin = values.origin, run = resolve(values.run), mode = values.mode;
  const ensure = (ok, message) => { if (!ok) throw Error(message); };
  ensure(['proposal', 'continue', 'restart', 'readonly'].includes(mode), 'Explicit mode required');
  ensure(mode !== 'proposal' || origin === 'http://127.0.0.1:8839', 'Proposal allowed only in Root isolated test');
  await mkdir(run);
  const id = '81f2195b2dd92184859c2301a8da2f1126c3b7e25cdf8b1d1f6684029fa66a45';
  const query = '?object_id=' + encodeURIComponent('object:path-' + id) + '&text_digital_object_id=' + encodeURIComponent('digital-object:931612c16bd2a9d7b17e9d915f51fb14a63751060084adf37753a07c88200fb4');
  const prefix = '/api/archive/public/e108-source/';
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = [], denied = [], stages = [], posts = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || (request.method() !== 'GET' && !(mode === 'proposal' && request.method() === 'POST' && url.pathname === prefix + 'corrections' && posts.length === 0))) {
      denied.push({ method: request.method(), path: url.pathname }); return route.abort();
    }
    if (request.method() === 'POST') posts.push(JSON.parse(request.postData()));
    return route.continue();
  });
  const human = async () => {
    ensure(!/\bCLEAN\b|[a-f0-9]{64}|object:path-|\bSHA(?:-256)?\b/u.test(await page.locator('body').innerText()), 'Technical metadata visible');
    ensure(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflow');
  };
  const getJson = async path => {
    const response = await context.request.get(origin + path); ensure(response.status() === 200, 'GET failed: ' + path);
    return response.json();
  };
  const bindSource = body => {
    ensure(body.current_revision && body.revisions.length === 1 && body.owner_access_enabled === false && body.reading_confirmed === false && (!body.decisions || body.decisions.length === 0), 'Unexpected source/authority');
    ensure(createHash('sha256').update(body.current_revision.text).digest('hex') === 'a4e71b7ec9e5f77b780f44447cfc8f761f8179fec753ea1b9cbf84b498997bdb', 'Source edition changed');
  };
  try {
    if (mode === 'restart') {
      await page.goto(origin + '/archives/textes/fichier/' + id + '/corrections/');
      await page.waitForFunction(() => document.querySelector('#file-line')?.options.length === 27 && document.querySelectorAll('#history-list .proposal').length === 1);
      const history = await getJson(prefix + 'history' + query); bindSource(history);
      ensure(history.proposals.length === 1 && history.proposals[0].reason === 'Essai technique du parcours intégré et de sa persistance ; aucune lecture historique validée.', 'Persisted proposal differs');
      ensure(await page.locator('.source-line').count() === 27, 'File lines changed');
      await human(); await page.screenshot({ path: resolve(run, 'persistent-history-mobile.png'), fullPage: true });
      stages.push('actual stopped/restarted isolated store → same proposal → source edition preserved');
    } else {
      const entry = await page.goto(origin + '/archives/recherche/');
      ensure(entry.status() === 200 && !/unsafe-inline|unsafe-eval/u.test(entry.headers()['content-security-policy'] || ''), 'M2 entry/CSP failed');
      await page.locator('#annex-query').fill('Louis de Tucé');
      const m2Links = page.getByRole('link', { name: 'Chercher « Louis de Tucé » dans les textes', exact: true });
      const m2Targets = await m2Links.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
      ensure(m2Targets.length > 0 && new Set(m2Targets).size === 1, 'M2 links disagree');
      await m2Links.first().tap();
      await page.waitForURL('**/archives/reperes/**');
      const source = page.locator('a[href*="' + id + '"]');
      const choices = await source.evaluateAll(nodes => nodes.filter(node => node.href.includes('81f2195b')).map(node => node.getAttribute('href')));
      ensure(choices.length > 0, 'M2 result does not point to selected source');
      await page.goto(new URL(choices[0], origin).href);
      await page.locator('#preexisting-text').waitFor(); const sourceLiteral = await page.locator('#preexisting-text').innerText();
      await human();
      const formLink = page.locator('a[href="/archives/textes/fichier/' + id + '/corrections/"]');
      ensure(await formLink.count() === 1, 'Source correction link missing/repeated');
      await formLink.tap();
      await page.waitForFunction(() => document.querySelector('#file-line')?.options.length === 27 && !document.querySelector('#submit-proposal').disabled);
      const initial = await getJson(prefix + 'history' + query); bindSource(initial);
      ensure(initial.proposals.length === (mode === 'continue' ? 1 : 0), 'Unexpected source-store proposal count');
      ensure(await page.locator('.source-line').count() === 27, '27 local file lines required');
      const lines = await page.locator('.source-line .line-text').allTextContents();
      ensure(JSON.stringify(lines.map(text => text === '\u00a0' ? '' : text)) === JSON.stringify(initial.current_revision.text.split('\r\n')), 'Displayed source lines differ');
      await human(); stages.push('M2 → lexical result → exact source file → numbered file correction form');
      if (mode === 'proposal') {
        const original = await page.locator('#replacement-line').inputValue();
        await page.locator('#replacement-line').fill(original + ' [essai technique du formulaire]');
        await page.locator('#reason').fill('Essai technique du parcours intégré et de sa persistance ; aucune lecture historique validée.');
        const responsePromise = page.waitForResponse(response => response.url() === origin + prefix + 'corrections' && response.request().method() === 'POST');
        await page.locator('#submit-proposal').tap(); const response = await responsePromise, receipt = await response.json();
        ensure(response.status() === 201 && receipt.human_decision === false && receipt.reading_confirmed === false && receipt.proposal_binding.line_number === 10, 'POST receipt failed');
        await page.waitForFunction(() => document.querySelectorAll('#history-list .proposal').length === 1);
        const history = await getJson(prefix + 'history' + query); bindSource(history);
        ensure(history.proposals.length === 1 && history.proposals[0].proposal_id === receipt.proposal.proposal_id, 'History receipt mismatch');
        await page.locator('#history-list details summary').tap();
        ensure((await page.locator('#history-list pre').innerText()).includes('[essai technique du formulaire]'), 'Proposed version missing');
        await human(); await page.screenshot({ path: resolve(run, 'proposal-history-mobile.png'), fullPage: true });
        stages.push('one technical UI POST → exact receipt → proposed version separate from immutable source');
      }
      await page.goto(origin + '/archives/texte/?object_id=' + encodeURIComponent('object:path-' + id));
      ensure(await page.locator('#preexisting-text').innerText() === sourceLiteral, 'Bookmarked source edition changed');
      await page.locator('[data-source-file-context="e108-folder"] a').tap();
      await page.waitForFunction(() => document.getElementById('catalogue-results')?.getAttribute('aria-busy') === 'false');
      await human(); stages.push('bookmarked source → classified photo folder, without asserted equivalence');
      await page.goto(origin + '/archives/fichiers/');
      ensure(await page.locator('.file-entry').count() === 4, 'Four file journeys changed');
      await page.getByRole('link', { name: 'Ouvrir la vue entière', exact: true }).tap();
      await page.waitForURL('**/archives/fichiers/e108-vue-11/');
      const textAt = id => page.locator('#' + id + ' .line-text').allTextContents();
      const a = [await textAt('full-original-lines'), await textAt('full-modern-lines')];
      ensure(a.every(lines => lines.length === 29), '29 lines required');
      await page.locator('#full-edition').selectOption('B');
      ensure((await textAt('full-original-lines')).length === 29 && (await textAt('full-modern-lines')).length === 29 && (await textAt('full-original-lines'))[13].includes('Moulbettoy'), 'Complete B edition failed');
      await page.locator('#full-edition').selectOption('A');
      ensure(JSON.stringify([await textAt('full-original-lines'), await textAt('full-modern-lines')]) === JSON.stringify(a), 'A edition restoration failed');
      for (const id of ['full-modern-panel', 'full-photo-panel', 'full-original-panel']) {
        await page.locator('[data-full-panel="' + id + '"]').tap();
        ensure(await page.locator('#' + id).evaluate(el => document.activeElement === el && el.getBoundingClientRect().left > -2 && el.getBoundingClientRect().left < innerWidth), 'Horizontal panel focus failed');
      }
      await page.locator('#full-priorities summary').tap();
      for (const [line, width, height] of [['L14',580,150],['L17',430,135]]) {
        const trigger = page.locator('[data-review-context="' + line + '"]'); await trigger.tap();
        await page.locator('#full-context-image').evaluate(image => image.decode());
        ensure(await page.locator('#full-context-image').evaluate((image, dimensions) => image.naturalWidth === dimensions[0] && image.naturalHeight === dimensions[1], [width,height]), 'Native context wrong');
        await page.locator('#context-native').tap();
        ensure(await page.locator('#full-context-image').evaluate((image,width) => Math.round(image.getBoundingClientRect().width) === width, width), 'Native context size failed');
        if(line === 'L14') await page.screenshot({ path: resolve(run, 'small-context-mobile.png') });
        await page.keyboard.press('Escape');
        await page.waitForFunction(line => document.activeElement === document.querySelector('[data-review-context="' + line + '"]') && !document.querySelector('#full-context-dialog').open, line);
      }
      await page.locator('[data-review-line="L29"]').tap();
      ensure(await page.locator('#full-line').inputValue() === 'L29', 'L29 line selection failed');
      await human(); await page.screenshot({ path: resolve(run, 'complete-reader-mobile.png') });
      stages.push('fourth file → complete A/B → horizontal text/modern/photo → minimal L14/L17 contexts → L29 band');
      await page.locator('#full-return').tap();
      await page.waitForFunction(() => document.getElementById('catalogue-results')?.getAttribute('aria-busy') === 'false');
      ensure(await page.locator('#ensemble-e108-11-14 [data-e108-photo]').count() === 4, 'Four-photo return changed');
      ensure(await page.locator('a[href="/archives/fichiers/e108-vue-11/"]').count() === 1, 'Dynamic catalogue complete reader link failed');
      await page.goto(origin + '/archives/avancement/'); await human();
      const board = await page.locator('body').innerText();
      ensure(board.includes('25 photographies sont consultables avec zoom.') && board.includes('29 lignes'), 'Board count/reader changed');
      stages.push('catalogue dynamic projection → exact complete-reader link → public progress');
    }
    ensure(errors.length === 0 && denied.length === 0 && posts.length === (mode === 'proposal' ? 1 : 0), 'Browser/request gate failed');
    const receipt = { passed: true, package: 'v30', origin, mode, stages, errors, denied, new_posts: posts.length, proposal_is_technical_fixture: mode === 'proposal', human_validation: false, owner_enabled: false, mobile_browser_emulation: true, physical_device_claim: false };
    await writeFile(resolve(run, 'verification.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, mode, stages: stages.length, posts: posts.length }));
  } catch (error) {
    await page.screenshot({ path: resolve(run, 'failure.png'), fullPage: true }).catch(() => {});
    await writeFile(resolve(run, 'failure.json'), JSON.stringify({ passed: false, message: error.message, stages, errors, denied, posts: posts.length }, null, 2) + '\n', { flag: 'wx' }); throw error;
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
