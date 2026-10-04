import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PostgresStore } from '../postgres-store.mjs';
import { ensure, canonical } from '../../contract.mjs';

const baseSql = readFileSync(new URL('../migrations/001.sql', import.meta.url), 'utf8');
const authSql = readFileSync(new URL('./migrations/002.sql', import.meta.url), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
export const MIGRATION_HASHES = Object.freeze({ 1: sha(baseSql), 2: sha(authSql) });
export const SERVERLESS_SCHEMA = 'archive_corrections_serverless';

export class ServerlessStore extends PostgresStore {
  constructor(driver, { schema = SERVERLESS_SCHEMA, ...options } = {}) {
    super(driver, { schema, ...options });
    ensure(/^archive_corrections_(serverless|d5)(_[a-z0-9_]+)?$/.test(schema), 422, 'd5_schema_required', 'Use a new dedicated D5 schema; D4 namespaces are preserved.');
  }
  async verifyMigration(tx) {
    const rows = (await tx.query(`SELECT version, sha256 FROM ${this.table('migrations')} ORDER BY version`)).rows;
    ensure(rows.length === 2 && rows.every((row, i) => row.version === i + 1 && row.sha256 === MIGRATION_HASHES[row.version]),
      503, 'migration_required', 'Both dedicated serverless migrations must match before serving.');
  }
  async migrate() {
    return this.driver.transaction(async tx => {
      await this.lockTransaction(tx);
      const exists = (await tx.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [this.schema])).rows.length;
      if (!exists) {
        await tx.exec(baseSql.replaceAll('__SCHEMA__', this.schema));
        await tx.query(`INSERT INTO ${this.table('migrations')} VALUES (1,$1)`, [MIGRATION_HASHES[1]]);
      } else {
        const rows = (await tx.query(`SELECT version, sha256 FROM ${this.table('migrations')} ORDER BY version`)).rows;
        if (rows.length === 2) { await this.verifyMigration(tx); return { migration: 2, applied: false, hashes: MIGRATION_HASHES }; }
        ensure(rows.length === 1 && rows[0].version === 1 && rows[0].sha256 === MIGRATION_HASHES[1],
          503, 'migration_required', 'Migration 001 must match before adding 002.');
      }
      await tx.exec(authSql.replaceAll('__SCHEMA__', this.schema));
      await tx.query(`INSERT INTO ${this.table('migrations')} VALUES (2,$1)`, [MIGRATION_HASHES[2]]);
      return { migration: 2, applied: true, hashes: MIGRATION_HASHES };
    });
  }
  async decide(request, key, payload, sessions) {
    return this.driver.transaction(async tx => {
      await this.lockTransaction(tx);
      await sessions.authorize(tx, request, { csrf: true });
      // Reuse immutable D4 mutation code, but on THIS acquired transaction client.
      // No nested BEGIN, no authorization/decision gap across connections.
      const scoped = new PostgresStore({ transaction: work => work(tx) }, { schema: this.schema, context: this.context });
      return scoped.mutate('decision', key, payload);
    });
  }
  async privateHistory(request, sessions) {
    return this.driver.transaction(async tx => {
      await this.lockTransaction(tx); await sessions.authorize(tx, request);
      const snapshot = await this.snapshot(tx);
      return { snapshot, history: { api_version: this.context.apiVersion, data_kind: this.context.dataKind, simulation: true,
        passage: this.passage, current_revision: snapshot.revisions.at(-1), revisions: snapshot.revisions,
        proposals: snapshot.proposals, decisions: snapshot.decisions } };
    });
  }
  async verifyUnchanged(snapshot) { ensure(canonical(await this.exportSnapshot()) === canonical(snapshot), 422, 'restore_mismatch', 'Editorial IDs/history must match exactly.'); }
}
