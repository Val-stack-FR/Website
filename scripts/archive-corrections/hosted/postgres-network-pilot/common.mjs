// Entirely invented D6 network pilot. Existing pg and D5 modules are read-only.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { sharedPoolDriver } from '../serverless/network.mjs';

export const requirePg = createRequire(new URL('../serverless/package.json', import.meta.url));
export const { Pool, Client } = requirePg('pg');
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const writeNew = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
export function config(path) {
  const value = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  if (value.version !== 'd6-network-config/v1' || value.host !== '127.0.0.1'
      || !Number.isInteger(value.port) || value.port < 1024 || value.port > 65535
      || value.simulation !== true || value.identity_verified !== false) throw new Error('D6 loopback-only configuration refused.');
  for (const name of ['operator_password', 'runtime_password', 'owner_passphrase', 'hmac_key']) {
    if (!/^[a-f0-9]{64}$/.test(value[name])) throw new Error('Fresh random hex fixture secrets required.');
  }
  if (!/^d6_operator_[a-f0-9]{8}$/.test(value.operator_user) || value.origin !== 'https://d6-fixture.example.test') throw new Error('Declared D6 fixture identity only.');
  for (const pin of value.source_pins) {
    const file = resolve(value.repository, pin.path);
    if (!file.startsWith(resolve(value.repository) + '\\') && !file.startsWith(resolve(value.repository) + '/')) throw new Error('Source pin outside checkout.');
    if (sha(readFileSync(file)) !== pin.sha256) throw new Error('Frozen D6 source pin changed: ' + pin.path);
  }
  const preflight = JSON.parse(readFileSync(join(value.run_directory, 'preflight.json'), 'utf8').replace(/^\uFEFF/, ''));
  if (preflight.passed !== true || preflight.database_already_started !== false || preflight.source_sha256 !== value.source_manifest_sha256
      || sha(readFileSync(join(value.run_directory, 'input-manifest.json'))) !== value.source_manifest_sha256
      || preflight.port !== value.port || preflight.host !== '127.0.0.1') throw new Error('Successful pre-execution preflight required.');
  return value;
}
export function poolOptions(value, database, label, runtime = false) {
  if (!/^[a-z][a-z0-9_]{2,40}$/.test(database)) throw new Error('Invented database identifier refused.');
  return { host: '127.0.0.1', port: value.port, database,
    user: runtime ? 'archive_corrections_app' : value.operator_user,
    password: runtime ? value.runtime_password : value.operator_password,
    max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 5000, statement_timeout: 8000,
    application_name: 'd6-fixture-' + label, ssl: false };
}
export function tracedDriver(pool, label, events) {
  const wrapped = Symbol('d6-wrapped');
  let sequence = 0;
  pool.on('connect', client => {
    if (client[wrapped]) return;
    client[wrapped] = true;
    const original = client.query.bind(client);
    let transaction;
    client.query = (...args) => {
      const sql = (typeof args[0] === 'string' ? args[0] : args[0]?.text ?? '').trim();
      let event;
      if (/^BEGIN\b/i.test(sql)) { transaction = label + ':' + (++sequence); event = 'BEGIN'; }
      else if (/^COMMIT\b/i.test(sql)) event = 'COMMIT';
      else if (/^ROLLBACK\b/i.test(sql)) event = 'ROLLBACK';
      else if (/pg_advisory_xact_lock/.test(sql)) event = 'advisory-lock';
      else if (/SELECT s\.token_hash/.test(sql)) event = 'session-authorize';
      else if (/INSERT INTO [a-z0-9_]+\.decisions/.test(sql)) event = 'decision-insert';
      else if (/INSERT INTO [a-z0-9_]+\.revisions/.test(sql)) event = 'revision-insert';
      else if (/INSERT INTO [a-z0-9_]+\.rate_events/.test(sql)) event = 'rate-reservation';
      if (event) events.push({ pool: label, backend_pid: client.processID, transaction, event });
      return original(...args);
    };
  });
  return sharedPoolDriver(pool);
}
export async function twoTcpClients(pool) {
  const clients = await Promise.all([pool.connect(), pool.connect()]);
  try {
    return await Promise.all(clients.map(async client => (await client.query(`SELECT pg_backend_pid() AS backend_pid,
      host(inet_client_addr()) AS client_address, inet_client_port() AS client_port,
      host(inet_server_addr()) AS server_address, inet_server_port() AS server_port,
      current_database() AS database, current_user AS role, version() AS server_version`)).rows[0]));
  } finally { for (const client of clients) client.release(); }
}
