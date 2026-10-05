import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { createNetworkDriver } from '../serverless/network.mjs';

const require = createRequire(new URL('../serverless/package.json', import.meta.url));
const { Client } = require('pg');
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const writeNew = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
export function config(file) {
  const value = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (value.version !== 'd7-tls-config/v1' || value.host !== '127.0.0.1' || value.simulation !== true
      || value.identity_verified !== false || !Number.isInteger(value.port) || value.port < 1024
      || value.origin !== 'https://d7-fixture.example.test') throw new Error('Private invented D7 configuration required.');
  for (const key of ['operator_password', 'runtime_password', 'owner_passphrase', 'hmac_key'])
    if (!/^[a-f0-9]{64}$/.test(value[key])) throw new Error('Fresh random fixture secrets required.');
  const input = readFileSync(join(value.run_directory, 'input-manifest.json'));
  const preflight = JSON.parse(readFileSync(join(value.run_directory, 'preflight.json'), 'utf8'));
  if (sha(input) !== value.source_manifest_sha256 || preflight.passed !== true
      || preflight.database_already_started !== false) throw new Error('Pinned pre-operation preflight required.');
  for (const pin of value.source_pins)
    if (sha(readFileSync(resolve(value.repository, pin.path))) !== pin.sha256) throw new Error('A frozen source changed.');
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== undefined) throw new Error('TLS verification override refused.');
  return value;
}
export function url(value, database, runtime = false) {
  if (!/^[a-z][a-z0-9_]{2,40}$/.test(database)) throw new Error('Invented database name required.');
  return `postgresql://${runtime ? 'archive_corrections_app' : value.operator_user}:${runtime ? value.runtime_password : value.operator_password}@127.0.0.1:${value.port}/${database}`;
}

// Observation only, local to this new process. The default D5 factory, Pool,
// connection options, TLS checks and lifecycle helper are used without overrides.
let observed = false;
export function observeTransactions(events, label) {
  if (observed) throw new Error('One trace observer per owned process.');
  observed = true;
  const original = Client.prototype.query;
  const active = new WeakMap(); let sequence = 0;
  Client.prototype.query = function (...args) {
    const sql = (typeof args[0] === 'string' ? args[0] : args[0]?.text ?? '').trim();
    let event;
    if (/^BEGIN\b/i.test(sql)) { active.set(this, label + ':' + (++sequence)); event = 'BEGIN'; }
    else if (/^COMMIT\b/i.test(sql)) event = 'COMMIT';
    else if (/^ROLLBACK\b/i.test(sql)) event = 'ROLLBACK';
    else if (/SELECT s\.token_hash/.test(sql)) event = 'session-authorize';
    else if (/INSERT INTO [a-z0-9_]+\.revisions/.test(sql)) event = 'revision-insert';
    else if (/INSERT INTO [a-z0-9_]+\.decisions/.test(sql)) event = 'decision-insert';
    if (event) events.push({ pool: label, backend_pid: this.processID, transaction: active.get(this), event,
      tls_authorized: this.connection?.stream?.authorized === true,
      tls_encrypted: this.connection?.stream?.encrypted === true });
    return original.apply(this, args);
  };
}
export function strictDriver(value, database, runtime = false) {
  return createNetworkDriver(url(value, database, runtime));
}
export async function tlsProof(driver) {
  return driver.transaction(async tx => (await tx.query(`SELECT pg_backend_pid() AS backend_pid,
    host(inet_client_addr()) AS client_address, inet_client_port() AS client_port,
    host(inet_server_addr()) AS server_address, inet_server_port() AS server_port,
    current_database() AS database, current_user AS role, ssl, version AS tls_version, cipher, bits,
    (SELECT xact_start IS NOT NULL FROM pg_stat_activity WHERE pid=pg_backend_pid()) AS in_transaction
    FROM pg_stat_ssl WHERE pid=pg_backend_pid()`)).rows[0], { readOnly: true });
}
