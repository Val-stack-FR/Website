import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { assertPrivateIgnoredOutput, adaptArchiveExport, renderReaderHtml } from './render-reader.mjs';
import { loadDraftBridge } from './draft-bridge.mjs';
import { buildDraftReviewIndex, queryDraftReview, renderDraftReviewPage } from './draft-review.mjs';
import { assertDraftMediaBudget } from './draft-media.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function prepareDraftPreview({ baseDirectory, readerPath, bridgeDirectory, outputPath, occurrencePath, correctionsOrigin, correctionTextIds = [] }) {
  const output = assertPrivateIgnoredOutput(outputPath);
  const base = assertPrivateIgnoredOutput(baseDirectory);
  if (existsSync(output)) throw new Error('A new ignored private output directory is required.');
  const baseProof = JSON.parse(readFileSync(join(base, 'integration-proof.json'), 'utf8'));
  for (const [name, expected] of Object.entries(baseProof.output_hashes)) if (sha(readFileSync(join(base, name))) !== expected) throw new Error('Base preview checksum drift.');
  if (sha(readFileSync(readerPath)) !== baseProof.input_hashes.reader) throw new Error('Reader export differs from the base proof.');
  const directories = Array.isArray(bridgeDirectory) ? bridgeDirectory : [bridgeDirectory];
  if (directories.length < 1 || directories.length > 2) throw new Error('One or two explicit draft bridge directories required.');
  const drafts = directories.map(loadDraftBridge);
  if (new Set(drafts.map(draft => draft.bridge.lot_id)).size !== drafts.length) throw new Error('Distinct draft lots required.');
  const sourceManifest = { manifest_version: 'atelier-draft-source-input/1', corpus_root_reference: 'env:PHD_CORPUS_ROOT', publication_status: 'not-published', bridge_hashes: Object.fromEntries(drafts.map(draft => [draft.bridge.lot_id, draft.checksums['reader-bridge.json']])), review_queue_hashes: Object.fromEntries(drafts.map(draft=>[draft.bridge.lot_id,draft.checksums['review-queue.json']])), source_alias_evidence: Object.fromEntries(drafts.map(draft=>[draft.bridge.lot_id,draft.sourceAliasEvidence])), objects: drafts.flatMap(draft => draft.sourceManifest.objects) };
  const sourceBytes = Buffer.from(JSON.stringify(sourceManifest, null, 2) + '\n');
  const mediaManifest = { manifest_version: 'atelier-draft-local-media/1', corpus_root_reference: 'env:PHD_CORPUS_ROOT', source_manifest_sha256: sha(sourceBytes), publication_status: 'not-published', link_status: 'candidate', objects: drafts.flatMap(draft => draft.mediaManifest.objects) };
  assertDraftMediaBudget(mediaManifest.objects);
  const model = adaptArchiveExport(JSON.parse(readFileSync(readerPath, 'utf8')));
  const html = renderReaderHtml(model, { privatePreview: true, draftDossiers: drafts.map(draft => draft.dossier), correctionsOrigin, correctionTextIds });
  const review = buildDraftReviewIndex(drafts.map(draft=>({bridge:draft.reviewBridge,queue:draft.queue})));
  mkdirSync(output, { recursive: true });
  const hashes = {};
  const write = (name, bytes) => { if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(typeof bytes === 'string' ? bytes : JSON.stringify(bytes, null, 2) + '\n'); writeFileSync(join(output, name), bytes, { flag: 'wx' }); hashes[name] = sha(bytes); };
  for (const name of ['catalogue.json', 'reader-allowlist.json', 'search.html', 'status.html']) write(name, readFileSync(join(base, name)));
  write('reader.html', html);
  write('draft-source-manifest.json', sourceBytes);
  write('draft-media-manifest.json', mediaManifest);
  write('draft-review.html', renderDraftReviewPage(queryDraftReview(review)));
  write('source-alias-evidence.json', sourceManifest.source_alias_evidence);
  if (occurrencePath) write('occurrence.html', readFileSync(occurrencePath));
  write('integration-proof.json', { version: 'atelier-site-draft-integration/1', generated_at: new Date().toISOString(),
    scope: 'private-local', corpus_originals_read: false, historical_confirmation: false, publication_approved: false,
    input_hashes: { base_integration_proof: sha(readFileSync(join(base, 'integration-proof.json'))), reader: baseProof.input_hashes.reader, lots: Object.fromEntries(drafts.map(draft => [draft.bridge.lot_id, draft.checksums])) },
    output_hashes: { ...hashes }, counts: { base_dossiers: model.dossiers.length, draft_dossiers: drafts.length, draft_photographs: mediaManifest.objects.length, draft_fragments: drafts.reduce((total,draft)=>total+draft.bridge.segments.length,0), review_occurrences: review.total, accepted_links_created: 0 },
    limits: ['Candidate-folder-only photographs, no canonical identities or accepted links.', 'Original and modern Markdown preserved and escaped; no historical validation.', 'Selected source bytes require a separate fresh manifest-bound preflight before preview startup.'] });
  return { output, lots: drafts.map(draft=>draft.bridge.lot_id), fragments: drafts.reduce((total,draft)=>total+draft.bridge.segments.length,0), images: mediaManifest.objects.length, review_occurrences: review.total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ strict: true, allowPositionals: false, options: { ...Object.fromEntries(['base', 'reader', 'output', 'occurrence-html', 'corrections-origin'].map(key => [key, { type: 'string' }])), 'bridge-directory': { type: 'string', multiple: true }, 'correction-text-id': { type: 'string', multiple: true } } });
    for (const key of ['base', 'reader', 'bridge-directory', 'output']) if (!values[key]) throw new Error('Required: --' + key);
    console.log(JSON.stringify(prepareDraftPreview({ baseDirectory: resolve(values.base), readerPath: resolve(values.reader), bridgeDirectory: values['bridge-directory'].map(path=>resolve(path)), outputPath: resolve(values.output), occurrencePath: values['occurrence-html'] && resolve(values['occurrence-html']), correctionsOrigin: values['corrections-origin'] ?? null, correctionTextIds: values['correction-text-id'] ?? [] })));
  } catch (error) { console.error('Draft preparation refused: ' + error.message); process.exitCode = 1; }
}
