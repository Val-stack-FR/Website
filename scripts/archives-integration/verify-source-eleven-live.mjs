import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const base = resolve('.private/archives-integration');
const root = resolve(base, 'publication-package-20261004-v28');
const assemblyBytes = await readFile(resolve(root, 'assembly.json'));
const assembly = JSON.parse(assemblyBytes);
const out = resolve(base, 'publication-source-eleven-live-20261004-r2');
await mkdir(out);
const records = {}, requests = [];
try {
  for (const [name, directory] of [['monbezon', 'publication-wip-local-20261004-v1'], ['p09', 'publication-p09-wip-local-20261004-v1']]) {
    const before = await readFile(resolve(base, directory, 'nineteenth-v27-four-photos-stopped-snapshot.json'));
    const after = await readFile(resolve(base, directory, 'twentieth-v28-source-eleven-initial-snapshot.json'));
    ensure(before.equals(after), 'Editorial state changed: ' + name);
    const state = JSON.parse(after);
    records[name] = { bytes: after.length, sha256: sha(after), proposals: state.proposals.length, revisions: state.revisions.length, decisions: state.decisions.length };
  }
  const origin = 'http://127.0.0.1:8822';
  const id = '81f2195b2dd92184859c2301a8da2f1126c3b7e25cdf8b1d1f6684029fa66a45';
  const routes = ['/archives/fichiers/', '/archives/avancement/', '/archives/fichiers/e108-vue-11/passage-en-cours/', '/archives/fichiers/e108-vue-11/passage-en-cours/extrait.png', '/assets/archives-e108-eleven-reader.css', '/assets/archives-e108-eleven-reader.js', '/assets/archives-e108-eleven-link.css', '/archives/textes/fichier/' + id + '/', '/archives/textes/fichier/79c3e538cf1042fd914e8ebd3115afc9fddd5c7f3d09288effe8e3a12234ae84/'];
  for (const route of routes) {
    const response = await fetch(origin + route), bytes = Buffer.from(await response.arrayBuffer());
    const pin = assembly.files['dist' + route + (route.endsWith('/') ? 'index.html' : '')];
    ensure(response.status === 200 && pin && sha(bytes) === pin.sha256, 'Live selected bytes changed: ' + route);
    ensure(!/unsafe-inline|unsafe-eval/u.test(response.headers.get('content-security-policy') || ''), 'CSP changed');
    if (route.endsWith('.js')) ensure(response.headers.get('content-type').includes('javascript'), 'Wrong MIME');
    requests.push({ route, status: response.status, selected_bytes_exact: true });
  }
  for (const route of ['/archives/texte/?object_id=object:path-' + id, '/archives/catalogue/', '/archives/catalogue/?query=11.jpg']) {
    const response = await fetch(origin + route), html = await response.text();
    ensure(response.status === 200, 'Dynamic route failed');
    if (route.startsWith('/archives/texte/')) ensure(html.includes('data-human-meta="source-logical-path"') && html.includes('data-source-file-context="e108-folder"'), 'Human source hook missing');
    else ensure(html.includes('/archives/fichiers/e108-vue-11/passage-en-cours/') && html.includes('e108-ensemble-template'), 'Reader or ensemble hook missing');
    requests.push({ route, status: 200, new_projection_present: true });
  }
  const hidden = await fetch(origin + '/.private/archives-integration/publication-source-eleven-live-20261004-r2/verification.json');
  ensure(hidden.status === 404, 'Private proof exposed');
  const proof = { passed: true, package: 'v28', assembly_sha256: sha(assemblyBytes), before: 'nineteenth-v27-four-photos', after: 'twentieth-v28-source-eleven', records, requests, private_route: 404, new_posts: 0, prior_failed_verifier_preserved: true };
  await writeFile(resolve(out, 'verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ passed: true, static_gets: routes.length, dynamic_gets: 3, stores_identical: true, new_posts: 0 }));
} catch (error) {
  await writeFile(resolve(out, 'failure.json'), JSON.stringify({ passed: false, message: error.message, records, requests }, null, 2) + '\n', { flag: 'wx' });
  throw error;
}
