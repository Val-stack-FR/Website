import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { canonical, digest, ensure, envelope, validateKey, validatePayload } from '../contract.mjs';
import { SYNTHETIC_CONTEXT } from '../fixture.mjs';
import { validateSnapshot } from '../snapshot-validation.mjs';

const migration = readFileSync(new URL('./migrations/001.sql', import.meta.url), 'utf8');
const migrationHash = createHash('sha256').update(migration).digest('hex');
const entity = row => row && JSON.parse(row.entity_json);
export const DEFAULT_SCHEMA = 'archive_corrections_pilot';

export class PostgresStore {
  constructor(driver, { schema = DEFAULT_SCHEMA, context = SYNTHETIC_CONTEXT } = {}) {
    ensure(/^archive_corrections_[a-z][a-z0-9_]{0,38}$/.test(schema), 422, 'invalid_schema', 'Use a dedicated corrections schema name.');
    this.driver = driver; this.schema = schema; this.context = context; this.passage = context.passage;
    // Fixed domain prefix + deterministic signed key; collisions only serialize unrelated pilots.
    this.lock = createHash('sha256').update(schema).digest().readInt32BE(0);
  }
  table(name) { return `${this.schema}.${name}`; }
  async lockTransaction(tx) { await tx.query('SELECT pg_advisory_xact_lock(172419, $1)', [this.lock]); }
  async migrate() {
    return this.driver.transaction(async tx => {
      await this.lockTransaction(tx);
      const found = (await tx.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [this.schema])).rows.length;
      if (found) {
        await this.verifyMigration(tx);
        return { migration: 1, applied: false, sha256: migrationHash };
      }
      await tx.exec(migration.replaceAll('__SCHEMA__', this.schema));
      await tx.query(`INSERT INTO ${this.table('migrations')} VALUES (1, $1)`, [migrationHash]);
      return { migration: 1, applied: true, sha256: migrationHash };
    });
  }
  async verifyMigration(tx) {
    const rows = (await tx.query(`SELECT version, sha256 FROM ${this.table('migrations')} ORDER BY version`)).rows;
    ensure(rows.length === 1 && rows[0].version === 1 && rows[0].sha256 === migrationHash,
      503, 'migration_required', 'The dedicated corrections migration must match before serving.');
  }
  async initialize({ seed = true } = {}) {
    await this.driver.transaction(async tx => {
      await this.lockTransaction(tx); await this.verifyMigration(tx);
      const metadata = (await tx.query(`SELECT fixture_json, api_version FROM ${this.table('metadata')}`)).rows[0];
      if (!metadata && seed) {
        await tx.query(`INSERT INTO ${this.table('metadata')} VALUES (1, $1, $2)`, [canonical(this.passage), this.context.apiVersion]);
        await this.insertRevision(tx, this.context.initialRevision);
      } else {
        ensure(metadata?.fixture_json === canonical(this.passage) && metadata.api_version === this.context.apiVersion,
          422, 'passage_mismatch', 'The database must match this exact selected passage and API version.');
      }
      validateSnapshot(await this.snapshot(tx), this.context);
    });
    return this;
  }
  async insertRevision(tx, value) {
    await tx.query(`INSERT INTO ${this.table('revisions')} VALUES ($1,$2,$3,$4,$5)`,
      [value.text_revision, value.revision_number, value.based_on_revision, value.decision_id, canonical(value)]);
  }
  async insertProposal(tx, value) {
    await tx.query(`INSERT INTO ${this.table('proposals')} VALUES ($1,$2,$3)`, [value.proposal_id, value.base_revision, canonical(value)]);
  }
  async insertDecision(tx, value) {
    await tx.query(`INSERT INTO ${this.table('decisions')} VALUES ($1,$2,$3,$4,$5)`,
      [value.decision_id, value.proposal_id, value.base_revision, value.text_revision, canonical(value)]);
  }
  async current(tx) {
    return entity((await tx.query(`SELECT entity_json FROM ${this.table('revisions')} ORDER BY revision_number DESC LIMIT 1`)).rows[0]);
  }
  async snapshot(tx) {
    const read = async (name, order) => (await tx.query(`SELECT entity_json FROM ${this.table(name)} ORDER BY ${order}`)).rows.map(entity);
    const revisions = await read('revisions', 'revision_number');
    const proposals = await read('proposals', 'proposal_id');
    const decisions = await read('decisions', 'decision_id');
    const requests = (await tx.query(`SELECT scope, request_key, payload_json, result_json FROM ${this.table('requests')} ORDER BY scope, request_key`)).rows
      .map(row => ({ scope: row.scope, key: row.request_key, payload: JSON.parse(row.payload_json), result: JSON.parse(row.result_json) }));
    const content = { api_version: this.context.apiVersion, snapshot_version: this.context.snapshotVersion,
      data_kind: this.context.dataKind, simulation: true, passage: this.passage, revisions, proposals, decisions, requests };
    return { ...content, sha256: digest(content) };
  }
  exportSnapshot() { return this.driver.transaction(tx => this.snapshot(tx), { readOnly: true }); }
  async history() {
    const { passage, revisions, proposals, decisions } = await this.exportSnapshot();
    return envelope({ passage, current_revision: revisions.at(-1), revisions, proposals, decisions }, this.context);
  }
  async mutate(scope, key, payload) {
    ensure(['proposal', 'decision'].includes(scope), 422, 'invalid_scope', 'Unknown mutation scope.');
    validateKey(key); validatePayload(scope, payload, this.passage);
    return this.driver.transaction(async tx => {
      await this.lockTransaction(tx);
      const previous = (await tx.query(`SELECT payload_json, result_json FROM ${this.table('requests')} WHERE scope=$1 AND request_key=$2`, [scope, key])).rows[0];
      if (previous) {
        ensure(previous.payload_json === canonical(payload), 409, 'idempotency_conflict', 'This key already belongs to a different payload.');
        return { status: 200, body: envelope({ ...JSON.parse(previous.result_json), replayed: true }, this.context) };
      }
      const current = await this.current(tx);
      ensure(payload.base_revision === current.text_revision, 409, 'revision_conflict', 'base_revision is stale; fetch the current passage before proposing again.');
      const created_at = new Date().toISOString();
      let result;
      if (scope === 'proposal') {
        const proposal = { ...payload, proposal_id: `proposal_${randomUUID()}`, actor_role: 'anonymous', created_at };
        await this.insertProposal(tx, proposal); result = { proposal };
      } else {
        const proposal = entity((await tx.query(`SELECT entity_json FROM ${this.table('proposals')} WHERE proposal_id=$1`, [payload.proposal_id])).rows[0]);
        ensure(proposal, 404, 'proposal_not_found', 'Unknown proposal.');
        ensure(proposal.base_revision === payload.base_revision, 409, 'revision_conflict', 'A proposal cannot be rebased by a decision. Submit a new proposal.');
        ensure(!(await tx.query(`SELECT 1 FROM ${this.table('decisions')} WHERE proposal_id=$1`, [proposal.proposal_id])).rows.length,
          409, 'proposal_decided', 'This proposal already has a decision.');
        const decision_id = `decision_${randomUUID()}`;
        const text_revision = payload.outcome === 'accept' ? `${this.passage.passage_id}:r${current.revision_number + 1}` : current.text_revision;
        const decision = { ...payload, decision_id, passage_id: this.passage.passage_id, text_revision, actor_role: this.context.ownerRole, created_at };
        if (payload.outcome === 'accept') await this.insertRevision(tx, {
          passage_id: this.passage.passage_id, text_revision, revision_number: current.revision_number + 1,
          based_on_revision: current.text_revision, decision_id, text: proposal.replacement_text,
          evidence_refs: payload.evidence_refs, actor_role: this.context.ownerRole, created_at, simulation: true,
        });
        await this.insertDecision(tx, decision); result = { decision };
      }
      await tx.query(`INSERT INTO ${this.table('requests')} VALUES ($1,$2,$3,$4)`, [scope, key, canonical(payload), canonical(result)]);
      return { status: 201, body: envelope({ ...result, replayed: false }, this.context) };
    });
  }
  async restore(snapshot) {
    validateSnapshot(snapshot, this.context); // Fail before any target write.
    await this.driver.transaction(async tx => {
      await this.lockTransaction(tx); await this.verifyMigration(tx);
      for (const name of ['metadata', 'revisions', 'proposals', 'decisions', 'requests']) {
        ensure(!(await tx.query(`SELECT 1 FROM ${this.table(name)} LIMIT 1`)).rows.length, 409, 'store_exists', 'Restore requires an empty dedicated schema.');
      }
      await tx.query(`INSERT INTO ${this.table('metadata')} VALUES (1,$1,$2)`, [canonical(this.passage), this.context.apiVersion]);
      for (const value of snapshot.revisions) await this.insertRevision(tx, value);
      for (const value of snapshot.proposals) await this.insertProposal(tx, value);
      for (const value of snapshot.decisions) await this.insertDecision(tx, value);
      for (const request of snapshot.requests) await tx.query(`INSERT INTO ${this.table('requests')} VALUES ($1,$2,$3,$4)`,
        [request.scope, request.key, canonical(request.payload), canonical(request.result)]);
      ensure(canonical(await this.snapshot(tx)) === canonical(snapshot), 422, 'restore_mismatch', 'Restore must reproduce every record and ID exactly.');
    });
  }
  close() { return this.driver.close(); }
}
