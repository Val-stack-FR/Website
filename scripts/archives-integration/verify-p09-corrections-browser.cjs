const { chromium } = require('playwright');
const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
(async () => {
  const run = resolve('.private/archives-integration/publication-p09-corrections-browser-20261004-v1');
  await mkdir(run);
  const origin = 'http://127.0.0.1:8822', api = origin + '/api/archive/public/p09/';
  const passageUrl = api + 'passage?passage_id=text%3Ap09-full-comparison-r1-proposed';
  const before = await (await fetch(passageUrl)).json();
  ensure(sha(Buffer.from(before.current_revision?.text || '')) === 'd261d924c902540a11b5d3ea3f9b430f037ccfb15a337c640f4129dbe0bee043', 'Selected P09 source unavailable.');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), posts = [], errors = [], external = [], modules = [];
  let firstReceipt;
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(origin)) external.push(request.url()); });
  page.on('response', response => { if (response.url().includes('/assets/archives-p09-corrections/') && response.url().endsWith('.mjs')) modules.push({ url: response.url().slice(origin.length), status: response.status(), type: response.headers()['content-type'] }); });
  await page.route('**/*', route => route.request().resourceType() === 'image' ? route.fulfill({ status: 204 }) : route.continue());
  await page.route('**/api/archive/public/p09/corrections', async route => {
    const request = route.request(), headers = await request.allHeaders();
    const response = await route.fetch(), receipt = await response.json();
    posts.push({ body: request.postData(), key: headers['idempotency-key'], origin: headers.origin, status: response.status(), proposal_id: receipt.proposal?.proposal_id });
    if (posts.length === 1) { firstReceipt = receipt; await route.abort('failed'); }
    else await route.fulfill({ response });
  });
  let proof;
  try {
    await page.goto(origin + '/archives/#next-reading-p09-author-pilot');
    await page.locator('a[href="/archives/corrections/p09/"]').tap();
    await page.waitForURL(origin + '/archives/corrections/p09/');
    const source = page.locator('#p09-correction-source'), replacement = page.locator('#p09-correction-replacement'), reason = page.locator('#p09-correction-reason');
    await page.waitForFunction(() => !document.getElementById('p09-correction-replacement').disabled);
    ensure(await source.textContent() === before.current_revision.text, 'Displayed source text drift.');
    ensure(await page.locator('#p09-correction-french').textContent() === before.passage.proposed_french.text, 'Displayed proposed French drift.');
    await page.locator('#p09-correction-submit').tap();
    ensure(posts.length === 0 && await reason.evaluate(element => !element.checkValidity()), 'Empty reason reached POST.');
    await replacement.fill(before.current_revision.text + '\n[ESSAI TECHNIQUE DU FORMULAIRE — aucune correction historique.]');
    await reason.fill('Essai technique local : vérifier conservation, perte de réponse et rejeu. Aucune lecture historique ni décision humaine proposée.');
    await page.locator('#p09-correction-submit').tap();
    await page.waitForFunction(() => !document.getElementById('p09-correction-retry').hidden);
    ensure(posts.length === 1 && posts[0].status === 201 && firstReceipt.proposal_review_status === 'pending' && firstReceipt.human_decision === false, 'First real pending POST failed.');
    ensure(await replacement.isDisabled() && await reason.isDisabled(), 'Uncertain send remains editable.');
    await page.locator('#p09-correction-retry').tap();
    await page.waitForFunction(() => Boolean(document.getElementById('correction-status').dataset.proposalId));
    ensure(posts.length === 2 && posts[1].status === 200 && posts[0].body === posts[1].body && posts[0].key === posts[1].key && posts[0].proposal_id === posts[1].proposal_id, 'Retry created or changed a proposal.');
    ensure(await page.locator('#correction-status').getAttribute('data-proposal-id') === posts[0].proposal_id, 'UI receipt does not match stored proposal.');
    ensure(await source.textContent() === before.current_revision.text, 'Source changed after proposal.');
    const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    ensure(geometry.scrollWidth <= geometry.width, 'Form overflows mobile viewport.');
    await page.screenshot({ path: resolve(run, 'mobile-p09-pending.png'), fullPage: true });
    await page.locator('a[href="/archives/#next-reading-p09-author-pilot"]').tap();
    await page.waitForURL(origin + '/archives/#next-reading-p09-author-pilot');
    await page.goto(origin + '/archives/corrections/p09/');
    await page.waitForFunction(() => !document.getElementById('p09-correction-replacement').disabled);
    await page.keyboard.press('Tab');
    ensure(await page.evaluate(() => document.activeElement.tagName !== 'BODY'), 'Keyboard focus unavailable.');
    const after = await (await fetch(passageUrl)).json();
    ensure(after.current_revision.text === before.current_revision.text && after.current_revision.text_revision === before.current_revision.text_revision, 'Source revision changed.');
    const ownerStatuses = [];
    for (const route of ['auth/login', 'auth/session', 'auth/logout', 'auth/revoke-all', 'owner/corrections', 'owner/decisions', 'owner/export']) ownerStatuses.push((await fetch(api + route)).status);
    ensure(ownerStatuses.every(status => status === 403), 'P09 owner/auth route enabled.');
    ensure(errors.length === 0 && external.length === 0 && new Set(modules.map(item => item.url)).size === 4 && modules.every(item => item.status === 200 && item.type.startsWith('text/javascript')), 'Browser modules/errors/origins failed.');
    proof = { passed: true, created_at: new Date().toISOString(), actual_local_http_d14_pglite: true, hosted_d15_entry_tested: false, mobile: geometry, exact_diplomatic_lines: 21, exact_french_separate: true, empty_reason_before_post: true, real_post_201: true, deliberate_first_response_loss: true, identical_body_key_retry_200: true, same_proposal_id: posts[0].proposal_id, source_revision_unchanged: true, owner_auth_403: ownerStatuses.length, new_human_decisions: 0, browser_modules: modules, page_errors: errors, external_requests: external, prior_photos_retested: false, persistence_restart_pending: true };
    await writeFile(resolve(run, 'technical-posts.json'), JSON.stringify(posts, null, 2) + '\n', { flag: 'wx' });
  } catch (error) {
    proof = { passed: false, error: error.message, posts: posts.length, page_errors: errors, external_requests: external, persistence_restart_pending: true };
    await page.screenshot({ path: resolve(run, 'failed-state.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await writeFile(resolve(run, 'verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
    await browser.close();
  }
  console.log(JSON.stringify(proof));
})();
