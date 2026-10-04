import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { createArchivePreview } from '../../scripts/archives/preview-server.mjs';
import { inventedCatalogue } from '../archives-catalogue/fixtures/invented-catalogue.mjs';

async function fixture(t) {
  const tempRoot = await realpath(tmpdir());
  const work = await mkdtemp(join(tempRoot, 'archives-preview-test-'));
  t.after(async () => {
    const target = await realpath(work);
    assert.equal(dirname(target).toLowerCase(), tempRoot.toLowerCase());
    assert.ok(target.toLowerCase().startsWith(join(tempRoot, 'archives-preview-test-').toLowerCase()));
    await rm(target, { recursive: true, force: true });
  });
  const assetsRoot = join(work, 'assets');
  const corpusRoot = join(work, 'corpus');
  await mkdir(join(assetsRoot, 'css'), { recursive: true });
  await mkdir(join(assetsRoot, 'js'));
  await mkdir(corpusRoot);
  await Promise.all(['styles.css', 'css/archives.css', 'js/archives-reader.js', 'favicon.svg'].map(name =>
    writeFile(join(assetsRoot, name), 'test asset')
  ));
  await writeFile(join(assetsRoot, '.env'), 'SECRET-SHOULD-NOT-BE-SERVED');
  const htmlPath = join(work, 'reader.html');
  await writeFile(htmlPath, '<!doctype html><html><body>Private preview</body></html>');
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  await writeFile(join(corpusRoot, 'selected.jpg'), bytes);
  await writeFile(join(corpusRoot, 'unselected.txt'), 'Unselected corpus object');
  const hash = createHash('sha256').update(bytes).digest('hex');
  const entry = {
    digital_object_id: 'object:test', view_id: 'view:test', relative_path: 'selected.jpg',
    sha256: hash, byte_size: bytes.length, media_type: 'image/jpeg', approved_review_id: 'review:fixture',
    source_reading_status: 'unreviewed', bytes_verified: true
  };
  const mediaManifestPath = join(work, 'media.json');
  const preflightPath = join(work, 'preflight.json');
  const sourceManifestPath = join(work, 'source-manifest.json');
  const sourceBytes = Buffer.from(JSON.stringify({
    corpus_root_reference: 'env:PHD_CORPUS_ROOT', objects: [{
      ...entry, expected_sha256: entry.sha256, expected_byte_size: entry.byte_size,
      rights: { local_consultation: 'authorized', permitted_uses: ['local-private-consultation'] }
    }]
  }));
  const sourceManifestHash = createHash('sha256').update(sourceBytes).digest('hex');
  await writeFile(sourceManifestPath, sourceBytes);
  await writeFile(mediaManifestPath, JSON.stringify({
    manifest_version: 'atelier-tuce-local-media/1.0.0', corpus_root_reference: 'env:PHD_CORPUS_ROOT',
    access_tier: 'project', publication_status: 'not-published', objects: [entry]
  }));
  await writeFile(preflightPath, JSON.stringify({
    passed: true, corpus_root_accessible: true, corpus_root_reference: 'env:PHD_CORPUS_ROOT',
    input_manifest_sha256: sourceManifestHash, scope: 'synthetic'
  }));
  return { htmlPath, assetsRoot, corpusRoot, mediaManifestPath, preflightPath, sourceManifestPath, sourceManifestHash, entry, hash, bytes };
}

test('only selected images and explicit assets are available on localhost', async t => {
  const f = await fixture(t);
  const preview = await createArchivePreview(f);
  const url = await preview.listen();
  t.after(() => new Promise(resolveDone => preview.server.close(resolveDone)));
  assert.equal(preview.server.address().address, '127.0.0.1');
  const home = await fetch(url);
  assert.equal(home.status, 200);
  assert.ok((await home.text()).includes('Private preview'));
  assert.equal(home.headers.get('cache-control'), 'no-store');
  assert.ok(!home.headers.get('content-security-policy').includes('unsafe-inline'));
  const origin = new URL(url).origin;
  const image = await fetch(origin + '/__archive_media/' + f.hash);
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), f.bytes);
  const head = await fetch(origin + '/__archive_media/' + f.hash, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  for (const forbidden of ['/.env', '/.git/config', '/scripts/build-site.js', '/unselected.txt',
    '/__archive_media/' + '0'.repeat(64), '/styles.css?source=.env', '/%2e%2e%5c.env']) {
    assert.equal((await fetch(origin + forbidden)).status, 404, forbidden);
  }
  assert.equal((await fetch(origin + '/styles.css')).status, 200);
  assert.equal((await fetch(url, { method: 'POST', body: 'ignored' })).status, 405);
});

test('startup refuses failed preflight, changed content and unsafe source paths', async t => {
  const f = await fixture(t);
  await writeFile(f.preflightPath, JSON.stringify({ passed: false }));
  await assert.rejects(createArchivePreview(f), /preflight/);
  await writeFile(f.preflightPath, JSON.stringify({
    passed: true, corpus_root_accessible: true, corpus_root_reference: 'env:PHD_CORPUS_ROOT',
    input_manifest_sha256: f.sourceManifestHash
  }));
  await writeFile(join(f.corpusRoot, 'selected.jpg'), 'changed');
  await assert.rejects(createArchivePreview(f), /hash has changed/);
  await writeFile(join(f.corpusRoot, 'selected.jpg'), f.bytes);
  for (const unsafe of ['../reader.html', 'C:/outside.jpg', '..\\reader.html', '/outside.jpg']) {
    await writeFile(f.mediaManifestPath, JSON.stringify({
      manifest_version: 'atelier-tuce-local-media/1.0.0', corpus_root_reference: 'env:PHD_CORPUS_ROOT',
      access_tier: 'project', publication_status: 'not-published',
      objects: [{ ...f.entry, relative_path: unsafe }]
    }));
    await assert.rejects(createArchivePreview(f), /Unsafe source path/, unsafe);
  }
});

test('startup rejects incoherent preflight and allowlist verification claims', async t => {
  const f = await fixture(t);
  await writeFile(f.preflightPath, JSON.stringify({
    passed: true, corpus_root_accessible: false, corpus_root_reference: 'env:PHD_CORPUS_ROOT',
    input_manifest_sha256: f.sourceManifestHash
  }));
  await assert.rejects(createArchivePreview(f), /preflight corpus configuration/);

  await writeFile(f.preflightPath, JSON.stringify({
    passed: true, corpus_root_accessible: true, corpus_root_reference: 'env:PHD_CORPUS_ROOT',
    input_manifest_sha256: f.sourceManifestHash
  }));
  await writeFile(f.mediaManifestPath, JSON.stringify({
    manifest_version: 'atelier-tuce-local-media/1.0.0', corpus_root_reference: 'env:PHD_CORPUS_ROOT',
    access_tier: 'project', publication_status: 'not-published',
    objects: [{ ...f.entry, byte_size: f.bytes.length + 1 }]
  }));
  await assert.rejects(createArchivePreview(f), /declared byte size/);

  await writeFile(f.mediaManifestPath, JSON.stringify({
    manifest_version: 'atelier-tuce-local-media/1.0.0', corpus_root_reference: 'env:PHD_CORPUS_ROOT',
    access_tier: 'project', publication_status: 'not-published',
    objects: [{ ...f.entry, bytes_verified: false }]
  }));
  await assert.rejects(createArchivePreview(f), /verified allowlist entry/);
});

test('a passed preflight cannot be reused with a different source manifest', async t => {
  const f = await fixture(t);
  await writeFile(f.sourceManifestPath, '{}');
  await assert.rejects(createArchivePreview(f), /Source manifest hash differs/);
});

test('optional annex search exposes only its page and two explicit assets', async t => {
  const f = await fixture(t);
  f.searchHtmlPath = join(f.assetsRoot, 'private-search.html');
  await writeFile(f.searchHtmlPath, '<!doctype html><html lang="fr"><body>Five selected fiches</body></html>');
  await writeFile(join(f.assetsRoot, 'css/archives-search.css'), '/* search */');
  await writeFile(join(f.assetsRoot, 'js/archives-search.js'), '// search');
  const preview = await createArchivePreview(f);
  const url = await preview.listen();
  t.after(() => new Promise(resolveDone => preview.server.close(resolveDone)));
  const origin = new URL(url).origin;
  const page = await fetch(origin + '/archives/recherche/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Five selected fiches/);
  for (const asset of ['/css/archives-search.css', '/js/archives-search.js']) {
    assert.equal((await fetch(origin + asset)).status, 200);
  }
  for (const forbidden of ['/private-search.html', '/query-index.json', '/archives/recherche/?file=.env']) {
    assert.equal((await fetch(origin + forbidden)).status, 404);
  }
  await assert.rejects(createArchivePreview({ ...f, searchHtmlPath: f.htmlPath }), /outside the checkout/);
});

test('optional occurrence page exposes only its route and stylesheet', async t => {
  const f = await fixture(t);
  f.occurrenceHtmlPath = join(f.assetsRoot, 'private-occurrence.html');
  await writeFile(f.occurrenceHtmlPath, '<!doctype html><html lang="fr"><body>One unreviewed context</body></html>');
  await writeFile(join(f.assetsRoot, 'css/archives-occurrence.css'), '/* occurrence */');
  const preview = await createArchivePreview(f);
  const url = await preview.listen();
  t.after(() => new Promise(resolveDone => preview.server.close(resolveDone)));
  const origin = new URL(url).origin;
  assert.match(await (await fetch(origin + '/archives/formes/')).text(), /One unreviewed context/);
  assert.equal((await fetch(origin + '/css/archives-occurrence.css')).status, 200);
  for (const forbidden of ['/private-occurrence.html', '/occurrence.json', '/archives/formes/?file=.env']) {
    assert.equal((await fetch(origin + forbidden)).status, 404);
  }
  await assert.rejects(createArchivePreview({ ...f, occurrenceHtmlPath: f.htmlPath }), /outside the checkout/);
});

test('optional statusboard exposes its route and stylesheet while source files stay private', async t => {
  const f = await fixture(t);
  f.statusHtmlPath = join(f.assetsRoot, 'private-status.html');
  await writeFile(f.statusHtmlPath, '<!doctype html><html lang="fr"><body>Two dossiers and five fiches</body></html>');
  await writeFile(join(f.assetsRoot, 'css/archives-statusboard.css'), '/* statusboard */');
  const preview = await createArchivePreview(f);
  const url = await preview.listen();
  t.after(() => new Promise(resolveDone => preview.server.close(resolveDone)));
  const origin = new URL(url).origin;
  const page = await fetch(origin + '/archives/avancement/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Two dossiers and five fiches/);
  assert.equal((await fetch(origin + '/css/archives-statusboard.css')).status, 200);
  for (const forbidden of ['/private-status.html', '/export-candidate.json', '/archives/avancement/?file=.env']) {
    assert.equal((await fetch(origin + forbidden)).status, 404);
  }
  await assert.rejects(createArchivePreview({ ...f, statusHtmlPath: f.htmlPath }), /outside the checkout/);
});

test('integrated catalogue serves static CLEAN cards and bounded data while refusing reserve and unverified links', async t => {
  const f = await fixture(t);
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(f.assetsRoot, 'scripts/archives-catalogue'), { recursive: true });
  await writeFile(join(f.assetsRoot, 'scripts/archives-catalogue/catalogue.css'), '/* catalogue */');
  await writeFile(join(f.assetsRoot, 'scripts/archives-catalogue/catalogue.js'), '// catalogue');
  await writeFile(join(f.assetsRoot, 'scripts/archives-catalogue/hierarchy.js'), '// hierarchy');
  const catalogue = inventedCatalogue(70);
  catalogue.records = catalogue.records.filter(record => record.collection_scope === 'clean');
  for (const record of catalogue.records) {
    record.consultation = { available: false, href: null, approval_id: null };
    if (record.status === 'reader-linked') record.status = 'metadata-only';
  }
  catalogue.record_count = catalogue.records.length;
  f.cataloguePath = join(f.assetsRoot, 'private-catalogue.json');
  await writeFile(f.cataloguePath, JSON.stringify(catalogue));
  const preview = await createArchivePreview(f);
  t.after(() => new Promise(resolveDone => preview.server.close(resolveDone)));
  const origin = new URL(await preview.listen()).origin;
  const html = await (await fetch(origin + '/archives/catalogue/')).text();
  assert.ok((html.match(/class="catalogue-card"/g) ?? []).length <= 50);
  assert.ok(html.includes('Classement historique des dossiers conservé'));
  const hierarchy = await (await fetch(origin + '/__catalogue_hierarchy')).json();
  assert.equal(hierarchy.selected_folder.logicalPath, 'CLEAN');
  assert.equal(hierarchy.counts.clean_image_files, catalogue.records.length);
  assert.ok(hierarchy.entries.every(entry=>entry.kind === 'folder' || entry.kind === 'file'));
  assert.ok(!html.includes('Toutes les collections'));
  assert.ok(!html.includes('<img src=x'));
  const data = await (await fetch(origin + '/__catalogue_data?collection_scope=all')).json();
  assert.equal(data.records.length, 50);
  assert.ok(data.records.every(record => record.collectionScope === 'clean'));
  for (const query of ['page_size=51', 'page=0', 'file=.env', 'page=1&page=2']) assert.equal((await fetch(origin + '/__catalogue_data?' + query)).status, 400);
  for (const route of ['/private-catalogue.json', '/scripts/archives-catalogue/catalogue.js']) assert.equal((await fetch(origin + route)).status, 404);
  for (const route of ['/archives/catalogue/?file=.env','/__catalogue_hierarchy?folder=CLEAN&folder=other','/__catalogue_hierarchy?page_size=51','/__catalogue_hierarchy?collection_scope=all','/__catalogue_hierarchy?folder=CLEAN/../other']) assert.equal((await fetch(origin + route)).status, 400);
  const reserve = inventedCatalogue(70);
  await writeFile(f.cataloguePath, JSON.stringify(reserve));
  await assert.rejects(createArchivePreview(f), /CLEAN only/);
  catalogue.records[0].consultation = { available: true, href: '/archives/#invented', approval_id: 'review:invented' };
  await writeFile(f.cataloguePath, JSON.stringify(catalogue));
  await assert.rejects(createArchivePreview(f), /reader export is required/);
});

test('candidate gallery requires a separate manifest-bound selection and cannot enter the accepted media route', async t => {
  const f = await fixture(t);
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x01, 5, 6, 7]);
  const hash = createHash('sha256').update(bytes).digest('hex');
  await writeFile(join(f.corpusRoot, 'candidate.jpg'), bytes);
  await writeFile(f.htmlPath, `<html><img src="/__archive_draft_media/${hash}" data-draft-object-id="object:path-${'c'.repeat(64)}"></html>`);
  await assert.rejects(createArchivePreview(f), /Candidate photographs require/);
  f.draftMediaManifestPath = join(f.assetsRoot, 'draft-media.json');
  await assert.rejects(createArchivePreview(f), /All three draft/);
  f.draftSourceManifestPath = join(f.assetsRoot, 'draft-source.json');
  f.draftPreflightPath = join(f.assetsRoot, 'draft-preflight.json');
  const objectId = 'object:path-' + 'c'.repeat(64);
  const sourceBytes = Buffer.from(JSON.stringify({ manifest_version: 'atelier-draft-source-input/1', corpus_root_reference: 'env:PHD_CORPUS_ROOT', objects: [{ digital_object_id: objectId, relative_path: 'candidate.jpg', expected_sha256: hash, expected_byte_size: bytes.length, media_type: 'image/jpeg', association_status: 'candidate', rights: { local_consultation: 'authorized', permitted_uses: ['local-private-consultation'] } }] }));
  const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
  await writeFile(f.draftSourceManifestPath, sourceBytes);
  await writeFile(f.draftPreflightPath, JSON.stringify({ passed: true, corpus_root_accessible: true, corpus_root_reference: 'env:PHD_CORPUS_ROOT', input_manifest_sha256: sourceHash }));
  await writeFile(f.draftMediaManifestPath, JSON.stringify({ manifest_version: 'atelier-draft-local-media/1', corpus_root_reference: 'env:PHD_CORPUS_ROOT', source_manifest_sha256: sourceHash, publication_status: 'not-published', link_status: 'candidate', objects: [{ digital_object_id: objectId, sha256: hash, byte_size: bytes.length, media_type: 'image/jpeg' }] }));
  const preview = await createArchivePreview(f);
  const origin = new URL(await preview.listen()).origin;
  t.after(() => new Promise(resolveDone => preview.server.close(resolveDone)));
  const image = await fetch(origin + '/__archive_draft_media/' + hash);
  assert.equal(image.status, 200);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
  for (const forbidden of ['/__archive_media/' + hash, '/__archive_draft_media/' + f.hash, '/draft-source.json', '/candidate.jpg']) assert.equal((await fetch(origin + forbidden)).status, 404);
  assert.equal((await fetch(origin + '/__archive_media/' + f.hash)).status, 200);
});
