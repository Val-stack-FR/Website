import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { createArchivePreview } from '../../scripts/archives/preview-server.mjs';

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
  await writeFile(mediaManifestPath, JSON.stringify({
    manifest_version: 'atelier-tuce-local-media/1.0.0', corpus_root_reference: 'env:PHD_CORPUS_ROOT',
    access_tier: 'project', publication_status: 'not-published', objects: [entry]
  }));
  await writeFile(preflightPath, JSON.stringify({
    passed: true, corpus_root_accessible: true, corpus_root_reference: 'env:PHD_CORPUS_ROOT',
    input_manifest_sha256: 'a'.repeat(64), scope: 'synthetic'
  }));
  return { htmlPath, assetsRoot, corpusRoot, mediaManifestPath, preflightPath, entry, hash, bytes };
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
    input_manifest_sha256: 'a'.repeat(64)
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
    input_manifest_sha256: 'a'.repeat(64)
  }));
  await assert.rejects(createArchivePreview(f), /preflight corpus configuration/);

  await writeFile(f.preflightPath, JSON.stringify({
    passed: true, corpus_root_accessible: true, corpus_root_reference: 'env:PHD_CORPUS_ROOT',
    input_manifest_sha256: 'a'.repeat(64)
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
