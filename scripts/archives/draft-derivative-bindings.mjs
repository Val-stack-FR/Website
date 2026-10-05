import { createHash } from 'node:crypto';
import { createDraftMediaFrame, qualifyDraftReadingRegion } from './draft-media-frames.mjs';
const contexts = new WeakMap();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (condition, message) => { if (!condition) throw new Error(`Draft derivative binding: ${message}`); };
const hash = value => /^[a-f0-9]{64}$/u.test(value ?? '');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const draftBindingsDigest = bindings => sha(Buffer.from(JSON.stringify(bindings)));

// This boundary checks normalized, explicitly pinned bindings and bytes. The
// package adapter must independently verify its closed file tree and review GO.
// A source photograph, candidate view and derivative are separate identities.
export function createDraftDerivativeBindings({ bindings, expectedBindingsSha256, bytesByDerivative, selectedObjectIds }) {
  check(Array.isArray(bindings) && bindings.length >= 1 && bindings.length <= 17
    && hash(expectedBindingsSha256) && draftBindingsDigest(bindings) === expectedBindingsSha256, 'mapping pin drift');
  check(bytesByDerivative instanceof Map && bytesByDerivative.size === bindings.length, 'closed derivative byte set required');
  check(Array.isArray(selectedObjectIds) && [3, 17].includes(selectedObjectIds.length)
    && new Set(selectedObjectIds).size === selectedObjectIds.length, 'explicit three-view pilot or seventeen-view selection required');
  const sources = new Map(), derivatives = new Set(), candidateViews = new Set(), routes = new Map();
  for (const value of bindings) {
    check(value && same(Object.keys(value).sort(), ['candidate_view_id', 'canonical_view_id', 'lot_id', 'coded_height', 'coded_width', 'derivative_byte_size',
      'derivative_object_id', 'derivative_sha256', 'display_height', 'display_width', 'exif_orientation', 'source_object_id', 'source_sha256'].sort()), 'unsupported mapping field');
    check(/^object:path-[a-f0-9]{64}$/u.test(value.source_object_id ?? '') && hash(value.source_sha256)
      && hash(value.derivative_sha256) && value.derivative_sha256 !== value.source_sha256
      && value.derivative_object_id === `object:media-${value.derivative_sha256}`
      && (value.candidate_view_id === null || /^candidate-view:[a-zA-Z0-9._:-]+$/u.test(value.candidate_view_id ?? ''))
      && value.canonical_view_id === null && /^[a-z0-9-]{1,100}$/u.test(value.lot_id ?? '')
      && !sources.has(value.source_object_id) && !derivatives.has(value.derivative_sha256)
      && (value.candidate_view_id === null || !candidateViews.has(value.candidate_view_id)), 'source/view/derivative identity drift or duplicate');
    const bytes = bytesByDerivative.get(value.derivative_sha256);
    check(Buffer.isBuffer(bytes) && Number.isSafeInteger(value.derivative_byte_size) && value.derivative_byte_size > 0
      && value.derivative_byte_size <= 32 * 1024 * 1024 && bytes.length === value.derivative_byte_size
      && sha(bytes) === value.derivative_sha256, 'derivative hash or byte size drift');
    const frame = createDraftMediaFrame({ codedWidth: value.coded_width, codedHeight: value.coded_height, exifOrientation: value.exif_orientation });
    check(frame.displayWidth === value.display_width && frame.displayHeight === value.display_height, 'EXIF display dimensions drift');
    sources.set(value.source_object_id, { binding: Object.freeze({ ...value }), frame });
    derivatives.add(value.derivative_sha256); if(value.candidate_view_id!==null)candidateViews.add(value.candidate_view_id);
  }
  check([...bytesByDerivative.values()].reduce((sum, bytes) => sum + bytes.length, 0) <= 128 * 1024 * 1024, 'total byte budget exceeded');
  check(selectedObjectIds.every(objectId => sources.has(objectId)), 'selection outside pinned sources');
  const selected = new Set(selectedObjectIds);
  for (const objectId of selected) {
    const { binding } = sources.get(objectId);
    routes.set(`/__archive_draft_derivative/${binding.derivative_sha256}`, {
      bytes: Buffer.from(bytesByDerivative.get(binding.derivative_sha256)), contentType: 'image/jpeg', size: binding.derivative_byte_size });
  }
  const context = Object.freeze({ version: 'private-draft-derivative-bindings/1' });
  contexts.set(context, { sources, selected, routes, bindingsSha256: expectedBindingsSha256 });
  return context;
}
function data(context) { const value = contexts.get(context); check(value, 'use a constructed binding context'); return value; }
export function draftDerivativeSelection(context) {
  const value = data(context);
  return { version: context.version, bindings_sha256: value.bindingsSha256,
    selected_object_ids: [...value.selected], bindings: [...value.sources.values()].map(item => ({ ...item.binding })) };
}
export function draftDerivativeRoutes(context) {
  return new Map([...data(context).routes].map(([url, item]) => [url, { ...item, bytes: Buffer.from(item.bytes) }]));
}
export function bindDraftPhotograph(context, objectId, sourceSha256) {
  const value = data(context), source = value.sources.get(objectId);
  check(source && source.binding.source_sha256 === sourceSha256, 'source object/hash drift');
  const { binding, frame } = source;
  return Object.freeze({ sourceObjectId: objectId, sourceSha256, candidateViewId: binding.candidate_view_id,
    canonicalViewId: null, lotId: binding.lot_id,
    derivativeObjectId: binding.derivative_object_id, derivativeSha256: binding.derivative_sha256,
    mediaUrl: value.selected.has(objectId) ? `/__archive_draft_derivative/${binding.derivative_sha256}` : null,
    width: frame.displayWidth, height: frame.displayHeight, codedWidth: frame.codedWidth, codedHeight: frame.codedHeight,
    exifOrientation: frame.exifOrientation, mediaStatus: value.selected.has(objectId) ? 'verified-private-derivative' : 'outside-pilot-selection',
    associationStatus: 'candidate', rightsStatus: 'unknown', humanReview: 'pending', publicationStatus: 'not-published' });
}
export function bindDraftReadingRegion(context, region) {
  const value = data(context), source = value.sources.get(region?.source_object_id);
  check(source && source.binding.source_sha256 === region.source_sha256, 'region source object/hash drift');
  if (!value.selected.has(region.source_object_id)) return Object.freeze({ status: 'pending-reference-frame',
    reason: 'Photograph is outside the pilot selection.', displayRectangle: null, individualWordRectangle: null, humanReview: 'pending' });
  return qualifyDraftReadingRegion(source.frame, region);
}
export function verifyDraftDerivativeHtml(html, context) {
  const value = data(context), text = Buffer.isBuffer(html) ? html.toString('utf8') : html;
  check(typeof text === 'string' && !text.includes('/__archive_draft_media/'), 'source photograph URL remains in derivative reader');
  const tags = [...text.matchAll(/<img\b[^>]*\bdata-draft-object-id="([^"]+)"[^>]*>/gu)];
  check(tags.length === value.selected.size, 'typed image selection cardinality drift');
  const seen = new Set();
  for (const [tag, objectId] of tags) {
    check(value.selected.has(objectId) && !seen.has(objectId), 'image source selection drift'); seen.add(objectId);
    const photo = bindDraftPhotograph(context, objectId, value.sources.get(objectId).binding.source_sha256);
    const attributes = [...tag.matchAll(/\b([a-z][a-z0-9-]*)="([^"]*)"/gu)];
    const attrs = Object.fromEntries(attributes.map(([, key, val]) => [key, val]));
    check(new Set(attributes.map(([, key]) => key)).size === attributes.length, 'duplicate image attribute');
    check(attrs.src === photo.mediaUrl && attrs['data-source-sha256'] === photo.sourceSha256
      && attrs['data-candidate-view-id'] === (photo.candidateViewId ?? '') && attrs['data-derivative-sha256'] === photo.derivativeSha256
      && attrs.width === String(photo.width) && attrs.height === String(photo.height), 'typed photograph binding drift');
  }
  for (const [url] of text.matchAll(/\/__archive_draft_derivative\/[a-f0-9]{64}/gu)) check(value.routes.has(url), 'derivative URL outside selection');
  return true;
}
