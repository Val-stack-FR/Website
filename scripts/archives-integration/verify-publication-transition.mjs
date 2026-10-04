import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: Object.fromEntries(['before', 'after', 'package', 'run'].map(name => [name, { type: 'string' }])) });
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
ensure([values.before, values.after, values.run].every(value => /^[a-z][a-z0-9-]{1,60}$/u.test(value || '')) && /^v\d+(?:-r\d+)?$/u.test(values.package || ''), 'Explicit bounded transition required.');
const base = resolve('.private/archives-integration'), run = resolve(base, values.run);
await mkdir(run);
const packageRoot = resolve(base, 'publication-package-20261004-' + values.package), assembly = JSON.parse(await readFile(resolve(packageRoot, 'assembly.json')));
const records = {};
for (const [name, directory] of [['monbezon', 'publication-wip-local-20261004-v1'], ['p09', 'publication-p09-wip-local-20261004-v1']]) {
  const before = await readFile(resolve(base, directory, values.before + '-stopped-snapshot.json'));
  const after = await readFile(resolve(base, directory, values.after + '-initial-snapshot.json'));
  ensure(before.equals(after), 'Editorial state changed at mount: ' + name);
  const state = JSON.parse(after);
  records[name] = { bytes: after.length, sha256: sha(after), proposals: state.proposals.length, revisions: state.revisions.length, decisions: state.decisions.length };
}
const origin = 'http://127.0.0.1:8822', requests = [];
const selectedRoutes = ['/archives/fichiers/', '/archives/fichiers/e133-page-1/', '/archives/fichiers/e113-marge-1/', '/archives/fichiers/p09/', '/archives/avancement/', '/assets/archives-hierarchy.js', '/assets/archives-p09-corrections/client.mjs', '/assets/archives-p09-corrections/session.mjs', '/assets/archives-integration-corrections.js'];
for (const name of assembly.delta?.added || []) if (name.startsWith('dist/')) selectedRoutes.push(name.slice(4).replace(/\/index\.html$/u, '/'));
for (const route of new Set(selectedRoutes)) {
  const response = await fetch(origin + route), bytes = Buffer.from(await response.arrayBuffer());
  const name = 'dist' + route + (route.endsWith('/') ? 'index.html' : ''), pin = assembly.files[name];
  ensure(response.status === 200 && pin && sha(bytes) === pin.sha256 && bytes.length === pin.size_bytes, 'Live selected route differs: ' + route);
  if (/\.(?:mjs|js)$/u.test(route)) ensure(response.headers.get('content-type').includes('javascript') && response.headers.get('x-content-type-options') === 'nosniff', 'Browser script MIME missing.');
  ensure(!/unsafe-inline|unsafe-eval/u.test(response.headers.get('content-security-policy') || ''), 'CSP weakened.');
  requests.push({ route, status: response.status, selected_bytes_exact: true });
}
if (assembly.readable_lexical_filenames) {
  const route = '/archives/reperes/?' + new URLSearchParams({ q: 'Tucé', kind: 'person_name_candidate', match: 'contains' });
  const response = await fetch(origin + route), html = await response.text();
  const labels = Array.from(html.matchAll(/<dt>Fichier<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gu), match => match[1]);
  const expected = ["Vue d'ensemble.txt", 'Note E.133.TXT', 'E.108 - 1470 - Louis de Tucé - PARTIEL.txt'];
  ensure(response.status === 200 && labels.length === 3 && expected.every(name => labels.includes(name)), 'Live lexical query did not project exact selected filenames.');
  ensure(!labels.some(label => /CLEAN|[\\/]/u.test(label)), 'Storage path remains in visible filename.');
  ensure(!/unsafe-inline|unsafe-eval/u.test(response.headers.get('content-security-policy') || ''), 'Lexical CSP weakened.');
  requests.push({ route, status: response.status, exact_selected_filenames: labels });
}
if (assembly.e108?.query_and_static_response_hook) {
  for (const route of ['/archives/catalogue/', '/archives/catalogue/?query=11.jpg']) {
    const response = await fetch(origin + route), html = await response.text();
    ensure(response.status === 200 && html.split('id="e108-ensemble-template"').length === 2 && html.split('id="e108-ensemble-link"').length === 2, 'Dynamic E108 response hook missing or duplicated.');
    ensure(html.includes('href="/assets/archives-catalogue-ensemble.css"') && html.includes('src="/assets/archives-catalogue-ensemble.js"'), 'Dynamic E108 assets missing.');
    requests.push({ route, status: response.status, e108_response_hook_once: true });
  }
}
const hidden = await fetch(origin + '/.private/archives-integration/' + values.run + '/verification.json');
ensure(hidden.status === 404, 'Private proof route exposed.');
const proof = { passed: true, created_at: new Date().toISOString(), package: values.package, before: values.before, after: values.after, records, requests, private_route: 404, new_posts: 0 };
await writeFile(resolve(run, 'verification.json'), JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ passed: true, live_selected_files_exact: true, correction_records_unchanged: true, new_posts: 0 }));
