import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const base = resolve('.private/archives-integration'), mon = resolve(base, 'publication-wip-local-20261004-v1'), p09 = resolve(base, 'publication-p09-wip-local-20261004-v1');
const previous = 'eighth-v13-r2-p09-corrections', current = 'ninth-v13-r2-p09-persistence';
const ready = JSON.parse(await readFile(resolve(p09, current + '-ready.json')));
const preserved = {};
for (const [name, directory] of [['monbezon', mon], ['p09', p09]]) {
  const stopped = await readFile(resolve(directory, previous + '-stopped-snapshot.json'));
  const initial = await readFile(resolve(directory, current + '-initial-snapshot.json'));
  ensure(stopped.equals(initial), 'Snapshot changed across actual shutdown/restart.');
  const data = JSON.parse(initial);
  ensure(data.revisions.length === 1 && data.proposals.length === 1 && data.decisions.length === 0, 'One technical proposal/revision and zero decisions required.');
  preserved[name] = { bytes: initial.length, sha256: sha(initial), proposals: data.proposals.length, revisions: 1, decisions: 0 };
}
const browser = JSON.parse(await readFile(resolve(base, 'publication-p09-corrections-browser-20261004-v1/verification.json')));
const p09Data = JSON.parse(await readFile(resolve(p09, current + '-initial-snapshot.json')));
ensure(browser.passed && p09Data.proposals[0].proposal_id === browser.same_proposal_id, 'Actual browser proposal not preserved.');
const checks = [];
for (const [route, status] of [
  ['/archives/', 200], ['/archives/corrections/p09/', 200], ['/archives/formes/p09/', 200],
  ['/api/archive/public/p09/health', 200], ['/api/archive/public/monbezon/health', 200],
  ['/api/archive/public/p09/owner/decisions', 403], ['/ops/provision-archive-runtime.mjs', 404],
]) {
  const response = await fetch('http://127.0.0.1:8822' + route);
  ensure(response.status === status, 'Post-restart route failed.'); checks.push({ route, status });
}
const source = await (await fetch('http://127.0.0.1:8822/api/archive/public/p09/passage?passage_id=text%3Ap09-full-comparison-r1-proposed')).json();
ensure(sha(Buffer.from(source.current_revision.text)) === 'd261d924c902540a11b5d3ea3f9b430f037ccfb15a337c640f4129dbe0bee043', 'Post-restart selected source changed.');
const proof = { passed: true, created_at: new Date().toISOString(), site: ready.site, actual_shutdown_restart: true, byte_identical_snapshots: preserved, browser_proposal_id_preserved: browser.same_proposal_id, checks, new_posts: 0, new_images_requested: 0, source_revision_unchanged: true, owner_enabled: false, hosted_pg_tls_tested: false, deployed: false };
await writeFile(resolve(p09, 'v13-r2-transition-verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ passed: true, real_shutdown_restart: true, preserved_proposals: 2, decisions: 0, new_posts: 0, routes: checks.length }));
