import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import vm from 'node:vm';
import { buildDraftReviewIndex, queryDraftReview, renderDraftReviewPage } from '../../scripts/archives/draft-review.mjs';
import { loadDraftBridge } from '../../scripts/archives/draft-bridge.mjs';
import { createDraftDerivativeBindings, draftBindingsDigest } from '../../scripts/archives/draft-derivative-bindings.mjs';

const H = char => char.repeat(64);
const sourceId = 'source:fixture-working-r0';
const segmentId = 'segment:fixture-title-1';
const occurrenceId = 'occurrence:fixture-name-1';
function fixture(count = 1, passage = '😀 [Loys ?] et tuce') {
  const start = Array.from(passage).join('').startsWith('😀 ') ? 2 : 0;
  const observed = passage === '😀 [Loys ?] et tuce' ? '[Loys ?]' : passage;
  const nulls = { document_id: null, act_id: null, witness_id: null, view_id: null, text_id: null };
  const image = { object_id: `object:path-${H('a')}`, sha256: H('b'), link_status: 'candidate-folder-only', rights_status: 'unknown', relative_path: 'C:/private/not-to-display.jpg' };
  const evidence = { segment_id: segmentId, line_id: 'title-l01', section_id: 'title', proposed_number: null,
    source_image_object_id: image.object_id, source_image_sha256: image.sha256, image_bbox: null,
    reading_regions: [{ crop_id: 'title-region', source_object_id: image.object_id, source_sha256: image.sha256,
      reference_frame: 'original-view', native_bbox: [1, 2, 3, 4], crop_sha256: H('d'), relative_path: 'data/private/reading-crops/title.png' }] };
  const segment = { id: segmentId, source_id: sourceId, canonical_refs: nulls, hand: { id: null, status: 'unknown' },
    locator: { label: 'data/private/hidden locator', line_start: 1, line_end: 1, bbox: null }, passage, base_revision: 'r0',
    working_transcription: { text: passage, status: 'machine-draft', author_kind: 'ai' } };
  const entries = Array.from({ length: count }, (_, number) => ({
    occurrence: { id: `${occurrenceId}-${number}`, segment_id: segmentId, category: 'name',
      span: { start, end: start + Array.from(observed).length, units: 'unicode-codepoints-half-open-r0' }, observed_text: observed,
      alternatives: [{ reading: 'Lois', author_kind: 'ai', confidence: 'possible', rationale: 'Alternative de lecture IA, sans identification.' }],
      reading_status: 'unresolved', identification_status: 'unresolved', entity_id: null },
    segment_id: segmentId, source_id: sourceId, source_sha256: H('c'), source_logical_uri: 'data/private/source-working.txt',
    base_revision: 'r0', passage, locator: segment.locator, image_evidence: structuredClone(evidence),
    proposals: [], review_status: 'pending-human-source-review', confirmed_memory: false,
  }));
  entries[0].proposals = [{ id: 'proposal:fixture-loys', occurrence_id: entries[0].occurrence.id, segment_id: segmentId,
    base_revision: 'r0', reading: 'Loys', alternative: 'Lois', normalized_person_name: null, entity_id: null,
    confidence: 'probable', rationale: 'Hypothèse IA révisable.', source_evidence: 'data/private/no-output.json', decision: null }];
  return { bridge: { format: 'private-draft-reader-bridge/0.1.0', lot_id: 'fixture-e133', display_title: 'E.133 — fixture candidate',
    scope: 'derived-draft', publication_status: 'private', reading_status: 'machine-draft', canonical_refs: nulls,
    images: [image], segments: [segment], image_evidence: { [segmentId]: evidence },
    review_queue_count: count, proposals_count: 1, confirmed_memory_count: 0,
    verified_input_hashes: { 'data/private/source-working.txt': H('c') } },
  queue: { format: 'private-draft-reader-bridge/0.1.0', lot_id: 'fixture-e133', publication_status: 'private', confirmed_memory_count: 0, entries } };
}
const pageFor = value => queryDraftReview(buildDraftReviewIndex([value]));
function analysisFixture() {
  const pair = fixture();
  pair.bridge.lot_id = pair.queue.lot_id = 'fixture-analysis';
  const evidence = { segment_id: segmentId, source_object_id: pair.bridge.images[0].object_id,
    source_sha256: H('b'), source_relative_path: 'C:/private/source-photo.jpg', layer: 'recto-acte', analysis_tile_ids: ['hg-01'],
    tile_manifest_uri: 'data/private/tiles.json', canonical_bbox: null,
    line_numbering: 'editorial-fragment-order-not-manuscript-lines', reading_author: 'source-ai',
    reading_notes: 'Fragment candidat ; raccord horizontal non validé.', human_review_status: 'pending' };
  pair.bridge.image_evidence[segmentId] = evidence;
  pair.queue.entries[0].image_evidence = structuredClone(evidence);
  pair.queue.entries[0].source_logical_uri = 'data/private/source-working.txt';
  pair.queue.entries[0].proposals = [{ type: 'proposal', idempotency_key: `${pair.queue.entries[0].occurrence.id}:1`,
    actor_id: 'actor:fixture-reader', proposal_id: 'proposal:fixture-journal', occurrence_id: pair.queue.entries[0].occurrence.id,
    base_revision: 'r0', reading: 'Loys', rationale: 'Lecture IA sans identification ni décision.' }];
  return pair;
}

function inventedMediaContext() {
  const bytesByDerivative = new Map();
  const bindings = ['a', 'd', 'e'].map((char, index) => {
    const bytes = Buffer.from(`invented-photo-${index}`), derivative_sha256 = createHash('sha256').update(bytes).digest('hex');
    bytesByDerivative.set(derivative_sha256, bytes);
    return { candidate_view_id: `candidate-view:invented-${index}`, canonical_view_id: null, lot_id: 'fixture-e133', source_object_id: `object:path-${H(char)}`, source_sha256: H('b'),
      derivative_object_id: `object:media-${derivative_sha256}`, derivative_sha256, derivative_byte_size: bytes.length,
      coded_width: 7, coded_height: 5, display_width: 5, display_height: 7, exif_orientation: 6 };
  });
  return createDraftDerivativeBindings({ bindings, expectedBindingsSha256: draftBindingsDigest(bindings), bytesByDerivative,
    selectedObjectIds: bindings.map(value => value.source_object_id) });
}

test('invented derivative projection preserves exact citations and source identities; ambiguous crops remain pending in static and dynamic views', async () => {
  const pair = fixture(), before = JSON.stringify(pair), mediaBindings = inventedMediaContext();
  const page = queryDraftReview(buildDraftReviewIndex([pair], { mediaBindings })), item = page.items[0];
  assert.equal(item.occurrence_id, `${occurrenceId}-0`); assert.equal(item.source_sha256, H('c'));
  assert.equal(item.image.sha256, H('b')); assert.equal(item.image.object_id, `object:path-${H('a')}`);
  assert.equal(item.image.derivative.sourceSha256, H('b')); assert.notEqual(item.image.derivative.derivativeSha256, H('b'));
  assert.equal(item.image.reading_regions[0].display_region.displayRectangle, null);
  assert.equal(JSON.stringify(pair), before);
  const html = renderDraftReviewPage(page);
  assert.match(html, /Cadrage en attente/); assert.equal(html.includes('/__archive_draft_media/'), false);
  const script = readFileSync(new URL('../../js/archives-draft-derivatives.js', import.meta.url), 'utf8');
  for (const mutate of [() => {}, response => { response.items[0].image.derivative.sourceSha256 = H('f'); },
    response => { response.items[0].image.media_url = `/__archive_draft_media/${H('b')}`; },
    response => { response.items[0].image.derivative.humanReview = 'accepted'; }]) {
    const dom = fakeDom(), response = structuredClone(page); mutate(response);
    vm.runInNewContext(script, { document: dom.document, URLSearchParams, AbortController,
      fetch: async () => ({ ok: true, json: async () => response }), location: { pathname: '/archives/formes-brouillons/' }, history: { replaceState() {} } });
    dom.handlers['form:submit']({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve));
    const accepted = response.items[0].image.derivative.sourceSha256 === H('b')
      && response.items[0].image.media_url.startsWith('/__archive_draft_derivative/') && response.items[0].image.derivative.humanReview === 'pending';
    assert.equal(dom.results.children.length > 0, accepted);
    if (accepted) assert.equal(dom.texts.includes('Cadrage en attente : le repère de cette zone n’est pas qualifié.'), true);
  }
  pair.queue.entries[0].image_evidence.reading_regions[0].native_bbox[0]++;
  assert.throws(() => buildDraftReviewIndex([pair], { mediaBindings }), /sealed region evidence drift/);
});

test('exact Unicode citation/source/revision and candidate photo identities survive a safe projection', () => {
  const pair = fixture();
  const before = JSON.stringify(pair);
  const page = pageFor(pair);
  const item = page.items[0];
  assert.deepEqual(item.span, { start: 2, end: 10, units: 'unicode-codepoints-half-open-r0' });
  assert.equal(item.observed_text, '[Loys ?]');
  assert.equal(item.source_id, sourceId);
  assert.equal(item.source_sha256, H('c'));
  assert.equal(item.image.object_id, pair.bridge.images[0].object_id);
  assert.equal(item.image.sha256, H('b'));
  assert.equal(item.image.link_status, 'candidate-folder-only');
  assert.equal(item.image.individual_word_bbox, null);
  assert.equal(item.image.reading_regions[0].reference_frame, 'original-view');
  assert.equal(item.proposals[0].author_kind, 'ai');
  assert.equal(item.proposals[0].entity_id, null);
  assert.equal(page.confirmed_memory_count, 0);
  assert.equal(JSON.stringify(pair), before, 'Input derivatives are not mutated.');
  assert.equal(/relative_path|logical_uri|crop_sha256|native_bbox|data\/private|C:\/private|derivative:|source_evidence/.test(JSON.stringify(page)), false);
});

test('offset, citation, segment, source hash, revision and photograph drift fail closed', () => {
  const changes = [
    pair => { pair.queue.entries[0].occurrence.span.start += 1; },
    pair => { pair.queue.entries[0].occurrence.observed_text = 'Louis'; },
    pair => { pair.queue.entries[0].passage += '.'; },
    pair => { pair.queue.entries[0].source_id = 'source:another'; },
    pair => { pair.queue.entries[0].source_sha256 = H('e'); },
    pair => { pair.queue.entries[0].source_logical_uri = 'derivative:invented-source'; },
    pair => { pair.bridge.verified_input_hashes['data/private/other-working.txt'] = H('e'); pair.queue.entries[0].source_sha256 = H('e'); },
    pair => { pair.queue.entries[0].base_revision = 'r1'; },
    pair => { pair.queue.entries[0].image_evidence.source_image_sha256 = H('e'); },
    pair => { pair.queue.entries[0].image_evidence.source_image_object_id = `object:path-${H('e')}`; },
    pair => { pair.queue.entries[0].image_evidence.reading_regions[0].source_sha256 = H('e'); },
    pair => { pair.queue.entries[0].image_evidence.image_bbox = [0, 0, 1, 1]; },
  ];
  for (const change of changes) { const pair = fixture(); change(pair); assert.throws(() => pageFor(pair), /Draft review:/); }
});

test('human decisions, identities, confirmed memory, canonical refs and accepted associations are refused', () => {
  const changes = [
    pair => { pair.bridge.confirmed_memory_count = 1; },
    pair => { pair.queue.entries[0].confirmed_memory = true; },
    pair => { pair.queue.entries[0].occurrence.entity_id = 'person:invented'; },
    pair => { pair.queue.entries[0].occurrence.identification_status = 'resolved'; },
    pair => { pair.bridge.canonical_refs.act_id = 'act:invented'; },
    pair => { pair.queue.entries[0].proposals[0].decision = 'accept'; },
    pair => { pair.queue.entries[0].proposals[0].normalized_person_name = 'Louis'; },
    pair => { pair.queue.entries[0].occurrence.alternatives[0].author_kind = 'human'; },
    pair => { pair.bridge.images[0].link_status = 'accepted'; },
    pair => { pair.bridge.images[0].rights_status = 'public'; },
  ];
  for (const change of changes) { const pair = fixture(); change(pair); assert.throws(() => pageFor(pair), /Draft review:/); }
});

test('pagination/search/lot filters are bounded, deterministic and validate unknown/duplicate parameters', () => {
  const index = buildDraftReviewIndex([fixture(123)]);
  const first = queryDraftReview(index);
  const second = queryDraftReview(index, new URLSearchParams('page=2&page_size=50&lot=fixture-e133&query=loys'));
  const third = queryDraftReview(index, { page: 3, page_size: 50 });
  assert.deepEqual([first.items.length, second.items.length, third.items.length], [50, 50, 23]);
  assert.equal(new Set([...first.items, ...second.items, ...third.items].map(item => item.occurrence_id)).size, 123);
  assert.equal(queryDraftReview(index, { query: 'LOŸS' }).total, 123);
  assert.equal(queryDraftReview(index, { query: 'no-such-form' }).total, 0);
  for (const params of [new URLSearchParams('page=1&page=2'), { page_size: 51 }, { page: 0 }, { page: 4 }, { lot: 'unknown' }, { q: 'bad-key' }, { query: 'x'.repeat(201) }, { query: 'C:/private/photo' }]) {
    assert.throws(() => queryDraftReview(index, params), /Draft review:/);
  }
  assert.throws(() => renderDraftReviewPage({ ...first }), /queried/);
});

test('a second synthetic lot stays separate and cannot collide with occurrence identities', () => {
  const first = fixture(3);
  const second = fixture(2);
  second.bridge.lot_id = second.queue.lot_id = 'fixture-other';
  assert.throws(() => buildDraftReviewIndex([first, second]), /duplicate occurrence/);
  for (const entry of second.queue.entries) {
    entry.occurrence.id += '-other';
    for (const proposal of entry.proposals) { proposal.id += '-other'; proposal.occurrence_id = entry.occurrence.id; }
  }
  const index = buildDraftReviewIndex([first, second]);
  assert.equal(queryDraftReview(index).total, 5);
  assert.equal(queryDraftReview(index, { lot: 'fixture-other' }).total, 2);
  assert.equal(queryDraftReview(index, { lot: 'fixture-e133' }).items.every(item => item.lot === 'fixture-e133'), true);
});

test('static HTML is escaped, externally scripted, bounded and contains only exact-photo links', () => {
  const pair = fixture(1, '<img src=x onerror="alert(1)">');
  pair.bridge.display_title = '<script>Unsafe title</script>';
  pair.queue.entries[0].proposals[0].reading = '<svg onload=bad()>IA</svg>';
  const page = pageFor(pair);
  const html = renderDraftReviewPage(page);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.equal(/<img|<svg|<script>|sonclick=|sstyle=|<style/.test(html), false);
  assert.equal((html.match(/<script/g) ?? []).length, 1);
  assert.match(html, /src="\/js\/archives-draft-review\.js" defer/);
  assert.match(html, new RegExp(`/__archive_draft_media/${H('b')}`));
  assert.equal(/data\/private|relative_path|logical_uri|crop_sha256|native_bbox/.test(html), false);
  const many = renderDraftReviewPage(queryDraftReview(buildDraftReviewIndex([fixture(123)])));
  assert.equal((many.match(/class="draft-review-card"/g) ?? []).length, 50);
  assert.match(many, /data-page="2"/);
});

test('a private locator inside a displayable proposal is refused, rather than exported', () => {
  const pair = fixture();
  pair.queue.entries[0].proposals[0].rationale = 'Read C:\\Users\\Private\\photo.jpg';
  assert.throws(() => pageFor(pair), /private locator/);
});

test('analysis-fragment evidence and journal proposals retain absent confidence/tiles without inventing regions', () => {
  const pair = analysisFixture();
  const before = JSON.stringify(pair);
  const page = pageFor(pair);
  const item = page.items[0];
  assert.deepEqual(item.image.analysis_tile_ids, ['hg-01']);
  assert.equal(item.image.layer, 'recto-acte');
  assert.equal(item.image.human_review_status, 'pending');
  assert.equal(item.image.line_numbering, 'editorial-fragment-order-not-manuscript-lines');
  assert.deepEqual(item.image.reading_regions, []);
  assert.equal(Object.hasOwn(item.image, 'proposed_number'), false);
  assert.equal(item.proposals[0].proposal_id, 'proposal:fixture-journal');
  assert.equal(item.proposals[0].confidence, 'unknown');
  assert.equal(item.proposals[0].alternative, null);
  assert.equal(item.proposals[0].decision, null);
  assert.equal(item.proposals[0].entity_id, null);
  assert.equal(JSON.stringify(pair), before);
  assert.equal(/relative_path|logical_uri|tile_manifest_uri|canonical_bbox|actor_id|reading_author|data\/private|C:\/private/.test(JSON.stringify(page)), false);
  const empty = analysisFixture();
  empty.bridge.image_evidence[segmentId].analysis_tile_ids = empty.queue.entries[0].image_evidence.analysis_tile_ids = [];
  assert.match(renderDraftReviewPage(pageFor(empty)), /Aucun repère de découpe fourni/);
});

test('analysis exact-source/image drift, mixed shapes and journal promotions fail closed', () => {
  const changes = [
    pair => { pair.queue.entries[0].source_logical_uri = 'data/private/other-working.txt'; },
    pair => { pair.bridge.verified_input_hashes['data/private/other-working.txt'] = H('e'); pair.queue.entries[0].source_sha256 = H('e'); },
    pair => { pair.queue.entries[0].image_evidence.source_object_id = `object:path-${H('e')}`; },
    pair => { pair.queue.entries[0].image_evidence.source_sha256 = H('e'); },
    pair => { pair.queue.entries[0].image_evidence.canonical_bbox = [0, 0, 1, 1]; },
    pair => { pair.queue.entries[0].image_evidence.source_image_object_id = pair.bridge.images[0].object_id; },
    pair => { pair.queue.entries[0].image_evidence.human_review_status = 'accepted'; },
    pair => { pair.queue.entries[0].image_evidence.analysis_tile_ids = ['hg-01', 'hg-01']; },
    pair => { pair.queue.entries[0].image_evidence.reading_notes = 'Changed source note'; },
    pair => { pair.queue.entries[0].image_evidence.reading_notes = 'Read C:/private/photo.jpg'; },
    pair => { pair.queue.entries[0].proposals[0].type = 'decision'; },
    pair => { pair.queue.entries[0].proposals[0].idempotency_key = 'occurrence:other:1'; },
    pair => { pair.queue.entries[0].proposals[0].confidence = 'probable'; },
    pair => { pair.queue.entries[0].proposals[0].decision = 'accept'; },
    pair => { pair.queue.entries[0].proposals[0].entity_id = 'person:invented'; },
    pair => { pair.queue.entries[0].proposals[0].author_kind = 'human'; },
  ];
  for (const change of changes) { const pair = analysisFixture(); change(pair); assert.throws(() => pageFor(pair), /Draft review:/); }
});

function fakeDom() {
  const handlers = {};
  const tags = [];
  const texts = [];
  const element = tag => {
    tags.push(tag);
    return { children: [], dataset: {}, append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; },
      set textContent(value) { texts.push(String(value)); }, get textContent() { return texts.at(-1); },
      set innerHTML(_value) { throw new Error('Unsafe DOM'); }, addEventListener(name, fn) { handlers[`${tag}:${name}`] = fn; } };
  };
  const form = element('form'); form.elements = { lot: { value: '' }, query: { value: '' }, page_size: { value: '50' } };
  const results = element('results');
  const nav = element('nav'); nav.contains = () => true;
  const status = element('status');
  return { handlers, tags, texts, results, document: { getElementById: id => ({ 'draft-review-form': form, 'draft-review-results': results, 'draft-review-pagination': nav, 'draft-review-status': status })[id], createElement: element, createTextNode: value => { texts.push(String(value)); return { nodeValue: value }; } } };
}

test('client fetch is GET-only, safe DOM preserves inert text and rejects response promotions/media URLs', async () => {
  const script = readFileSync(new URL('../../js/archives-draft-review.js', import.meta.url), 'utf8');
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|Authorization|POST/.test(script), false);
  const page = pageFor(fixture(1, '<script>Inert text</script>'));
  for (const mutate of [() => {}, data => { data.items[0].entity_id = 'person:injected'; }, data => { data.items[0].image.media_url = 'https://foreign.example/photo'; }]) {
    const dom = fakeDom();
    const response = structuredClone(page); mutate(response);
    const requests = [];
    vm.runInNewContext(script, { document: dom.document, URLSearchParams, AbortController,
      fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => response }; },
      location: { pathname: '/archives/formes-brouillons/' }, history: { replaceState() {} } });
    dom.handlers['form:submit']({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options.method, 'GET');
    assert.match(requests[0].url, /^\/__draft_review_data\?/);
    const accepted = response.items[0].entity_id === null && response.items[0].image.media_url.startsWith('/__archive_draft_media/');
    assert.equal(dom.results.children.length > 0, accepted);
    if (accepted) assert.equal(dom.texts.includes('<script>Inert text</script>'), true);
    assert.equal(dom.tags.includes('script') || dom.tags.includes('img'), false);
  }
});

test('analysis notes are inert in static and safe DOM views; human-review promotion is rejected', async () => {
  const pair = analysisFixture();
  const note = '<img src=x onerror="alert(1)"> fragment';
  pair.bridge.image_evidence[segmentId].reading_notes = pair.queue.entries[0].image_evidence.reading_notes = note;
  const page = pageFor(pair);
  assert.match(renderDraftReviewPage(page), /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; fragment/);
  const script = readFileSync(new URL('../../js/archives-draft-review.js', import.meta.url), 'utf8');
  for (const pending of [true, false]) {
    const dom = fakeDom();
    const response = structuredClone(page);
    if (!pending) response.items[0].image.human_review_status = 'accepted';
    vm.runInNewContext(script, { document: dom.document, URLSearchParams, AbortController,
      fetch: async () => ({ ok: true, json: async () => response }),
      location: { pathname: '/archives/formes-brouillon/' }, history: { replaceState() {} } });
    dom.handlers['form:submit']({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(dom.results.children.length > 0, pending);
    if (pending) assert.equal(dom.texts.includes(note), true);
    assert.equal(dom.tags.includes('img'), false);
  }
});

const realDirectory = process.env.ARCHIVE_DRAFT_REVIEW_PACKAGE;
function assertReviewProjection(loaded, raw) {
  assert.deepEqual(loaded.bridge, raw.bridge, 'The loader must not rewrite the upstream bridge.');
  assert.deepEqual(loaded.queue, raw.queue);
  assert.ok(loaded.reviewBridge, 'An independently verified review projection is required.');
  const { verified_input_hashes: rawHashes, ...rawContent } = raw.bridge;
  const { verified_input_hashes: reviewHashes, ...reviewContent } = loaded.reviewBridge;
  assert.deepEqual(reviewContent, rawContent, 'Source aliases must not alter passages, states or identities.');
  if (raw.bridge.lot_id === 'lois-e133') {
    assert.throws(() => buildDraftReviewIndex([raw]), /exact source locator\/hash drift/);
    const evidence = loaded.sourceAliasEvidence;
    assert.equal(evidence.format, 'private-derived-source-alias-evidence/1');
    assert.equal(evidence.upstream_modified, false);
    assert.equal(evidence.historical_confirmation, false);
    assert.match(evidence.manifest_sha256, /^[a-f0-9]{64}$/);
    assert.equal(evidence.package_sha256, rawHashes[evidence.package_path]);
    assert.equal(evidence.bindings.length, 3);
    assert.equal(new Set(evidence.bindings.map(binding => binding.source_id)).size, 3);
    assert.deepEqual(Object.keys(reviewHashes).filter(key => !Object.hasOwn(rawHashes, key)).sort(), evidence.bindings.map(binding => binding.logical_uri).sort());
    for (const binding of evidence.bindings) {
      assert.equal(Object.hasOwn(rawHashes, binding.logical_uri), false);
      assert.equal(binding.sha256, rawHashes[binding.verified_path]);
      assert.equal(binding.sha256, reviewHashes[binding.logical_uri]);
      const entries = raw.queue.entries.filter(entry => entry.source_id === binding.source_id);
      assert.ok(entries.length > 0);
      assert.equal(entries.every(entry => entry.source_logical_uri === binding.logical_uri && entry.source_sha256 === binding.sha256), true);
    }
  } else {
    assert.equal(loaded.sourceAliasEvidence, null, 'E.113 already supplies exact verified source keys.');
    assert.deepEqual(reviewHashes, rawHashes);
  }
}
test('E.133 verified derivative projection: raw source aliases refused, 416 exact Unicode/photo mappings retained', { skip: !realDirectory && 'Set ARCHIVE_DRAFT_REVIEW_PACKAGE to the authorized E.133 bridge folder.' }, () => {
  const checksums = JSON.parse(readFileSync(join(realDirectory, 'checksums.json'), 'utf8'));
  const read = filename => {
    const bytes = readFileSync(join(realDirectory, filename));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), checksums[filename]);
    return JSON.parse(bytes);
  };
  const raw = { bridge: read('reader-bridge.json'), queue: read('review-queue.json') };
  const loaded = loadDraftBridge(realDirectory);
  assertReviewProjection(loaded, raw);
  assert.deepEqual(read('reader-bridge.json'), raw.bridge, 'Upstream bridge bytes still satisfy their original checksum after projection.');
  assert.deepEqual(read('review-queue.json'), raw.queue);
  const pair = { bridge: loaded.reviewBridge, queue: loaded.queue };
  const index = buildDraftReviewIndex([pair]);
  const page = queryDraftReview(index);
  assert.equal(index.total, 416);
  assert.equal(pair.bridge.segments.length, 97);
  assert.equal(pair.bridge.images.length, 4);
  assert.equal(page.items.length, 50);
  assert.equal(page.total_pages, 9);
  assert.equal(queryDraftReview(index, { query: 'lois' }).items.some(item => item.proposals.some(value => value.alternative === 'Lois')), true);
  assert.equal(queryDraftReview(index, { page: 9 }).items.length, 16);
  assert.equal(/relative_path|logical_uri|crop_sha256|native_bbox|data\/private/.test(JSON.stringify(page)), false);
  assert.equal(/data\/private|relative_path|logical_uri/.test(renderDraftReviewPage(page)), false);
});

const bridgesRoot = process.env.ARCHIVE_DRAFT_REVIEW_BRIDGES_ROOT;
test('E.133 + E.113 authorized derivatives: checksums/profile, 992 exact Unicode sources, 89 proposals, 17 photographs, 20 bounded pages',
  { skip: !bridgesRoot && 'Set ARCHIVE_DRAFT_REVIEW_BRIDGES_ROOT after both lot gates are explicitly authorized.' }, () => {
    const pairs = ['e133', 'e113'].map(lot => {
      const directory = join(bridgesRoot, lot);
      const checksums = JSON.parse(readFileSync(join(directory, 'checksums.json'), 'utf8'));
      const read = filename => {
        const bytes = readFileSync(join(directory, filename));
        assert.equal(createHash('sha256').update(bytes).digest('hex'), checksums[filename], `${lot}/${filename} checksum`);
        return JSON.parse(bytes);
      };
      const raw = { bridge: read('reader-bridge.json'), queue: read('review-queue.json') };
      assert.equal(raw.bridge.format, 'private-draft-reader-bridge/0.1.0');
      assert.equal(raw.queue.format, raw.bridge.format);
      const loaded = loadDraftBridge(directory);
      assertReviewProjection(loaded, raw);
      assert.deepEqual(read('reader-bridge.json'), raw.bridge);
      assert.deepEqual(read('review-queue.json'), raw.queue);
      const pair = { bridge: loaded.reviewBridge, queue: loaded.queue };
      return pair;
    });
    const index = buildDraftReviewIndex(pairs);
    const first = queryDraftReview(index);
    assert.equal(index.format, 'private-draft-review-query/0.1.0');
    assert.equal(index.total, 992);
    assert.deepEqual(index.lots.map(lot => [lot.id, lot.count]), [['lois-e133', 416], ['jeanne-e113', 576]]);
    assert.equal(first.items.length, 50);
    assert.equal(first.total_pages, 20);
    const rows = Array.from({ length: 20 }, (_, offset) => queryDraftReview(index, { page: offset + 1 })).flatMap(page => {
      assert.equal(page.items.length, page.page === 20 ? 42 : 50);
      assert.equal(page.confirmed_memory_count, 0);
      assert.equal(/relative_path|logical_uri|tile_manifest_uri|canonical_bbox|crop_sha256|native_bbox|actor_id|data\/private/.test(JSON.stringify(page)), false);
      return page.items;
    });
    assert.equal(new Set(rows.map(row => row.occurrence_id)).size, 992);
    assert.equal(rows.reduce((count, row) => count + row.proposals.length, 0), 89);
    const photos = new Map(pairs.flatMap(pair => pair.bridge.images).map(image => [image.object_id, image.sha256]));
    assert.equal(photos.size, 17);
    const usedPhotos = new Set();
    for (const row of rows) {
      const pair = pairs.find(value => value.bridge.lot_id === row.lot);
      const entry = pair.queue.entries.find(value => value.occurrence.id === row.occurrence_id);
      const segment = pair.bridge.segments.find(value => value.id === row.segment_id);
      assert.equal(row.passage, segment.passage);
      assert.equal(row.source_id, segment.source_id);
      assert.equal(row.source_id, entry.source_id);
      assert.equal(row.source_sha256, entry.source_sha256);
      assert.equal(row.base_revision, segment.base_revision);
      assert.equal(row.observed_text, Array.from(segment.passage).slice(row.span.start, row.span.end).join(''));
      assert.equal(row.observed_text, entry.occurrence.observed_text);
      assert.equal(row.source_sha256, pair.bridge.verified_input_hashes[entry.source_logical_uri], 'Every source locator must be an exact verified key, never an unrelated input hash.');
      const evidence = pair.bridge.image_evidence[segment.id];
      assert.equal(row.image.object_id, evidence.source_image_object_id ?? evidence.source_object_id);
      assert.equal(row.image.sha256, evidence.source_image_sha256 ?? evidence.source_sha256);
      assert.equal(photos.get(row.image.object_id), row.image.sha256);
      assert.equal(row.image.media_url, `/__archive_draft_media/${row.image.sha256}`);
      usedPhotos.add(row.image.object_id);
      for (const region of row.image.reading_regions) {
        assert.equal(photos.get(region.source_image_object_id), region.source_image_sha256);
        usedPhotos.add(region.source_image_object_id);
      }
      assert.equal(row.entity_id, null);
      assert.equal(row.identification_status, 'unresolved');
      assert.equal(row.confirmed_memory, false);
      assert.equal(Object.values(row.canonical_refs).every(value => value === null), true);
      if (row.lot === 'jeanne-e113') {
        assert.equal(row.source_sha256, pair.bridge.verified_input_hashes[entry.source_logical_uri]);
        assert.deepEqual(row.image.analysis_tile_ids, evidence.analysis_tile_ids);
        assert.equal(row.image.layer, evidence.layer);
        assert.equal(row.image.reading_notes, evidence.reading_notes);
        assert.equal(row.image.human_review_status, 'pending');
        assert.equal(Object.hasOwn(row.image, 'proposed_number'), false);
        assert.equal(row.proposals.every(proposal => proposal.confidence === 'unknown' && proposal.alternative === null && proposal.decision === null), true);
      } else {
        assert.equal(row.image.proposed_number, evidence.proposed_number);
      }
    }
    const unusedPhotos = pairs.flatMap(pair => pair.bridge.images).filter(image => !usedPhotos.has(image.object_id));
    assert.equal(usedPhotos.size, 16, 'All cited photos are exact bridge members; the overview remains unlinked to a passage.');
    assert.equal(unusedPhotos.length, 1);
    assert.equal(unusedPhotos[0].coverage.status, 'overview-overlapping-context');
    assert.deepEqual(unusedPhotos[0].coverage.unit_ids, []);
    assert.deepEqual(unusedPhotos[0].coverage.tile_ids, []);
    assert.equal(unusedPhotos[0].coverage.not_a_separate_historical_page, true);
    for (let suffix = 21; suffix <= 27; suffix += 1) {
      const candidates = rows.filter(row => row.lot === 'lois-e133' && row.image.section_id === `p3-entry-${suffix}`);
      assert.ok(candidates.length > 0);
      assert.equal(candidates.every(row => row.image.proposed_number === suffix - 1), true, 'sidecar candidate number is not inferred from the technical suffix');
    }
    assert.equal(queryDraftReview(index, { lot: 'jeanne-e113' }).total, 576);
    assert.equal(queryDraftReview(index, { lot: 'lois-e133' }).total, 416);
    assert.equal(/relative_path|logical_uri|tile_manifest_uri|data\/private/.test(renderDraftReviewPage(queryDraftReview(index, { lot: 'jeanne-e113' }))), false);
  });
