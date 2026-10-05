import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { loadDraftMedia, MAX_DRAFT_JPEG_BYTES } from '../../scripts/archives/draft-media.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const tempRoot = await realpath(tmpdir());
  const root = await mkdtemp(join(tempRoot, 'archive-draft-media-'));
  t.after(async () => {
    const target = await realpath(root);
    assert.equal(dirname(target).toLowerCase(), tempRoot.toLowerCase());
    assert.ok(target.toLowerCase().startsWith(join(tempRoot, 'archive-draft-media-').toLowerCase()));
    await rm(target, { recursive: true, force: true });
  });
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  await writeFile(join(root, 'invented.jpg'), bytes);
  const objectId = 'object:path-' + 'a'.repeat(64);
  const source = { manifest_version: 'atelier-draft-source-input/1', corpus_root_reference: 'env:PHD_CORPUS_ROOT', objects: [{ digital_object_id: objectId, relative_path: 'invented.jpg', expected_sha256: sha(bytes), expected_byte_size: bytes.length, media_type: 'image/jpeg', association_status: 'candidate', rights: { local_consultation: 'authorized', permitted_uses: ['local-private-consultation'] } }] };
  const sourceManifestPath = join(root, 'source.json');
  const mediaManifestPath = join(root, 'media.json');
  const preflightPath = join(root, 'preflight.json');
  const sourceBytes = Buffer.from(JSON.stringify(source));
  const media = { manifest_version: 'atelier-draft-local-media/1', corpus_root_reference: 'env:PHD_CORPUS_ROOT', source_manifest_sha256: sha(sourceBytes), publication_status: 'not-published', link_status: 'candidate', objects: [{ digital_object_id: objectId, sha256: sha(bytes), byte_size: bytes.length, media_type: 'image/jpeg' }] };
  const preflight = { passed: true, corpus_root_accessible: true, corpus_root_reference: 'env:PHD_CORPUS_ROOT', input_manifest_sha256: sha(sourceBytes) };
  await writeFile(sourceManifestPath, sourceBytes); await writeFile(mediaManifestPath, JSON.stringify(media)); await writeFile(preflightPath, JSON.stringify(preflight));
  return { args: { corpusRoot: root, sourceManifestPath, mediaManifestPath, preflightPath, html: `<img src="/__archive_draft_media/${sha(bytes)}" data-draft-object-id="${objectId}">` }, source, media, preflight, bytes };
}

test('candidate media verifies exact bytes under a separate manifest without an accepted review', async t => {
  const f = await fixture(t);
  const files = await loadDraftMedia(f.args);
  assert.equal(files.size, 1);
  assert.equal(files.get(sha(f.bytes)).size, f.bytes.length);
  assert.ok(!Object.hasOwn(f.media.objects[0], 'approved_review_id'));
});

test('candidate media refuses failed preflight, binding drift and photograph promotion', async t => {
  const f = await fixture(t);
  for (const bad of [{ ...f.preflight, passed: false }, { ...f.preflight, input_manifest_sha256: '0'.repeat(64) }]) {
    await writeFile(f.args.preflightPath, JSON.stringify(bad));
    await assert.rejects(loadDraftMedia(f.args), /preflight/);
  }
  await writeFile(f.args.preflightPath, JSON.stringify(f.preflight));
  f.media.objects[0].approved_review_id = 'review:invented';
  await writeFile(f.args.mediaManifestPath, JSON.stringify(f.media));
  await assert.rejects(loadDraftMedia(f.args), /promoted/);
});

test('candidate media refuses HTML drift, source byte drift and unsafe source paths', async t => {
  const f = await fixture(t);
  await assert.rejects(loadDraftMedia({ ...f.args, html: '' }), /HTML photograph/);
  await writeFile(join(f.args.corpusRoot, 'invented.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0x01]));
  await assert.rejects(loadDraftMedia(f.args), /bytes differ/);
  f.source.objects[0].relative_path = '../outside.jpg';
  const sourceBytes = Buffer.from(JSON.stringify(f.source));
  await writeFile(f.args.sourceManifestPath, sourceBytes);
  f.preflight.input_manifest_sha256 = sha(sourceBytes); f.media.source_manifest_sha256 = sha(sourceBytes);
  await writeFile(f.args.preflightPath, JSON.stringify(f.preflight)); await writeFile(f.args.mediaManifestPath, JSON.stringify(f.media));
  await assert.rejects(loadDraftMedia(f.args), /unsafe/);
});

test('candidate media refuses object drift with identical SHA and bounds reads before allocating', async t => {
  const f = await fixture(t);
  await assert.rejects(loadDraftMedia({ ...f.args, html: f.args.html.replace('object:path-' + 'a'.repeat(64), 'object:path-' + 'c'.repeat(64)) }), /object\/hash binding/);
  f.media.objects[0].byte_size = MAX_DRAFT_JPEG_BYTES + 1;
  await writeFile(f.args.mediaManifestPath, JSON.stringify(f.media));
  await assert.rejects(loadDraftMedia(f.args), /oversized/);
  f.media.objects[0].byte_size = f.bytes.length;
  await writeFile(f.args.mediaManifestPath, JSON.stringify(f.media));
  await writeFile(join(f.args.corpusRoot, 'invented.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0, 0]));
  await assert.rejects(loadDraftMedia(f.args), /size differs before read/);
});
