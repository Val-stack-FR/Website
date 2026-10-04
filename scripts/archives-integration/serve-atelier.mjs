import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createAtelierPreview } from './atelier-preview.mjs';
import { loadMountedCorrections } from './corrections-mount.mjs';

let app, mounted, closing = false, record, episode;
async function close() {
  if (closing) return; closing = true;
  if (app) await app.close();
  let snapshotExported = false;
  if (mounted) {
    try {
      await writeFile(resolve(record, episode + '-editorial-snapshot.json'), JSON.stringify(await mounted.app.exportEditorial('preview'), null, 2), { flag: 'wx' });
      snapshotExported = true;
    } finally { await mounted.close(); }
  }
  await writeFile(resolve(record, episode + '-stopped.json'), JSON.stringify({ stopped_at: new Date().toISOString(), pid: process.pid, database_closed: Boolean(mounted), snapshot_exported: snapshotExported, simulation: true, identity_verified: false }), { flag: 'wx' });
  console.log('Owned atelier server stopped cleanly.');
}
try {
  const { values } = parseArgs({ options: { reader: { type: 'string' }, 'reader-sha256': { type: 'string' }, lexical: { type: 'string' }, 'mount-ready': { type: 'string' }, 'mount-ready-sha256': { type: 'string' }, record: { type: 'string' }, episode: { type: 'string' } } });
  if (!values.record || !/^[a-z][a-z0-9-]{1,30}$/u.test(values.episode ?? '')) throw new Error('Private record and fresh episode required.');
  record = resolve(values.record); episode = values.episode;
  await mkdir(record, { recursive: true });
  const origin = 'http://127.0.0.1:8810';
  mounted = await loadMountedCorrections({ readyFile: values['mount-ready'], readySha256: values['mount-ready-sha256'], origin });
  app = await createAtelierPreview({ readerOrigin: values.reader, readerSha256: values['reader-sha256'], lexicalDirectory: values.lexical, origin, corrections: mounted });
  const url = await app.listen();
  await writeFile(resolve(record, episode + '-initial-editorial-snapshot.json'), JSON.stringify(await mounted.app.exportEditorial('preview'), null, 2), { flag: 'wx' });
  await writeFile(resolve(record, episode + '-started.json'), JSON.stringify({ started_at: new Date().toISOString(), pid: process.pid, url, reader_sha256: app.readerSha256, mount_ready_sha256: mounted.readySha256, historical_decisions_enabled: false, human_identity_verified: false }), { flag: 'wx' });
  console.log(JSON.stringify({ url, pid: process.pid, corrections: 'pending-proposals-only', owner_identity: 'not-qualified' }));
  process.stdin.on('data', chunk => { if (chunk.toString('utf8').trim() === 'stop') close().then(() => process.exit(0)).catch(() => { process.exitCode = 1; }); });
  process.once('SIGINT', () => close().then(() => process.exit(0)));
  process.once('SIGTERM', () => close().then(() => process.exit(0)));
} catch {
  if (app) await app.close().catch(() => {});
  if (mounted) await mounted.close().catch(() => {});
  console.error('Atelier mount refused; inspect private gate records without exposing configuration.');
  process.exitCode = 1;
}
