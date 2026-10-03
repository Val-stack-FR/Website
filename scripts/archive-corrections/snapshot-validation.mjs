import { API_VERSION, SNAPSHOT_VERSION, PASSAGE, INITIAL_REVISION } from './fixture.mjs';
import { canonical, digest, ensure, exactFields, boundedText, evidence, isEntityId, validateKey, validatePayload } from './contract.mjs';

const same = (a, b) => canonical(a) === canonical(b);
const check = (condition, message) => ensure(condition, 422, 'invalid_snapshot', message);
const project = (entity, keys) => Object.fromEntries(keys.map(key => [key, entity[key]]));
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const proposalFields = ['passage_id', 'base_revision', 'replacement_text', 'reason', 'evidence_refs', 'simulation'];
const decisionFields = ['proposal_id', 'base_revision', 'outcome', 'reason', 'evidence_refs', 'simulation'];

function mapUnique(items, field) {
  const result = new Map(items.map(item => [item[field], item]));
  check(result.size === items.length, `Duplicate ${field}.`);
  return result;
}

function simulatedEntity(entity) {
  check(entity.passage_id === PASSAGE.passage_id && entity.simulation === true, 'Only this synthetic passage and simulated entities can be restored.');
  const timestamp = typeof entity.created_at === 'string' ? Date.parse(entity.created_at) : NaN;
  check(typeof entity.created_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entity.created_at)
    && Number.isFinite(timestamp) && new Date(timestamp).toISOString() === entity.created_at, 'Invalid created_at.');
  evidence(entity.evidence_refs);
}

export function validateSnapshot(snapshot) {
  exactFields(snapshot, ['api_version', 'snapshot_version', 'data_kind', 'simulation', 'passage', 'revisions', 'proposals', 'decisions', 'requests', 'sha256']);
  const { sha256, ...content } = snapshot;
  check(sha256 === digest(content), 'Snapshot integrity hash differs.');
  check(snapshot.api_version === API_VERSION && snapshot.snapshot_version === SNAPSHOT_VERSION
    && snapshot.data_kind === 'synthetic' && snapshot.simulation === true
    && same(snapshot.passage, PASSAGE), 'Unknown version or fixture.');
  for (const key of ['revisions', 'proposals', 'decisions', 'requests']) {
    check(Array.isArray(snapshot[key]), 'Snapshot tables must be arrays.');
  }
  check(snapshot.revisions.length > 0 && same(snapshot.revisions[0], INITIAL_REVISION), 'The seed revision must be exactly the invented fixture.');
  const revisions = mapUnique(snapshot.revisions, 'text_revision');
  const proposals = mapUnique(snapshot.proposals, 'proposal_id');
  const decisions = mapUnique(snapshot.decisions, 'decision_id');
  for (const [index, revision] of snapshot.revisions.entries()) {
    exactFields(revision, Object.keys(INITIAL_REVISION));
    simulatedEntity(revision);
    boundedText(revision.text, 'text', 5000);
    check(revision.revision_number === index + 1 && revision.text_revision === `${PASSAGE.passage_id}:r${index + 1}`, 'Revisions must be ordered and contiguous.');
    if (index > 0) {
      check(revision.actor_role === 'owner_test'
        && revision.based_on_revision === snapshot.revisions[index - 1].text_revision, 'Invalid revision ancestry or role.');
      const decision = decisions.get(revision.decision_id);
      const proposal = decision && proposals.get(decision.proposal_id);
      check(decision?.outcome === 'accept' && decision.text_revision === revision.text_revision
        && decision.base_revision === revision.based_on_revision && proposal?.replacement_text === revision.text
        && same(decision.evidence_refs, revision.evidence_refs) && decision.created_at === revision.created_at,
      'A new revision must be justified by its corresponding accepted simulated decision.');
    }
  }
  for (const proposal of snapshot.proposals) {
    exactFields(proposal, [...proposalFields, 'proposal_id', 'actor_role', 'created_at']);
    simulatedEntity(proposal);
    validatePayload('proposal', project(proposal, proposalFields));
    check(isEntityId(proposal.proposal_id, 'proposal')
      && proposal.actor_role === 'anonymous' && revisions.has(proposal.base_revision), 'Invalid proposal ID, actor or base revision.');
  }
  const decidedProposals = new Set();
  for (const decision of snapshot.decisions) {
    exactFields(decision, [...decisionFields, 'decision_id', 'passage_id', 'text_revision', 'actor_role', 'created_at']);
    simulatedEntity(decision);
    validatePayload('decision', project(decision, decisionFields));
    check(isEntityId(decision.decision_id, 'decision') && decision.actor_role === 'owner_test', 'Invalid decision ID or actor.');
    const proposal = proposals.get(decision.proposal_id);
    const revision = revisions.get(decision.text_revision);
    check(proposal && proposal.base_revision === decision.base_revision && revision
      && !decidedProposals.has(decision.proposal_id), 'Missing, rebased or multiply decided proposal.');
    decidedProposals.add(decision.proposal_id);
    check(decision.outcome === 'accept'
      ? revision.decision_id === decision.decision_id && revision.based_on_revision === decision.base_revision
      : decision.text_revision === decision.base_revision, 'Decision/resulting revision mismatch.');
  }
  check(snapshot.decisions.filter(d => d.outcome === 'accept').length === snapshot.revisions.length - 1, 'Each new revision needs exactly one acceptance.');
  const requestKeys = new Set();
  const recordedEntities = new Set();
  for (const request of snapshot.requests) {
    exactFields(request, ['scope', 'key', 'payload', 'result']);
    check(['proposal', 'decision'].includes(request.scope), 'Unknown idempotency scope.');
    validateKey(request.key);
    validatePayload(request.scope, request.payload);
    exactFields(request.result, [request.scope]);
    const entity = request.result[request.scope];
    const id = entity?.[`${request.scope}_id`];
    const expected = request.scope === 'proposal' ? proposals.get(id) : decisions.get(id);
    const uniqueKey = `${request.scope}:${request.key}`;
    check(expected && same(expected, entity) && !recordedEntities.has(id)
      && !requestKeys.has(uniqueKey) && same(request.payload, project(entity, request.scope === 'proposal' ? proposalFields : decisionFields)),
    'Idempotency records must describe each original successful mutation exactly once.');
    requestKeys.add(uniqueKey);
    recordedEntities.add(id);
  }
  check(recordedEntities.size === snapshot.proposals.length + snapshot.decisions.length, 'Missing mutation idempotency records.');
  check(same(snapshot.proposals, [...snapshot.proposals].sort((a, b) => compare(a.proposal_id, b.proposal_id)))
    && same(snapshot.decisions, [...snapshot.decisions].sort((a, b) => compare(a.decision_id, b.decision_id)))
    && same(snapshot.requests, [...snapshot.requests].sort((a, b) => compare(a.scope, b.scope) || compare(a.key, b.key))),
  'Snapshot tables must use deterministic order.');
}
