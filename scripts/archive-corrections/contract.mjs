import { createHash } from 'node:crypto';
import { PASSAGE, SYNTHETIC_CONTEXT } from './fixture.mjs';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ensure(condition, status, code, message) {
  if (!condition) throw new ApiError(status, code, message);
}

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digest(value) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function exactFields(value, fields) {
  ensure(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every(key => Object.hasOwn(value, key)),
  422, 'invalid_fields', 'The object must contain exactly the documented fields. Client roles are not accepted.');
}

export function boundedText(value, field, max = 1000) {
  ensure(typeof value === 'string' && value.trim().length > 0 && value.length <= max
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value),
  422, 'invalid_text', `${field} must be nonempty text of at most ${max} characters.`);
}

export function evidence(value, passage = PASSAGE) {
  ensure(Array.isArray(value) && value.length > 0 && value.length <= 8
    && new Set(value).size === value.length
    && value.every(ref => passage.evidence_refs.includes(ref)),
  422, 'invalid_evidence', 'Only evidence refs in this explicitly selected passage are supported.');
}

const entityIdPatterns = {
  proposal: /^proposal_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  decision: /^decision_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
};

export function isEntityId(value, kind) {
  return typeof value === 'string' && entityIdPatterns[kind]?.test(value) === true;
}

export function validatePayload(scope, payload, passage = PASSAGE) {
  const fields = scope === 'proposal'
    ? ['passage_id', 'base_revision', 'replacement_text', 'reason', 'evidence_refs', 'simulation']
    : ['proposal_id', 'base_revision', 'outcome', 'reason', 'evidence_refs', 'simulation'];
  exactFields(payload, fields);
  ensure(payload.simulation === true, 422, 'simulation_required', 'This service accepts simulation:true only.');
  boundedText(payload.base_revision, 'base_revision', 100);
  ensure(payload.base_revision.startsWith(`${passage.passage_id}:r`)
    && /^[1-9][0-9]*$/.test(payload.base_revision.slice(passage.passage_id.length + 2)),
    422, 'invalid_revision', 'Use a text_revision from this selected passage.');
  boundedText(payload.reason, 'reason');
  evidence(payload.evidence_refs, passage);
  if (scope === 'proposal') {
    ensure(payload.passage_id === passage.passage_id, 422, 'synthetic_only', 'Only the explicitly selected passage is supported.');
    boundedText(payload.replacement_text, 'replacement_text', 5000);
  } else {
    ensure(isEntityId(payload.proposal_id, 'proposal'),
      422, 'invalid_proposal_id', 'Use a proposal_id returned by this service.');
    ensure(['accept', 'reject'].includes(payload.outcome), 422, 'invalid_outcome', 'outcome must be accept or reject.');
  }
}

export function validateKey(key) {
  ensure(typeof key === 'string' && /^[A-Za-z0-9._:-]{8,100}$/.test(key),
    422, 'invalid_idempotency_key', 'Idempotency-Key must be 8–100 ASCII letters, digits or ._:-');
}

export function envelope(data, context = SYNTHETIC_CONTEXT) {
  return { api_version: context.apiVersion, data_kind: context.dataKind, simulation: true, ...data };
}
