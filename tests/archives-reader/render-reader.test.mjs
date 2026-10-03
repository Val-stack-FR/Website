import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  adaptArchiveExport,
  buildMediaManifest,
  renderReaderHtml,
  writePrivatePreview
} from '../../scripts/archives/render-reader.mjs';

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const VIEW_A = 'object:view-monbezon-a';
const VIEW_B = 'object:view-monbezon-b';

const sourceExport = () => ({
  export_profile: 'atelier-tuce-reader/0.1.0',
  package_id: 'package:test-private-preview',
  publication: {
    status: 'review-pending',
    rights_review: 'pending',
    approved_for_publication: false
  },
  candidates: [
    {
      candidate_id: 'candidate:monbezon-test',
      document_id: null,
      act_id: null,
      label: 'Dossier Monbezon <script>alert(1)</script>',
      archival_reference: 'TEST-MONBEZON',
      identification_status: 'candidate',
      reading_status: 'unreviewed',
      date_ids: ['date:monbezon-a', 'date:monbezon-b'],
      view_ids: [VIEW_A, VIEW_B],
      text_ids: ['text:monbezon'],
      uncertainties: ['Dates concurrentes à départager.']
    },
    {
      candidate_id: 'candidate:e108-test',
      document_id: null,
      act_id: null,
      label: 'Dossier E.108 sans image reliée',
      archival_reference: 'E.108',
      identification_status: 'candidate',
      reading_status: 'unreviewed',
      date_ids: ['date:e108'],
      view_ids: [],
      text_ids: ['text:e108'],
      uncertainties: ['Lien photographique absent.']
    }
  ],
  media: [
    {
      digital_object_id: VIEW_A,
      object_type: 'other',
      view_id: VIEW_A,
      witness_id: null,
      media_kind: 'image',
      sha256: SHA_A,
      media_type: 'image/jpeg',
      media_url: null,
      rights_status: 'pending',
      access_tier: 'project',
      publication_status: 'blocked-pending-rights',
      derivative_of_ids: []
    },
    {
      digital_object_id: VIEW_B,
      object_type: 'other',
      view_id: VIEW_B,
      witness_id: null,
      media_kind: 'image',
      sha256: SHA_B,
      media_type: 'image/jpeg',
      media_url: null,
      rights_status: 'pending',
      access_tier: 'project',
      publication_status: 'blocked-pending-rights',
      derivative_of_ids: []
    }
  ],
  texts: [
    {
      text_id: 'text:monbezon',
      transcription_id: 'transcription:monbezon',
      digital_object_id: 'object:text-monbezon',
      source_object_id: 'object:source-monbezon',
      literal: 'Texte réel simulé pour le test.\n<img src=x onerror="alert(1)">',
      language: 'fr',
      revision: 'c'.repeat(64),
      translation: null,
      extent: 'PARTIAL',
      reading_status: 'unreviewed',
      evidence_locator_ids: []
    },
    {
      text_id: 'text:e108',
      transcription_id: 'transcription:e108',
      digital_object_id: 'object:text-e108',
      source_object_id: 'object:source-e108',
      literal: 'Texte E.108 sans rattachement photographique.',
      language: 'fr',
      revision: 'd'.repeat(64),
      translation: null,
      extent: 'PARTIAL',
      reading_status: 'unreviewed',
      evidence_locator_ids: []
    }
  ],
  dates: [
    { date_id: 'date:monbezon-a', expression: 'date alléguée A', certainty: 'disputed', precision: 'unknown', notes: 'source A' },
    { date_id: 'date:monbezon-b', expression: 'date alléguée B', certainty: 'disputed', precision: 'unknown', notes: 'source B' },
    { date_id: 'date:e108', expression: 'date alléguée E.108', certainty: 'unknown', precision: 'unknown', notes: null }
  ],
  approved_links: [
    {
      review_id: 'review:monbezon',
      source_object_id: 'object:source-monbezon',
      target_object_ids: [VIEW_A, VIEW_B],
      applied_target_object_ids: [VIEW_A, VIEW_B],
      decision: 'link-after-evidence',
      review_status: 'accepted',
      confidence: 'certain',
      reviewed_at: '2026-09-06T12:00:00Z',
      input_review_sha256: 'e'.repeat(64)
    }
  ],
  mentions: [],
  evidence_locators: [],
  notes: ['Test fixture only.']
});

const model = adaptArchiveExport(sourceExport());
assert.equal(model.dossiers.length, 2);
assert.equal(model.dossiers[0].actId, null, 'A consultation candidate must not become an identified act.');
assert.equal(model.dossiers[0].documentId, null);
assert.equal(model.dossiers[0].readingStatus, 'unreviewed');
assert.equal(model.dossiers[0].images.length, 2, 'Monbezon receives only its two exact accepted endpoints.');
assert.equal(model.dossiers[1].images.length, 0, 'E.108 keeps its empty view set.');
assert.equal(model.dossiers[0].hasDateConflict, true);
assert.deepEqual(model.dossiers[0].images.map((image) => image.mediaUrl), [
  `/__archive_media/${SHA_A}`,
  `/__archive_media/${SHA_B}`
]);

const html = renderReaderHtml(model, { privatePreview: true });
assert.match(html, /id="candidate-monbezon-test"/);
assert.match(html, /href="#candidate-e108-test"/);
assert.match(html, /Dates en conflit ou non départagées/);
assert.match(html, /Traduction absente/);
assert.match(html, /Images non reliées/);
assert.match(html, /Dossier Monbezon &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
assert.doesNotMatch(html, /<img src=x onerror=/);
assert.doesNotMatch(html, /<style\b|\sstyle=/i);
assert.doesNotMatch(html, /<[^>]+\son[a-z]+\s*=/i);
assert.doesNotMatch(html, /<script(?![^>]+src=)/i);
assert.doesNotMatch(html, /(?:[A-Za-z]:[\\/]|\\\\)/);
assert.equal(renderReaderHtml(model, { privatePreview: true }), html, 'Rendering must be byte-stable for the same view model.');

const manifest = buildMediaManifest(model);
assert.deepEqual(manifest.allowedSha256, [SHA_A, SHA_B]);
assert.equal(manifest.items.length, 2);
assert.ok(manifest.items.every((item) => Object.keys(item).every((key) => !/path|source/i.test(key))));

assert.throws(
  () => renderReaderHtml(model),
  /private preview mode/,
  'Pending-rights exports cannot render outside explicit private mode.'
);
assert.throws(
  () => writePrivatePreview({ inputPath: 'unused', outputPath: 'unused', mediaMode: 'local-preview' }),
  /--private-preview/,
  'The CLI write path needs the private-preview guard.'
);

const privateTestRoot = resolve('.private', 'archives-mvp', 'renderer-test');
const privateInput = resolve(privateTestRoot, 'input.json');
const privateOutput = resolve(privateTestRoot, 'output');
mkdirSync(privateTestRoot, { recursive: true });
writeFileSync(privateInput, `${JSON.stringify(sourceExport(), null, 2)}\n`, 'utf8');
const firstWrite = writePrivatePreview({
  inputPath: privateInput,
  outputPath: privateOutput,
  mediaMode: 'local-preview',
  privatePreview: true
});
const firstHtmlBytes = readFileSync(firstWrite.htmlPath);
const firstManifestBytes = readFileSync(firstWrite.manifestPath);
const secondWrite = writePrivatePreview({
  inputPath: privateInput,
  outputPath: privateOutput,
  mediaMode: 'local-preview',
  privatePreview: true
});
assert.deepEqual(readFileSync(secondWrite.htmlPath), firstHtmlBytes, 'Repeated CLI writes must preserve HTML bytes.');
assert.deepEqual(readFileSync(secondWrite.manifestPath), firstManifestBytes, 'Repeated CLI writes must preserve manifest bytes.');
assert.equal(firstWrite.dossiers, 2);
assert.equal(firstWrite.images, 2);

const missingText = sourceExport();
missingText.candidates[0].text_ids = ['text:missing'];
assert.throws(() => adaptArchiveExport(missingText), /Unresolved .*text_ids reference/);

const missingDate = sourceExport();
missingDate.candidates[0].date_ids = ['date:missing'];
assert.throws(() => adaptArchiveExport(missingDate), /Unresolved .*date_ids reference/);

const missingMediaEndpoint = sourceExport();
missingMediaEndpoint.approved_links[0].applied_target_object_ids.push('object:view-missing');
missingMediaEndpoint.approved_links[0].target_object_ids.push('object:view-missing');
assert.throws(() => adaptArchiveExport(missingMediaEndpoint), /does not resolve to media/);

const proximityOnly = sourceExport();
proximityOnly.candidates[1].view_ids = [VIEW_A];
const proximityModel = adaptArchiveExport(proximityOnly);
assert.equal(proximityModel.dossiers[1].images.length, 0, 'A nearby declared view is not attached without a source-object link match.');

const leakingPath = structuredClone(model);
leakingPath.dossiers[0].texts[0].literal = 'Z:\\private\\scan.jpg';
assert.throws(() => renderReaderHtml(leakingPath, { privatePreview: true }), /source path would leak/);

const forbiddenOutput = resolve('archives', 'pending-real-output');
const cli = spawnSync(process.execPath, [
  'scripts/archives/render-reader.mjs',
  '--input', 'unused.json',
  '--output', forbiddenOutput,
  '--media-mode', 'local-preview',
  '--private-preview'
], { cwd: resolve('.'), encoding: 'utf8', windowsHide: true });
assert.notEqual(cli.status, 0);
assert.match(cli.stderr, /not ignored by Git/);
assert.equal(existsSync(forbiddenOutput), false, 'Rejected public-like output must not be created.');

console.log('Real-export adapter and private static renderer checks passed.');
