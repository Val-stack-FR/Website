import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { prepareStatusboard, renderStatusboard } from '../../scripts/archives/render-statusboard.mjs';
import { syntheticAnnexIndex } from './fixtures/synthetic-annex-index.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function syntheticReaderExport() {
  return {
    export_profile: 'atelier-tuce-reader/0.1.0',
    package_id: 'package:synthetic-status-reader',
    publication: { approved_for_publication: false, rights_review: 'pending', status: 'review-pending' },
    candidates: [
      {
        candidate_id: 'candidate:synthetic-rivage', document_id: null, act_id: null,
        archival_reference: 'D.1 (fixture)', consultation_only: true,
        identification_status: 'candidate', label: '[D.1] Atelier du Rivage — PARTIEL', reading_status: 'unreviewed',
        text_ids: ['text:synthetic-rivage'], date_ids: [],
        view_ids: ['view:synthetic-rivage-recto', 'view:synthetic-rivage-verso'],
        uncertainties: ['Lecture volontairement lacunaire dans la fixture synthétique.'], witness_id: null
      },
      {
        candidate_id: 'candidate:synthetic-tuce', document_id: null, act_id: null,
        archival_reference: 'D.2 (fixture)', consultation_only: true,
        identification_status: 'candidate', label: 'Dossier fictif de Camille de Tucé', reading_status: 'unreviewed',
        text_ids: ['text:synthetic-tuce'], date_ids: ['date:synthetic-tuce-a', 'date:synthetic-tuce-b'],
        view_ids: [], uncertainties: ['Deux dates inventées à départager dans la fixture.'], witness_id: null
      }
    ],
    texts: [
      {
        text_id: 'text:synthetic-rivage', transcription_id: 'transcription:synthetic-rivage',
        source_object_id: 'object:synthetic-rivage-text', literal: 'Fragment inventé — ligne ----.',
        language: 'frm', revision: 'a'.repeat(64), extent: 'PARTIAL', reading_status: 'unreviewed', translation: null
      },
      {
        text_id: 'text:synthetic-tuce', transcription_id: 'transcription:synthetic-tuce',
        source_object_id: 'object:synthetic-tuce-text', literal: 'Autre fragment entièrement inventé.',
        language: 'frm', revision: 'b'.repeat(64), extent: 'PARTIAL', reading_status: 'unreviewed', translation: null
      }
    ],
    dates: [
      { date_id: 'date:synthetic-tuce-a', expression: 'vers 1401', certainty: 'disputed', precision: 'circa', notes: 'Fixture inventée.' },
      { date_id: 'date:synthetic-tuce-b', expression: 'vers 1402', certainty: 'disputed', precision: 'circa', notes: 'Fixture inventée.' }
    ],
    media: [
      {
        digital_object_id: 'view:synthetic-rivage-recto', view_id: 'view:synthetic-rivage-recto', media_kind: 'image',
        media_type: 'image/jpeg', publication_status: 'blocked-pending-rights', rights_status: 'pending', sha256: 'c'.repeat(64)
      },
      {
        digital_object_id: 'view:synthetic-rivage-verso', view_id: 'view:synthetic-rivage-verso', media_kind: 'image',
        media_type: 'image/jpeg', publication_status: 'blocked-pending-rights', rights_status: 'pending', sha256: 'd'.repeat(64)
      }
    ],
    approved_links: [{
      applied_target_object_ids: ['view:synthetic-rivage-recto', 'view:synthetic-rivage-verso'], confidence: 'certain',
      decision: 'link-after-evidence', review_id: 'review:synthetic-rivage', review_status: 'accepted',
      source_object_id: 'object:synthetic-rivage-text',
      target_object_ids: ['view:synthetic-rivage-recto', 'view:synthetic-rivage-verso']
    }],
    evidence_locators: [], mentions: [], notes: []
  };
}

function syntheticInputs() {
  const reader = syntheticReaderExport();
  const annex = syntheticAnnexIndex();
  annex.fiches[0].label = 'Aline de Tucé — personnage fictif';
  annex.fiches[0].person_heading = 'Aline de Tucé — intitulé fictif';
  return { reader, annex };
}

test('seven bounded units remain separated with explicit workflow states', () => {
  const { reader, annex } = syntheticInputs();
  const model = prepareStatusboard(reader, annex);
  assert.equal(model.totalEntries, 7);
  assert.equal(model.dossiers.length, 2);
  assert.equal(model.fiches.length, 5);
  assert.equal(new Set([...model.dossiers, ...model.fiches].map(item => item.key)).size, 7);

  const rivage = model.dossiers.find(item => item.label.includes('Rivage'));
  assert.match(rivage.textState, /partielle/);
  assert.equal(rivage.translationState, 'Absente de l’export');
  assert.equal(rivage.imageState, '2 liens image acceptés');
  assert.equal(rivage.responsible, 'À attribuer');

  const tuceDossier = model.dossiers.find(item => item.label.includes('Tucé'));
  assert.equal(tuceDossier.priority.level, 'prioritaire');
  assert.match(tuceDossier.priority.reason, /libellé source contient « Tucé »/);
  assert.equal(tuceDossier.imageState, 'Aucun lien image accepté');
  assert.ok(tuceDossier.blockers.includes('Aucune vue déclarée et aucun lien image accepté.'));
  assert.ok(tuceDossier.blockers.includes('Dates concurrentes non départagées.'));

  assert.equal(model.fiches.filter(item => item.priority.level === 'prioritaire').length, 1);
  assert.ok(model.fiches.every(item => item.unitType === 'Fiche éditoriale'));
  assert.ok(model.fiches.every(item => item.textState.includes('n’est pas un acte transcrit')));
  assert.ok(model.fiches.every(item => item.imageState.includes('aucun original ou pixel lu')));
  assert.ok(model.fiches.every(item => item.blockers.includes('Citations primaires non vérifiées.')));
  assert.ok(model.fiches.every(item => item.provenance.sha256.match(/^[a-f0-9]{64}$/)));
});

test('static HTML is accessible, escaped, CSP-compatible and avoids progress claims', () => {
  const { reader, annex } = syntheticInputs();
  const html = renderStatusboard(reader, annex);
  assert.equal((html.match(/data-statusboard-entry/g) || []).length, 7);
  assert.match(html, /Deux dossiers de consultation et cinq fiches éditoriales/);
  assert.match(html, /href="\/archives\/"/);
  assert.match(html, /href="\/archives\/recherche\/"/);
  assert.match(html, /href="\/css\/archives-statusboard\.css"/);
  assert.match(html, /Textes, traductions et images sont suivis séparément/);
  assert.match(html, /Références de travail non assimilées à des actes transcrits/);
  assert.match(html, /Responsable<\/dt><dd>À attribuer/);
  assert.match(html, /Priorité motivée/);
  assert.match(html, /Prochaine action/);
  assert.match(html, /SHA-256 source/);
  assert.doesNotMatch(html, /\d+(?:[.,]\d+)?\s*%/);
  assert.doesNotMatch(html, /progression des agents|avancement des agents/i);
  assert.doesNotMatch(html, /<style\b|\sstyle=/i);
  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /<[^>]+\son[a-z]+\s*=/i);
  assert.equal(renderStatusboard(reader, annex), html, 'The same bounded inputs must render byte-stable HTML.');

  const hostileReader = structuredClone(reader);
  hostileReader.candidates[0].label = '<img src=x onerror="alert(1)">';
  hostileReader.candidates[0].uncertainties = ['<script>alert(2)</script> & brute'];
  const hostileAnnex = structuredClone(annex);
  hostileAnnex.fiches[0].label = '<b>fiche hostile</b>';
  const escaped = renderStatusboard(hostileReader, hostileAnnex);
  assert.match(escaped, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(escaped, /&lt;script&gt;alert\(2\)&lt;\/script&gt; &amp; brute/);
  assert.match(escaped, /&lt;b&gt;fiche hostile&lt;\/b&gt;/);
  assert.doesNotMatch(escaped, /<img src=x|<script>alert\(2\)|<b>fiche hostile/);
});

test('expanded, publishable and referentially invalid inputs are refused', () => {
  const { reader, annex } = syntheticInputs();

  const extraDossier = structuredClone(reader);
  extraDossier.candidates.push({ ...structuredClone(reader.candidates[0]), candidate_id: 'candidate:synthetic-extra' });
  assert.throws(() => prepareStatusboard(extraDossier, annex), /exactly two consultation dossiers/);

  const shortAnnex = structuredClone(annex);
  const removedFiche = shortAnnex.fiches.pop();
  shortAnnex.entries = shortAnnex.entries.filter(entry => entry.fiche_id !== removedFiche.fiche_id);
  assert.throws(() => prepareStatusboard(reader, shortAnnex), /exactly five editorial fiches/);

  const publishableReader = structuredClone(reader);
  publishableReader.publication.approved_for_publication = true;
  assert.throws(() => prepareStatusboard(publishableReader, annex), /private and non-publishable|pending-rights private-preview/);

  const publishableAnnex = structuredClone(annex);
  publishableAnnex.publication.approved_for_publication = true;
  assert.throws(() => prepareStatusboard(reader, publishableAnnex), /private, non-publishable/);

  const missingText = structuredClone(reader);
  missingText.candidates[0].text_ids = ['text:missing'];
  assert.throws(() => prepareStatusboard(missingText, annex), /Unresolved .*text_ids/);

  const missingLocator = structuredClone(annex);
  missingLocator.dates[0].evidence_locator_ids = ['evidence:missing'];
  assert.throws(() => prepareStatusboard(reader, missingLocator), /Unresolved .*evidence_locator_ids/);
});

test('CLI emits only deterministic HTML from safe temporary fixtures', t => {
  const { reader, annex } = syntheticInputs();
  const temporaryRoot = realpathSync(tmpdir());
  const temporaryDirectory = mkdtempSync(join(temporaryRoot, 'statusboard-test-'));
  t.after(() => {
    const target = realpathSync(temporaryDirectory);
    assert.equal(dirname(target).toLowerCase(), temporaryRoot.toLowerCase());
    assert.ok(basename(target).startsWith('statusboard-test-'));
    rmSync(target, { recursive: true, force: true });
  });
  const readerPath = join(temporaryDirectory, 'reader.json');
  const annexPath = join(temporaryDirectory, 'annex.json');
  writeFileSync(readerPath, `${JSON.stringify(reader)}\n`, 'utf8');
  writeFileSync(annexPath, `${JSON.stringify(annex)}\n`, 'utf8');
  const result = spawnSync(process.execPath, [
    resolve(repositoryRoot, 'scripts', 'archives', 'render-statusboard.mjs'),
    '--reader', readerPath, '--annex', annexPath
  ], { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, `${renderStatusboard(reader, annex)}\n`);
});

test('optional private integration remains exactly two dossiers and five fiches', {
  skip: !(process.env.ARCHIVE_STATUS_READER_EXPORT && process.env.ARCHIVE_STATUS_ANNEX_INDEX)
}, () => {
  const reader = JSON.parse(readFileSync(resolve(process.env.ARCHIVE_STATUS_READER_EXPORT), 'utf8'));
  const annex = JSON.parse(readFileSync(resolve(process.env.ARCHIVE_STATUS_ANNEX_INDEX), 'utf8'));
  const model = prepareStatusboard(reader, annex);
  assert.equal(model.totalEntries, 7);
  assert.equal(model.dossiers.length, 2);
  assert.equal(model.fiches.length, 5);
  assert.ok(model.dossiers.some(item => item.label.includes('Monbezon')));
  assert.ok(model.fiches.some(item => item.label === 'Jean de Bouillé'));
  assert.equal((renderStatusboard(reader, annex).match(/data-statusboard-entry/g) || []).length, 7);
});
