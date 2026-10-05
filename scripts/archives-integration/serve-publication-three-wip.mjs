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
const { values } = parseArgs({ options: {
  site: { type: 'string' }, record: { type: 'string' }, 'p09-record': { type: 'string' }, 'e108-record': { type: 'string' },
  episode: { type: 'string' }, 'previous-episode': { type: 'string' }, 'previous-e108-episode': { type: 'string' }, origin: { type: 'string' }, 'init-e108': { type: 'boolean', default: false }, 'allow-main-origin': { type: 'boolean', default: false },
} });
const root = await realpath(resolve('.')), site = await realpath(resolve(values.site));
const record = resolve(values.record), p09Record = resolve(values['p09-record']), e108Record = resolve(values['e108-record']);
const origin = loopbackBase(values.origin), episode = values.episode, previousEpisode = values['previous-episode'], previousE108Episode = values['previous-e108-episode'];
ensure(new URL(origin).port && (origin !== 'http://127.0.0.1:8822' || values['allow-main-origin'] === true), 'Select an explicit loopback port; origin 8822 requires the root-only opt-in after supervised stop.');
ensure([record, p09Record, e108Record].every(p => relative(root, p).startsWith('.private' + sep + 'archives-integration' + sep))
  && new Set([record, p09Record, e108Record]).size === 3 && [episode, previousEpisode, previousE108Episode].every(s => /^[a-z][a-z0-9-]{1,40}$/u.test(s)) && episode !== previousEpisode && episode !== previousE108Episode,
  'Three distinct owned records, fresh episode and explicit previous episode required.');

const correctionRoot = 'Z:/Codex/repos/Website-archives-corrections';
const e108ReviewRoot = resolve(correctionRoot, '.archive-corrections-private/e108-source-file-correction-mvp-20261004-v1');
const e108Overlay = resolve(e108ReviewRoot, 'deployment-overlay');
const [{ pgliteDriver }, { loadDeliveryBundle: loadMonbezon }, { createLocalWip }, { ServerlessStore }, { loadDeliveryBundle: loadP09 }, { createP09Adapter }, { createPublicCorrectionsDispatcher }, { SELECTION: p09Selection }, { createE108SourceAdapter, seedNewStore, loadExactContext }, { SELECTION: e108Selection }] = await Promise.all([
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/hosted/drivers.mjs')).href),
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/public-wip/bundle.mjs')).href),
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/public-wip/candidate.mjs')).href),
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/hosted/serverless/store.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-p09/bundle.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-p09/adapter.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-p09/dispatcher.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-p09/selection.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-e108-source/adapter.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-e108-source/selection.mjs')).href),
]);
const monBundle = loadMonbezon(resolve(site, 'scripts/archive-corrections/public-wip/delivery-assets'));
const p09Bundle = loadP09(resolve(site, 'scripts/archive-corrections/public-p09/delivery-assets'));
const e108Context = loadExactContext();
ensure(e108Selection.profile === 'e108-source-file-wip' && e108Selection.schema === 'archive_corrections_d5_e108_source_wip' && e108Context.initialRevision.text.split('\r\n').length === 27, 'Exact isolated E108 context required.');

const browserModules = new Map();
const selectedAssembly = JSON.parse(await readFile(resolve(site, '../assembly.json')));
for (const [asset, route] of [
  ['e108-source-corrections.mjs', '/assets/e108-source-corrections.mjs'],
  ['e108-source-selection.mjs', '/assets/e108-source-selection.mjs'],
]) {
  const file = `dist/assets/${asset}`, pin = selectedAssembly.files[file], bytes = await readFile(resolve(site, file));
  ensure(pin && bytes.length === pin.size_bytes && sha(bytes) === pin.sha256, 'Selected E108 browser module drift.'); browserModules.set(route, bytes);
}
for (const name of ['selection', 'form-adapter', 'session', 'client']) {
  const route = `/assets/archives-p09-corrections/${name}.mjs`, file = `dist${route}`, pin = selectedAssembly.files[file], bytes = await readFile(resolve(site, file));
  ensure(pin && bytes.length === pin.size_bytes && sha(bytes) === pin.sha256, 'Selected P09 browser module drift.'); browserModules.set(route, bytes);
}

const monConfig = JSON.parse(await readFile(resolve(record, 'local-config.json')));
ensure(await realpath(record) === record && monConfig.version === 'root-publication-wip-local/1' && monConfig.origin === 'http://127.0.0.1:8822'
  && monConfig.directory === resolve(record, 'pglite') && monConfig.local_driver_only === true && monConfig.owner_enabled === false, 'Existing Monbezon store binding drift.');
const p09Config = JSON.parse(await readFile(resolve(p09Record, 'local-config.json')));
ensure(await realpath(p09Record) === p09Record && p09Config.version === 'root-publication-p09-wip-local/1' && p09Config.origin === 'http://127.0.0.1:8822'
  && p09Config.directory === resolve(p09Record, 'pglite') && p09Config.schema === 'archive_corrections_d5_p09_wip_root' && p09Config.local_driver_only === true && p09Config.owner_enabled === false,
  'Existing P09 store binding drift.');
const priorMonBytes = await readFile(resolve(record, previousEpisode + '-stopped-snapshot.json'));
const priorP09Bytes = await readFile(resolve(p09Record, previousEpisode + '-stopped-snapshot.json'));
const priorMon = JSON.parse(priorMonBytes), priorP09 = JSON.parse(priorP09Bytes);
ensure(priorMon.revisions.length === 1 && priorMon.decisions.length === 0 && priorMon.revisions[0].text === monBundle.context.initialRevision.text, 'Prior Monbezon snapshot drift.');
ensure(priorP09.revisions.length === 1 && priorP09.decisions.length === 0 && priorP09.revisions[0].text === p09Bundle.context.initialRevision.text, 'Prior P09 snapshot drift.');

let e108Config, priorE108SnapshotBytes, priorE108Snapshot;
if (values['init-e108']) {
  try { await lstat(e108Record); throw new Error('E108 initialization only accepts a new store record.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await mkdir(e108Record, { recursive: false });
  e108Config = { version: 'root-publication-e108-source-wip-local/1', origin, schema: e108Selection.schema,
    directory: resolve(e108Record, 'pglite'), sessionKey: randomBytes(32).toString('hex'), local_driver_only: true,
    owner_enabled: false, decisions_enabled: false, seeded_once: false };
  await writeFile(resolve(e108Record, 'local-config.json'), JSON.stringify(e108Config, null, 2) + '\n', { flag: 'wx' });
} else {
  ensure(await realpath(e108Record) === e108Record, 'E108 record reparse refused.');
  e108Config = JSON.parse(await readFile(resolve(e108Record, 'local-config.json')));
  ensure(e108Config.version === 'root-publication-e108-source-wip-local/1' && e108Config.origin === origin && e108Config.directory === resolve(e108Record, 'pglite')
    && e108Config.schema === e108Selection.schema && e108Config.seeded_once === true && e108Config.owner_enabled === false && e108Config.decisions_enabled === false,
    'Existing isolated E108 store binding drift.');
  priorE108SnapshotBytes = await readFile(resolve(e108Record, previousE108Episode + '-stopped-snapshot.json'));
  priorE108Snapshot = JSON.parse(priorE108SnapshotBytes);
  ensure(priorE108Snapshot.revisions.length === 1 && Array.isArray(priorE108Snapshot.proposals) && priorE108Snapshot.decisions.length === 0
    && priorE108Snapshot.revisions[0].text === e108Context.initialRevision.text, 'Prior E108 stopped snapshot drift.');
}

const locks = [];
let app, monDriver, p09Driver, e108Driver, monMount, p09Mount, e108Mount, started = false, stopping = false;
const lockRecord = async directory => { const path = resolve(directory, 'local-store.lock'); await writeFile(path, JSON.stringify({ pid: process.pid, episode }), { flag: 'wx' }); locks.push(path); };
const snapshot = async (directory, driver, schema, context, suffix) => {
  const store = new ServerlessStore(driver, { schema, context }); await store.initialize({ seed: false });
  const data = await store.exportSnapshot(), bytes = Buffer.from(JSON.stringify(data, null, 2) + '\n');
  await writeFile(resolve(directory, `${episode}-${suffix}.json`), bytes, { flag: 'wx' });
  return { bytes: bytes.length, sha256: sha(bytes), revisions: data.revisions.length, proposals: data.proposals.length, decisions: data.decisions.length };
};
const snapshots = async suffix => ({
  monbezon: await snapshot(record, monDriver, monConfig.schema, monBundle.context, suffix),
  p09: await snapshot(p09Record, p09Driver, p09Config.schema, p09Bundle.context, suffix),
  e108: await snapshot(e108Record, e108Driver, e108Config.schema, e108Context, suffix),
});
const closeDrivers = async () => {
  const results = await Promise.allSettled([monMount ? monMount.close() : monDriver?.close(), p09Mount ? p09Mount.close() : p09Driver?.close(), e108Mount ? e108Mount.close() : e108Driver?.close()]);
  ensure(results.every(result => result.status === 'fulfilled'), 'One or more local stores could not be closed.');
};
const release = async () => { const results = await Promise.allSettled(locks.map(path => unlink(path))); ensure(results.every(x => x.status === 'fulfilled'), 'Local lock cleanup failed.'); locks.length = 0; };
const stop = async () => {
  if (stopping) return; stopping = true;
  const result = await settleWipShutdown({ captureSnapshots: () => snapshots('stopped-snapshot'), closeServer: async () => { if (started) await app.close(); }, closeStores: closeDrivers, releaseLocks: release });
  const receipts = await Promise.allSettled([record, p09Record, e108Record].map(directory => writeFile(resolve(directory, `${episode}-stopped.json`), JSON.stringify({ pid: process.pid, ...result, owner_enabled: false, decisions_enabled: false, production_configuration_present: false }, null, 2) + '\n', { flag: 'wx' })));
  if (result.resources_closed) process.stdin.pause();
  if (result.clean_shutdown && receipts.every(x => x.status === 'fulfilled')) console.log('Three-profile WIP preview stopped cleanly.');
  else { console.error('Local shutdown incomplete; inspect private receipts before restart.'); process.exitCode = 1; }
};

try {
  app = await createAssembledPreview({ sitePath: site, origin });
  for (const directory of [record, p09Record, e108Record]) await lockRecord(directory);
  monDriver = await pgliteDriver(monConfig.directory); p09Driver = await pgliteDriver(p09Config.directory); e108Driver = await pgliteDriver(e108Config.directory);
  if (values['init-e108']) {
    const seeded = await seedNewStore(e108Driver, { schema: e108Config.schema });
    ensure(seeded.revisions.length === 1 && seeded.proposals.length === 0 && seeded.decisions.length === 0, 'Fresh one-source E108 seed required.');
    e108Config.seeded_once = true;
    await writeFile(resolve(e108Record, 'seed-proof.json'), JSON.stringify({ schema: e108Config.schema, object_id: e108Selection.object_id, source_sha256: e108Selection.base_text_sha256, source_bytes: 1210, lines: 27, proposals: 0, decisions: 0, seeded_once: true }, null, 2) + '\n', { flag: 'wx' });
    await writeFile(resolve(e108Record, 'local-config.json'), JSON.stringify(e108Config, null, 2) + '\n');
  }
  monMount = createLocalWip({ driver: monDriver, schema: monConfig.schema, ...monBundle, origin, sessionKey: monConfig.sessionKey });
  p09Mount = createP09Adapter({ driver: p09Driver, schema: p09Config.schema, ...p09Bundle, origin, sessionKey: p09Config.sessionKey, local: true });
  e108Mount = createE108SourceAdapter({ driver: e108Driver, schema: e108Config.schema, origin, local: true });
  const dispatcher = createPublicCorrectionsDispatcher({ origin, local: true,
    monbezonProvider: async () => ({ ...monMount, profile: 'monbezon-wip', passage_id: monBundle.context.passage.passage_id, context_sha256: '3b831b7be7e0b2ab3ee785a52281249fab733da5d1bbdcbc896973a21c96d655', schema: monConfig.schema }),
    p09Provider: async () => ({ ...p09Mount, schema: p09Config.schema }),
  });
  const readonly = app.server.listeners('request'); ensure(readonly.length === 1, 'Single readonly listener required.'); app.server.removeListener('request', readonly[0]);
  app.server.on('request', (request, response) => {
    if (typeof request.url === 'string' && request.url.length <= 8192 && request.url.startsWith(e108Selection.prefix)) { void e108Mount.handler(request, response); return; }
    if (typeof request.url === 'string' && request.url.length <= 8192 && request.url.startsWith('/api/archive/public/')) { void dispatcher.handler(request, response); return; }
    if (browserModules.has(request.url)) {
      const guard = guardRequest(request, origin);
      if (!guard.status && !guard.url.search) { const bytes = browserModules.get(request.url); response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" }); response.end(request.method === 'HEAD' ? undefined : bytes); return; }
    }
    void readonly[0](request, response);
  });
  const proof = await snapshots('initial-snapshot');
  ensure(proof.monbezon.sha256 === sha(priorMonBytes) && proof.p09.sha256 === sha(priorP09Bytes), 'Prior Monbezon or P09 store changed.');
  ensure(proof.e108.revisions === 1 && proof.e108.decisions === 0 && (values['init-e108']
    ? proof.e108.proposals === 0
    : proof.e108.proposals === priorE108Snapshot.proposals.length && proof.e108.sha256 === sha(priorE108SnapshotBytes)), 'E108 one-source store or prior snapshot changed.');
  for (const directory of [record, p09Record, e108Record]) await writeFile(resolve(directory, `${episode}-ready.json`), JSON.stringify({ pid: process.pid, origin, site, snapshots: proof, schema_isolation: true, original_incoming_message: true, explicit_e108_prefix_dispatch: true, e108_seeded_only_on_init_flag: true, owner_enabled: false, decisions_enabled: false, production_configuration_present: false, deployed: false }, null, 2) + '\n', { flag: 'wx' });
  console.log(await app.listen()); started = true;
  process.stdin.setEncoding('utf8'); process.stdin.on('data', value => { if (value.trim() === 'stop') void stop(); }); process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());
} catch {
  await settleWipShutdown({ captureSnapshots: async () => null, closeServer: async () => { if (started) await app.close(); }, closeStores: closeDrivers, releaseLocks: release });
  console.error('Three-profile mount refused; inspect private receipts without exposing configuration.'); process.exitCode = 1;
}
