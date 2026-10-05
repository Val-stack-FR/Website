import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  filterAnnexCards,
  normalizeSearchText,
  prepareAnnexSearch,
  renderAnnexSearch
} from '../../scripts/archives/render-annex-search.mjs';
import { syntheticAnnexIndex } from './fixtures/synthetic-annex-index.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = syntheticAnnexIndex();

test('the bounded synthetic index produces five distinct, traceable fiche cards', () => {
  const model = prepareAnnexSearch(source);
  assert.equal(model.cards.length, 5);
  assert.equal(new Set(model.cards.map(card => card.id)).size, 5);
  assert.deepEqual(model.cards.filter(card => card.label === 'Aubin du Rivage').map(card => card.number), ['101', '102']);
  assert.ok(model.cards.filter(card => card.label === 'Aubin du Rivage').every(card => card.ambiguities.length === 1));

  assert.equal(normalizeSearchText('  ÉCLAIREUR À L’ORÉE  '), 'eclaireur a l’oree');
  assert.deepEqual(filterAnnexCards(model.cards, 'AUBIN', 'name').map(card => card.number), ['101', '102']);
  assert.deepEqual(filterAnnexCards(model.cards, 'éclaireur', 'title').map(card => card.number), ['101']);
  assert.deepEqual(filterAnnexCards(model.cards, 'Aîné', 'variant').map(card => card.number), ['101', '102']);
  assert.deepEqual(filterAnnexCards(model.cards, 'Clairvallon', 'place').map(card => card.number), ['203']);
  assert.equal(filterAnnexCards(model.cards, 'personne hors lot', 'all').length, 0);
  assert.equal(filterAnnexCards(model.cards, '', 'all').length, 5);

  const entries = model.cards.flatMap(card => Object.values(card.groups).flat());
  assert.ok(entries.some(entry => entry.indexOnly));
  assert.ok(entries.filter(entry => entry.indexOnly).every(entry => entry.origin === 'synthetic-index-variant'));
  for (const entry of entries) {
    assert.match(entry.provenance.table, /\.csv$/);
    assert.ok(Number.isSafeInteger(entry.provenance.recordNumber));
    assert.ok(entry.provenance.field.length > 0);
    assert.match(entry.provenance.sha256, /^[a-f0-9]{64}$/);
  }
});

test('static HTML is escaped, CSP-compatible and explicit about scope and provenance', () => {
  const html = renderAnnexSearch(source);
  assert.equal((html.match(/data-annex-card/g) || []).length, 5);
  assert.match(html, /href="\/archives\/"/);
  assert.match(html, /src="\/js\/archives-search\.js" defer/);
  assert.match(html, /href="\/css\/archives-search\.css"/);
  assert.match(html, /Cette recherche couvre uniquement cinq fiches expérimentales/);
  assert.match(html, /Aucun résultat ne prouve une absence dans le reste du corpus/);
  assert.match(html, /Variante d’index uniquement · occurrence non attestée/);
  assert.match(html, /citations primaires non vérifiées/);
  assert.match(html, /Fiche 101 · sélection expérimentale/);
  assert.match(html, /Fiche 102 · sélection expérimentale/);
  assert.match(html, /SHA-256 source/);
  assert.match(html, new RegExp('a{64}'));
  assert.doesNotMatch(html, /<style\b|\sstyle=/i);
  assert.doesNotMatch(html, /<[^>]+\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /<script(?![^>]+src=)/i);
  assert.equal(renderAnnexSearch(source), html, 'The same index must render byte-stable HTML.');

  const hostile = structuredClone(source);
  hostile.fiches[0].label = '<img src=x onerror="alert(1)">';
  hostile.entries.find(entry => entry.fiche_id === hostile.fiches[0].fiche_id).literal = '<script>alert(2)</script>';
  hostile.limitations[0] = 'Limite <b>inventée</b> & brute';
  const escaped = renderAnnexSearch(hostile);
  assert.match(escaped, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(escaped, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.match(escaped, /Limite &lt;b&gt;inventée&lt;\/b&gt; &amp; brute/);
  assert.doesNotMatch(escaped, /<img src=x|<script>alert\(2\)/);
});

test('invalid references, expanded scope and publishable inputs are refused', () => {
  const missingLocator = structuredClone(source);
  missingLocator.entries[0].evidence_locator_id = 'evidence:missing';
  assert.throws(() => prepareAnnexSearch(missingLocator), /Unresolved .*evidence_locator_id/);

  const missingCandidate = structuredClone(source);
  missingCandidate.entries.find(entry => entry.scope === 'variant').candidate_fiche_ids = ['row:missing'];
  assert.throws(() => prepareAnnexSearch(missingCandidate), /Unresolved .*candidate_fiche_ids/);

  const inferredOccurrence = structuredClone(source);
  inferredOccurrence.entries.find(entry => entry.scope === 'variant').source_occurrence_in_fiche = true;
  assert.throws(() => prepareAnnexSearch(inferredOccurrence), /Variant must remain index-only/);

  const crossedDate = structuredClone(source);
  crossedDate.entries.find(entry => entry.date_id != null).date_id = source.fiches[1].date_id;
  assert.throws(() => prepareAnnexSearch(crossedDate), /Entry date does not belong to its fiche/);

  const duplicateNumber = structuredClone(source);
  duplicateNumber.fiches[1].fiche_n = duplicateNumber.fiches[0].fiche_n;
  assert.throws(() => prepareAnnexSearch(duplicateNumber), /Fiche number must be a unique positive integer/);

  const tooManyFiches = structuredClone(source);
  tooManyFiches.fiches.push({ ...structuredClone(source.fiches[0]), fiche_id: 'row:extra', fiche_n: '999' });
  assert.throws(() => prepareAnnexSearch(tooManyFiches), /one to five fiches/);

  const tooManyMentions = structuredClone(source);
  tooManyMentions.entries.push({ ...structuredClone(source.entries.find(entry => entry.scope === 'name')), entry_id: 'entry:extra' });
  assert.throws(() => prepareAnnexSearch(tooManyMentions), /ten fiche name mentions/);

  const publishable = structuredClone(source);
  publishable.publication.approved_for_publication = true;
  assert.throws(() => prepareAnnexSearch(publishable), /private, non-publishable/);

  assert.throws(() => filterAnnexCards(prepareAnnexSearch(source).cards, 'Aubin', 'unsupported'), /Unsupported search scope/);
});

test('CLI writes only the rendered document to stdout from a safe temporary fixture', t => {
  const temporaryRoot = realpathSync(tmpdir());
  const temporaryDirectory = mkdtempSync(join(temporaryRoot, 'annex-search-test-'));
  t.after(() => {
    const target = realpathSync(temporaryDirectory);
    assert.equal(dirname(target).toLowerCase(), temporaryRoot.toLowerCase());
    assert.ok(basename(target).startsWith('annex-search-test-'));
    rmSync(target, { recursive: true, force: true });
  });
  const indexPath = join(temporaryDirectory, 'query-index.json');
  writeFileSync(indexPath, `${JSON.stringify(source)}\n`, 'utf8');
  const expected = `${renderAnnexSearch(source)}\n`;
  const result = spawnSync(process.execPath, [
    resolve(repositoryRoot, 'scripts', 'archives', 'render-annex-search.mjs'), '--index', indexPath
  ], { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, expected);
});

test('optional private integration index remains bounded when explicitly provided', {
  skip: !process.env.ARCHIVE_ANNEX_QUERY_INDEX
}, () => {
  const privateIndex = JSON.parse(readFileSync(resolve(process.env.ARCHIVE_ANNEX_QUERY_INDEX), 'utf8'));
  const model = prepareAnnexSearch(privateIndex);
  assert.equal(model.cards.length, 5);
  assert.equal(new Set(model.cards.map(card => card.id)).size, 5);
  assert.match(renderAnnexSearch(privateIndex), /data-annex-card/);
});

