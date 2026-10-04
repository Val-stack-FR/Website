import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, realpath, lstat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createAssembledPreview } from './assembled-preview.mjs';
import { guardRequest, loopbackBase } from './media-preview.mjs';
import { settleWipShutdown } from './wip-shutdown.mjs';
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const sha = b => createHash('sha256').update(b).digest('hex');
const { values } = parseArgs({ options: { site: { type: 'string' }, record: { type: 'string' }, 'p09-record': { type: 'string' }, episode: { type: 'string' }, 'previous-episode': { type: 'string' }, origin: { type: 'string', default: 'http://127.0.0.1:8822' }, 'init-p09': { type: 'boolean', default: false } } });
const root = await realpath(resolve('.')), site = await realpath(resolve(values.site));
const record = resolve(values.record), p09Record = resolve(values['p09-record']);
const origin = loopbackBase(values.origin), episode = values.episode;
const previousEpisode = values['previous-episode'];
ensure([record, p09Record].every(p => relative(root, p).startsWith('.private' + sep + 'archives-integration' + sep)) && record !== p09Record && [episode, previousEpisode].every(s => /^[a-z][a-z0-9-]{1,40}$/u.test(s)) && episode !== previousEpisode, 'Distinct owned records, fresh episode and explicit previous episode required.');
const correctionRoot = 'Z:/Codex/repos/Website-archives-corrections';
const d14 = resolve(correctionRoot, '.archive-corrections-private/d14-p09-corrections-ae8f65bb-c7f6-4c90-92f7-6928af6b96cd');
for (const name of ['public-wip/candidate.mjs', 'public-wip/bundle.mjs', 'public-wip/policy.mjs', 'public-wip/mandate.mjs', 'hosted/serverless/store.mjs', 'hosted/serverless/network.mjs']) {
  ensure(sha(await readFile(resolve(correctionRoot, 'scripts/archive-corrections', name))) === sha(await readFile(resolve(site, 'scripts/archive-corrections', name))), 'Monbezon factory differs from packaged selection.');
}
const delta = JSON.parse(await readFile(resolve(d14, 'delta-allowlist.json')));
ensure(delta.file_count === 9 && delta.files.length === 9, 'Exact D14 selection required.');
for (const pin of delta.files) {
  const target = resolve(site, pin.target_relative_path), source = resolve(d14, 'deployment-overlay', pin.target_relative_path);
  ensure(pin.target_relative_path.startsWith('scripts/archive-corrections/public-p09/') && await realpath(source) === source && await realpath(target) === target, 'Unsafe P09 source or selection.');
  const bytes = await readFile(target), author = await readFile(source);
  ensure(bytes.length === pin.bytes && sha(bytes) === pin.sha256 && bytes.equals(author), 'P09 selected source drift.');
}
const [{ pgliteDriver }, { loadDeliveryBundle: loadMonbezon }, { createLocalWip }, { ServerlessStore }, { loadDeliveryBundle: loadP09 }, { createP09Adapter }, { createPublicCorrectionsDispatcher }, { SELECTION }] = await Promise.all([
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/hosted/drivers.mjs')).href),
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/public-wip/bundle.mjs')).href),
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/public-wip/candidate.mjs')).href),
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/hosted/serverless/store.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-p09/bundle.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-p09/adapter.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-p09/dispatcher.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-p09/selection.mjs')).href),
]);
const monBundle = loadMonbezon(resolve(site, 'scripts/archive-corrections/public-wip/delivery-assets'));
const p09Bundle = loadP09(resolve(site, 'scripts/archive-corrections/public-p09/delivery-assets'));
// The frozen generic preview predates browser ES modules. Mirror the four
// explicit deployment MIME headers without expanding its static allowlist.
const browserModules = new Map();
const selectedAssembly = JSON.parse(await readFile(resolve(site, '../assembly.json')));
for (const name of ['selection', 'form-adapter', 'session', 'client']) {
  const route = '/assets/archives-p09-corrections/' + name + '.mjs';
  const file = 'dist' + route, pin = selectedAssembly.files[file];
  ensure(pin, 'Selected browser module required.');
  const bytes = await readFile(resolve(site, file));
  ensure(bytes.length === pin.size_bytes && sha(bytes) === pin.sha256, 'Browser module drift.');
  browserModules.set(route, bytes);
}
const monConfig = JSON.parse(await readFile(resolve(record, 'local-config.json')));
ensure(await realpath(record) === record && monConfig.version === 'root-publication-wip-local/1' && monConfig.origin === origin && monConfig.directory === resolve(record, 'pglite') && monConfig.local_driver_only === true && monConfig.owner_enabled === false, 'Existing Monbezon local configuration drift.');
const priorSnapshotBytes = await readFile(resolve(record, previousEpisode + '-stopped-snapshot.json'));
const priorSnapshot = JSON.parse(priorSnapshotBytes);
ensure(priorSnapshot.revisions.length === 1 && priorSnapshot.decisions.length === 0 && priorSnapshot.revisions[0].text === monBundle.context.initialRevision.text, 'Prior stopped Monbezon snapshot must retain the selected source without decisions.');
const locks = [];
let app, monDriver, p09Driver, monMount, p09Mount, started = false, stopping = false;
const lockRecord = async directory => { const path = resolve(directory, 'local-store.lock'); await writeFile(path, JSON.stringify({ pid: process.pid, episode }), { flag: 'wx' }); locks.push(path); };
const snapshot = async (directory, driver, schema, context, suffix) => {
  const store = new ServerlessStore(driver, { schema, context }); await store.initialize({ seed: false });
  const data = await store.exportSnapshot(), bytes = Buffer.from(JSON.stringify(data, null, 2) + '\n');
  await writeFile(resolve(directory, episode + '-' + suffix + '.json'), bytes, { flag: 'wx' });
  return { bytes: bytes.length, sha256: sha(bytes), revisions: data.revisions.length, proposals: data.proposals.length, decisions: data.decisions.length };
};
let p09Config, priorP09SnapshotBytes;
const snapshots = async suffix => ({
  monbezon: await snapshot(record, monDriver, monConfig.schema, monBundle.context, suffix),
  p09: await snapshot(p09Record, p09Driver, p09Config.schema, p09Bundle.context, suffix),
});
const closeDrivers = async () => {
  const results = await Promise.allSettled([monMount ? monMount.close() : monDriver?.close(), p09Mount ? p09Mount.close() : p09Driver?.close()]);
  ensure(results.every(result => result.status === 'fulfilled'), 'Local store cleanup failed.');
};
const release = async () => {
  const results = await Promise.allSettled(locks.map(path => unlink(path)));
  ensure(results.every(result => result.status === 'fulfilled'), 'Local lock cleanup failed.'); locks.length = 0;
};
const stop = async () => {
  if (stopping) return; stopping = true;
  const result = await settleWipShutdown({ captureSnapshots: () => snapshots('stopped-snapshot'), closeServer: async () => { if (started) await app.close(); }, closeStores: closeDrivers, releaseLocks: release });
  const receipts = await Promise.allSettled([record, p09Record].map(directory => writeFile(resolve(directory, episode + '-stopped.json'), JSON.stringify({ pid: process.pid, ...result, owner_enabled: false, production_configuration_present: false }, null, 2) + '\n', { flag: 'wx' })));
  if (result.resources_closed) process.stdin.pause();
  if (result.clean_shutdown && receipts.every(item => item.status === 'fulfilled')) console.log('Two-profile WIP preview stopped cleanly.');
  else { console.error('Local shutdown incomplete; inspect the private receipt before another mount.'); process.exitCode = 1; }
};
try {
  app = await createAssembledPreview({ sitePath: site, origin });
  await lockRecord(record);
  if (values['init-p09']) {
    try { await lstat(p09Record); throw new Error('Fresh P09 record required.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    await mkdir(p09Record);
    await writeFile(resolve(p09Record, 'local-config.json'), JSON.stringify({ version: 'root-publication-p09-wip-local/1', origin, schema: 'archive_corrections_d5_p09_wip_root', directory: resolve(p09Record, 'pglite'), sessionKey: randomBytes(32).toString('hex'), local_driver_only: true, owner_enabled: false }, null, 2) + '\n', { flag: 'wx' });
  }
  ensure(await realpath(p09Record) === p09Record, 'P09 record reparse refused.');
  p09Config = JSON.parse(await readFile(resolve(p09Record, 'local-config.json')));
  ensure(p09Config.version === 'root-publication-p09-wip-local/1' && p09Config.origin === origin && p09Config.directory === resolve(p09Record, 'pglite') && p09Config.schema === 'archive_corrections_d5_p09_wip_root' && p09Config.schema !== monConfig.schema && p09Config.local_driver_only === true && p09Config.owner_enabled === false, 'Owned P09 local configuration drift.');
  if (!values['init-p09']) {
    priorP09SnapshotBytes = await readFile(resolve(p09Record, previousEpisode + '-stopped-snapshot.json'));
    const previousP09 = JSON.parse(priorP09SnapshotBytes);
    ensure(previousP09.revisions.length === 1 && previousP09.decisions.length === 0 && previousP09.revisions[0].text === p09Bundle.context.initialRevision.text, 'Stopped P09 snapshot must retain the selected source without decisions.');
  }
  await lockRecord(p09Record);
  monDriver = await pgliteDriver(monConfig.directory); p09Driver = await pgliteDriver(p09Config.directory);
  if (values['init-p09']) {
    const store = new ServerlessStore(p09Driver, { schema: p09Config.schema, context: p09Bundle.context });
    const migration = await store.migrate(); await store.initialize({ seed: true });
    await writeFile(resolve(p09Record, 'seed-proof.json'), JSON.stringify({ local_only: true, migration, passage_id: SELECTION.passage_id, edition_id: SELECTION.edition_id, source_text_sha256: SELECTION.body_sha256, human_decisions: 0 }, null, 2) + '\n', { flag: 'wx' });
  }
  monMount = createLocalWip({ driver: monDriver, schema: monConfig.schema, ...monBundle, origin, sessionKey: monConfig.sessionKey });
  p09Mount = createP09Adapter({ driver: p09Driver, schema: p09Config.schema, ...p09Bundle, origin, sessionKey: p09Config.sessionKey, local: true });
  const dispatcher = createPublicCorrectionsDispatcher({ origin, local: true,
    monbezonProvider: async () => ({ ...monMount, profile: 'monbezon-wip', passage_id: monBundle.context.passage.passage_id, context_sha256: '3b831b7be7e0b2ab3ee785a52281249fab733da5d1bbdcbc896973a21c96d655', schema: monConfig.schema }),
    p09Provider: async () => ({ ...p09Mount, schema: p09Config.schema }),
  });
  const readonly = app.server.listeners('request'); ensure(readonly.length === 1, 'Single readonly listener required.');
  app.server.removeListener('request', readonly[0]);
  app.server.on('request', (request, response) => {
    if (typeof request.url === 'string' && request.url.length <= 8192 && request.url.startsWith('/api/archive/public/')) { void dispatcher.handler(request, response); return; }
    if (browserModules.has(request.url)) {
      const guard = guardRequest(request, origin);
      if (!guard.status && !guard.url.search) {
        const bytes = browserModules.get(request.url);
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
        response.end(request.method === 'HEAD' ? undefined : bytes); return;
      }
    }
    void readonly[0](request, response);
  });
  const proof = await snapshots('initial-snapshot');
  ensure(proof.monbezon.sha256 === sha(priorSnapshotBytes) && proof.monbezon.bytes === priorSnapshotBytes.length && proof.monbezon.revisions === 1 && proof.monbezon.proposals === priorSnapshot.proposals.length && proof.monbezon.decisions === 0, 'Existing Monbezon snapshot changed.');
  if (priorP09SnapshotBytes) ensure(proof.p09.sha256 === sha(priorP09SnapshotBytes) && proof.p09.bytes === priorP09SnapshotBytes.length, 'Existing P09 snapshot changed.');
  for (const directory of [record, p09Record]) await writeFile(resolve(directory, episode + '-ready.json'), JSON.stringify({ pid: process.pid, origin, site, snapshots: proof, schema_isolation: true, original_incoming_message: true, exact_d14_packaged_sources: true, hosted_d15_entry_in_package: true, hosted_d15_used_for_local_http: false, explicit_browser_module_mime_headers: 4, local_driver_only: true, production_configuration_present: false, owner_enabled: false, deployed: false }, null, 2) + '\n', { flag: 'wx' });
  console.log(await app.listen()); started = true;
  process.stdin.setEncoding('utf8'); process.stdin.on('data', value => { if (value.trim() === 'stop') void stop(); }); process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());
} catch {
  await settleWipShutdown({ captureSnapshots: async () => null, closeServer: async () => { if (started) await app.close(); }, closeStores: closeDrivers, releaseLocks: release });
  console.error('Two-profile mount refused; inspect private inputs without exposing configuration.'); process.exitCode = 1;
}
