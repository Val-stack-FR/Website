import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { SYNTHETIC_CONTEXT } from './fixture.mjs';
import { canonical, digest, ensure, envelope, validateKey, validatePayload } from './contract.mjs';
import { storePaths } from './runtime.mjs';
import { validateSnapshot } from './snapshot-validation.mjs';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const parseEntity = row => row && JSON.parse(row.entity_json);

export class Store {
  constructor(name, { seed = true, readOnly = false, context = SYNTHETIC_CONTEXT } = {}) {
    this.context = context;
    this.passage = context.passage;
    const paths = storePaths(name, !readOnly);
    this.paths = paths;
    this.db = new DatabaseSync(paths.database, { timeout: 5000, readOnly });
    try {
      if (!readOnly) {
        this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
        this.db.exec(schema);
        for (const table of ['metadata', 'revisions', 'proposals', 'decisions', 'requests']) {
          for (const action of ['UPDATE', 'DELETE']) {
            this.db.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_no_${action.toLowerCase()}
              BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END;`);
          }
        }
        if (seed) this.transaction(() => {
          if (!this.db.prepare('SELECT singleton FROM metadata').get()) {
            this.db.prepare('INSERT INTO metadata VALUES (1, ?, ?)').run(canonical(this.passage), context.apiVersion);
            this.insertRevision(context.initialRevision);
          }
        });
      }
      if (seed || readOnly) {
        this.verifyFixture();
        validateSnapshot(this.exportSnapshot(), context);
      }
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  close() { this.db.close(); }

  verifyFixture() {
    const meta = this.db.prepare('SELECT fixture_json, api_version FROM metadata').get();
    ensure(meta?.fixture_json === canonical(this.passage) && meta.api_version === this.context.apiVersion,
      422, 'synthetic_only', 'The database must belong to this exact selected passage and API version.');
  }

  transaction(work, mode = 'IMMEDIATE') {
    this.db.exec(`BEGIN ${mode}`);
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw error;
    }
  }

  insertRevision(entity) {
    this.db.prepare('INSERT INTO revisions VALUES (?, ?, ?, ?, ?)').run(
      entity.text_revision, entity.revision_number, entity.based_on_revision, entity.decision_id, canonical(entity));
  }

  insertProposal(entity) {
    this.db.prepare('INSERT INTO proposals VALUES (?, ?, ?)').run(entity.proposal_id, entity.base_revision, canonical(entity));
  }

  insertDecision(entity) {
    this.db.prepare('INSERT INTO decisions VALUES (?, ?, ?, ?, ?)').run(
      entity.decision_id, entity.proposal_id, entity.base_revision, entity.text_revision, canonical(entity));
  }

  current() {
    return parseEntity(this.db.prepare('SELECT entity_json FROM revisions ORDER BY revision_number DESC LIMIT 1').get());
  }

  history() {
    return this.transaction(() => envelope({
      passage: this.passage,
      current_revision: this.current(),
      revisions: this.db.prepare('SELECT entity_json FROM revisions ORDER BY revision_number').all().map(parseEntity),
      proposals: this.db.prepare('SELECT entity_json FROM proposals ORDER BY proposal_id').all().map(parseEntity),
      decisions: this.db.prepare('SELECT entity_json FROM decisions ORDER BY decision_id').all().map(parseEntity),
    }, this.context), 'DEFERRED');
  }

  mutate(scope, key, payload) {
    validateKey(key);
    validatePayload(scope, payload, this.passage);
    return this.transaction(() => {
      const previous = this.db.prepare('SELECT payload_json, result_json FROM requests WHERE scope=? AND request_key=?').get(scope, key);
      if (previous) {
        ensure(previous.payload_json === canonical(payload), 409, 'idempotency_conflict', 'This key already belongs to a different payload.');
        return { status: 200, body: envelope({ ...JSON.parse(previous.result_json), replayed: true }, this.context) };
      }
      const current = this.current();
      ensure(payload.base_revision === current.text_revision, 409, 'revision_conflict', 'base_revision is stale; fetch the current passage before proposing again.');
      const created_at = new Date().toISOString();
      let result;
      if (scope === 'proposal') {
        const proposal = {
          ...payload, proposal_id: `proposal_${randomUUID()}`, actor_role: 'anonymous', created_at,
        };
        this.insertProposal(proposal);
        result = { proposal };
      } else {
        const proposal = parseEntity(this.db.prepare('SELECT entity_json FROM proposals WHERE proposal_id=?').get(payload.proposal_id));
        ensure(proposal, 404, 'proposal_not_found', 'Unknown proposal.');
        ensure(proposal.base_revision === payload.base_revision, 409, 'revision_conflict', 'A proposal cannot be rebased by a decision. Submit a new proposal.');
        ensure(!this.db.prepare('SELECT decision_id FROM decisions WHERE proposal_id=?').get(proposal.proposal_id),
          409, 'proposal_decided', 'This proposal already has a decision.');
        const decision_id = `decision_${randomUUID()}`;
        const text_revision = payload.outcome === 'accept'
          ? `${this.passage.passage_id}:r${current.revision_number + 1}` : current.text_revision;
        const decision = {
          ...payload, decision_id, passage_id: this.passage.passage_id,
          text_revision, actor_role: this.context.ownerRole, created_at,
        };
        if (payload.outcome === 'accept') {
          this.insertRevision({
            passage_id: this.passage.passage_id, text_revision, revision_number: current.revision_number + 1,
            based_on_revision: current.text_revision, decision_id, text: proposal.replacement_text,
            evidence_refs: payload.evidence_refs, actor_role: this.context.ownerRole, created_at, simulation: true,
          });
        }
        this.insertDecision(decision);
        result = { decision };
      }
      this.db.prepare('INSERT INTO requests VALUES (?, ?, ?, ?)').run(scope, key, canonical(payload), canonical(result));
      return { status: 201, body: envelope({ ...result, replayed: false }, this.context) };
    });
  }

  exportSnapshot() {
    return this.transaction(() => {
      const content = {
        api_version: this.context.apiVersion, snapshot_version: this.context.snapshotVersion,
        data_kind: this.context.dataKind, simulation: true, passage: this.passage,
        revisions: this.db.prepare('SELECT entity_json FROM revisions ORDER BY revision_number').all().map(parseEntity),
        proposals: this.db.prepare('SELECT entity_json FROM proposals ORDER BY proposal_id').all().map(parseEntity),
        decisions: this.db.prepare('SELECT entity_json FROM decisions ORDER BY decision_id').all().map(parseEntity),
        requests: this.db.prepare('SELECT scope, request_key, payload_json, result_json FROM requests ORDER BY scope, request_key').all()
          .map(row => ({ scope: row.scope, key: row.request_key, payload: JSON.parse(row.payload_json), result: JSON.parse(row.result_json) })),
      };
      return { ...content, sha256: digest(content) };
    }, 'DEFERRED');
  }
}

// Used only by the offline restore command after full validation.
export function restoreSnapshot(name, snapshot, context = SYNTHETIC_CONTEXT) {
  validateSnapshot(snapshot, context);
  const paths = storePaths(name);
  ensure(!existsSync(paths.directory), 409, 'store_exists', 'Restore requires a new store name; nothing is overwritten.');
  const store = new Store(name, { seed: false, context });
  try {
    store.transaction(() => {
      store.db.prepare('INSERT INTO metadata VALUES (1, ?, ?)').run(canonical(context.passage), context.apiVersion);
      for (const revision of snapshot.revisions) store.insertRevision(revision);
      for (const proposal of snapshot.proposals) store.insertProposal(proposal);
      for (const decision of snapshot.decisions) store.insertDecision(decision);
      for (const request of snapshot.requests) {
        store.db.prepare('INSERT INTO requests VALUES (?, ?, ?, ?)').run(request.scope, request.key, canonical(request.payload), canonical(request.result));
      }
    });
    store.verifyFixture();
    ensure(canonical(store.exportSnapshot()) === canonical(snapshot), 422, 'restore_mismatch', 'Restored snapshot did not reproduce the source exactly.');
  } finally {
    store.close();
  }
}
