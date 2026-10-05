const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = 'Z:/Codex/repos/Website-archives-reader/.private/archives-integration';
const out = path.join(root, 'publication-v33-r2-main-transition-20261004-v1');
const episode = 'twentyfourth-v33-three-files';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const ensure = (ok, text) => { if (!ok) throw new Error(text); };
const pins = [
  ['publication-wip-local-20261004-v1', '6d489e4ce3f9704f396aa32a8ae77cd7874cb8f4e12f8fd737b5f297e715b9c6'],
  ['publication-p09-wip-local-20261004-v1', '2e5b1590fc923e1cbcb214e4fb8057ed9b41de3f7426e5202c35c49053b7a933'],
  ['publication-e108-source-wip-local-20261004-v1', '6347acfab4baeeb525c24e52448f4aef1cc75702e2498fa020dae4902c3d8fac']
];
(async () => {
  fs.mkdirSync(out);
  const snapshots = pins.map(([record, expected]) => {
    const base = path.join(root, record);
    const ready = JSON.parse(fs.readFileSync(path.join(base, episode + '-ready.json')));
    const bytes = fs.readFileSync(path.join(base, episode + '-initial-snapshot.json'));
    ensure(sha(bytes) === expected && ready.site.endsWith('publication-package-20261004-v33-r2\\site'), 'Main binding changed');
    const data = JSON.parse(bytes);
    return {record, sha256: expected, pid: ready.pid, revisions: data.revisions.length, proposals: data.proposals.length, decisions: data.decisions.length};
  });
  const browser = await chromium.launch({channel:'msedge',headless:true});
  let verification;
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    const errors = [], methods = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', request => methods.push(request.method()));
    await page.goto('http://127.0.0.1:8822/archives/avancement/', {waitUntil:'networkidle'});
    const link = page.locator('a[href="/archives/fichiers/e99-p08-droite/passage-en-cours/"]').first();
    ensure(await link.count() === 1, 'E99 link missing');
    await link.click();
    await page.waitForURL('**/e99-p08-droite/passage-en-cours/');
    ensure(await page.locator('#original-lines li').count() === 6 && await page.locator('#modern-lines li').count() === 6, 'Six rows missing');
    await page.locator('#twelve-priorities summary').click();
    await page.locator('button[data-priority-line="R02"]').click();
    await page.locator('#context-native').click();
    ensure(await page.locator('#context-dialog').evaluate(e => e.open), 'Dialog not open');
    const selected = page.locator('#context-dialog [data-context="R02"] img');
    const image = await selected.evaluate(e => ({complete:e.complete,w:e.naturalWidth,h:e.naturalHeight}));
    ensure(image.complete && image.w === 3968 && image.h === 271, 'Native row missing');
    await page.screenshot({path:path.join(out,'mounted-R02-native-mobile.png')});
    ensure(errors.length === 0 && methods.every(m => ['GET','HEAD'].includes(m)), 'Unexpected error or write');
    verification = {passed:true,scope:'Read-only admission of mounted v33-r2 and preserved main stores',episode,main_origin:'http://127.0.0.1:8822',snapshots,steps:['Statusboard E99 link','Six-row reader','R02 native context'],native_image:image,page_errors:errors,POST_count:0,human_decisions:false,historical_confirmation:false,public_deployed:false};
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out,'verification.json'), JSON.stringify(verification,null,2)+'\n');
  console.log(JSON.stringify({passed:verification.passed,proof:out,stores:verification.snapshots.map(s=>({record:s.record,proposals:s.proposals,decisions:s.decisions}))}));
})().catch(e => { console.error(e.message); process.exitCode=1; });
