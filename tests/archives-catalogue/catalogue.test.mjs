import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  MAX_PAGE_SIZE,
  prepareCatalogue,
  queryCatalogue
} from '../../scripts/archives-catalogue/contract.mjs';
import { renderCataloguePage } from '../../scripts/archives-catalogue/render-page.mjs';
import { createCataloguePreview } from '../../scripts/archives-catalogue/server.mjs';
import { inventedCatalogue } from './fixtures/invented-catalogue.mjs';

const startPreview = async input => {
  const directory = await mkdtemp(join(tmpdir(), 'archives-catalogue-test-'));
  const cataloguePath = join(directory, 'catalogue.json');
  await writeFile(cataloguePath, `${JSON.stringify(input)}\n`, 'utf8');
  const preview = await createCataloguePreview({ cataloguePath });
  const url = await preview.listen(0);
  return {
    url,
    preview,
    async close() {
      await preview.close();
      await rm(directory, { recursive: true, force: true });
    }
  };
};

test('CLEAN is the default and all collections is explicit', () => {
  const model = prepareCatalogue(inventedCatalogue());
  const clean = queryCatalogue(model);
  const all = queryCatalogue(model, { collection_scope: 'all' });
  assert.equal(clean.filters.collection_scope, 'clean');
  assert.equal(clean.counts.matched_image_files, clean.counts.clean_image_files);
  assert.ok(all.counts.matched_image_files > clean.counts.matched_image_files);
  assert.equal(all.counts.matched_image_files, all.counts.inventory_image_files);
});

test('search and filters cover names, paths, types, states and priorities', () => {
  const model = prepareCatalogue(inventedCatalogue());
  assert.equal(queryCatalogue(model, { query: 'marie martin' }).counts.matched_image_files, 2);
  assert.equal(queryCatalogue(model, { query: 'ENTREE SANS NOM' }).counts.matched_image_files, 1);
  assert.ok(queryCatalogue(model, { collection_type: 'scan' }).records.every(record => record.collectionType === 'scan'));
  assert.ok(queryCatalogue(model, { status: 'duplicate-candidate' }).records.every(record => record.status === 'duplicate-candidate'));
  assert.ok(queryCatalogue(model, { priority: 'tuce' }).records.every(record => record.priority === 'tuce'));
  assert.equal(queryCatalogue(model, { collection_scope: 'all', query: 'durand' }).counts.matched_image_files, 1);
});

test('homonyms, possible duplicates and candidate groups stay separate and qualified', () => {
  const model = prepareCatalogue(inventedCatalogue());
  const homonyms = queryCatalogue(model, { query: 'Marie Martin', page_size: '50' }).records;
  assert.equal(homonyms.length, 2);
  assert.notEqual(homonyms[0].catalogueId, homonyms[1].catalogueId);
  const duplicates = queryCatalogue(model, { status: 'duplicate-candidate' }).records;
  assert.equal(duplicates.length, 2);
  assert.ok(duplicates.every(record => record.interpretation === 'file-not-act'));
  assert.equal(new Set(duplicates.map(record => record.catalogueId)).size, 2);
  const unclassified = queryCatalogue(model, { status: 'unclassified' }).records;
  assert.equal(unclassified[0].groups[0].status, 'candidate-unclassified');
});

test('pagination is stable, capped at fifty and keeps the DOM payload bounded', () => {
  const model = prepareCatalogue(inventedCatalogue(123));
  const first = queryCatalogue(model, { collection_scope: 'all', page_size: '50', page: '1' });
  const second = queryCatalogue(model, { collection_scope: 'all', page_size: '50', page: '2' });
  const last = queryCatalogue(model, { collection_scope: 'all', page_size: '50', page: '3' });
  assert.equal(MAX_PAGE_SIZE, 50);
  assert.equal(first.records.length, 50);
  assert.equal(second.records.length, 50);
  assert.equal(last.records.length, 23);
  assert.equal(first.pagination.page_count, 3);
  assert.equal(new Set([...first.records, ...second.records, ...last.records].map(record => record.catalogueId)).size, 123);
  assert.throws(() => queryCatalogue(model, { page_size: '51' }), /page_size/);
});

test('twenty thousand metadata records remain accepted but one page stays capped', () => {
  const model = prepareCatalogue(inventedCatalogue(20_000));
  const result = queryCatalogue(model, { collection_scope: 'all', page_size: '50', page: '400' });
  assert.equal(result.counts.inventory_image_files, 20_000);
  assert.equal(result.records.length, 50);
  assert.equal(result.pagination.page_count, 400);
  assert.throws(() => prepareCatalogue(inventedCatalogue(20_001)), /record_count/);
});

test('the contract refuses path leakage and unapproved reader links', () => {
  const absolute = inventedCatalogue(8);
  absolute.records[0].logical_path = 'Z:/private/secret.jpg';
  assert.throws(() => prepareCatalogue(absolute), /logical_path/);
  const sourcePath = inventedCatalogue(8);
  sourcePath.records[0].provenance.discovery_source = 'private/catalogue.jsonl';
  assert.throws(() => prepareCatalogue(sourcePath), /discovery_source/);
  const unauthorized = inventedCatalogue(8);
  unauthorized.records[0].consultation = { available: true, href: '/private/photo.jpg', approval_id: 'review:invented' };
  assert.throws(() => prepareCatalogue(unauthorized), /reader route/);
  const extra = inventedCatalogue(8);
  extra.records[0].physical_path = 'Z:/private/secret.jpg';
  assert.throws(() => prepareCatalogue(extra), /unexpected or missing fields/);
});

test('the page has external assets and the client has no HTML injection sink', async () => {
  const html = renderCataloguePage();
  assert.doesNotMatch(html, /<script(?![^>]+src=)/u);
  assert.doesNotMatch(html, /style\s*=/u);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/u);
  assert.match(html, /maxlength="100"/u);
  assert.match(html, /50 fichiers maximum/u);
  const script = await readFile(new URL('../../scripts/archives-catalogue/catalogue.js', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/u);
  assert.match(script, /textContent/u);
});

test('the loopback preview exposes only bounded catalogue routes', async t => {
  const running = await startPreview(inventedCatalogue());
  t.after(() => running.close());
  const base = new URL(running.url);
  const page = await fetch(running.url);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/u);
  const data = await fetch(new URL('/__catalogue_data?collection_scope=all&page_size=50', base));
  const payload = await data.json();
  assert.equal(data.status, 200);
  assert.equal(payload.records.length, 50);
  assert.equal(payload.records[7].fileName.literal, '<img src=x onerror=alert(1)>.jpg');
  assert.equal(Object.hasOwn(payload.records[0], 'physical_path'), false);
  assert.equal((await fetch(new URL('/private/secret.jpg', base))).status, 404);
  assert.equal((await fetch(new URL('/__catalogue_data?source=Z%3A%2Fprivate', base))).status, 400);
  assert.equal((await fetch(new URL('/__catalogue_data?page=1&page=2', base))).status, 400);
  assert.equal((await fetch(new URL('/archives/catalogue/?query=x', base))).status, 404);
  assert.equal((await fetch(new URL('/__catalogue_data', base), { method: 'POST' })).status, 405);
  const head = await fetch(new URL('/archives/catalogue/', base), { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal((await head.text()).length, 0);
});

