import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { CATALOGUE_CONTRACT, MAX_RECORDS, prepareCatalogue } from './contract.mjs';

const COVERAGE_VERSION = 'coverage-object/1.0.0';
const RELATION_VERSION = 'coverage-relation/1.0.0';
const ALLOWLIST_VERSION = 'archives-catalogue-reader-allowlist/0.1.0';
const SHA256 = /^[a-f0-9]{64}$/u;
const OBJECT_ID = /^object:path-[a-f0-9]{64}$/u;
const IMAGE_EXTENSIONS = new Map([
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'],
  ['.tif', 'image/tiff'], ['.tiff', 'image/tiff'], ['.webp', 'image/webp'],
  ['.bmp', 'image/bmp'], ['.gif', 'image/gif'], ['.heic', 'image/heic']
]);
const REQUIRED_OBJECT_FIELDS = [
  'schema_version', 'object_id', 'object_id_basis', 'logical_path', 'path_provenance',
  'collection', 'extension', 'size_bytes', 'inventory_observed_at', 'discovery_role',
  'role_basis', 'sha256', 'hash_freshness', 'candidate_groups', 'status',
  'canonical_link_status', 'archive_content_inspected', 'rights_status'
];
const OPTIONAL_OBJECT_FIELDS = [
  'inventory_modified_at', 'inventory_role_guess', 'duplicate_occurrence',
  'candidate_priority', 'canonical_link_evidence'
];
const OBJECT_FIELDS = new Set([...REQUIRED_OBJECT_FIELDS, ...OPTIONAL_OBJECT_FIELDS]);

const fail = message => { throw new Error(message); };
const ensure = (condition, message) => { if (!condition) fail(message); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const object = (value, label) => {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  return value;
};
const boundedText = (value, label, max = 1200) => {
  ensure(typeof value === 'string' && value.length > 0 && value.length <= max, `${label} must be bounded text.`);
  ensure(!/[\u0000-\u001f\u007f]/u.test(value), `${label} contains a control character.`);
  return value;
};
const logicalPath = (value, label) => {
  boundedText(value, label);
  ensure(!value.startsWith('/') && !value.includes('\\') && !/^[A-Za-z]:/u.test(value), `${label} must be logical, not physical.`);
  ensure(value.split('/').every(part => part && part !== '.' && part !== '..'), `${label} contains an unsafe segment.`);
  return value;
};
const timestampOrNull = (value, label) => {
  if (value === null) return null;
  boundedText(value, label, 100);
  ensure(Number.isFinite(Date.parse(value)), `${label} must be an ISO timestamp or null.`);
  return value;
};

const parseJson = (bytes, label) => {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { return fail(`${label} is not valid JSON.`); }
};

const parseJsonLines = (bytes, label) => {
  const source = bytes.toString('utf8');
  ensure(!source.startsWith('\ufeff'), `${label} must not contain a BOM.`);
  const lines = source.split(/\r?\n/u);
  if (lines.at(-1) === '') lines.pop();
  ensure(lines.length > 0 && lines.every(Boolean), `${label} must contain one JSON object per nonempty line.`);
  return lines.map((line, index) => parseJson(Buffer.from(line), `${label} line ${index + 1}`));
};

export const validateCoverageObject = (record, index) => {
  const label = `catalogue line ${index + 1}`;
  object(record, label);
  ensure(Object.keys(record).every(key => OBJECT_FIELDS.has(key)), `${label} has an unsupported field.`);
  ensure(REQUIRED_OBJECT_FIELDS.every(key => Object.hasOwn(record, key)), `${label} misses a required field.`);
  ensure(record.schema_version === COVERAGE_VERSION, `${label} has an unsupported schema_version.`);
  ensure(typeof record.object_id === 'string' && OBJECT_ID.test(record.object_id), `${label}.object_id is invalid.`);
  logicalPath(record.logical_path, `${label}.logical_path`);
  boundedText(record.collection, `${label}.collection`, 200);
  // Coverage preserves unconventional inventory suffixes, including its explicit
  // no-extension marker. Only projected images must match IMAGE_EXTENSIONS.
  ensure(record.extension === null || record.extension === '(sans extension)' ||
    (typeof record.extension === 'string' && /^\.[A-Za-z0-9_#-]{1,99}$/u.test(record.extension)), `${label}.extension is invalid.`);
  ensure(Number.isSafeInteger(record.size_bytes) && record.size_bytes >= 0, `${label}.size_bytes is invalid.`);
  timestampOrNull(record.inventory_observed_at, `${label}.inventory_observed_at`);
  timestampOrNull(record.inventory_modified_at ?? null, `${label}.inventory_modified_at`);
  ensure(['image', 'transcription', 'other_text_or_document', 'annex_or_document', 'other_media', 'compressed_archive', 'other'].includes(record.discovery_role), `${label}.discovery_role is invalid.`);
  ensure(record.sha256 === null || (typeof record.sha256 === 'string' && SHA256.test(record.sha256)), `${label}.sha256 is invalid.`);
  ensure(['historical_inventory_hash_not_rechecked', 'not_provided'].includes(record.hash_freshness), `${label}.hash_freshness is invalid.`);
  ensure(Array.isArray(record.candidate_groups) && record.candidate_groups.length <= 16, `${label}.candidate_groups is invalid.`);
  ensure(['existing_text', 'accepted_link', 'candidate_group_lead', 'candidate_name_lead', 'unknown'].includes(record.status), `${label}.status is invalid.`);
  ensure(['accepted', 'not_in_examined_canonical_links'].includes(record.canonical_link_status), `${label}.canonical_link_status is invalid.`);
  ensure(record.archive_content_inspected === false && record.rights_status === 'unknown', `${label} overstates inspection or rights.`);
  if (Object.hasOwn(record, 'duplicate_occurrence')) ensure(record.duplicate_occurrence === 'kept_as_distinct_path_occurrence', `${label}.duplicate_occurrence is invalid.`);
  return record;
};

const relationIndex = relations => {
  const bySubject = new Map();
  for (const [index, relation] of relations.entries()) {
    const label = `relations line ${index + 1}`;
    object(relation, label);
    ensure(relation.schema_version === RELATION_VERSION, `${label} has an unsupported schema_version.`);
    ensure(typeof relation.subject_id === 'string' && OBJECT_ID.test(relation.subject_id), `${label}.subject_id is invalid.`);
    ensure(['file-in-collection', 'exact-byte-duplicate-group', 'photo-group-candidate', 'priority-evidence'].includes(relation.type), `${label}.type is invalid.`);
    const list = bySubject.get(relation.subject_id) ?? [];
    list.push(relation);
    bySubject.set(relation.subject_id, list);
  }
  return bySubject;
};

const validateChecksums = (checksums, files) => {
  object(checksums, 'checksums');
  for (const [name, bytes] of Object.entries(files)) {
    ensure(typeof checksums[name] === 'string' && SHA256.test(checksums[name]), `checksums.json lacks ${name}.`);
    ensure(checksums[name] === digest(bytes), `${name} does not match checksums.json.`);
  }
};

const loadAllowlist = async path => {
  if (!path) return new Map();
  const input = object(parseJson(await readFile(path), 'reader allowlist'), 'reader allowlist');
  ensure(input.schema_version === ALLOWLIST_VERSION && Array.isArray(input.entries), 'Reader allowlist contract is invalid.');
  const entries = new Map();
  for (const [index, entry] of input.entries.entries()) {
    const label = `reader allowlist entry ${index + 1}`;
    object(entry, label);
    ensure(Object.keys(entry).length === 3 && ['object_id', 'href', 'review_id'].every(key => Object.hasOwn(entry, key)), `${label} has unexpected fields.`);
    ensure(OBJECT_ID.test(entry.object_id), `${label}.object_id is invalid.`);
    ensure(/^\/archives\/(?:#[A-Za-z0-9._:-]+)?$/u.test(entry.href), `${label}.href is not a reader route.`);
    ensure(/^review:[A-Za-z0-9._:-]+$/u.test(entry.review_id), `${label}.review_id is invalid.`);
    ensure(!entries.has(entry.object_id), `${label}.object_id is duplicated.`);
    entries.set(entry.object_id, entry);
  }
  return entries;
};

const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const unique = values => [...new Set(values)];
const mediaType = extension => IMAGE_EXTENSIONS.get(extension?.toLocaleLowerCase('en')) ?? null;
const collectionType = path => /(^|\/)photos? des archives(?:\/|$)/iu.test(path) ? 'photo' : /(^|\/)scans?(?:\/|$)/iu.test(path) ? 'scan' : 'unknown';
const cleanScope = collection => collection.toLocaleLowerCase('fr') === 'clean' ? 'clean' : 'other';

const readerConsultation = (record, allowlist) => {
  const entry = allowlist.get(record.object_id);
  if (!entry) return { available: false, href: null, approval_id: null };
  ensure(record.canonical_link_status === 'accepted', `Allowlisted ${record.object_id} is not accepted by coverage metadata.`);
  const evidence = Array.isArray(record.canonical_link_evidence) ? record.canonical_link_evidence : [];
  ensure(evidence.some(item => item && item.review_id === entry.review_id), `Allowlisted ${record.object_id} lacks matching review evidence.`);
  return { available: true, href: entry.href, approval_id: entry.review_id };
};

const groupCandidates = record => record.candidate_groups.map((candidate, index) => {
  object(candidate, `${record.object_id}.candidate_groups[${index}]`);
  boundedText(candidate.group_id, `${record.object_id}.candidate_groups[${index}].group_id`, 80);
  boundedText(candidate.evidence, `${record.object_id}.candidate_groups[${index}].evidence`, 300);
  return {
    candidate_id: `group:photo-${candidate.group_id.replace(/[^A-Za-z0-9._-]/gu, '-')}`,
    label: `Groupe ${candidate.group_id}`,
    status: 'candidate-unclassified',
    basis: candidate.evidence
  };
});

const nameCandidates = record => unique(record.candidate_groups.flatMap(group => Array.isArray(group.matched_label_tokens) ? group.matched_label_tokens : []))
  .slice(0, 16)
  .map(token => ({ literal: boundedText(token, `${record.object_id}.matched_label_token`, 200), status: 'candidate', basis: 'Jeton candidat issu d’un libellé de groupe.' }));

export async function adaptCoverage({ cataloguePath, relationsPath, summaryPath, inputManifestPath, checksumsPath, allowlistPath = null, generatedAt, collectionScope = 'all' }) {
  ensure(['clean', 'all'].includes(collectionScope), 'Unsupported projection collection scope.');
  ensure(Number.isFinite(Date.parse(generatedAt)), 'generatedAt must be an ISO timestamp supplied by the caller.');
  const [catalogueBytes, relationsBytes, summaryBytes, inputManifestBytes, checksumsBytes, allowlist] = await Promise.all([
    readFile(cataloguePath), readFile(relationsPath), readFile(summaryPath), readFile(inputManifestPath), readFile(checksumsPath), loadAllowlist(allowlistPath)
  ]);
  validateChecksums(parseJson(checksumsBytes, 'checksums.json'), {
    'catalogue.jsonl': catalogueBytes,
    'relations.jsonl': relationsBytes,
    'summary.json': summaryBytes,
    'input-manifest.json': inputManifestBytes
  });
  const coverageRecords = parseJsonLines(catalogueBytes, 'catalogue.jsonl').map(validateCoverageObject);
  ensure(coverageRecords.length <= MAX_RECORDS, `Coverage catalogue exceeds ${MAX_RECORDS} records.`);
  const relations = relationIndex(parseJsonLines(relationsBytes, 'relations.jsonl'));
  const summary = object(parseJson(summaryBytes, 'summary.json'), 'summary.json');
  ensure(summary.source_originals_read === false, 'summary.json must prove source_originals_read=false.');
  ensure(summary.excluded_rows === 0, 'The adapter refuses a partial coverage projection.');
  ensure(summary.catalogued_rows === coverageRecords.length, 'summary.json catalogued_rows does not match catalogue.jsonl.');
  const inputManifest = object(parseJson(inputManifestBytes, 'input-manifest.json'), 'input-manifest.json');
  ensure(inputManifest.version === 'coverage-input-manifest/1' && Array.isArray(inputManifest.inputs), 'input-manifest.json contract is invalid.');
  const seen = new Set();
  const images = coverageRecords.filter(record => record.discovery_role === 'image' && (collectionScope === 'all' || cleanScope(record.collection) === 'clean'));
  const isTuce = record => (relations.get(record.object_id) ?? []).some(item => item.type === 'priority-evidence' && item.object_id === 'priority:tuce-name') || record.candidate_priority === 'Tuce_name_or_photo_group_evidence';
  images.sort((left, right) => Number(isTuce(right)) - Number(isTuce(left)) || compareText(left.logical_path, right.logical_path));
  const records = images.map((record, index) => {
    ensure(!seen.has(record.object_id), `Duplicate coverage object_id: ${record.object_id}`);
    seen.add(record.object_id);
    const related = relations.get(record.object_id) ?? [];
    const duplicateRelation = related.find(item => item.type === 'exact-byte-duplicate-group');
    const consultation = readerConsultation(record, allowlist);
    const groups = groupCandidates(record);
    const scope = cleanScope(record.collection);
    const extension = record.extension?.toLocaleLowerCase('en') ?? null;
    const type = mediaType(extension);
    ensure(type, `Image ${record.object_id} has an unsupported extension.`);
    const priority = related.some(item => item.type === 'priority-evidence' && item.object_id === 'priority:tuce-name') || record.candidate_priority === 'Tuce_name_or_photo_group_evidence'
      ? 'tuce'
      : scope === 'other' ? 'other-family' : 'unknown';
    const status = duplicateRelation ? 'duplicate-candidate'
      : consultation.available ? 'reader-linked'
      : groups.length ? 'unclassified'
      : record.status === 'unknown' ? 'unknown' : 'metadata-only';
    return {
      catalogue_id: record.object_id,
      sort_key: index + 1,
      digital_object_id: record.object_id,
      logical_path: record.logical_path,
      file_name: { literal: basename(record.logical_path), status: 'candidate' },
      extension,
      size_bytes: record.size_bytes,
      collection_id: `collection:${createHash('sha256').update(record.collection).digest('hex')}`,
      collection_label: record.collection,
      collection_scope: scope,
      collection_type: collectionType(record.logical_path),
      media_type: type,
      status,
      priority,
      name_candidates: nameCandidates(record),
      date_candidate: { literal: null, status: 'unknown' },
      group_candidates: groups,
      duplicate_candidate: duplicateRelation ? {
        candidate_set_id: duplicateRelation.object_id,
        status: 'possible-duplicate',
        basis: 'Relation de doublon exact issue d’une empreinte historique non revérifiée.'
      } : null,
      transcription: { status: 'none', version_labels: [] },
      consultation,
      interpretation: 'file-not-act',
      provenance: {
        manifest_record_id: record.object_id,
        discovery_source: 'coverage-catalogue-1.0.0',
        source_sha256: digest(catalogueBytes),
        hash_freshness: record.hash_freshness,
        inventory_observed_at: record.inventory_observed_at,
        inventory_modified_at: record.inventory_modified_at ?? null
      }
    };
  });
  for (const objectId of allowlist.keys()) ensure(seen.has(objectId), `Allowlist object ${objectId} is not an image in catalogue.jsonl.`);
  const output = {
    schema_version: CATALOGUE_CONTRACT,
    package_id: `package:coverage-${digest(catalogueBytes).slice(0, 16)}`,
    generated_at: generatedAt,
    source_manifest_sha256: digest(inputManifestBytes),
    record_count: records.length,
    default_collection_scope: 'clean',
    records,
    limitations: [
      'Projection locale de métadonnées de découverte; aucun original n’a été lu.',
      'Les fichiers sont des occurrences distinctes et ne sont pas des actes identifiés.',
      'Noms, groupes et doublons restent des candidats; les dates ne sont pas déduites des chemins.',
      'Une empreinte historique est signalée comme non revérifiée et ne prouve pas l’état actuel du fichier.',
      ...(collectionScope === 'clean' ? [
        'CLEAN constitue le fonds principal; les branches Sync et Random ne sont pas projetées dans cette consultation.',
        `L’inventaire CLEAN contient ${coverageRecords.filter(record => cleanScope(record.collection) === 'clean').length} fichiers de tous types; ce catalogue projette ${images.length} images classées par extension. Aucun de ces comptes n’est un nombre d’actes.`
      ] : [])
    ]
  };
  prepareCatalogue(output);
  return output;
}

async function main() {
  try {
    const { values } = parseArgs({ strict: true, allowPositionals: false, options: {
      catalogue: { type: 'string' }, relations: { type: 'string' }, summary: { type: 'string' },
      'input-manifest': { type: 'string' }, checksums: { type: 'string' }, allowlist: { type: 'string' },
      output: { type: 'string' }, 'generated-at': { type: 'string' }, 'collection-scope': { type: 'string', default: 'clean' }
    } });
    for (const required of ['catalogue', 'relations', 'summary', 'input-manifest', 'checksums', 'output', 'generated-at']) {
      if (!values[required]) fail(`Required: --${required}.`);
    }
    const output = await adaptCoverage({
      cataloguePath: resolve(values.catalogue), relationsPath: resolve(values.relations), summaryPath: resolve(values.summary),
      inputManifestPath: resolve(values['input-manifest']), checksumsPath: resolve(values.checksums),
      allowlistPath: values.allowlist ? resolve(values.allowlist) : null, generatedAt: values['generated-at'], collectionScope: values['collection-scope']
    });
    await writeFile(resolve(values.output), `${JSON.stringify(output)}\n`, { encoding: 'utf8', flag: 'wx' });
    console.log(`Wrote ${output.record_count} image metadata records.`);
  } catch (error) {
    console.error(`Coverage adapter refused: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();

