import { readFileSync, openSync, writeFileSync, closeSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { pgliteDriver } from '../hosted/drivers.mjs';
import { ServerlessStore } from '../hosted/serverless/store.mjs';
import { enrollSharedOwner, SharedSessions } from '../hosted/serverless/sessions.mjs';
import { loadReaderContext } from '../reader-binding.mjs';
import { SYNTHETIC_CONTEXT } from '../fixture.mjs';
import { ensure } from '../contract.mjs';
import { loadConfig } from './config.mjs';
import { createIntegratedHandler, FixtureLoopbackSessions } from './handler.mjs';

export async function openIntegrated(configFile, { origin } = {}) {
  const value = loadConfig(configFile);
  ensure(origin === undefined || origin === value.public_origin, 503, 'mount_origin_mismatch', 'Explicit mount origin must match the private configuration.');
  // Six pinned authorized derivatives only, never the original or an image.
  const context = loadReaderContext(join(value.run_directory, 'derivatives'));
  const lockPath = join(value.run_directory, 'service-lock.private.json');
  const lockToken = randomBytes(32).toString('hex');
  let lock;
  try { lock = openSync(lockPath, 'wx', 0o600); }
  catch { throw new Error('Exclusive D8 store already owned; stop its service cleanly before restart.'); }
  writeFileSync(lock, JSON.stringify({ pid: process.pid, lock_token: lockToken })); closeSync(lock);
  let driver, closed = false;
  async function close() {
    if (closed) return; closed = true;
    try { if (driver) await driver.close(); }
    finally {
      const owner = JSON.parse(readFileSync(lockPath, 'utf8'));
      if (owner.pid === process.pid && owner.lock_token === lockToken) unlinkSync(lockPath);
    }
  }
  try {
    driver = await pgliteDriver(join(value.run_directory, 'data'));
    const stores = {
      preview: new ServerlessStore(driver, { schema: 'archive_corrections_d5_d8_preview', context }),
      fixture: new ServerlessStore(driver, { schema: 'archive_corrections_d5_d8_fixture', context: SYNTHETIC_CONTEXT }),
    };
    for (const store of Object.values(stores)) { await store.migrate(); await store.initialize(); }
    const real = await stores.preview.exportSnapshot();
    ensure(real.revisions.length === 1 && real.decisions.length === 0, 503, 'historical_decisions_refused', 'The preview must remain the unchanged unreviewed source revision.');
    const count = (await driver.transaction(tx => tx.query(`SELECT count(*)::int AS count FROM ${stores.fixture.table('owner_credentials')}`))).rows[0].count;
    if (count === 0) await enrollSharedOwner(stores.fixture, value.fixture_owner_passphrase);
    const sessions = new FixtureLoopbackSessions(stores.fixture, value.session_hmac_key);
    const previewLimiter = new SharedSessions(stores.preview, value.session_hmac_key);
    const handler = createIntegratedHandler({ stores, fixtureSessions: sessions,
      reserveProposal: profile => (profile === 'fixture' ? sessions : previewLimiter).reserve('proposal'), origin: value.public_origin });
    return { handler, close, config: value,
      exportEditorial: profile => {
        ensure(['fixture','preview'].includes(profile), 422, 'invalid_profile', 'An explicit D8 profile is required.');
        return stores[profile].exportSnapshot();
      } };
  } catch (error) { await close(); throw error; }
}
