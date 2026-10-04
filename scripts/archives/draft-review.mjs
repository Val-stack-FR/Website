// Read-only presentation of an explicitly supplied private draft bridge.
// File checksums/preflight and photograph bytes remain the loader's responsibility.
import { bindDraftPhotograph, bindDraftReadingRegion } from './draft-derivative-bindings.mjs';
const BRIDGE_PROFILE = 'private-draft-reader-bridge/0.1.0';
export const DRAFT_REVIEW_PROFILE = 'private-draft-review-query/0.1.0';
const indexes = new WeakMap();
const pages = new WeakSet();
const hashPattern = /^[a-f0-9]{64}$/u;
const idPattern = /^[a-z][a-z0-9-]*:[a-zA-Z0-9._:-]+$/u;
const check = (condition, message) => { if (!condition) throw new Error(`Draft review: ${message}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const frozen = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
};
const text = (value, label, max = 5000) => {
  check(typeof value === 'string' && value.length > 0 && value.length <= max
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value), `invalid ${label}`);
  check(!/(?:[A-Za-z]:[\\/]|file:\/\/|(?:\.\.|data\/private|corpus)[\\/]|PHD_CORPUS_ROOT|(?:derivative|phd|workshop):)/iu.test(value), `private locator in ${label}`);
  return value;
};
const id = (value, label) => { check(typeof value === 'string' && idPattern.test(value), `invalid ${label}`); return value; };
const sha = (value, label) => { check(hashPattern.test(value ?? ''), `invalid ${label}`); return value; };
const list = (value, label, max = 50000) => { check(Array.isArray(value) && value.length <= max, `invalid ${label}`); return value; };
const nullRefs = refs => check(refs && Object.keys(refs).length === 5
  && ['document_id', 'act_id', 'witness_id', 'view_id', 'text_id'].every(key => Object.hasOwn(refs, key) && refs[key] === null), 'canonical identity promotion');
export const normalizeDraftQuery = value => String(value).normalize('NFD').replace(/\p{M}+/gu, '').toLocaleLowerCase('fr').replace(/\s+/gu, ' ').trim();
export const escapeDraftHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function imageMap(bridge, mediaBindings) {
  const images = new Map();
  for (const image of list(bridge.images, 'images', 64)) {
    const object_id = id(image.object_id, 'image object');
    check(/^object:path-[a-f0-9]{64}$/u.test(object_id) && !images.has(object_id), 'duplicate or non-file photograph');
    check(image.link_status === 'candidate-folder-only' && image.rights_status === 'unknown', 'photograph association or rights promotion');
    const derivative = mediaBindings ? bindDraftPhotograph(mediaBindings, object_id, image.sha256) : null;
    if(derivative)check(derivative.lotId===bridge.lot_id,'derivative lot binding drift');
    images.set(object_id, { object_id, sha256: sha(image.sha256, 'image hash'), link_status: 'candidate-folder-only',
      rights_status: 'unknown', media_url: derivative ? derivative.mediaUrl : `/__archive_draft_media/${image.sha256}`,
      ...(derivative ? { derivative } : {}) });
  }
  check(images.size > 0, 'no candidate photographs');
  return images;
}

function imageEvidence(value, segmentId, images, mediaBindings) {
  check(value?.segment_id === segmentId, 'image evidence segment drift');
  if (Object.hasOwn(value, 'source_object_id')) {
    check(!['source_image_object_id', 'source_image_sha256', 'reading_regions', 'proposed_number', 'image_bbox'].some(key => Object.hasOwn(value, key))
      && value.canonical_bbox === null && value.human_review_status === 'pending'
      && value.line_numbering === 'editorial-fragment-order-not-manuscript-lines', 'analysis fragment bbox, shape or review promotion');
    const primary = images.get(value.source_object_id);
    check(primary && primary.sha256 === value.source_sha256, 'analysis fragment image hash/object drift');
    const analysis_tile_ids = list(value.analysis_tile_ids, 'analysis tile ids', 64).map(tile => text(tile, 'analysis tile id', 100));
    check(new Set(analysis_tile_ids).size === analysis_tile_ids.length
      && analysis_tile_ids.every(tile => /^[a-zA-Z0-9._:-]+$/u.test(tile)), 'invalid or duplicate technical analysis tile');
    return { ...primary, layer: text(value.layer, 'analysis layer', 100), analysis_tile_ids,
      line_numbering: 'editorial-fragment-order-not-manuscript-lines', reading_notes: text(value.reading_notes, 'analysis notes'),
      human_review_status: 'pending', reading_regions: [], individual_word_bbox: null,
      limits: 'Fragments d’analyse candidats ; ordre éditorial du dérivé, sans numéro de ligne historique ni rectangle de mot individuel mesuré.' };
  }
  check(!Object.hasOwn(value, 'canonical_bbox') && !Object.hasOwn(value, 'analysis_tile_ids') && value.image_bbox === null,
    'image evidence individual bbox or mixed shape drift');
  const primary = images.get(value.source_image_object_id);
  check(primary && primary.sha256 === value.source_image_sha256, 'image hash/object drift');
  const reading_regions = list(value.reading_regions, 'reading regions', 32).map(region => {
    const image = images.get(region.source_object_id);
    check(image && image.sha256 === region.source_sha256, 'region photograph drift');
    return { region_id: text(region.crop_id, 'region id', 100), source_image_object_id: image.object_id,
      source_image_sha256: image.sha256, reference_frame: region.reference_frame === undefined ? null : text(region.reference_frame, 'reference frame', 100),
      coordinate_transform: region.coordinate_transform === undefined ? null : text(region.coordinate_transform, 'coordinate transform', 1000),
      status: 'candidate-reading-region', individual_word_bbox: null,
      ...(mediaBindings ? { display_region: bindDraftReadingRegion(mediaBindings, region) } : {}) };
  });
  check(value.proposed_number === null || Number.isSafeInteger(value.proposed_number) && value.proposed_number > 0, 'invalid candidate entry number');
  return { ...primary, line_id: text(value.line_id, 'line id', 100), section_id: text(value.section_id, 'section id', 100),
    proposed_number: value.proposed_number === null ? null : value.proposed_number,
    reading_regions, individual_word_bbox: null, limits: 'Régions de lecture candidates ; aucun rectangle de mot individuel mesuré.' };
}

function candidateAlternative(value) {
  check(value?.author_kind === 'ai' && ['possible', 'probable', 'uncertain', 'unknown'].includes(value.confidence), 'alternative author or certainty promotion');
  return { reading: text(value.reading, 'alternative reading'), author_kind: 'ai', confidence: value.confidence,
    rationale: text(value.rationale, 'alternative rationale') };
}

function candidateProposal(proposal, occurrenceId, segmentId, revision) {
  check(proposal && proposal.occurrence_id === occurrenceId && proposal.base_revision === revision
    && ['entity_id', 'normalized_person_name', 'decision'].every(key => !Object.hasOwn(proposal, key) || proposal[key] === null)
    && (proposal.author_kind === undefined || proposal.author_kind === 'ai'), 'proposal citation or identity/decision promotion');
  if (Object.hasOwn(proposal, 'type')) {
    // A journal proposal is linked through its exact occurrence, whose segment was verified above.
    // Missing confidence/alternative are kept unknown/null; the machine-draft package supplies the AI role.
    check(proposal.type === 'proposal' && !Object.hasOwn(proposal, 'id') && !Object.hasOwn(proposal, 'alternative')
      && !Object.hasOwn(proposal, 'confidence') && !Object.hasOwn(proposal, 'segment_id'), 'mixed journal proposal shape');
    id(proposal.actor_id, 'proposal source actor');
    check(typeof proposal.idempotency_key === 'string' && proposal.idempotency_key.startsWith(`${occurrenceId}:`)
      && /^[1-9][0-9]*$/u.test(proposal.idempotency_key.slice(occurrenceId.length + 1)),
      'proposal idempotency occurrence drift');
    return { proposal_id: id(proposal.proposal_id, 'proposal'), reading: text(proposal.reading, 'proposal reading'), alternative: null,
      author_kind: 'ai', confidence: 'unknown', rationale: text(proposal.rationale, 'proposal rationale'), decision: null, entity_id: null };
  }
  check(proposal.segment_id === segmentId && proposal.entity_id === null && proposal.normalized_person_name === null && proposal.decision === null
    && ['possible', 'probable', 'uncertain', 'unknown'].includes(proposal.confidence), 'proposal segment or certainty promotion');
  return { proposal_id: id(proposal.id, 'proposal'), reading: text(proposal.reading, 'proposal reading'),
    alternative: proposal.alternative === null ? null : text(proposal.alternative, 'proposal alternative'),
    author_kind: 'ai', confidence: proposal.confidence, rationale: text(proposal.rationale, 'proposal rationale'), decision: null, entity_id: null };
}

export function buildDraftReviewIndex(pairs, { mediaBindings = null } = {}) {
  list(pairs, 'bridge pairs', 8);
  check(pairs.length > 0, 'empty bridge pairs');
  const rows = [];
  const lots = [];
  const seenLots = new Set();
  const seenOccurrences = new Set();
  for (const { bridge, queue } of pairs) {
    check(bridge?.format === BRIDGE_PROFILE && queue?.format === BRIDGE_PROFILE
      && bridge.scope === 'derived-draft' && bridge.publication_status === 'private'
      && queue.publication_status === 'private' && bridge.reading_status === 'machine-draft'
      && bridge.confirmed_memory_count === 0 && queue.confirmed_memory_count === 0, 'private machine draft / memory zero required');
    nullRefs(bridge.canonical_refs);
    const lot = text(bridge.lot_id, 'lot', 100);
    check(/^[a-z0-9-]+$/u.test(lot) && queue.lot_id === lot && !seenLots.has(lot), 'lot mismatch or duplicate');
    seenLots.add(lot);
    const title = text(bridge.display_title, 'title', 300);
    const images = imageMap(bridge, mediaBindings);
    const segments = new Map();
    for (const segment of list(bridge.segments, 'segments')) {
      const key = id(segment.id, 'segment');
      check(!segments.has(key), 'duplicate segment');
      nullRefs(segment.canonical_refs);
      check(segment.hand?.id === null && segment.hand.status === 'unknown'
        && segment.working_transcription?.status === 'machine-draft' && segment.working_transcription.author_kind === 'ai'
        && segment.working_transcription.text === segment.passage && segment.locator?.bbox === null, 'segment promotion or passage drift');
      id(segment.source_id, 'segment source');
      text(segment.base_revision, 'revision', 100);
      text(segment.passage, 'passage');
      check(Number.isSafeInteger(segment.locator.line_start) && Number.isSafeInteger(segment.locator.line_end)
        && segment.locator.line_start >= 1 && segment.locator.line_end >= segment.locator.line_start, 'invalid source line locator');
      segments.set(key, segment);
    }
    const inputHashes = Object.values(bridge.verified_input_hashes ?? {}).map(value => sha(value, 'verified input hash'));
    check(inputHashes.length > 0, 'verified source hashes required');
    const sourceHashes = new Map();
    const entries = list(queue.entries, 'queue entries');
    check(bridge.review_queue_count === entries.length, 'queue count mismatch');
    let proposalsCount = 0;
    for (const entry of entries) {
      const occurrence = entry.occurrence;
      const occurrence_id = id(occurrence?.id, 'occurrence');
      check(!seenOccurrences.has(occurrence_id), 'duplicate occurrence');
      seenOccurrences.add(occurrence_id);
      const segment = segments.get(entry.segment_id);
      check(segment && occurrence.segment_id === segment.id && entry.passage === segment.passage
        && entry.source_id === segment.source_id && entry.base_revision === segment.base_revision
        && entry.locator?.bbox === null && entry.locator.line_start === segment.locator.line_start
        && entry.locator.line_end === segment.locator.line_end, 'segment/source/revision/locator drift');
      check(occurrence.reading_status === 'unresolved' && occurrence.identification_status === 'unresolved'
        && occurrence.entity_id === null && entry.confirmed_memory === false
        && entry.review_status === 'pending-human-source-review', 'occurrence or memory promotion');
      const source_sha256 = sha(entry.source_sha256, 'source hash');
      check(inputHashes.includes(source_sha256) && (!sourceHashes.has(entry.source_id) || sourceHashes.get(entry.source_id) === source_sha256), 'source hash drift');
      const keyedSource = Object.hasOwn(bridge.verified_input_hashes, entry.source_logical_uri);
      check(typeof entry.source_logical_uri === 'string' && keyedSource
        && bridge.verified_input_hashes[entry.source_logical_uri] === source_sha256, 'exact source locator/hash drift');
      sourceHashes.set(entry.source_id, source_sha256);
      const span = occurrence.span;
      const points = Array.from(segment.passage);
      check(span?.units === 'unicode-codepoints-half-open-r0' && entry.base_revision === 'r0'
        && Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end)
        && span.start >= 0 && span.end > span.start && span.end <= points.length
        && points.slice(span.start, span.end).join('') === occurrence.observed_text, 'Unicode offset/citation drift');
      if (mediaBindings) check(same(bridge.image_evidence?.[segment.id]?.reading_regions ?? [], entry.image_evidence?.reading_regions ?? []), 'sealed region evidence drift');
      const bridgeImage = imageEvidence(bridge.image_evidence?.[segment.id], segment.id, images, mediaBindings);
      const entryImage = imageEvidence(entry.image_evidence, segment.id, images, mediaBindings);
      check(same(bridgeImage, entryImage), 'queue/bridge image evidence drift');
      const proposals = list(entry.proposals, 'proposals', 100).map(proposal => candidateProposal(proposal, occurrence_id, segment.id, entry.base_revision));
      proposalsCount += proposals.length;
      const row = frozen({ lot, lot_title: title, occurrence_id, segment_id: segment.id,
        category: text(occurrence.category, 'category', 100), passage: segment.passage,
        observed_text: text(occurrence.observed_text, 'observed text'), span: { start: span.start, end: span.end, units: span.units },
        source_id: entry.source_id, source_sha256, base_revision: entry.base_revision,
        locator: { line_start: segment.locator.line_start, line_end: segment.locator.line_end },
        image: bridgeImage, alternatives: list(occurrence.alternatives, 'alternatives', 100).map(candidateAlternative), proposals,
        reading_status: 'unresolved', identification_status: 'unresolved', entity_id: null, canonical_refs: { document_id: null, act_id: null, witness_id: null, view_id: null, text_id: null },
        confirmed_memory: false, review_status: 'pending-human-source-review' });
      rows.push(row);
    }
    check(proposalsCount === bridge.proposals_count, 'proposal count mismatch');
    lots.push(frozen({ id: lot, title, count: entries.length }));
  }
  const index = frozen({ format: DRAFT_REVIEW_PROFILE, publication_status: 'private', confirmed_memory_count: 0, total: rows.length, lots,
    ...(mediaBindings ? { media_profile: 'private-draft-derivative-bindings/1' } : {}) });
  indexes.set(index, rows.map(row => ({ row, searchable: normalizeDraftQuery([row.observed_text, row.passage, row.category,
    ...row.alternatives.map(value => value.reading), ...row.proposals.flatMap(value => [value.reading, value.alternative ?? ''])].join(' ')) })));
  return index;
}

function queryOptions(input) {
  const allowed = ['lot', 'query', 'page', 'page_size'];
  let value;
  if (input instanceof URLSearchParams) {
    check([...input.keys()].every(key => allowed.includes(key)) && allowed.every(key => input.getAll(key).length <= 1), 'unknown or duplicate query parameter');
    value = Object.fromEntries(input);
  } else {
    check(input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).every(key => allowed.includes(key)), 'unknown query field');
    value = input;
  }
  const number = (raw, fallback, max, label) => {
    if (raw === undefined) return fallback;
    check((typeof raw === 'number' && Number.isSafeInteger(raw) || typeof raw === 'string' && /^[1-9][0-9]*$/u.test(raw)), `invalid ${label}`);
    const result = Number(raw);
    check(result >= 1 && result <= max, `invalid ${label}`);
    return result;
  };
  const lot = value.lot ?? '';
  const query = value.query ?? '';
  check(typeof lot === 'string' && (lot === '' || /^[a-z0-9-]{1,100}$/u.test(lot)), 'invalid lot filter');
  check(typeof query === 'string' && query.length <= 200 && !/[\u0000-\u001f\u007f-\u009f]/u.test(query), 'invalid query');
  if (query.trim()) text(query, 'query', 200);
  return { lot, query: query.trim(), page: number(value.page, 1, 1000000, 'page'), page_size: number(value.page_size, 50, 50, 'page size') };
}

export function queryDraftReview(index, input = {}) {
  const entries = indexes.get(index);
  check(entries, 'use the constructed index');
  const options = queryOptions(input);
  check(options.lot === '' || index.lots.some(lot => lot.id === options.lot), 'unknown lot');
  const needle = normalizeDraftQuery(options.query);
  const selected = entries.filter(({ row, searchable }) => (options.lot === '' || row.lot === options.lot) && (!needle || searchable.includes(needle)));
  const total_pages = Math.max(1, Math.ceil(selected.length / options.page_size));
  check(options.page <= total_pages, 'page outside results');
  const page = frozen({ format: DRAFT_REVIEW_PROFILE, publication_status: 'private', confirmed_memory_count: 0,
    ...(index.media_profile ? { media_profile: index.media_profile } : {}),
    lots: index.lots, ...options, total: selected.length, total_pages,
    items: selected.slice((options.page - 1) * options.page_size, options.page * options.page_size).map(value => value.row) });
  pages.add(page);
  return page;
}

const h = escapeDraftHtml;
const candidateList = values => values.length ? `<ul>${values.map(value => `<li><strong>${h(value.reading)}</strong>${value.alternative ? ` · alternative ${h(value.alternative)}` : ''} · proposition IA ${h(value.confidence)}<p>${h(value.rationale)}</p></li>`).join('')}</ul>` : '<p>Aucune variante proposée dans ce dérivé.</p>';
const analysisNotes = image => image.analysis_tile_ids ? `<p>Couche candidate : ${h(image.layer)}. Revue humaine : en attente.</p><p>${image.analysis_tile_ids.length ? `Repères techniques du dérivé : ${image.analysis_tile_ids.map(h).join(' · ')}.` : 'Aucun repère de découpe fourni pour ce fragment.'}</p><p>${h(image.reading_notes)}</p>` : '';
const photoLink = image => image.media_url === null ? '<p>Photographie hors de la sélection pilote.</p>'
  : `<p><a href="${h(image.media_url)}">${image.derivative ? 'Ouvrir la photographie dérivée candidate' : 'Ouvrir la photo source candidate'}</a> · candidate-folder-only · droits inconnus</p>`;
const derivativeNote = image => image.derivative ? `<p class="draft-review-meta">Vue candidate ${h(image.derivative.candidateViewId ?? 'sans identité de vue créée')} · dérivé ${h(image.derivative.derivativeObjectId)}<br>SHA-256 du dérivé ${h(image.derivative.derivativeSha256)}</p><p>Raster codé ${image.derivative.codedWidth} × ${image.derivative.codedHeight} ; affichage ${image.derivative.width} × ${image.derivative.height}. Revue humaine en attente.</p>` : '';
const regionNote = region => region.display_region ? `<p>${region.display_region.displayRectangle ? `Zone candidate dans le repère affiché : ${region.display_region.displayRectangle.map(h).join(', ')}. Aucun rectangle de mot validé.` : 'Cadrage en attente : le repère de cette zone n’est pas qualifié.'}</p>` : '';
const card = item => {
  const points = Array.from(item.passage);
  return `<article class="draft-review-card"><h2>${h(item.observed_text)}</h2><p class="draft-review-meta">${h(item.lot_title)} · ${h(item.category)} · non résolu</p>
<p class="draft-review-citation">${h(points.slice(0, item.span.start).join(''))}<mark>${h(item.observed_text)}</mark>${h(points.slice(item.span.end).join(''))}</p>
<p>Offsets Unicode [${item.span.start}, ${item.span.end}) dans ${h(item.base_revision)}. Identité non résolue ; mémoire confirmée : 0.</p>
<dl><dt>Occurrence / segment</dt><dd>${h(item.occurrence_id)}<br>${h(item.segment_id)}</dd><dt>Source / SHA-256 / révision</dt><dd>${h(item.source_id)}<br>${h(item.source_sha256)}<br>${h(item.base_revision)}</dd></dl>
<details><summary>Variantes et propositions IA (${item.alternatives.length + item.proposals.length})</summary>${candidateList([...item.alternatives, ...item.proposals])}</details>
<details><summary>Références photo candidates et limites de lecture</summary>${photoLink(item.image)}<p class="draft-review-meta">${h(item.image.object_id)}<br>${h(item.image.sha256)}</p>${derivativeNote(item.image)}<p>${h(item.image.limits)}</p>${analysisNotes(item.image)}<ul>${item.image.reading_regions.map(region => `<li>${h(region.region_id)} · repère ${h(region.reference_frame ?? 'non précisé')}${region.coordinate_transform ? ` · ${h(region.coordinate_transform)}` : ''}<br><span class="draft-review-meta">${h(region.source_image_object_id)} · ${h(region.source_image_sha256)}</span>${regionNote(region)}</li>`).join('')}</ul></details></article>`;
};
const pageUrl = (page, number) => `?${new URLSearchParams({ lot: page.lot, query: page.query, page: String(number), page_size: String(page.page_size) })}`;

export function renderDraftReviewPage(initialPage) {
  check(pages.has(initialPage) && initialPage.items.length <= 50, 'use a queried, bounded initial page');
  const page = initialPage;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Formes candidates — atelier privé</title><link rel="stylesheet" href="/css/archives-draft-review.css"><script src="/js/archives-draft-${page.media_profile ? 'derivatives' : 'review'}.js" defer></script></head>
<body class="draft-review-page"><main><header><p class="draft-review-kicker">Atelier privé · lecture seule</p><h1>Formes candidates à revoir</h1><p>Brouillons IA non relus humainement. Les citations, variantes et liens photo restent des propositions. Identités non résolues ; aucune décision ; mémoire confirmée : 0.</p><a href="/archives/">Retour à l’atelier</a></header>
<form id="draft-review-form" method="get"><label for="draft-review-query">Chercher une forme ou variante</label><input id="draft-review-query" name="query" maxlength="200" value="${h(page.query)}"><label for="draft-review-lot">Lot</label><select id="draft-review-lot" name="lot"><option value="">Tous les lots fournis</option>${page.lots.map(lot => `<option value="${h(lot.id)}"${page.lot === lot.id ? ' selected' : ''}>${h(lot.title)} (${lot.count})</option>`).join('')}</select><input type="hidden" name="page_size" value="${page.page_size}"><button type="submit">Rechercher</button></form>
<p id="draft-review-status" role="status" aria-live="polite">${page.total} occurrences candidates · page ${page.page}/${page.total_pages} · ${page.page_size} maximum par page.</p><div id="draft-review-results">${page.items.length ? page.items.map(card).join('') : '<p>Aucune occurrence candidate pour cette recherche.</p>'}</div>
<nav id="draft-review-pagination" aria-label="Pages de formes candidates">${page.page > 1 ? `<a href="${h(pageUrl(page, page.page - 1))}" data-page="${page.page - 1}">Précédente</a>` : ''}${page.page < page.total_pages ? `<a href="${h(pageUrl(page, page.page + 1))}" data-page="${page.page + 1}">Suivante</a>` : ''}</nav><footer>Consultation privée uniquement · régions candidates, aucun rectangle de mot inventé · aucune publication ni mémoire historique confirmée.</footer></main></body></html>`;
}
