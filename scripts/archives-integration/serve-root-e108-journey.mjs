import { readFile, mkdir, writeFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createAssembledPreview } from './assembled-preview.mjs';
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const { values } = parseArgs({ options: Object.fromEntries(['site', 'record', 'origin', 'episode', 'previous'].map(name => [name, { type: 'string' }]).concat([['init', { type: 'boolean', default: false }]])) });
const root = await realpath(resolve('.')), site = await realpath(resolve(values.site)), record = resolve(values.record);
const origin = new URL(values.origin), episode = values.episode;
ensure(origin.protocol === 'http:' && origin.hostname === '127.0.0.1' && origin.port && origin.port !== '8822' && origin.href === origin.origin + '/', 'Owned test loopback required');
ensure(relative(root, record).startsWith('.private' + sep + 'archives-integration' + sep) && /^[a-z][a-z0-9-]{1,40}$/u.test(episode), 'Owned private record and episode required');
const [{ pgliteDriver }, { seedNewStore, createE108SourceAdapter }, { SELECTION }] = await Promise.all([
  import(pathToFileURL(resolve('Z:/Codex/repos/Website-archives-corrections/scripts/archive-corrections/hosted/drivers.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-e108-source/adapter.mjs')).href),
  import(pathToFileURL(resolve(site, 'scripts/archive-corrections/public-e108-source/selection.mjs')).href),
]);
if (values.init) {
  await mkdir(record);
  await writeFile(resolve(record, 'owned-test-config.json'), JSON.stringify({ origin: origin.origin, schema: SELECTION.schema, directory: resolve(record, 'pglite'), main_stores_used: false }, null, 2) + '\n', { flag: 'wx' });
}
ensure(await realpath(record) === record, 'Reparse record refused');
const config = JSON.parse(await readFile(resolve(record, 'owned-test-config.json')));
ensure(config.origin === origin.origin && config.schema === SELECTION.schema && config.directory === resolve(record, 'pglite') && config.main_stores_used === false, 'Owned test configuration changed');
let driver, adapter, app, listening = false, stopping = false;
const snapshot = async suffix => {
  const data = await adapter.exportForQualification(), bytes = Buffer.from(JSON.stringify(data, null, 2) + '\n');
  await writeFile(resolve(record, episode + '-' + suffix + '.json'), bytes, { flag: 'wx' });
  return { sha256: sha(bytes), revisions: data.revisions.length, proposals: data.proposals.length, decisions: data.decisions.length };
};
const stop = async () => {
  if (stopping) return; stopping = true;
  try {
    const final = await snapshot('stopped-snapshot');
    if (listening) await app.close();
    await adapter.close();
    await writeFile(resolve(record, episode + '-stopped.json'), JSON.stringify({ clean_shutdown: true, final, main_stores_used: false }) + '\n', { flag: 'wx' });
    process.stdin.pause(); console.log('Owned E108 journey stopped cleanly.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
};
try {
  driver = await pgliteDriver(config.directory);
  if (values.init) await seedNewStore(driver);
  adapter = createE108SourceAdapter({ driver, origin: origin.origin, local: true });
  app = await createAssembledPreview({ sitePath: site, origin: origin.origin });
  const initial = await snapshot('initial-snapshot');
  ensure(initial.revisions === 1 && initial.decisions === 0, 'Source store changed');
  if (values.init) ensure(initial.proposals === 0, 'Fresh seed not empty');
  else {
    ensure(/^[a-z][a-z0-9-]{1,40}$/u.test(values.previous || '') && values.previous !== episode, 'Prior closed episode required');
    ensure(JSON.parse(await readFile(resolve(record, values.previous + '-stopped.json'))).clean_shutdown, 'Prior shutdown unqualified');
    ensure(initial.sha256 === sha(await readFile(resolve(record, values.previous + '-stopped-snapshot.json'))), 'Restart changed the proposal/source snapshot');
  }
  const readonly = app.server.listeners('request'); ensure(readonly.length === 1, 'Single readonly listener required');
  app.server.removeListener('request', readonly[0]);
  app.server.on('request', (request, response) => {
    if (typeof request.url === 'string' && request.url.length <= 8192 && request.url.startsWith(SELECTION.prefix)) void adapter.handler(request, response);
    else void readonly[0](request, response);
  });
  await writeFile(resolve(record, episode + '-ready.json'), JSON.stringify({ initial, source_only: true, isolated: true, origin: origin.origin, site }) + '\n', { flag: 'wx' });
  console.log(await app.listen()); listening = true;
  process.stdin.setEncoding('utf8'); process.stdin.on('data', text => { if (text.trim() === 'stop') void stop(); });
  process.on('SIGINT', () => void stop()); process.on('SIGTERM', () => void stop());
} catch (error) {
  if (listening) await app.close();
  if (adapter) await adapter.close(); else if (driver) await driver.close();
  throw error;
}
