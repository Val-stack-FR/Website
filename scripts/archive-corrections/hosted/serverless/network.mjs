import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { ensure } from '../../contract.mjs';

export function validateDatabaseUrl(value) {
  let url; try { url = new URL(value); } catch { /* never echo the secret */ }
  ensure(url && ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname && url.username && url.password
    && url.pathname.length > 1 && !url.search && !url.hash, 503, 'database_configuration_required', 'A private PostgreSQL URL without query options is required.');
  return value;
}

export function sharedPoolDriver(pool) {
  return {
    async transaction(work, { readOnly = false } = {}) {
      const client = await pool.connect(); let begun = false, discard;
      try {
        await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN'); begun = true;
        const result = await work({ query: client.query.bind(client), exec: sql => client.query(sql) });
        await client.query('COMMIT'); begun = false; return result;
      } catch (error) {
        if (begun) { try { await client.query('ROLLBACK'); } catch (rollbackError) { discard = rollbackError; } }
        else discard = error;
        throw error;
      } finally { client.release(discard); }
    },
    close: () => pool.end(),
  };
}

export function createNetworkDriver(url, { attach = attachDatabasePool, PoolClass = Pool } = {}) {
  validateDatabaseUrl(url);
  const pool = new PoolClass({ connectionString: url, max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 5000,
    statement_timeout: 8000, application_name: 'archive-corrections-serverless-pilot',
    ssl: { rejectUnauthorized: true }, enableChannelBinding: true });
  pool.on('error', () => {});
  attach(pool); // Official Fluid compute lifecycle helper; once per warm function module.
  return sharedPoolDriver(pool);
}
