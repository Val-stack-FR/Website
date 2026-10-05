import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import test from 'node:test';

import { prepareCatalogue } from '../../scripts/archives-catalogue/contract.mjs';
import { buildCatalogueHierarchy } from '../../scripts/archives-catalogue/hierarchy.mjs';
import { buildPreexistingTextIndex } from '../../scripts/archives/preexisting-texts.mjs';
import { loadLexicalSearch } from '../../scripts/archives-integration/lexical-search.mjs';
import { createReadonlyHandler } from '../../scripts/archives-integration/publication-readonly/handler.mjs';
import { createVercelRoute } from '../../scripts/archives-integration/publication-readonly/vercel-route.mjs';
import { inventedCatalogue } from '../archives-catalogue/fixtures/invented-catalogue.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');

function fixture() {
  const text = 'Monbezon';
  const sourceSha = sha(text);
  const objectId = `object:path-${sha('invented text path')}`;
  const record = {
    format: 'private-c07-reader-text/0.1.0', object_id: objectId,
    occurrence_id: `text-occurrence:${sha('invented occurrence')}`,
    transcription_id: `transcription:${sha('invented transcription')}`,
    text_digital_object_id: `digital-object:${sourceSha}`, source_sha256: sourceSha,
    source_byte_size: Buffer.byteLength(text), source_empty: false,
    source_encoding: 'utf-8-sig',
    encoding_provenance: { status: 'unvalidated_hypothesis', basis: 'Fixture', validated_as_authentic_reading: false },
    text, review_status: 'preexisting-unreviewed', rights_status: 'unknown', publication_status: 'private',
    catalogue_discovery_status: 'unknown', act_id: null, document_id: null, photo_ids: [], modern_french: null
  };
  const coverage = [{ schema_version: 'coverage-object/1.0.0', object_id: objectId,
    object_id_basis: 'Invented fixture path', logical_path: 'CLEAN/Fixture/Monbezon.txt',
    path_provenance: 'Invented fixture', collection: 'CLEAN', extension: '.txt', size_bytes: record.source_byte_size,
    inventory_observed_at: '2026-10-04', discovery_role: 'other_text_or_document', role_basis: 'Fixture',
    sha256: sourceSha, hash_freshness: 'historical_inventory_hash_not_rechecked', candidate_groups: [], status: 'unknown',
    canonical_link_status: 'not_in_examined_canonical_links', archive_content_inspected: false, rights_status: 'unknown' }];
  const index = buildPreexistingTextIndex([record], coverage, { indexSha256: sha('index'), coverageSha256: sha('coverage') });
  const lexical = { rows: Array.from({ length: 535 }, (_, i) => ({
    candidate_id: `mentioncandidate:${sha(`candidate ${i}`)}`, candidate_kind: 'place_name_candidate',
    literal: i === 0 ? 'Monbezon' : `Lieu fictif ${i}`, citation: i === 0 ? 'à Monbezon' : `près du lieu fictif ${i}`,
    source: { object_id: objectId, source_sha256: sourceSha, logical_path: coverage[0].logical_path },
    span: { unit: 'unicode_codepoint', start: 0, end: 1, end_exclusive: true }, review_status: 'unreviewed', resolution_status: 'not_attempted', rights_status: 'unknown'
  })) };
  const catalogue = prepareCatalogue(inventedCatalogue(5), { inputSha256: sha('catalogue') });
  return { catalogue, index, lexical, objectId };
}

async function withServer(handler, callback) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await callback(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('read-only routes serve canonical catalogue, hierarchy, text and lexical renderers', async () => {
  const data = fixture();
  const app = createReadonlyHandler({ ...data, hierarchy: buildCatalogueHierarchy(data.catalogue), transformHtml: html => html.replace('</body>', '<nav id="root-nav"></nav></body>') });
  await withServer(app.handler, async base => {
    const api = await fetch(`${base}/__catalogue_data?query=monbezon`);
    assert.equal(api.status, 200);
    const payload = await api.json();
    assert.equal(payload.counts.matched_image_files, 0);
    assert.doesNotMatch(JSON.stringify(payload), /[A-Za-z]:\\/u);
    const hierarchy = await fetch(`${base}/__catalogue_hierarchy?folder=CLEAN`);
    assert.equal(hierarchy.status, 200);
    assert.equal((await hierarchy.json()).selected_folder.logicalPath, 'CLEAN');
    const catalogue = await fetch(`${base}/archives/catalogue/?query=photo`);
    const catalogueHtml = await catalogue.text();
    assert.equal(catalogue.status, 200);
    assert.match(catalogueHtml, /value="photo"/u);
    assert.match(catalogueHtml, /root-nav/u);
    const folderPage = await fetch(`${base}/archives/catalogue/?folder=CLEAN`);
    assert.match(await folderPage.text(), /archives-hierarchy\.js/u);
    const text = await fetch(`${base}/archives/texte/?object_id=${encodeURIComponent(data.objectId)}`);
    const textHtml = await text.text();
    assert.equal(text.status, 200);
    assert.match(textHtml, /preexisting-unreviewed/u);
    assert.match(textHtml, /Monbezon/u);
    const texts = await fetch(`${base}/archives/textes/?folder=CLEAN%2FFixture`);
    assert.equal(texts.status, 200);
    assert.match(await texts.text(), /Monbezon/u);
    const lexical = await fetch(`${base}/archives/reperes/?q=Monbezon`);
    assert.equal(lexical.status, 200);
    assert.match(await lexical.text(), /à Monbezon/u);
  });
});

test('duplicate, unknown and oversized parameters fail closed; writes are refused and HEAD is bodyless', async () => {
  const data = fixture();
  const handler = createReadonlyHandler(data).handler;
  await withServer(handler, async base => {
    for (const suffix of ['?page=1&page=2', '?secret=x', `?query=${'x'.repeat(2100)}`]) {
      assert.equal((await fetch(`${base}/__catalogue_data${suffix}`)).status, 400);
    }
    assert.equal((await fetch(`${base}/archives/texte/?object_id=${data.objectId}&path=Z%3A%2Fprivate`)).status, 400);
    assert.equal((await fetch(`${base}/__catalogue_data`, { method: 'POST' })).status, 405);
    for (const route of ['/__catalogue_data', '/__catalogue_hierarchy?folder=CLEAN', '/archives/catalogue/', '/archives/textes/', `/archives/texte/?object_id=${data.objectId}`, '/archives/reperes/']) {
      const head = await fetch(`${base}${route}`, { method: 'HEAD' });
      assert.equal(head.status, 200, route);
      assert.equal(await head.text(), '', route);
    }
    assert.equal((await fetch(`${base}/Z%3A%2Fsecret`)).status, 404);
  });
  assert.equal(typeof createVercelRoute(data), 'function');
});

test('catalogue page stays hierarchical without folder; hierarchy metrics and explicit notes are preserved', async () => {
  const data = fixture();
  const cleanRecord = data.catalogue.records.find(record => record.collectionScope === 'clean');
  assert.ok(cleanRecord);
  const folderPath = cleanRecord.logicalPath.split('/').slice(0, -1).join('/');
  const notes = [{ folderPath, text: 'Note de dossier fictive · rapprochement candidat.', object_ids: [cleanRecord.catalogueId] }];
  const app = createReadonlyHandler({ ...data, folderNotes: notes });
  const defaults = createReadonlyHandler(data);
  await withServer(app.handler, async base => {
    const page = await fetch(`${base}/archives/catalogue/?query=photo`);
    assert.match(await page.text(), /archives-hierarchy\.js/u);
    assert.match(page.headers.get('content-security-policy'), /form-action 'self'/u);
    const resultResponse = await fetch(`${base}/__catalogue_hierarchy?query=photo`);
    const result = await resultResponse.json();
    assert.equal(result.selected_folder.logicalPath, 'CLEAN');
    assert.equal(result.counts.inventory_image_files, data.catalogue.records.length);
    assert.equal(result.counts.clean_image_files, data.catalogue.records.filter(record => record.collectionScope === 'clean').length);
    assert.equal(result.counts.reader_links, data.catalogue.records.filter(record => record.consultation.available).length);
    const folder = await fetch(`${base}/__catalogue_hierarchy?folder=${encodeURIComponent(folderPath)}`);
    const folderResult = await folder.json();
    assert.deepEqual(folderResult.notes, [{ text: notes[0].text, object_ids: notes[0].object_ids }]);
  });
  await withServer(defaults.handler, async base => {
    const result = await (await fetch(`${base}/__catalogue_hierarchy`)).json();
    assert.equal(result.notes, null);
    assert.equal(result.selected_folder.logicalPath, 'CLEAN');
  });
});

const realInputs = ['ARCHIVES_READONLY_CATALOGUE', 'ARCHIVES_READONLY_TEXT_INDEX', 'ARCHIVES_READONLY_TEXT_COVERAGE', 'ARCHIVES_READONLY_LEXICAL_DIR'];
const hasRealInputs = realInputs.every(name => process.env[name]);
test('optional pinned real package smoke test: Monbezon, 535 lexical candidates and selected catalogue', { skip: !hasRealInputs }, async () => {
  const catalogueBytes = readFileSync(process.env.ARCHIVES_READONLY_CATALOGUE);
  const coverageBytes = readFileSync(process.env.ARCHIVES_READONLY_TEXT_COVERAGE);
  const indexBytes = readFileSync(process.env.ARCHIVES_READONLY_TEXT_INDEX);
  assert.ok(catalogueBytes.length <= 64 * 1024 * 1024 && coverageBytes.length <= 8 * 1024 * 1024 && indexBytes.length <= 8 * 1024 * 1024);
  assert.equal(sha(coverageBytes), 'dbdd1ec2b01d679327ccc374904f59ae70f09fd654a8aa47c579bb5ed2c4fe79');
  const catalogue = prepareCatalogue(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(catalogueBytes)), { inputSha256: sha(catalogueBytes) });
  const sourceCoverage = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(coverageBytes)).records;
  const indexRecords = new TextDecoder('utf-8', { fatal: true }).decode(indexBytes).trimEnd().split(/\r?\n/u).map(JSON.parse);
  assert.equal(sha(indexBytes), '9a0f3b57aea6c21f72132ef1c8af58564eface9f1ca9d267942718fbac772afe');
  const coverageById = new Map(sourceCoverage.map(row => [row.object_id, row]));
  const coverage = indexRecords.map((record) => {
    const source = coverageById.get(record.object_id);
    assert.ok(source, `Missing exact coverage object: ${record.object_id}`);
    assert.equal(source.fresh_source_sha256 ?? source.catalogue_sha256, record.source_sha256);
    assert.equal(source.source_byte_size, record.source_byte_size);
    assert.equal(source.catalogue_status, record.catalogue_discovery_status);
    return { schema_version: 'coverage-object/1.0.0', object_id: source.object_id,
      object_id_basis: 'Stable object path ID in accepted C03/C07 derivative', logical_path: source.logical_path,
      path_provenance: 'C03 CLEAN inventory path, joined by exact object_id', collection: 'CLEAN',
      extension: extname(source.logical_path), size_bytes: record.source_byte_size, inventory_observed_at: null,
      discovery_role: source.discovery_role, role_basis: 'C03 discovery role', sha256: record.source_sha256,
      hash_freshness: 'historical_inventory_hash_not_rechecked', candidate_groups: [], status: record.catalogue_discovery_status,
      canonical_link_status: source.canonical_link_status === 'accepted' ? 'accepted' : 'not_in_examined_canonical_links',
      archive_content_inspected: false, rights_status: 'unknown' };
  });
  const index = buildPreexistingTextIndex(indexRecords, coverage, {
    indexSha256: sha(indexBytes), coverageSha256: sha(coverageBytes)
  });
  const lexical = await loadLexicalSearch(process.env.ARCHIVES_READONLY_LEXICAL_DIR);
  const monbezonObjectId = 'object:path-db9eae05209aec0308075c4a45645d514489a537d54ee75c27be54bc585c7bd8';
  assert.equal(indexRecords.length, 166);
  assert.equal(lexical.rows.length, 535);
  assert.ok(catalogue.records.length > 0 && catalogue.records.length <= 20_000);
  assert.ok(indexRecords.some(record => record.object_id === monbezonObjectId));
  const app = createReadonlyHandler({ catalogue, index, lexical });
  await withServer(app.handler, async base => {
    const response = await fetch(`${base}/archives/texte/?object_id=${encodeURIComponent(monbezonObjectId)}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Monbezon/u);
    const results = await fetch(`${base}/archives/reperes/?q=Monbezon`);
    assert.equal(results.status, 200);
    assert.match(await results.text(), /535 repères/u);
  });
});
