import { existsSync, lstatSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { ensure } from '../contract.mjs';

export const DATABASE_ENV = 'ARCHIVE_CORRECTIONS_DATABASE_URL';

// Pass the pg client through the WHOLE transaction, including COMMIT and ROLLBACK.
export function poolDriver(pool) {
  return {
    async transaction(work, { readOnly = false } = {}) {
      const client = await pool.connect();
      let releaseError;
      try {
        await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
        try {
          const result = await work({ query: client.query.bind(client), exec: sql => client.query(sql) });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          try { await client.query('ROLLBACK'); } catch (rollbackError) { releaseError = rollbackError; }
          throw error;
        }
      } catch (error) { releaseError ??= error; throw error; }
      finally { client.release(releaseError); }
    },
    close: () => pool.end(),
  };
}

export async function postgresDriver(connectionString = process.env[DATABASE_ENV]) {
  let url;
  try { url = new URL(connectionString); } catch { /* bounded diagnostic only */ }
  ensure(url && ['postgres:', 'postgresql:'].includes(url.protocol) && url.hostname
    && url.username && url.password && url.pathname.length > 1 && !url.search && !url.hash,
  422, 'database_configuration_required', `Set ${DATABASE_ENV} to a PostgreSQL URL without query options.`);
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000, statement_timeout: 10000, application_name: 'archive-corrections-pilot',
    ssl: { rejectUnauthorized: true }, enableChannelBinding: true });
  // Do not let idle socket errors print a connection URL/SQL payload or crash the process.
  pool.on('error', () => {});
  return poolDriver(pool);
}

export async function pgliteDriver(directory) {
  ensure(typeof directory === 'string' && isAbsolute(directory)
    && (!existsSync(directory) || lstatSync(directory).isDirectory() && !lstatSync(directory).isSymbolicLink()),
  422, 'invalid_test_directory', 'PGlite requires an explicit real private test directory.');
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite(directory, { relaxedDurability: false });
  await db.waitReady;
  return {
    db,
    transaction: (work, { readOnly = false } = {}) => db.transaction(async tx => {
      if (readOnly) await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      return work({ query: tx.query.bind(tx), exec: tx.exec.bind(tx) });
    }),
    close: () => db.close(),
  };
}
