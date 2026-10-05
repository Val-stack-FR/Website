import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createDraftDerivativeBindings, draftBindingsDigest, draftDerivativeSelection,
  draftDerivativeRoutes, bindDraftPhotograph, bindDraftReadingRegion,verifyDraftDerivativeHtml } from '../../scripts/archives/draft-derivative-bindings.mjs';
import { createDraftDossier,bindDraftDossierMedia } from '../../scripts/archives/draft-dossier.mjs';
import { renderReaderHtml } from '../../scripts/archives/render-reader.mjs';
const H = char => char.repeat(64);
function inventedFixture(count = 3) {
  const orientations = [null, 6, 1, 8];
  const bytesByDerivative = new Map();
  const bindings = Array.from({ length: count }, (_, index) => {
    // Invented byte payload tests this binding boundary, not JPEG decoding.
    const bytes = Buffer.from(`fully invented asymmetric raster fixture ${index}`);
    const derivative_sha256 = createHash('sha256').update(bytes).digest('hex');
    bytesByDerivative.set(derivative_sha256, bytes);
    const exif_orientation = orientations[index % 4], rotated = [6, 8].includes(exif_orientation);
    return { candidate_view_id: `candidate-view:invented-${index}`, canonical_view_id: null, lot_id: 'invented', source_object_id: `object:path-${index.toString(16).padStart(64, 'a')}`,
      source_sha256: H('b'), derivative_object_id: `object:media-${derivative_sha256}`, derivative_sha256,
      derivative_byte_size: bytes.length, coded_width: 7, coded_height: 5,
      display_width: rotated ? 5 : 7, display_height: rotated ? 7 : 5, exif_orientation };
  });
  return { bindings, expectedBindingsSha256: draftBindingsDigest(bindings), bytesByDerivative,
    selectedObjectIds: bindings.slice(0, 3).map(value => value.source_object_id) };
}
test('invented pilot pins source, candidate view and derivative separately, selects exactly three immutable routes', () => {
  const fixture = inventedFixture(), context = createDraftDerivativeBindings(fixture);
  const bound = bindDraftPhotograph(context, fixture.bindings[1].source_object_id, H('b'));
  assert.equal(bound.mediaUrl, `/__archive_draft_derivative/${fixture.bindings[1].derivative_sha256}`);
  assert.deepEqual([bound.width, bound.height, bound.codedWidth, bound.codedHeight], [5, 7, 7, 5]);
  assert.equal(bound.candidateViewId, 'candidate-view:invented-1'); assert.equal(bound.sourceSha256, H('b'));
  assert.equal(bound.associationStatus, 'candidate'); assert.equal(bound.humanReview, 'pending'); assert.equal(bound.rightsStatus, 'unknown');
  const routes = draftDerivativeRoutes(context), selection = draftDerivativeSelection(context);
  routes.values().next().value.bytes[0] = 0; selection.bindings[0].source_sha256 = H('c');
  fixture.bytesByDerivative.values().next().value[0] = 0; fixture.bindings[0].source_sha256 = H('c');
  assert.equal(draftDerivativeRoutes(context).size, 3);
  assert.equal(draftDerivativeSelection(context).bindings[0].source_sha256, H('b'));
  assert.notEqual(draftDerivativeRoutes(context).values().next().value.bytes[0], 0);
  assert.throws(() => bindDraftPhotograph({ ...context }, fixture.bindings[0].source_object_id, H('b')));
});
test('outside-pilot photographs retain source identities with no route; ambiguous regions remain pending', () => {
  const fixture = inventedFixture(17), context = createDraftDerivativeBindings(fixture);
  const outside = fixture.bindings[16];
  assert.equal(bindDraftPhotograph(context, outside.source_object_id, outside.source_sha256).mediaUrl, null);
  const region = { source_object_id: fixture.bindings[1].source_object_id, source_sha256: H('b'),
    reference_frame: 'original-view', native_bbox: [1, 1, 4, 2] };
  assert.equal(bindDraftReadingRegion(context, region).displayRectangle, null);
  region.reference_frame = 'native-coded-raster'; region.coordinate_units = 'pixel-edges-xywh';
  assert.deepEqual(bindDraftReadingRegion(context, region).displayRectangle, [2, 1, 2, 4]);
  assert.throws(() => bindDraftReadingRegion(context, { ...region, source_sha256: H('c') }));
});
test('all seventeen invented views can be selected explicitly without merging identities', () => {
  const fixture = inventedFixture(17); fixture.selectedObjectIds = fixture.bindings.map(value => value.source_object_id);
  const context = createDraftDerivativeBindings(fixture);
  assert.equal(draftDerivativeRoutes(context).size, 17);
  assert.equal(draftDerivativeSelection(context).selected_object_ids.length, 17);
  for (const binding of fixture.bindings) assert.equal(bindDraftPhotograph(context, binding.source_object_id, binding.source_sha256).mediaStatus, 'verified-private-derivative');
});
test('absent candidate/canonical view IDs remain null; source identity cannot create a historical view', () => {
  const fixture = inventedFixture(); fixture.bindings.forEach(binding => { binding.candidate_view_id=null; });
  fixture.expectedBindingsSha256=draftBindingsDigest(fixture.bindings);
  const context=createDraftDerivativeBindings(fixture),photo=bindDraftPhotograph(context,fixture.bindings[0].source_object_id,H('b'));
  assert.equal(photo.candidateViewId,null); assert.equal(photo.canonicalViewId,null);
  fixture.bindings[0].canonical_view_id='view:invented-canonical'; fixture.expectedBindingsSha256=draftBindingsDigest(fixture.bindings);
  assert.throws(()=>createDraftDerivativeBindings(fixture));
});
test('invented typed gallery and fragment links use only selected derivative hashes; source/view/text states stay distinct', () => {
  const fixture = inventedFixture(17), context = createDraftDerivativeBindings(fixture);
  const dossier = createDraftDossier({ presentationId: 'presentation:invented', label: 'Invented technical fixture', originalText: 'Invented text.', modernText: 'Invented modern draft.',
    revision: 'r0', notes: [], candidateViews: fixture.bindings.slice(0, 13).map((value, index) => ({ objectId: value.source_object_id, sha256: value.source_sha256, label: `Invented ${index}` })),
    fragments: [{ id: 'segment:invented', label: 'Invented fragment', passage: 'Invented text.', imageObjectIds: [fixture.bindings[0].source_object_id, fixture.bindings[4].source_object_id] }] });
  const bound = bindDraftDossierMedia(dossier, context), before = JSON.stringify(dossier);
  const base = createDraftDossier({ presentationId: 'presentation:invented-base', label: 'Invented base', originalText: 'Invented base text.', modernText: 'Invented modern base.', revision: 'r0', notes: [], candidateViews: [] });
  const html = renderReaderHtml({ packageId: 'package:invented', sourcePublication: { approvedForPublication: false }, dossiers: [base] }, { privatePreview: true, draftDossiers: [bound] });
  assert.equal(verifyDraftDerivativeHtml(html, context), true); assert.equal(html.includes('/__archive_draft_media/'), false);
  assert.equal(bound.texts[0], dossier.texts[0]); assert.equal(bound.fragments, dossier.fragments);
  assert.equal(JSON.stringify(dossier), before); assert.equal(bound.actId, null); assert.equal(bound.readingStatus, 'machine-draft');
  assert.match(html, /hors de la sélection pilote/);
  for (const changed of [html.replace('width="7"', 'width="8"'), html.replace('data-source-sha256="'+H('b')+'"', 'data-source-sha256="'+H('c')+'"'), html+' /__archive_draft_media/'+H('b'), html+' /__archive_draft_derivative/'+H('f')]) assert.throws(() => verifyDraftDerivativeHtml(changed, context));
});
test('changed mapping, selection, byte set, hash, dimensions and candidate identity fail closed', () => {
  const changes = [value => { value.expectedBindingsSha256 = H('f'); }, value => { value.selectedObjectIds.pop(); },
    value => { value.selectedObjectIds[0] = `object:path-${H('f')}`; },
    value => { value.bytesByDerivative.set(H('f'), Buffer.from('extra')); },
    value => { value.bytesByDerivative.values().next().value[0] = 0; },
    value => { value.bindings[0].display_width++; }, value => { value.bindings[0].candidate_view_id = 'view:invented-canonical'; },
    value => { value.bindings[0].human_review = 'accepted'; }, value => { value.bindings[1].candidate_view_id = value.bindings[0].candidate_view_id; }];
  for (const change of changes) { const value = inventedFixture(); change(value);
    if (value.expectedBindingsSha256 !== H('f')) value.expectedBindingsSha256 = draftBindingsDigest(value.bindings);
    assert.throws(() => createDraftDerivativeBindings(value));
  }
});
