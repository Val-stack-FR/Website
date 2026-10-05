import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createDraftDossier } from './draft-dossier.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const ensure = (test, message) => { if (!test) throw new Error('Draft bridge: ' + message); };
const load = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/u, ''));
const inside = (root,file) => { const part = relative(root,file); return part && !isAbsolute(part) && part !== '..' && !part.startsWith('..'+sep); };

// Reconcile a technical logical URI only through the explicitly hashed source
// package and source-ID mapping. Upstream bridge and queue bytes stay unchanged.
function reconcileSourceAliases(directory, bridge, queue) {
  const missing = queue.entries.filter(entry=>!Object.hasOwn(bridge.verified_input_hashes,entry.source_logical_uri));
  if (!missing.length) return { reviewBridge:bridge, sourceAliasEvidence:null };
  const manifestPath = join(dirname(directory),bridge.lot_id+'.inputs.json');
  const manifestBytes = readFileSync(manifestPath), manifest = JSON.parse(manifestBytes.toString('utf8'));
  ensure(manifest.format === bridge.format && manifest.lot_id === bridge.lot_id && manifest.permitted_use === 'private-derived-consultation' && Array.isArray(manifest.entries), 'explicit source alias manifest required.');
  const root = realpathSync(resolve(directory,'../../../../..'));
  const campaign = realpathSync(join(root,'data/private/transcription-campaign'));
  const readEntry = entry => {
    ensure(entry && typeof entry.path === 'string' && !isAbsolute(entry.path) && !/^[A-Za-z]:/u.test(entry.path) && !entry.path.split(/[\\/]/u).some(part=>part === '..') && bridge.verified_input_hashes[entry.path] === entry.sha256, 'source alias path/hash missing from bridge.');
    const file = realpathSync(resolve(root,entry.path)); ensure(inside(campaign,file),'source alias resolves outside private campaign derivatives.');
    const bytes = readFileSync(file); ensure(sha(bytes) === entry.sha256,'source alias input checksum drift.'); return bytes;
  };
  const packageEntries = manifest.entries.filter(entry=>entry.role === 'package'); ensure(packageEntries.length === 1,'one exact source package required.');
  const packageBytes = readEntry(packageEntries[0]), packageData = JSON.parse(packageBytes.toString('utf8'));
  ensure(packageData.scope === 'derived-draft' && packageData.publication_status === 'private' && Array.isArray(packageData.sources) && Array.isArray(packageData.segments),'private source package required.');
  const hashes = {...bridge.verified_input_hashes}, bindings = new Map();
  for (const entry of missing) {
    const candidates = packageData.sources.filter(source=>source.id === entry.source_id);
    ensure(candidates.length === 1 && candidates[0].logical_uri === entry.source_logical_uri && candidates[0].sha256 === entry.source_sha256,'logical source alias does not match its exact source ID/URI/hash.');
    const sourceEntries = manifest.entries.filter(source=>source.role === 'source_text' && source.source_id === entry.source_id);
    ensure(sourceEntries.length === 1 && sourceEntries[0].sha256 === entry.source_sha256,'source alias manifest mapping differs.');
    const matchingSegments = packageData.segments.filter(segment=>segment.id === entry.segment_id);
    ensure(matchingSegments.length === 1,'source alias segment identity is missing or ambiguous.');
    const segment = matchingSegments[0];
    ensure(segment?.source_id === entry.source_id && segment.base_revision === entry.base_revision && segment.working_transcription?.text === entry.passage,'source alias segment/revision/passage drift.');
    if (!bindings.has(entry.source_id)) { readEntry(sourceEntries[0]); bindings.set(entry.source_id,{source_id:entry.source_id,logical_uri:entry.source_logical_uri,sha256:entry.source_sha256,verified_path:sourceEntries[0].path}); }
    ensure(hashes[entry.source_logical_uri] == null || hashes[entry.source_logical_uri] === entry.source_sha256,'ambiguous source alias.');
    hashes[entry.source_logical_uri] = entry.source_sha256;
  }
  return {reviewBridge:{...bridge,verified_input_hashes:hashes},sourceAliasEvidence:{format:'private-derived-source-alias-evidence/1',manifest_sha256:sha(manifestBytes),package_path:packageEntries[0].path,package_sha256:sha(packageBytes),bindings:[...bindings.values()],upstream_modified:false,historical_confirmation:false}};
}

export function loadDraftBridge(directory) {
  const checksums = load(join(directory, 'checksums.json'));
  for (const name of ['reader-bridge.json', 'review-queue.json']) ensure(sha(readFileSync(join(directory, name))) === checksums[name], 'output checksum drift: ' + name);
  const bridge = load(join(directory, 'reader-bridge.json'));
  const queue = load(join(directory, 'review-queue.json'));
  ensure(bridge.format === 'private-draft-reader-bridge/0.1.0' && queue.format === bridge.format && queue.lot_id === bridge.lot_id, 'profile or lot mismatch.');
  ensure(bridge.scope === 'derived-draft' && bridge.publication_status === 'private' && queue.publication_status === 'private' && bridge.reading_status === 'machine-draft' && bridge.confirmed_memory_count === 0 && queue.confirmed_memory_count === 0, 'unreviewed private state required.');
  ensure(/^[a-z0-9-]+$/u.test(bridge.lot_id) && bridge.canonical_refs && Object.values(bridge.canonical_refs).every(value => value === null), 'no canonical identity may be introduced.');
  const assets = bridge.text_assets;
  for (const key of ['original_markdown', 'modern_markdown']) {
    const asset = assets?.[key];
    ensure(asset && asset.format === 'text/markdown' && asset.review_status === 'machine-draft' && typeof asset.text === 'string' && asset.text.length > 0 && sha(Buffer.from(asset.text, 'utf8')) === asset.sha256 && bridge.verified_input_hashes?.[asset.logical_uri] === asset.sha256, 'text asset/hash/provenance drift: ' + key);
  }
  ensure(Array.isArray(bridge.images) && bridge.images.length >= 1 && bridge.images.length <= 13, 'one to thirteen selected photographs required per dossier.');
  const imageMap = new Map();
  for (const image of bridge.images) {
    ensure(/^object:path-[a-f0-9]{64}$/u.test(image.object_id) && /^[a-f0-9]{64}$/u.test(image.sha256) && !imageMap.has(image.object_id) && Number.isSafeInteger(image.expected_byte_size) && image.expected_byte_size > 0, 'invalid photograph identity/hash/size.');
    ensure(image.link_status === 'candidate-folder-only' && image.rights_status === 'unknown' && Array.isArray(image.permitted_uses) && image.permitted_uses.includes('private-research-transcription') && image.approved_review_id == null, 'private candidate association required.');
    imageMap.set(image.object_id, image);
  }
  ensure(Array.isArray(bridge.segments) && bridge.segments.length >= 1 && bridge.segments.length <= 1000 && Array.isArray(queue.entries) && queue.entries.length === bridge.review_queue_count, 'segment/review queue bounds differ.');
  const segmentMap = new Map();
  const fragments = bridge.segments.map((segment, index) => {
    ensure(typeof segment.id === 'string' && !segmentMap.has(segment.id) && segment.working_transcription?.status === 'machine-draft' && segment.working_transcription.text === segment.passage && Object.values(segment.canonical_refs ?? {}).every(value => value === null), 'segment identity/text/state drift.');
    segmentMap.set(segment.id, segment);
    const evidence = bridge.image_evidence?.[segment.id];
    const sourceId = evidence?.source_image_object_id ?? evidence?.source_object_id;
    const sourceHash = evidence?.source_image_sha256 ?? evidence?.source_sha256;
    ensure(evidence?.segment_id === segment.id && imageMap.get(sourceId)?.sha256 === sourceHash && evidence.image_bbox == null && evidence.canonical_bbox == null, 'segment source photograph drift.');
    if (evidence.source_object_id) ensure(evidence.source_relative_path === imageMap.get(sourceId).relative_path && evidence.human_review_status === 'pending' && evidence.line_numbering === 'editorial-fragment-order-not-manuscript-lines', 'fragment source/path/editorial state drift.');
    const imageIds = new Set([sourceId]);
    for (const region of evidence.reading_regions ?? []) {
      ensure(imageMap.get(region.source_object_id)?.sha256 === region.source_sha256, 'reading region photograph drift.');
      imageIds.add(region.source_object_id);
    }
    return { id: segment.id, label: `Fragment de travail ${index + 1}${evidence.proposed_number ? ` · entrée proposée ${evidence.proposed_number}` : ''}`, passage: segment.passage, imageObjectIds: [...imageIds] };
  });
  for (const entry of queue.entries) {
    const segment = segmentMap.get(entry.segment_id);
    const occurrence = entry.occurrence;
    const span = occurrence?.span;
    ensure(segment && entry.passage === segment.passage && occurrence.segment_id === segment.id && Number.isSafeInteger(span?.start) && Number.isSafeInteger(span?.end) && span.start >= 0 && span.end >= span.start && span.end <= [...segment.passage].length && [...segment.passage].slice(span.start, span.end).join('') === occurrence.observed_text, 'review citation/Unicode span drift.');
    ensure(occurrence.entity_id == null && entry.confirmed_memory === false && occurrence.identification_status === 'unresolved' && (entry.proposals ?? []).every(proposal => proposal.decision == null && proposal.entity_id == null && proposal.normalized_person_name == null), 'review identity or decision promotion.');
  }
  const sorted = [...bridge.images].sort((a, b) => (a.coverage?.proposed_reading_order ?? 999) - (b.coverage?.proposed_reading_order ?? 999) || Number(a.coverage?.role === 'overlapping-detail') - Number(b.coverage?.role === 'overlapping-detail'));
  const dossier = createDraftDossier({ presentationId: 'presentation:' + bridge.lot_id, label: bridge.display_title,
    originalText: assets.original_markdown.text, modernText: assets.modern_markdown.text,
    revision: 'fragments ' + [...new Set(bridge.segments.map(segment => segment.base_revision))].join(', '),
    notes: ['Les photographies appartiennent au dossier candidat ; leur ordre est proposé et les détails recouvrants ne sont pas des pages supplémentaires.', 'Les régions sont des zones de lecture ; aucune boîte de ligne ou de mot n’est validée.'],
    candidateViews: sorted.map(image => ({ objectId: image.object_id, sha256: image.sha256, label: image.coverage?.role === 'overlapping-detail' ? 'Détail recouvrant · vue candidate' : image.coverage?.proposed_reading_order ? `Vue de travail · ordre proposé ${image.coverage.proposed_reading_order}` : image.relative_path.split(/[\\/]/u).at(-1) + ' · vue candidate' })), fragments });
  const sourceManifest = { manifest_version: 'atelier-draft-source-input/1', corpus_root_reference: 'env:PHD_CORPUS_ROOT',
    bridge_sha256: checksums['reader-bridge.json'], publication_status: 'not-published',
    objects: bridge.images.map(image => ({ digital_object_id: image.object_id, relative_path: image.relative_path, expected_sha256: image.sha256, expected_byte_size: image.expected_byte_size, media_type: 'image/jpeg', association_status: 'candidate',
      rights: { status: image.rights_status, local_consultation: 'authorized', permitted_uses: [...image.permitted_uses, 'local-private-consultation'], authorization_basis: 'Explicit private site MVP authorization; bridge original private uses retained, no public permission.' } })) };
  const sourceBytes = Buffer.from(JSON.stringify(sourceManifest, null, 2) + '\n');
  const mediaManifest = { manifest_version: 'atelier-draft-local-media/1', corpus_root_reference: 'env:PHD_CORPUS_ROOT', source_manifest_sha256: sha(sourceBytes), publication_status: 'not-published', link_status: 'candidate', objects: bridge.images.map(image => ({ digital_object_id: image.object_id, sha256: image.sha256, byte_size: image.expected_byte_size, media_type: 'image/jpeg' })) };
  const {reviewBridge,sourceAliasEvidence} = reconcileSourceAliases(directory,bridge,queue);
  return { bridge, reviewBridge, sourceAliasEvidence, queue, dossier, sourceManifest, sourceBytes, mediaManifest, checksums };
}
