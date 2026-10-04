import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const base = resolve('.private/archives-integration');
const previous = 'ninth-v13-r2-p09-persistence', current = 'tenth-v14-human-review';
const records = { monbezon: resolve(base, 'publication-wip-local-20261004-v1'), p09: resolve(base, 'publication-p09-wip-local-20261004-v1') };
const run = resolve(base, 'publication-human-live-20261004-v1');
await mkdir(run);
const preserved = {};
for (const [name, directory] of Object.entries(records)) {
  const stopped = await readFile(resolve(directory, previous + '-stopped-snapshot.json'));
  const initial = await readFile(resolve(directory, current + '-initial-snapshot.json'));
  ensure(stopped.equals(initial), 'Existing record changed during human UI transition.');
  const data = JSON.parse(initial);
  ensure(data.revisions.length === 1 && data.decisions.length === 0, 'Source revision or decisions changed.');
  preserved[name] = { bytes: initial.length, sha256: sha(initial), proposals: data.proposals.length, revisions: data.revisions.length, decisions: data.decisions.length };
}
const origin = 'http://127.0.0.1:8822', checks = [];
for (const [route, status] of [
  ['/archives/', 200], ['/archives/fichiers/', 200], ['/archives/fichiers/p09/', 200],
  ['/archives/corrections/p09/', 200], ['/api/archive/public/p09/health', 200],
  ['/api/archive/public/monbezon/health', 200], ['/api/archive/public/p09/owner/decisions', 403],
  ['/ops/provision-archive-runtime.mjs', 404], ['/human-cleanup-metadata.json', 404],
]) {
  const response = await fetch(origin + route);
  ensure(response.status === status, 'Live route verification failed: ' + route);
  checks.push({ route, status });
}
const legacy = await fetch(origin + '/archives/formes-brouillons/?q=Tuce', { redirect: 'manual' });
ensure(legacy.status === 303 && legacy.headers.get('location') === '/archives/fichiers/', 'Legacy review route failed.');
const source = await (await fetch(origin + '/api/archive/public/p09/passage?passage_id=text%3Ap09-full-comparison-r1-proposed')).json();
ensure(sha(Buffer.from(source.current_revision.text)) === 'd261d924c902540a11b5d3ea3f9b430f037ccfb15a337c640f4129dbe0bee043', 'P09 source revision changed.');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(), errors = [], external = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (!request.url().startsWith(origin)) external.push(request.url()); });
await page.route('**/*', route => route.request().method() === 'POST' ? route.abort() : route.request().resourceType() === 'image' && !route.request().url().includes('/archives/review-crops/p09/') ? route.fulfill({ status: 204 }) : route.continue());
try {
  await page.goto(origin + '/archives/');
  const human = await page.locator('body').innerText();
  ensure(!/\bSHA(?:-256)?\b|[a-f0-9]{64}|(?:object|source|segment|occurrence|fragment|package):[a-z0-9_-]|\b(?:H07|MVP|MOCKUP|SNAPSHOT|Root|codepoints)\b/u.test(human), 'Technical metadata visible in primary reader.');
  await page.screenshot({ path: resolve(run, 'main-mobile.png') });
  await page.locator('a[href="/archives/fichiers/"]').first().tap();
  await page.waitForURL(origin + '/archives/fichiers/');
  await page.locator('a[href="/archives/fichiers/p09/"]').first().tap();
  await page.waitForURL(origin + '/archives/fichiers/p09/');
  const lines = await page.locator('.source-line').allTextContents();
  ensure(lines.length === 21 && sha(Buffer.from(lines.join('\n') + '\n')) === 'b827189b0e30ad119e825bfdd8e2267c3321c635891dd08581d16ac080c1dee1', 'Human review source lines changed.');
  await page.waitForFunction(() => [...document.querySelectorAll('.reading-point img')].every(image => image.complete && image.naturalWidth > 0));
  const crops = await page.locator('.reading-point img').count(); ensure(crops === 3, 'Expected three precise review crops.');
  await page.locator('#ligne-l04 a.line-point-link').tap();
  ensure(new URL(page.url()).hash === '#point-l04', 'Exact line to image jump failed.');
  await page.locator('#point-l04 a[href="#ligne-l04"]').tap();
  ensure(new URL(page.url()).hash === '#ligne-l04', 'Image to line return failed.');
  ensure(errors.length === 0 && external.length === 0, 'Live browser error or external request.');
  const proof = { passed: true, created_at: new Date().toISOString(), origin, actual_live_transition: true, byte_identical_records: preserved, main_visible_technical_metadata: 0, numbered_lines: lines.length, precise_crops: crops, actual_touch_roundtrip: 'L04', browser_errors: errors, external_requests: external, checks, legacy_html_redirect: true, new_posts: 0, source_revision_unchanged: true, prior_photo_bytes_retested: false, whole_fonds_review_prepared: false, deployed: false };
  await writeFile(resolve(run, 'verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ passed: true, live_human_ui: true, preserved_records: 2, visible_technical_metadata: 0, numbered_lines: 21, crops: 3, new_posts: 0 }));
} finally { await browser.close(); }
