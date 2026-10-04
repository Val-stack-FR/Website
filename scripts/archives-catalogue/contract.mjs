import { createHash } from 'node:crypto';

export const CATALOGUE_CONTRACT = 'archives-catalogue-discovery/0.1.0';
export const MAX_RECORDS = 20_000;
export const MAX_PAGE_SIZE = 50;

export const COLLECTION_SCOPES = ['clean', 'other'];
export const COLLECTION_TYPES = ['photo', 'scan', 'page', 'unknown'];
export const RECORD_STATUSES = ['metadata-only', 'reader-linked', 'unclassified', 'duplicate-candidate', 'unknown'];
export const PRIORITIES = ['tuce', 'other-family', 'unknown'];
export const TRANSCRIPTION_STATUSES = ['none', 'preexisting-unvalidated', 'multiple-unresolved'];
export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/bmp', 'image/gif', 'image/heic'];

const SHA256 = /^[a-f0-9]{64}$/u;
const ID = /^[a-z][a-z0-9-]*:[A-Za-z0-9._:-]+$/u;
const READER_LINK = /^\/archives\/(?:#[A-Za-z0-9._:-]+)?$/u;

const fail = message => { throw new Error(message); };
const ensure = (condition, message) => { if (!condition) fail(message); };

const strictObject = (value, fields, label) => {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  const keys = Object.keys(value);
  ensure(keys.length === fields.length && fields.every(field => Object.hasOwn(value, field)), `${label} has unexpected or missing fields.`);
  return value;
};

const text = (value, label, max = 500) => {
  ensure(typeof value === 'string' && value.length > 0 && value.length <= max, `${label} must be a bounded nonempty string.`);
  ensure(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value), `${label} contains a forbidden control character.`);
  ensure(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value), `${label} contains invalid Unicode.`);
  return value;
};

const optionalText = (value, label, max = 500) => value === null ? null : text(value, label, max);

const id = (value, label) => {
  text(value, label, 200);
  ensure(ID.test(value), `${label} is not a logical identifier.`);
  return value;
};

const sha256 = (value, label) => {
  ensure(typeof value === 'string' && SHA256.test(value), `${label} must be a lowercase SHA-256.`);
  return value;
};

const integer = (value, label, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  ensure(Number.isSafeInteger(value) && value >= min && value <= max, `${label} must be an integer between ${min} and ${max}.`);
  return value;
};

const oneOf = (value, values, label) => {
  ensure(values.includes(value), `${label} is unsupported.`);
  return value;
};

const logicalPath = (value, label) => {
  text(value, label, 1200);
  ensure(!value.startsWith('/') && !value.startsWith('\\') && !/^[A-Za-z]:/u.test(value), `${label} must not be an absolute path.`);
  ensure(!value.includes('\\') && !value.includes(':') && !value.includes('\0'), `${label} must be a forward-slash logical path.`);
  const parts = value.split('/');
  ensure(parts.every(part => part && part !== '.' && part !== '..'), `${label} contains an unsafe segment.`);
  return value;
};

const timestamp = value => {
  text(value, 'generated_at', 100);
  ensure(/^\d{4}-\d{2}-\d{2}T/u.test(value) && Number.isFinite(Date.parse(value)), 'generated_at must be an ISO timestamp.');
  return value;
};

const optionalTimestamp = (value, label) => {
  if (value === null) return null;
  text(value, label, 100);
  ensure(Number.isFinite(Date.parse(value)), `${label} must be an ISO timestamp or null.`);
  return value;
};

const array = (value, label, max, validator) => {
  ensure(Array.isArray(value) && value.length <= max, `${label} must be an array with at most ${max} entries.`);
  return value.map((entry, index) => validator(entry, `${label}[${index}]`));
};

const candidateValue = (value, label, kind) => {
  strictObject(value, ['literal', 'status'], label);
  ensure(value.status === 'candidate' || value.status === 'unknown', `${label}.status must remain candidate or unknown.`);
  if (value.status === 'unknown') ensure(value.literal === null, `${label}.literal must be null when unknown.`);
  else text(value.literal, `${label}.literal`, kind === 'filename' ? 300 : 120);
  return { literal: value.literal, status: value.status };
};

const nameCandidate = (value, label) => {
  strictObject(value, ['literal', 'status', 'basis'], label);
  text(value.literal, `${label}.literal`, 200);
  ensure(value.status === 'candidate', `${label}.status must remain candidate.`);
  text(value.basis, `${label}.basis`, 300);
  return { literal: value.literal, status: value.status, basis: value.basis };
};

const groupCandidate = (value, label) => {
  if (value === null) return null;
  strictObject(value, ['candidate_id', 'label', 'status', 'basis'], label);
  id(value.candidate_id, `${label}.candidate_id`);
  text(value.label, `${label}.label`, 200);
  ensure(value.status === 'candidate-unclassified', `${label}.status must remain candidate-unclassified.`);
  text(value.basis, `${label}.basis`, 300);
  return { ...value };
};

const duplicateCandidate = (value, label) => {
  if (value === null) return null;
  strictObject(value, ['candidate_set_id', 'status', 'basis'], label);
  id(value.candidate_set_id, `${label}.candidate_set_id`);
  ensure(value.status === 'possible-duplicate', `${label}.status must remain possible-duplicate.`);
  text(value.basis, `${label}.basis`, 300);
  return { ...value };
};

const consultation = (value, label) => {
  strictObject(value, ['available', 'href', 'approval_id'], label);
  ensure(typeof value.available === 'boolean', `${label}.available must be a boolean.`);
  if (value.available) {
    ensure(typeof value.href === 'string' && READER_LINK.test(value.href), `${label}.href must be a bounded reader route.`);
    id(value.approval_id, `${label}.approval_id`);
    ensure(value.approval_id.startsWith('review:'), `${label}.approval_id must be a preserved review ID.`);
  } else {
    ensure(value.href === null && value.approval_id === null, `${label} cannot expose a link without approval.`);
  }
  return { ...value };
};

const transcription = (value, label) => {
  strictObject(value, ['status', 'version_labels'], label);
  oneOf(value.status, TRANSCRIPTION_STATUSES, `${label}.status`);
  const versionLabels = array(value.version_labels, `${label}.version_labels`, 8, (entry, itemLabel) => text(entry, itemLabel, 120));
  if (value.status === 'none') ensure(versionLabels.length === 0, `${label} cannot list versions when status is none.`);
  if (value.status === 'multiple-unresolved') ensure(versionLabels.length >= 2, `${label} needs at least two unresolved version labels.`);
  return { status: value.status, versionLabels };
};

const provenance = (value, label) => {
  strictObject(value, [
    'manifest_record_id', 'discovery_source', 'source_sha256', 'hash_freshness',
    'inventory_observed_at', 'inventory_modified_at'
  ], label);
  id(value.manifest_record_id, `${label}.manifest_record_id`);
  text(value.discovery_source, `${label}.discovery_source`, 160);
  ensure(!/[\\/]/u.test(value.discovery_source) && !/^[A-Za-z]:/u.test(value.discovery_source), `${label}.discovery_source must be a label, not a path.`);
  sha256(value.source_sha256, `${label}.source_sha256`);
  oneOf(value.hash_freshness, ['historical_inventory_hash_not_rechecked', 'not_provided'], `${label}.hash_freshness`);
  const inventoryObservedAt = optionalTimestamp(value.inventory_observed_at, `${label}.inventory_observed_at`);
  const inventoryModifiedAt = optionalTimestamp(value.inventory_modified_at, `${label}.inventory_modified_at`);
  return { ...value, inventory_observed_at: inventoryObservedAt, inventory_modified_at: inventoryModifiedAt };
};

const prepareRecord = (record, index, seenIds) => {
  const label = `records[${index}]`;
  strictObject(record, [
    'catalogue_id', 'sort_key', 'digital_object_id', 'logical_path', 'file_name', 'extension', 'size_bytes', 'collection_id', 'collection_label',
    'collection_scope', 'collection_type', 'media_type', 'status', 'priority', 'name_candidates', 'date_candidate',
    'group_candidates', 'duplicate_candidate', 'transcription', 'consultation', 'interpretation', 'provenance'
  ], label);
  id(record.catalogue_id, `${label}.catalogue_id`);
  ensure(!seenIds.has(record.catalogue_id), `Duplicate catalogue_id: ${record.catalogue_id}`);
  seenIds.add(record.catalogue_id);
  integer(record.sort_key, `${label}.sort_key`);
  if (record.digital_object_id !== null) id(record.digital_object_id, `${label}.digital_object_id`);
  logicalPath(record.logical_path, `${label}.logical_path`);
  const fileName = candidateValue(record.file_name, `${label}.file_name`, 'filename');
  const extension = optionalText(record.extension, `${label}.extension`, 20);
  const sizeBytes = integer(record.size_bytes, `${label}.size_bytes`);
  id(record.collection_id, `${label}.collection_id`);
  text(record.collection_label, `${label}.collection_label`, 160);
  oneOf(record.collection_scope, COLLECTION_SCOPES, `${label}.collection_scope`);
  oneOf(record.collection_type, COLLECTION_TYPES, `${label}.collection_type`);
  oneOf(record.media_type, MEDIA_TYPES, `${label}.media_type`);
  oneOf(record.status, RECORD_STATUSES, `${label}.status`);
  oneOf(record.priority, PRIORITIES, `${label}.priority`);
  const names = array(record.name_candidates, `${label}.name_candidates`, 16, nameCandidate);
  const date = candidateValue(record.date_candidate, `${label}.date_candidate`, 'date');
  const groups = array(record.group_candidates, `${label}.group_candidates`, 16, groupCandidate);
  ensure(groups.every(Boolean), `${label}.group_candidates cannot contain null.`);
  const duplicate = duplicateCandidate(record.duplicate_candidate, `${label}.duplicate_candidate`);
  const transcriptions = transcription(record.transcription, `${label}.transcription`);
  const reader = consultation(record.consultation, `${label}.consultation`);
  ensure(record.interpretation === 'file-not-act', `${label}.interpretation must remain file-not-act.`);
  const source = provenance(record.provenance, `${label}.provenance`);
  if (record.status === 'reader-linked') ensure(reader.available, `${label} reader-linked status requires an approved reader link.`);
  if (record.status === 'duplicate-candidate') ensure(duplicate !== null, `${label} duplicate-candidate status requires a candidate set.`);
  return {
    catalogueId: record.catalogue_id,
    sortKey: record.sort_key,
    digitalObjectId: record.digital_object_id,
    logicalPath: record.logical_path,
    fileName,
    extension,
    sizeBytes,
    collectionId: record.collection_id,
    collectionLabel: record.collection_label,
    collectionScope: record.collection_scope,
    collectionType: record.collection_type,
    mediaType: record.media_type,
    status: record.status,
    priority: record.priority,
    names,
    date,
    groups,
    duplicate,
    transcription: transcriptions,
    consultation: reader,
    interpretation: record.interpretation,
    provenance: source
  };
};

export function prepareCatalogue(input, options = {}) {
  strictObject(input, ['schema_version', 'package_id', 'generated_at', 'source_manifest_sha256', 'record_count', 'default_collection_scope', 'records', 'limitations'], 'catalogue');
  ensure(input.schema_version === CATALOGUE_CONTRACT, `Unsupported schema_version: ${input.schema_version}`);
  id(input.package_id, 'package_id');
  timestamp(input.generated_at);
  sha256(input.source_manifest_sha256, 'source_manifest_sha256');
  integer(input.record_count, 'record_count', 1, MAX_RECORDS);
  ensure(input.default_collection_scope === 'clean', 'The default collection scope must remain clean.');
  ensure(Array.isArray(input.records) && input.records.length === input.record_count, 'record_count must equal records.length.');
  const seenIds = new Set();
  const records = input.records.map((record, index) => prepareRecord(record, index, seenIds));
  records.sort((left, right) => left.sortKey - right.sortKey || left.catalogueId.localeCompare(right.catalogueId, 'fr'));
  const limitations = array(input.limitations, 'limitations', 24, (entry, label) => text(entry, label, 500));
  ensure(limitations.length > 0, 'At least one limitation is required.');
  return {
    schemaVersion: CATALOGUE_CONTRACT,
    packageId: input.package_id,
    generatedAt: input.generated_at,
    sourceManifestSha256: input.source_manifest_sha256,
    inputSha256: options.inputSha256
      ? sha256(options.inputSha256, 'input file SHA-256')
      : createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    defaultCollectionScope: input.default_collection_scope,
    limitations,
    records
  };
}

export const normalizeSearch = value => String(value ?? '')
  .normalize('NFD')
  .replace(/\p{M}+/gu, '')
  .toLocaleLowerCase('fr')
  .replace(/[-_.]+/gu, ' ')
  .replace(/\s+/gu, ' ')
  .trim();

const searchable = record => normalizeSearch([
  ...record.names.map(name => name.literal),
  record.logicalPath,
  record.collectionType,
  record.status,
  record.priority,
  record.fileName.literal ?? ''
].join(' '));

const integerParameter = (value, label, fallback, min, max) => {
  if (value === undefined || value === null || value === '') return fallback;
  ensure(/^\d+$/u.test(String(value)), `${label} must be an integer.`);
  return integer(Number(value), label, min, max);
};

export function queryCatalogue(model, parameters = {}) {
  const query = normalizeSearch(parameters.query ?? '');
  ensure(query.length <= 100, 'query exceeds 100 characters.');
  const collectionScope = parameters.collection_scope || model.defaultCollectionScope;
  ensure(collectionScope === 'clean' || collectionScope === 'all', 'Unsupported collection_scope.');
  const collectionType = parameters.collection_type || '';
  const status = parameters.status || '';
  const priority = parameters.priority || '';
  if (collectionType) oneOf(collectionType, COLLECTION_TYPES, 'collection_type');
  if (status) oneOf(status, RECORD_STATUSES, 'status');
  if (priority) oneOf(priority, PRIORITIES, 'priority');
  const page = integerParameter(parameters.page, 'page', 1, 1, MAX_RECORDS);
  const pageSize = integerParameter(parameters.page_size, 'page_size', MAX_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const matched = model.records.filter(record => {
    if (collectionScope === 'clean' && record.collectionScope !== 'clean') return false;
    if (collectionType && record.collectionType !== collectionType) return false;
    if (status && record.status !== status) return false;
    if (priority && record.priority !== priority) return false;
    return !query || searchable(record).includes(query);
  });
  const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
  const offset = (page - 1) * pageSize;
  const records = offset < matched.length ? matched.slice(offset, offset + pageSize) : [];
  return {
    contract_version: model.schemaVersion,
    package: {
      package_id: model.packageId,
      generated_at: model.generatedAt,
      source_manifest_sha256: model.sourceManifestSha256,
      input_sha256: model.inputSha256,
      limitations: model.limitations
    },
    filters: { query, collection_scope: collectionScope, collection_type: collectionType, status, priority },
    counts: {
      inventory_image_files: model.records.length,
      clean_image_files: model.records.filter(record => record.collectionScope === 'clean').length,
      reader_links: model.records.filter(record => record.consultation.available).length,
      matched_image_files: matched.length
    },
    pagination: { page, page_size: pageSize, page_count: pageCount, returned_records: records.length },
    records
  };
}

