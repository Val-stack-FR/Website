import { readFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ensure, boundedText, canonical } from './contract.mjs';

export const READER_PACKAGE_ENV = 'ARCHIVE_CORRECTIONS_READER_PACKAGE';
export const MONBEZON_TEXT_ID = 'text:atelier-494756c2009be577ad11a5eb0a662d38';
// The coordinator authorized this exact private MVP-I2 package for local consultation.
// These immutable derivative fingerprints grant neither public rights nor a historical review.
export const BUNDLE_HASHES = Object.freeze({
  'export-candidate.json': 'c037723e0a90b5b03f3e535d3781bb49ae6e99e99da5e719c2cf09d5af09226c',
  'research-package.json': 'ce07b1bd18adb2b6739e0afa62b628c7fdbd42312908fd99a11d656569bf4faf',
  'source-input-manifest.json': '28acce7928f17b8c7a3b39f24933273730ae691107678b876b840ee8c04a3148',
  'preflight-report.json': '103d3e8fabd2d4574298905435023d4d5c49aa47b5d9063aa9aff0af25f30df2',
  'media-allowlist.json': '64c6406d1d88ff24e4268e75a8066a194decf999c75199d6caf9f836655edd59',
  'verification-final.json': 'b3af3430348d20901018fc9b9f066313d163165243ffd27661122837cb9ef689',
});
const same = (a, b) => canonical(a) === canonical(b);
const check = condition => ensure(condition, 422, 'reader_binding_refused', 'The exact private reader package and accepted allowlist are required.');

export function loadReaderContext(directory, textId = MONBEZON_TEXT_ID) {
  ensure(typeof directory === 'string' && directory.length > 0, 422, 'reader_package_required', `Set ${READER_PACKAGE_ENV} to the authorized private derivative package.`);
  check(textId === MONBEZON_TEXT_ID);
  let files;
  try {
    const dir = lstatSync(directory);
    check(dir.isDirectory() && !dir.isSymbolicLink());
    files = Object.fromEntries(Object.entries(BUNDLE_HASHES).map(([name, expected]) => {
      const path = join(directory, name);
      const info = lstatSync(path);
      check(info.isFile() && !info.isSymbolicLink() && info.size <= 2 * 1024 * 1024);
      const bytes = readFileSync(path);
      check(createHash('sha256').update(bytes).digest('hex') === expected);
      return [name, JSON.parse(bytes.toString('utf8'))];
    }));
  } catch (error) {
    if (error.code === 'reader_binding_refused') throw error;
    check(false); // No private path or parser content appears in client or CLI diagnostics.
  }
  const output = files['export-candidate.json'];
  const research = files['research-package.json'];
  const manifest = files['source-input-manifest.json'];
  const preflight = files['preflight-report.json'];
  const allowlist = files['media-allowlist.json'];
  const proof = files['verification-final.json'];
  check(preflight.passed === true && preflight.input_manifest_sha256 === BUNDLE_HASHES['source-input-manifest.json']
    && proof.canonical_research_schema_valid === true && proof.canonical_references_valid === true
    && proof.export_schema_valid === true && proof.media_allowlist_schema_valid === true
    && proof.source_bytes_unchanged === true && proof.repeat_artifacts_identical === true
    && proof.publication_status === 'not-published' && output.publication.approved_for_publication === false);
  const text = output.texts.find(item => item.text_id === textId);
  const candidate = output.candidates.find(item => item.text_ids.includes(textId));
  const transcription = research.transcriptions.find(item => item.transcription_id === text?.transcription_id);
  const source = allowlist.objects.find(item => item.digital_object_id === text?.source_object_id);
  const input = manifest.objects.find(item => item.digital_object_id === text?.source_object_id);
  const link = output.approved_links.find(item => item.source_object_id === text?.source_object_id);
  check(text && candidate && transcription && source && input && link);
  check(candidate.act_id === null && candidate.document_id === null && candidate.reading_status === 'unreviewed'
    && text.reading_status === 'unreviewed' && text.translation === null && transcription.review_status === 'unreviewed'
    && transcription.revision === text.revision && transcription.source_digital_object_id === text.source_object_id
    && transcription.text_digital_object_id === text.digital_object_id && source.bytes_verified === true
    && source.sha256 === text.revision && input.expected_sha256 === text.revision
    && source.approved_review_id === link.review_id && input.approved_review_id === link.review_id
    && link.review_status === 'accepted' && link.confidence === 'certain'
    && input.rights.local_consultation === 'authorized'
    && same(candidate.view_ids, link.applied_target_object_ids));
  for (const id of candidate.view_ids) {
    const object = allowlist.objects.find(item => item.digital_object_id === id);
    const selected = manifest.objects.find(item => item.digital_object_id === id);
    check(object?.bytes_verified === true && object.approved_review_id === link.review_id
      && object.view_id === id && selected?.approved_review_id === link.review_id
      && object.sha256 === selected.expected_sha256 && selected.rights.local_consultation === 'authorized');
  }
  boundedText(text.literal, 'reader literal', 5000);
  const passage = {
    passage_id: text.text_id, title: candidate.label, data_kind: 'historical-local', simulation: true,
    candidate_id: candidate.candidate_id, act_id: null, document_id: null,
    transcription_id: text.transcription_id, digital_object_id: text.digital_object_id,
    source_object_id: text.source_object_id, source_revision: text.revision,
    reading_status: 'unreviewed', translation: null, evidence_refs: [...text.evidence_locator_ids],
    linked_view_ids: [...candidate.view_ids], link_review_id: link.review_id,
    link_review_scope: 'digital-object-association-only', publication_status: 'not-published',
    public_rights_review: 'pending', package_id: output.package_id,
    package_sha256: BUNDLE_HASHES['export-candidate.json'],
  };
  const initialRevision = {
    passage_id: passage.passage_id, text_revision: `${passage.passage_id}:r1`, revision_number: 1,
    based_on_revision: null, decision_id: null, text: text.literal, evidence_refs: passage.evidence_refs,
    actor_role: 'seed_reader_local', created_at: new Date(proof.verified_at).toISOString(), simulation: true,
  };
  return { passage, initialRevision, apiVersion: 'archive-corrections/reader-local-v1',
    snapshotVersion: 'archive-corrections-reader-snapshot/v1', dataKind: 'historical-local', ownerRole: 'owner_local' };
}
