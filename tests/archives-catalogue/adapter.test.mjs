import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { adaptCoverage } from '../../scripts/archives-catalogue/adapt-coverage.mjs';
import { prepareCatalogue, queryCatalogue } from '../../scripts/archives-catalogue/contract.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(`${JSON.stringify(value)}\n`, 'utf8');
const objectId = suffix => `object:path-${suffix.repeat(64)}`;

const coverageObject = (id, logicalPath, overrides = {}) => ({
  schema_version: 'coverage-object/1.0.0', object_id: id,
  object_id_basis: 'invented path digest', logical_path: logicalPath, path_provenance: 'invented fixture',
  collection: overrides.collection ?? 'CLEAN', extension: overrides.extension ?? '.jpg', size_bytes: overrides.size_bytes ?? 1234,
  inventory_modified_at: null, inventory_observed_at: '2026-10-03T10:00:00Z', inventory_role_guess: 'image',
  discovery_role: overrides.discovery_role ?? 'image', role_basis: 'invented fixture', sha256: null, hash_freshness: 'not_provided',
  duplicate_occurrence: 'kept_as_distinct_path_occurrence', candidate_groups: overrides.candidate_groups ?? [],
  candidate_priority: overrides.candidate_priority ?? 'unclassified_or_other_family_included',
  status: overrides.status ?? 'unknown', canonical_link_status: overrides.canonical_link_status ?? 'not_in_examined_canonical_links',
  canonical_link_evidence: overrides.canonical_link_evidence ?? [], archive_content_inspected: false, rights_status: 'unknown'
});

const writeFixture = async ({ tamper = false } = {}) => {
  const directory = await mkdtemp(join(tmpdir(), 'coverage-adapter-test-'));
  const first = objectId('a');
  const second = objectId('b');
  const text = objectId('c');
  const records = [
    coverageObject(first, 'CLEAN/Photos des Archives/Tucé/01.jpg', {
      status: 'accepted_link', canonical_link_status: 'accepted',
      canonical_link_evidence: [{ package: 'invented', review_id: 'review:invented-1' }],
      candidate_priority: 'Tuce_name_or_photo_group_evidence',
      candidate_groups: [{ group_id: 'P01', candidate_ids: ['T01'], evidence: 'invented folder label evidence', matched_label_tokens: ['Tucé'], source_locator: 'invented.csv#row-2' }]
    }),
    coverageObject(second, 'Autre fonds/Portraits/02.jpg', { collection: 'Autre fonds' }),
    coverageObject(text, 'CLEAN/Transcription/note.txt', { extension: '.txt', discovery_role: 'transcription', status: 'existing_text' })
  ];
  const relation = { schema_version: 'coverage-relation/1.0.0', relation_id: `relation:${'d'.repeat(64)}`, type: 'priority-evidence', subject_id: first, object_id: 'priority:tuce-name', status: 'discovery_lead', provenance: { input_id: 'invented', locator: 'invented#1' } };
  const catalogue = Buffer.from(records.map(value => JSON.stringify(value)).join('\n') + '\n', 'utf8');
  const relations = json(relation);
  const summary = json({ catalogued_rows: 3, excluded_rows: 0, source_originals_read: false });
  const manifest = json({ version: 'coverage-input-manifest/1', inputs: [{ input_id: 'invented', sha256: 'e'.repeat(64) }] });
  const checksums = json({ 'catalogue.jsonl': sha(catalogue), 'relations.jsonl': sha(relations), 'summary.json': sha(summary), 'input-manifest.json': sha(manifest) });
  const allowlist = json({ schema_version: 'archives-catalogue-reader-allowlist/0.1.0', entries: [{ object_id: first, href: '/archives/#invented', review_id: 'review:invented-1' }] });
  const files = { catalogue, relations, summary, manifest, checksums, allowlist };
  const paths = {};
  for (const [name, bytes] of Object.entries(files)) {
    paths[name] = join(directory, `${name}.json`);
    await writeFile(paths[name], tamper && name === 'catalogue' ? Buffer.concat([bytes, Buffer.from(' ' )]) : bytes);
  }
  return { directory, paths };
};

test('coverage adapter verifies proofs, keeps image occurrences and requires an explicit reader allowlist', async t => {
  const fixture = await writeFixture();
  t.after(() => rm(fixture.directory, { recursive: true, force: true }));
  const args = {
    cataloguePath: fixture.paths.catalogue, relationsPath: fixture.paths.relations, summaryPath: fixture.paths.summary,
    inputManifestPath: fixture.paths.manifest, checksumsPath: fixture.paths.checksums,
    allowlistPath: fixture.paths.allowlist, generatedAt: '2026-10-03T12:00:00Z'
  };
  const output = await adaptCoverage(args);
  const model = prepareCatalogue(output);
  assert.equal(output.record_count, 2);
  assert.equal(queryCatalogue(model, { collection_scope: 'all' }).records.length, 2);
  const linked = model.records.find(record => record.consultation.available);
  assert.equal(linked.consultation.href, '/archives/#invented');
  assert.equal(linked.names[0].literal, 'Tucé');
  assert.equal(linked.date.status, 'unknown');
  assert.equal(linked.groups[0].status, 'candidate-unclassified');
  assert.equal(model.records.find(record => record.collectionScope === 'other').priority, 'other-family');
});

test('coverage adapter refuses checksum drift and allowlist evidence drift', async t => {
  const tampered = await writeFixture({ tamper: true });
  t.after(() => rm(tampered.directory, { recursive: true, force: true }));
  await assert.rejects(adaptCoverage({
    cataloguePath: tampered.paths.catalogue, relationsPath: tampered.paths.relations, summaryPath: tampered.paths.summary,
    inputManifestPath: tampered.paths.manifest, checksumsPath: tampered.paths.checksums,
    allowlistPath: tampered.paths.allowlist, generatedAt: '2026-10-03T12:00:00Z'
  }), /does not match checksums/);
  const fixture = await writeFixture();
  t.after(() => rm(fixture.directory, { recursive: true, force: true }));
  const badAllowlist = json({ schema_version: 'archives-catalogue-reader-allowlist/0.1.0', entries: [{ object_id: objectId('a'), href: '/archives/#invented', review_id: 'review:wrong' }] });
  await writeFile(fixture.paths.allowlist, badAllowlist);
  await assert.rejects(adaptCoverage({
    cataloguePath: fixture.paths.catalogue, relationsPath: fixture.paths.relations, summaryPath: fixture.paths.summary,
    inputManifestPath: fixture.paths.manifest, checksumsPath: fixture.paths.checksums,
    allowlistPath: fixture.paths.allowlist, generatedAt: '2026-10-03T12:00:00Z'
  }), /lacks matching review evidence/);
});

test('CLEAN projection excludes reserve bytes and accepts nonimage inventory suffix markers', async t => {
  const fixture = await writeFixture();
  t.after(() => rm(fixture.directory, { recursive: true, force: true }));
  const { readFile } = await import('node:fs/promises');
  const bytes = await readFile(fixture.paths.catalogue);
  const rows = bytes.toString('utf8').trim().split('\n').map(JSON.parse);
  rows[2].extension = '(sans extension)';
  const updated = Buffer.from(rows.map(JSON.stringify).join('\n') + '\n');
  await writeFile(fixture.paths.catalogue, updated);
  const sums = JSON.parse(await readFile(fixture.paths.checksums, 'utf8'));
  sums['catalogue.jsonl'] = sha(updated);
  await writeFile(fixture.paths.checksums, json(sums));
  const output = await adaptCoverage({ cataloguePath: fixture.paths.catalogue, relationsPath: fixture.paths.relations,
    summaryPath: fixture.paths.summary, inputManifestPath: fixture.paths.manifest, checksumsPath: fixture.paths.checksums,
    generatedAt: '2026-10-03T12:00:00Z', collectionScope: 'clean' });
  assert.equal(output.record_count, 1);
  assert.ok(output.records.every(record => record.collection_scope === 'clean'));
  assert.ok(!JSON.stringify(output).includes('Autre fonds/Portraits'));
  assert.ok(output.limitations.some(limit => limit.includes('3 fichiers')) === false);
  assert.ok(output.limitations.some(limit => limit.includes('2 fichiers de tous types')));
});

