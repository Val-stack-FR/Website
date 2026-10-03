import test from 'node:test';
import assert from 'node:assert/strict';
import { loopbackBase, permittedSourceRoute, guardRequest, rewriteMediaUrls, readBounded } from '../../scripts/archives-integration/media-preview.mjs';

test('literal loopback origin only; no external host, credentials, path or redirect seed', () => {
  assert.equal(loopbackBase('http://127.0.0.1:8769'), 'http://127.0.0.1:8769');
  for (const value of ['https://example.org', 'http://localhost:8769', 'http://127.0.0.1',
    'http://u:p@127.0.0.1:8769', 'http://127.0.0.1:8769/private', 'http://127.0.0.1:8769/?url=x']) assert.throws(() => loopbackBase(value));
});
test('original view identifier and prose stay literal while bindings change', () => {
  const html = '<article id="candidate:invented">hash-1<img src="/__archive_media/hash-1"><a href="/__archive_media/hash-1">source</a><svg><image href="/__archive_media/hash-1"/></svg></article>';
  const rewritten = rewriteMediaUrls(html, new Map([['/__archive_media/hash-1', '/archives/media-releases/invented/media/new.jpg']]));
  assert.ok(rewritten.includes('id="candidate:invented">hash-1'));
  assert.equal(rewritten.split('/archives/media-releases/invented/media/new.jpg').length - 1, 3);
  assert.equal(rewritten.replaceAll('/archives/media-releases/invented/media/new.jpg', '/__archive_media/hash-1'), html);
});
test('closed route set denies private files and arbitrary proxies', () => {
  for (const path of ['/data/private/', '/.git/config', '/env', '/api/decide', '/arbitrary.js', '/__archive_media/nohash']) assert.equal(permittedSourceRoute(new URL(path, 'http://127.0.0.1:1')), false);
  for (const path of ['/archives/', '/archives/texte/?id=object%3Ainvented', '/__catalogue_hierarchy?folder=CLEAN', '/js/archives-reader.js']) assert.equal(permittedSourceRoute(new URL(path, 'http://127.0.0.1:1')), true);
  assert.equal(permittedSourceRoute(new URL('/styles.css?file=private', 'http://127.0.0.1:1')), false);
});
const origin = 'http://127.0.0.1:8795';
const request = (url, extra = {}) => ({ method: 'GET', url, headers: { host: '127.0.0.1:8795' }, rawHeaders: ['Host', '127.0.0.1:8795'], ...extra });
test('all mutations and cross-origin/rebinding requests denied', () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) assert.equal(guardRequest(request('/archives/', { method }), origin).status, 405);
  for (const headers of [{ host: 'evil.example' }, { host: '127.0.0.1:8795', origin: 'http://evil.example' }, { host: '127.0.0.1:8795', 'sec-fetch-site': 'cross-site' }]) assert.equal(guardRequest(request('/archives/', { headers }), origin).status, 403);
});
test('raw and encoded path escapes denied before URL normalization', () => {
  for (const url of ['/archives/../styles.css', '/archives/%2e%2e/styles.css', '/%2fprivate', '/%5cprivate', '/x\\y', '/%00', '//evil.example/x', '/%zz', '/C:/secret']) assert.equal(guardRequest(request(url), origin).status, 400);
  assert.equal(guardRequest(request('/__catalogue_hierarchy?folder=CLEAN%2FPhotos'), origin).url.searchParams.get('folder'), 'CLEAN/Photos');
});
test('oversized query cannot reach the source', () => {
  assert.equal(guardRequest(request('/archives/?q=' + 'x'.repeat(5000)), origin).status, 400);
});
test('duplicate Host and Origin refused regardless of ordering or case', () => {
  for (const rawHeaders of [
    ['Host', '127.0.0.1:8795', 'Host', 'evil.example'],
    ['Host', 'evil.example', 'host', '127.0.0.1:8795'],
    ['Host', '127.0.0.1:8795', 'Origin', origin, 'origin', 'http://evil.example'],
    []
  ]) assert.equal(guardRequest(request('/archives/', { rawHeaders }), origin).status, 400);
});
test('GET and HEAD body framing refused before proxying, even declared zero', () => {
  for (const method of ['GET', 'HEAD']) {
    for (const [name, value] of [['content-length', '3'], ['content-length', '0'], ['transfer-encoding', 'chunked'], ['expect', '100-continue']]) {
      assert.equal(guardRequest(request('/archives/', { method, headers: { host: '127.0.0.1:8795', [name]: value }, rawHeaders: ['Host', '127.0.0.1:8795', name, value] }), origin).status, 400);
    }
  }
});
test('declared body limit is checked before reading', async () => {
  await assert.rejects(() => readBounded(new Response('abc', { headers: { 'content-length': '100' } }), 4));
  assert.equal((await readBounded(new Response('abc'), 4)).toString(), 'abc');
});
test('streamed body limit enforced without relying on content-length', async () => {
  await assert.rejects(() => readBounded(new Response('abcdefgh'), 4));
});
