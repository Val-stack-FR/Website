import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: Object.fromEntries(['package', 'before', 'after', 'run'].map(name => [name, { type: 'string' }])) });
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
ensure(/^v\d+(?:-r\d+)?$/.test(values.package || '') && [values.before, values.after, values.run].every(name => /^[a-z][a-z0-9-]{1,60}$/.test(name || '')), 'Explicit bounded transition required');
const base = resolve('.private/archives-integration'), root = resolve(base, 'publication-package-20261004-' + values.package), out = resolve(base, values.run);
await mkdir(out);
const assemblyBytes = await readFile(resolve(root, 'assembly.json')), assembly = JSON.parse(assemblyBytes), origin = 'http://127.0.0.1:8822', records = {}, requests = [];
try {
  for (const [name, directory] of [['monbezon', 'publication-wip-local-20261004-v1'], ['p09', 'publication-p09-wip-local-20261004-v1'], ['e108', 'publication-e108-source-wip-local-20261004-v1']]) {
    const folder = resolve(base, directory), stopped = await readFile(resolve(folder, values.before + '-stopped-snapshot.json')), resumed = await readFile(resolve(folder, values.after + '-initial-snapshot.json'));
    ensure(JSON.parse(await readFile(resolve(folder, values.before + '-stopped.json'))).clean_shutdown && stopped.equals(resumed), 'Store was not preserved at transition: ' + name);
    const state = JSON.parse(resumed);
    records[name] = { bytes: resumed.length, sha256: sha(resumed), revisions: state.revisions.length, proposals: state.proposals.length, decisions: state.decisions.length, transition_byte_exact: true };
  }
  const id = '81f2195b2dd92184859c2301a8da2f1126c3b7e25cdf8b1d1f6684029fa66a45';
  const routes = ['/archives/fichiers/', '/archives/avancement/', '/archives/fichiers/e108-vue-12/passage-en-cours/', '/assets/archives-e108-twelve-reader.js', '/assets/e108-source-corrections.mjs', '/archives/fichiers/e108-vue-11/', '/archives/textes/fichier/' + id + '/corrections/'];
  for (const route of routes) {
    const response = await fetch(origin + route), bytes = Buffer.from(await response.arrayBuffer()), pin = assembly.files['dist' + route + (route.endsWith('/') ? 'index.html' : '')];
    ensure(response.status === 200 && pin && sha(bytes) === pin.sha256 && bytes.length === pin.size_bytes, 'Selected live bytes differ: ' + route);
    const csp = response.headers.get('content-security-policy'); ensure(csp && !/unsafe-inline|unsafe-eval/.test(csp), 'CSP failed');
    if (/\.(?:mjs|js)$/.test(route)) ensure(response.headers.get('content-type')?.includes('javascript'), 'Script MIME failed');
    requests.push({ route, status: 200, selected_bytes_exact: true });
  }
  for (const route of ['/archives/catalogue/?query=12.jpg', '/archives/texte/?object_id=object:path-' + id]) {
    const response = await fetch(origin + route), html = await response.text();
    ensure(response.status === 200 && (route.startsWith('/archives/texte/') ? html.includes('/corrections/') : html.includes('/archives/fichiers/e108-vue-12/passage-en-cours/')), 'Dynamic projection failed');
    requests.push({ route, status: 200, projection_present: true });
  }
  for (const profile of ['monbezon', 'p09', 'e108-source']) {
    const route = '/api/archive/public/' + profile + '/health', response = await fetch(origin + route), body = await response.json();
    ensure(response.status === 200 && body.reading_confirmed === false && body.owner_access_enabled === false, 'Health/authority drift');
    requests.push({ route, status: 200, owner_disabled: true });
  }
  const query = '?' + new URLSearchParams({ object_id: 'object:path-' + id, text_digital_object_id: 'digital-object:931612c16bd2a9d7b17e9d915f51fb14a63751060084adf37753a07c88200fb4' });
  const response = await fetch(origin + '/api/archive/public/e108-source/history' + query), history = await response.json();
  ensure(response.status === 200 && history.proposals.length === records.e108.proposals && history.revisions.length === records.e108.revisions && history.decisions.length === records.e108.decisions && sha(Buffer.from(history.current_revision.text)) === 'a4e71b7ec9e5f77b780f44447cfc8f761f8179fec753ea1b9cbf84b498997bdb', 'Source/history changed');
  ensure((await fetch(origin + '/.private/archives-integration/' + values.run + '/verification.json')).status === 404, 'Private route exposed');
  await writeFile(resolve(out, 'verification.json'), JSON.stringify({ passed: true, package: values.package, assembly_sha256: sha(assemblyBytes), origin, before: values.before, after: values.after, records, requests, e108_source_exact: true, private_route: 404, new_posts: 0, new_decisions: 0 }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ passed: true, stores_exact: 3, selected_static_gets: routes.length, new_posts: 0 }));
} catch (error) {
  await writeFile(resolve(out, 'failure.json'), JSON.stringify({ passed: false, message: error.message, records, requests }, null, 2) + '\n', { flag: 'wx' }); throw error;
}
