// Entirely invented test material. Never import an archive or a historical reading here.
export const API_VERSION = 'archive-corrections/v1';
export const SNAPSHOT_VERSION = 'archive-corrections-snapshot/v1';
export const PASSAGE = Object.freeze({
  passage_id: 'synthetic-mvp-d-001',
  title: 'Passage inventé pour MVP-D local',
  data_kind: 'synthetic',
  simulation: true,
  evidence_refs: ['synthetic:evidence:line-1'],
});
export const INITIAL_REVISION = Object.freeze({
  passage_id: PASSAGE.passage_id,
  text_revision: `${PASSAGE.passage_id}:r1`,
  revision_number: 1,
  based_on_revision: null,
  decision_id: null,
  text: 'La boîte contient trois jetons imaginaires.',
  evidence_refs: PASSAGE.evidence_refs,
  actor_role: 'seed_fixture',
  created_at: '2026-10-03T00:00:00.000Z',
  simulation: true,
});
