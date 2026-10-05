import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createAssembledPreview } from './assembled-preview.mjs';
import { loopbackBase } from './media-preview.mjs';

const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const hash = b => createHash('sha256').update(b).digest('hex');
const { values } = parseArgs({ options: { site: { type: 'string' }, record: { type: 'string' }, episode: { type: 'string' }, origin: { type: 'string', default: 'http://127.0.0.1:8822' }, init: { type: 'boolean', default: false } } });
const root = await realpath(resolve('.')), site = await realpath(resolve(values.site)), record = resolve(values.record), origin = loopbackBase(values.origin), episode = values.episode;
ensure(relative(root, record).startsWith('.private' + sep + 'archives-integration' + sep) && /^[a-z][a-z0-9-]{1,40}$/u.test(episode), 'Owned private record and fresh episode required.');
const configPath = resolve(record, 'local-config.json'), lock = resolve(record, 'local-store.lock');
const correctionRoot = 'Z:/Codex/repos/Website-archives-corrections';
// The local test imports the accepted author factory with its already provisioned
// dependencies. Every selected source must be byte-identical to the packaged code.
// Neither its local driver nor node_modules is added to the publication package.
for (const name of ['public-wip/candidate.mjs', 'public-wip/bundle.mjs', 'public-wip/policy.mjs', 'public-wip/mandate.mjs', 'hosted/serverless/store.mjs', 'hosted/serverless/network.mjs']) {
  const source = resolve(correctionRoot, 'scripts/archive-corrections', name), selected = resolve(site, 'scripts/archive-corrections', name);
  ensure(hash(await readFile(source)) === hash(await readFile(selected)), 'Local factory differs from packaged selection.');
}
const [{ pgliteDriver }, { loadDeliveryBundle }, { seedExactContext }, { createLocalWip }, { ServerlessStore }] = await Promise.all([
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/hosted/drivers.mjs')).href),
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/public-wip/bundle.mjs')).href),
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/public-wip/seed.mjs')).href),
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/public-wip/candidate.mjs')).href),
  import(pathToFileURL(resolve(correctionRoot, 'scripts/archive-corrections/hosted/serverless/store.mjs')).href)
]);
const bundle = loadDeliveryBundle(resolve(site, 'scripts/archive-corrections/public-wip/delivery-assets'));
if (values.init) {
  try { await lstat(record); throw new Error('Initialization record exists.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await mkdir(record);
  await writeFile(configPath, JSON.stringify({ version: 'root-publication-wip-local/1', origin, schema: 'archive_corrections_d5_public_wip_root', directory: resolve(record, 'pglite'), sessionKey: randomBytes(32).toString('hex'), local_driver_only: true, owner_enabled: false }, null, 2) + '\n', { flag: 'wx' });
}
ensure(await realpath(record) === record, 'Private record reparse refused.');
const config = JSON.parse(await readFile(configPath));
ensure(config.version === 'root-publication-wip-local/1' && config.origin === origin && config.directory === resolve(record, 'pglite') && config.local_driver_only === true && config.owner_enabled === false, 'Owned local configuration drift.');
await writeFile(lock, JSON.stringify({ pid: process.pid, episode }), { flag: 'wx' });
let driver, corrections, app, started = false, stopping = false;
const recordSnapshot = async suffix => {
  const store = new ServerlessStore(driver, { schema: config.schema, context: bundle.context });
  await store.initialize({ seed: false });
  const snapshot = await store.exportSnapshot();
  await writeFile(resolve(record, episode + '-' + suffix + '.json'), JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx' });
  return { revisions: snapshot.revisions.length, proposals: snapshot.proposals.length, decisions: snapshot.decisions.length };
};
const stop = async () => {
  if (stopping) return; stopping = true;
  const counts = driver ? await recordSnapshot('stopped-snapshot') : null;
  if (started) await app.close();
  if (corrections) await corrections.close(); else if (driver) await driver.close();
  await unlink(lock);
  await writeFile(resolve(record, episode + '-stopped.json'), JSON.stringify({ pid: process.pid, clean_shutdown: true, counts, production_configuration_present: false }, null, 2) + '\n', { flag: 'wx' });
  process.stdin.pause(); console.log('Publication WIP preview stopped cleanly.');
};
try {
  // Static/runtime selection is verified before the local database is opened.
  app = await createAssembledPreview({ sitePath: site, origin });
  driver = await pgliteDriver(config.directory);
  if (values.init) await writeFile(resolve(record, 'seed-proof.json'), JSON.stringify(await seedExactContext(driver, { schema: config.schema, ...bundle }), null, 2) + '\n', { flag: 'wx' });
  corrections = createLocalWip({ driver, schema: config.schema, ...bundle, origin, sessionKey: config.sessionKey });
  const readonly = app.server.listeners('request'); ensure(readonly.length === 1, 'Single readonly request listener required.');
  app.server.removeListener('request', readonly[0]);
  app.server.on('request', (request, response) => {
    const raw = request.url;
    if (typeof raw === 'string' && raw.length <= 8192 && raw.startsWith('/api/archive/public/monbezon/')) {
      // Pass the original IncomingMessage, complete rawHeaders and request body.
      void corrections.handler(request, response); return;
    }
    void readonly[0](request, response);
  });
  const counts = await recordSnapshot('initial-snapshot');
  await writeFile(resolve(record, episode + '-ready.json'), JSON.stringify({ pid: process.pid, origin, site, counts, exact_packaged_factory_sources: true, local_driver: 'PGlite isolated, not included in publication', original_incoming_message: true, production_configuration_present: false, owner_enabled: false, publication_executed: false }, null, 2) + '\n', { flag: 'wx' });
  console.log(await app.listen()); started = true;
  process.stdin.setEncoding('utf8'); process.stdin.on('data', value => { if (value.trim() === 'stop') void stop(); });
  process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());
} catch {
  if (started) await app.close();
  if (corrections) await corrections.close(); else if (driver) await driver.close();
  await unlink(lock); console.error('Publication WIP local mount refused; inspect private inputs without exposing configuration.'); process.exitCode = 1;
}
