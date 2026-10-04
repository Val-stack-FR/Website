// Presentation only. This constructor creates no canonical document, act,
// view, transcription, person or accepted association.
import { bindDraftPhotograph } from './draft-derivative-bindings.mjs';
const drafts = new WeakSet();
const requireText = (value, label, max = 200000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid draft ${label}.`);
  return value;
};

export function createDraftDossier(input) {
  const allowed = ['presentationId', 'label', 'originalText', 'modernText', 'revision', 'notes', 'candidateViews', 'fragments'];
  if (!input || Object.keys(input).some(key => !allowed.includes(key))) throw new Error('Unsupported draft presentation field.');
  const id = requireText(input.presentationId, 'presentationId', 100);
  if (!/^presentation:[a-z0-9-]+$/u.test(id)) throw new Error('A local presentation ID is required.');
  const label = requireText(input.label, 'label', 200);
  const original = requireText(input.originalText, 'originalText');
  const modern = requireText(input.modernText, 'modernText');
  const revision = requireText(input.revision, 'revision', 100);
  if (!Array.isArray(input.notes) || input.notes.length > 24) throw new Error('Bounded draft notes are required.');
  const notes = input.notes.map(note => requireText(note, 'note', 1000));
  if (!Array.isArray(input.candidateViews) || input.candidateViews.length > 13) throw new Error('At most thirteen candidate photographs are allowed.');
  const seen = new Set();
  const views = input.candidateViews.map(view => {
    if (!view || Object.keys(view).some(key => !['objectId', 'sha256', 'label'].includes(key))) throw new Error('Unsupported candidate photograph field.');
    if (!/^object:path-[a-f0-9]{64}$/u.test(view.objectId) || !/^[a-f0-9]{64}$/u.test(view.sha256)) throw new Error('Explicit source photograph identity and hash required.');
    if (seen.has(view.objectId)) throw new Error('Duplicate candidate photograph.');
    seen.add(view.objectId);
    return Object.freeze({ digitalObjectId: view.objectId, sha256: view.sha256, label: requireText(view.label, 'photograph label', 200), mediaUrl: `/__archive_draft_media/${view.sha256}`, associationStatus: 'candidate', rightsStatus: 'unknown', publicationStatus: 'not-published' });
  });
  const fragments = input.fragments ?? [];
  if (!Array.isArray(fragments) || fragments.length > 1000) throw new Error('Bounded fragments required.');
  const fragmentIds = new Set();
  const safeFragments = fragments.map(fragment => {
    if (!fragment || Object.keys(fragment).some(key => !['id', 'label', 'passage', 'imageObjectIds'].includes(key))) throw new Error('Unsupported fragment field.');
    const fragmentId = requireText(fragment.id, 'fragment ID', 200);
    if (fragmentIds.has(fragmentId) || !Array.isArray(fragment.imageObjectIds) || fragment.imageObjectIds.length < 1 || fragment.imageObjectIds.some(objectId => !seen.has(objectId))) throw new Error('Distinct fragments must reference selected photographs.');
    fragmentIds.add(fragmentId);
    return Object.freeze({ id: fragmentId, label: requireText(fragment.label, 'fragment label', 200), passage: requireText(fragment.passage, 'fragment passage', 10000), imageObjectIds: Object.freeze([...fragment.imageObjectIds]) });
  });
  const dossier = Object.freeze({
    candidateId: id, slug: id.replace(':', '-'), label, documentId: null, actId: null,
    archivalReference: null, identificationStatus: 'candidate', readingStatus: 'machine-draft',
    dateClaims: Object.freeze([]), hasDateConflict: false,
    uncertainties: Object.freeze(['Brouillon IA partiel, non relu humainement. Dossier photo candidat ; aucune identité canonique ni association acceptée créée.', ...notes]),
    texts: Object.freeze([Object.freeze({ textId: `${id}:original`, transcriptionId: null, sourceObjectId: null,
      literal: original, language: 'fr', revision, extent: 'lecture partielle', readingStatus: 'machine-draft',
      translation: Object.freeze({ literal: modern, language: 'fr', status: 'machine-draft' }) })]),
    images: Object.freeze([]), candidateViews: Object.freeze(views), fragments: Object.freeze(safeFragments)
  });
  drafts.add(dossier);
  return dossier;
}

export const isDraftDossier = value => drafts.has(value);

export function bindDraftDossierMedia(dossier, mediaBindings) {
  if (!isDraftDossier(dossier)) throw new Error('Verified draft presentation required.');
  const bound = Object.freeze({ ...dossier, candidateViews: Object.freeze(dossier.candidateViews.map(view => {
    const photograph=bindDraftPhotograph(mediaBindings, view.digitalObjectId, view.sha256);
    if(dossier.candidateId!=='presentation:'+photograph.lotId)throw new Error('Draft derivative lot differs from dossier.');
    return Object.freeze({ ...view, ...photograph });
  })) });
  drafts.add(bound);
  return bound;
}
