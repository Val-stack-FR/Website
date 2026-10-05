import assert from 'node:assert/strict';
import test from 'node:test';
import { createDraftDossier } from '../../scripts/archives/draft-dossier.mjs';
import { renderReaderHtml, buildMediaManifest } from '../../scripts/archives/render-reader.mjs';

const input = () => ({ presentationId: 'presentation:invented-draft', label: 'Dossier de test inventé', originalText: 'Lecture [incertaine ?]\n<script>invented</script>', modernText: 'Lecture modernisée [incertaine ?]', revision: 'r0', notes: ['Identités et dates inconnues.'], candidateViews: [{ objectId: 'object:path-' + 'a'.repeat(64), sha256: 'b'.repeat(64), label: 'Photographie inventée' }] });
const base = () => ({ packageId: 'package:invented', sourcePublication: { approvedForPublication: false }, dossiers: [createDraftDossier({ ...input(), presentationId: 'presentation:base', candidateViews: [] })] });

test('draft original, modern version and candidate photographs remain distinct and escaped', () => {
  const dossier = createDraftDossier(input());
  const html = renderReaderHtml(base(), { privatePreview: true, draftDossiers: [dossier] });
  assert.match(html, /1 \/ 2/);
  assert.match(html, /brouillon IA non relu/);
  assert.match(html, /Vues du dossier photo candidat/);
  assert.match(html, /Rattachement candidat/);
  assert.match(html, /Lecture modernisée \[incertaine \?\]/);
  assert.ok(html.indexOf('Transcription proposée · graphies originales') < html.indexOf('Français moderne proposé · brouillon IA'));
  assert.ok(!html.includes('Texte importé'));
  assert.ok(html.includes('&lt;script&gt;invented&lt;/script&gt;'));
  assert.ok(!html.includes('Lien image · accepté'));
  assert.ok(!html.includes('/__archive_media/'));
  assert.ok(!html.includes('Proposer une lecture'));
  assert.equal(dossier.documentId, null);
  assert.equal(dossier.actId, null);
  assert.equal(dossier.images.length, 0);
  assert.deepEqual(buildMediaManifest({ dossiers: [dossier] }).allowedSha256, []);
});

test('presentation rejects canonical identities, accepted links, foreign URLs and unbounded scope', () => {
  for (const extra of [{ document_id: 'document:invented' }, { approved_links: [] }, { reading_status: 'accepted' }]) assert.throws(() => createDraftDossier({ ...input(), ...extra }), /Unsupported/);
  assert.throws(() => createDraftDossier({ ...input(), candidateViews: [{ ...input().candidateViews[0], mediaUrl: 'https://outside.invalid/image' }] }), /Unsupported/);
  assert.throws(() => createDraftDossier({ ...input(), candidateViews: Array(14).fill(input().candidateViews[0]) }), /thirteen/);
  assert.throws(() => createDraftDossier({ ...input(), candidateViews: Array(2).fill(input().candidateViews[0]) }), /Duplicate/);
  assert.throws(() => createDraftDossier({ ...input(), modernText: null }), /modernText/);
  assert.throws(() => renderReaderHtml(base(), { privatePreview: true, draftDossiers: [{}] }), /verified draft/);
  assert.throws(() => renderReaderHtml(base(), { privatePreview: true, draftDossiers: [createDraftDossier(input()), createDraftDossier(input()), createDraftDossier(input())] }), /two verified/);
});

test('draft paths remain private and a draft cannot receive an unqualified correction CTA', () => {
  const dossier = createDraftDossier({ ...input(), originalText: 'C:\\private\\source.txt' });
  assert.throws(() => renderReaderHtml(base(), { privatePreview: true, draftDossiers: [dossier] }), /source path/);
  const safe = createDraftDossier(input());
  assert.throws(() => renderReaderHtml(base(), { privatePreview: true, correctionsOrigin: 'http://127.0.0.1:8789', correctionTextIds: [safe.texts[0].textId], draftDossiers: [safe] }), /explicit text IDs/);
});
