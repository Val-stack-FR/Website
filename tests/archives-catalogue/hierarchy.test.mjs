import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { CATALOGUE_CONTRACT } from '../../scripts/archives-catalogue/contract.mjs';
import { buildCatalogueHierarchy, queryCatalogueHierarchy } from '../../scripts/archives-catalogue/hierarchy.mjs';

const record = (logicalPath, index, extra = {}) => ({
  catalogueId: `catalogue:invented-${index}`, logicalPath,
  fileName: { literal: logicalPath.split('/').at(-1), status: 'candidate' },
  collectionScope: 'clean', collectionType: 'photo', status: 'metadata-only', priority: 'tuce',
  names: [], groups: [{ candidate_id: 'group:photo-P02', status: 'candidate-unclassified' }],
  interpretation: 'file-not-act', consultation: { available: false, href: null, approval_id: null },
  ...extra
});
const model = records => ({ schemaVersion: CATALOGUE_CONTRACT, packageId: 'package:invented-hierarchy', generatedAt: '2000-01-01T00:00:00Z', sourceManifestSha256: '0'.repeat(64), inputSha256: '1'.repeat(64), limitations: ['Entirely invented fixture; no historical grouping.'], records });
const hierarchyFor = records => buildCatalogueHierarchy(model(records));

test('all intermediate exact folders/cotes survive and counts refer to descendant files', () => {
  const hierarchy = hierarchyFor([
    record('CLEAN/Photos/E.108/Source en intégralité page 1 à 30/11.jpg', 1),
    record('CLEAN/Photos/E.108/Source en intégralité page 1 à 30/12.jpg', 2),
    record('CLEAN/Photos/E.108/notice.jpg', 3),
    record('CLEAN/Photos/E.108bis/1.jpg', 4)
  ]);
  assert.deepEqual(queryCatalogueHierarchy(hierarchy).folders.map(folder => folder.logicalPath), ['CLEAN/Photos']);
  const photos = queryCatalogueHierarchy(hierarchy, { folder: 'CLEAN/Photos' });
  assert.deepEqual(photos.folders.map(folder => folder.name), ['E.108', 'E.108bis']);
  const selected = queryCatalogueHierarchy(hierarchy, { folder: 'CLEAN/Photos/E.108' });
  assert.equal(selected.counts.descendant_image_files, 3);
  assert.equal(selected.counts.files, 1);
  assert.equal(selected.folders[0].descendantFileCount, 2);
  assert.equal(selected.records[0].logicalPath, 'CLEAN/Photos/E.108/notice.jpg');
  assert.deepEqual(selected.breadcrumbs.map(folder => folder.logicalPath), ['CLEAN', 'CLEAN/Photos', 'CLEAN/Photos/E.108']);
  assert.equal(hierarchy.folders.has('group:photo-P02'), false);
});

test('same folder labels, case and Unicode variants keep different exact path SHA IDs', () => {
  const paths = ['CLEAN/Boite 1/Même dossier', 'CLEAN/Boite 2/Même dossier', 'CLEAN/É', 'CLEAN/E\u0301', 'CLEAN/é'];
  const hierarchy = hierarchyFor(paths.map((path, index) => record(`${path}/1.jpg`, index)));
  const ids = paths.map(path => hierarchy.folders.get(path).folderId);
  assert.equal(new Set(ids).size, paths.length);
  for (const path of paths) assert.equal(hierarchy.folders.get(path).folderId, `folder:${createHash('sha256').update(path, 'utf8').digest('hex')}`);
  assert.equal(queryCatalogueHierarchy(hierarchy, { folder: paths[0] }).records.length, 1);
  assert.throws(() => queryCatalogueHierarchy(hierarchy, { folder: 'CLEAN/Même dossier' }), /Unknown folder/);
});

test('direct files use natural numerical basename order rather than inventory keys or historical suffixes', () => {
  const names = ['14.jpg', '1.jpg', '12.jpg', '10.jpg', '2.jpg', '11.jpg', '13.jpg', 'Photo 11 - 1400.jpg', 'Photo 2 - 1900.jpg'];
  const records = names.map((name, index) => record(`CLEAN/E.108/${name}`, index, { sortKey: 100 - index }));
  const hierarchy = hierarchyFor(records);
  const result = queryCatalogueHierarchy(hierarchy, { folder: 'CLEAN/E.108' });
  assert.deepEqual(result.records.map(item => item.logicalPath.split('/').at(-1)), ['1.jpg', '2.jpg', '10.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', 'Photo 2 - 1900.jpg', 'Photo 11 - 1400.jpg']);
  assert.ok(result.records.every(item => item.interpretation === 'file-not-act'));
  assert.deepEqual(records.map(item => item.logicalPath.split('/').at(-1)), names, 'The source order is unchanged.');
});

test('mixed boxes paginate immediate children and direct files as a shared bounded sequence', () => {
  const records = [
    ...Array.from({ length: 32 }, (_, index) => record(`CLEAN/Boite/Dossier ${index + 1}/photo.jpg`, index)),
    ...Array.from({ length: 31 }, (_, index) => record(`CLEAN/Boite/${index + 1}.jpg`, 100 + index))
  ];
  const hierarchy = hierarchyFor(records);
  const first = queryCatalogueHierarchy(hierarchy, { folder: 'CLEAN/Boite', page_size: '50' });
  const second = queryCatalogueHierarchy(hierarchy, { folder: 'CLEAN/Boite', page_size: 50, page: 2 });
  assert.equal(first.entries.length, 50);
  assert.equal(first.folders.length, 32);
  assert.equal(first.records.length, 18);
  assert.equal(second.entries.length, 13);
  assert.equal(second.folders.length, 0);
  assert.equal(first.counts.files, 31);
  assert.equal(first.counts.child_folders, 32);
  assert.equal(first.counts.matched_entries, 63);
  assert.equal(first.pagination.page_count, 2);
  assert.equal(new Set([...first.entries, ...second.entries].map(entry => entry.kind === 'folder' ? entry.folder.folderId : entry.record.catalogueId)).size, 63);
  assert.equal(queryCatalogueHierarchy(hierarchy, { folder: 'CLEAN/Boite', page: 3, page_size: 50 }).entries.length, 0);
  assert.equal(queryCatalogueHierarchy(hierarchy).pagination.page_size, 20);
});

test('CLEAN only excludes reserves, while mismatched and unsafe clean paths refuse', () => {
  const hierarchy = hierarchyFor([
    record('CLEAN/Boite/1.jpg', 1),
    record('Sync/Boite/2.jpg', 2, { collectionScope: 'other' }),
    record('Random/Boite/3.jpg', 3, { collectionScope: 'other' })
  ]);
  assert.equal(queryCatalogueHierarchy(hierarchy).counts.clean_image_files, 1);
  assert.equal(hierarchy.folders.has('Sync'), false);
  assert.throws(() => queryCatalogueHierarchy(hierarchy, { collection_scope: 'all' }), /collection_scope/);
  for (const path of ['clean/Boite/1.jpg', 'Sync/Boite/1.jpg', 'CLEAN/../1.jpg', 'CLEAN//1.jpg', '/CLEAN/1.jpg', 'CLEAN\\Boite\\1.jpg', 'CLEAN']) {
    assert.throws(() => hierarchyFor([record(path, 1)]), /logicalPath/);
  }
  for (const folder of ['CLEAN/..', 'CLEAN/Boite/', 'CLEAN%2FBoite', hierarchy.rootId]) {
    assert.throws(() => queryCatalogueHierarchy(hierarchy, { folder }), /folder/);
  }
  assert.equal(queryCatalogueHierarchy(hierarchy, { folder: '' }).selected_folder.logicalPath, 'CLEAN');
});

test('descendant search and simultaneous filters retain only matching immediate branches', () => {
  const hierarchy = hierarchyFor([
    record('CLEAN/Boite A/Intermédiaire/E.108/11.jpg', 1, { names: [{ literal: 'Louis de Tucé' }], status: 'unclassified', collectionType: 'scan' }),
    record('CLEAN/Boite A/Intermédiaire/E.108/12.jpg', 2, { names: [{ literal: 'Louis de Tucé' }], priority: 'other-family' }),
    record('CLEAN/Boite B/E.76/1.jpg', 3, { names: [{ literal: 'Louis de Tucé' }] }),
    record('CLEAN/direct.jpg', 4)
  ]);
  const filtered = queryCatalogueHierarchy(hierarchy, { query: 'LOUIS DE TUCE', priority: 'tuce', status: 'unclassified', collection_type: 'scan' });
  assert.deepEqual(filtered.folders.map(folder => folder.name), ['Boite A']);
  assert.equal(filtered.folders[0].descendantFileCount, 2);
  assert.equal(filtered.folders[0].matchedDescendantFileCount, 1);
  assert.equal(filtered.counts.matched_image_files, 1);
  assert.equal(filtered.counts.matched_files, 0);
  const branch = queryCatalogueHierarchy(hierarchy, { folder: 'CLEAN/Boite A', query: '11.jpg' });
  assert.equal(branch.folders[0].name, 'Intermédiaire');
  assert.equal(branch.folders[0].matchedDescendantFileCount, 1);
  assert.equal(queryCatalogueHierarchy(hierarchy, { query: 'absent' }).entries.length, 0);
});

test('parameter bounds, types, unknown folders and options reject explicitly', () => {
  const hierarchy = hierarchyFor([record('CLEAN/1.jpg', 1)]);
  for (const page_size of [0, 51, true, '1.5', [], 'Infinity']) assert.throws(() => queryCatalogueHierarchy(hierarchy, { page_size }), /page_size/);
  for (const page of [0, -1, true, '1e2', 20_001]) assert.throws(() => queryCatalogueHierarchy(hierarchy, { page }), /page/);
  for (const [key, value] of [['priority', 'invented'], ['status', 'accepted-act'], ['collection_type', 'document']]) assert.throws(() => queryCatalogueHierarchy(hierarchy, { [key]: value }), new RegExp(key));
  assert.throws(() => queryCatalogueHierarchy(hierarchy, { query: 'x'.repeat(101) }), /query/);
  assert.throws(() => queryCatalogueHierarchy(hierarchy, { query: false }), /query/);
  assert.throws(() => queryCatalogueHierarchy(hierarchy, { folder: 'CLEAN/missing' }), /Unknown folder/);
  assert.throws(() => queryCatalogueHierarchy(hierarchy, { source: 'private' }), /Unsupported/);
  assert.throws(() => hierarchyFor([record('CLEAN/a.jpg', 1), record('CLEAN/b.jpg', 1)]), /catalogueId/);
});

test('empty CLEAN remains a navigable zero-count root without reserve leakage', () => {
  const hierarchy = hierarchyFor([record('Sync/Boite/1.jpg', 1, { collectionScope: 'other' })]);
  const result = queryCatalogueHierarchy(hierarchy);
  assert.equal(result.selected_folder.logicalPath, 'CLEAN');
  assert.equal(result.selected_folder.parentPath, null);
  assert.equal(result.counts.clean_image_files, 0);
  assert.equal(result.counts.matched_entries, 0);
  assert.deepEqual(result.entries, []);
  assert.equal(result.pagination.page_count, 1);
});

test('twenty thousand distinct immediate folders remain paginated without losing hierarchy', () => {
  const records = Array.from({ length: 20_000 }, (_, index) => record(`CLEAN/Boite ${index + 1}/1.jpg`, index));
  const hierarchy = hierarchyFor(records);
  const last = queryCatalogueHierarchy(hierarchy, { page: 400, page_size: 50 });
  assert.equal(last.counts.clean_image_files, 20_000);
  assert.equal(last.counts.child_folders, 20_000);
  assert.equal(last.pagination.page_count, 400);
  assert.equal(last.entries.length, 50);
  assert.equal(last.folders.at(-1).name, 'Boite 20000');
  assert.equal(hierarchy.folders.size, 20_001);
  assert.throws(() => hierarchyFor([...records, record('CLEAN/overflow/1.jpg', 20_000)]), /prepared catalogue model/);
});
