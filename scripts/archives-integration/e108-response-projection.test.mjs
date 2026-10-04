import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  compileE108ResponseProjection,
  E108_COMPOSED_CATALOGUE_SHA256,
  E108_PARENT_CATALOGUE_SHA256,
  E108_CATALOGUE_PATH,
} from './e108-response-projection.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REVIEW_ROOT = join(REPO_ROOT, '.private/archives-next-readings/e108-ensemble-ui-20261004-v1/reviewed-r3');
const RUN_ROOT = join(REPO_ROOT, '.private/archives-integration/e108-response-projection-20261004-v1');
const PARENT_HTML_PATH = join(REPO_ROOT, '.private/archives-integration/publication-package-20261004-v11/site/dist/archives/catalogue/index.html');
const COMPOSED_HTML_PATH = join(REVIEW_ROOT, 'catalogue.html');
const CONTRACT_PATH = join(REVIEW_ROOT, 'integration-contract.json');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const readUtf8 = async (path) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readFile(path));

const parentHtml = await readUtf8(PARENT_HTML_PATH);
const composedHtml = await readUtf8(COMPOSED_HTML_PATH);
const contract = JSON.parse(await readUtf8(CONTRACT_PATH));
const compiled = compileE108ResponseProjection({
  parentHtml,
  composedHtml,
  parentSha256: digest(Buffer.from(parentHtml, 'utf8')),
  composedSha256: digest(Buffer.from(composedHtml, 'utf8')),
});
const runtime = await import(`data:text/javascript;base64,${Buffer.from(compiled.sourceText).toString('base64')}`);
const responseUrl = (query) => `${E108_CATALOGUE_PATH}?${query}`;

test('extracts exactly four reversible insertions from the pinned snapshots', () => {
  assert.equal(digest(Buffer.from(parentHtml, 'utf8')), E108_PARENT_CATALOGUE_SHA256);
  assert.equal(digest(Buffer.from(composedHtml, 'utf8')), E108_COMPOSED_CATALOGUE_SHA256);
  assert.equal(compiled.parentRestoredExactly, true);
  assert.deepEqual(Object.keys(compiled.insertions), ['intro', 'css', 'template', 'script']);
  assert.equal(runtime.projectE108CatalogueResponse(E108_CATALOGUE_PATH, parentHtml), composedHtml);
  assert.equal(runtime.restoreE108Projection(composedHtml), parentHtml);
});

test('saved runtime module is the exact output of the pure compiler', async () => {
  const emitted = await readUtf8(join(RUN_ROOT, 'e108-response-projection-runtime.mjs'));
  assert.equal(emitted, compiled.sourceText);
});

test('projects query-bearing catalogue responses and leaves the response payload reversible', () => {
  const dynamicHtml = parentHtml.replace('</main>', '<p data-api-response-page="2">Page API distincte</p></main>');
  assert.notEqual(dynamicHtml, parentHtml);
  for (const query of [
    'folder=CLEAN%2FPhotos%20des%20Archives%2FE.108&page=1&page_size=20',
    'q=E.108&sort=nominal&cursor=eyJwYWdlIjoyfQ',
    'folder=other&page=3&filter=archive',
  ]) {
    const projected = runtime.projectE108CatalogueResponse(responseUrl(query), dynamicHtml);
    assert.equal(runtime.restoreE108Projection(projected), dynamicHtml);
    for (const insertion of Object.values(compiled.insertions)) assert.equal(projected.split(insertion).length - 1, 1);
    assert.equal(projected.includes('<p data-api-response-page="2">Page API distincte</p>'), true);
  }
});

test('does not change other routes or catalogue responses without the unique landmark', () => {
  for (const url of ['/archives/', '/archives/catalogue-export/?page=2', '/api/catalogue/?folder=E108']) {
    assert.equal(runtime.projectE108CatalogueResponse(url, parentHtml), parentHtml);
  }
  const jsonLikeResponse = '{"page":2,"entries":[]}';
  assert.equal(runtime.projectE108CatalogueResponse(responseUrl('page=2'), jsonLikeResponse), jsonLikeResponse);
  const noNotice = '<!doctype html><html><head></head><body><main>Autre réponse</main></body></html>';
  assert.equal(runtime.projectE108CatalogueResponse(responseUrl('q=empty'), noNotice), noNotice);
});

test('refuses duplicate or partial projections and ambiguous catalogue landmarks', () => {
  const projected = runtime.projectE108CatalogueResponse(E108_CATALOGUE_PATH, parentHtml);
  assert.throws(() => runtime.projectE108CatalogueResponse(E108_CATALOGUE_PATH, projected), /already or partially projected/u);
  assert.throws(() => runtime.projectE108CatalogueResponse(E108_CATALOGUE_PATH, parentHtml.replace('</body>', `${compiled.insertions.css}</body>`)), /already or partially projected/u);
  assert.throws(() => runtime.projectE108CatalogueResponse(E108_CATALOGUE_PATH, `${parentHtml}${'<aside class="catalogue-notice" aria-label="Limites du catalogue">'}`), /catalogue-notice landmark must be unique/u);
});

test('requires unique and ordered head/body landmarks before decorating', () => {
  const cases = [
    parentHtml.replace('</head>', ''),
    parentHtml.replace('</head>', '</head></head>'),
    parentHtml.replace('</body>', ''),
    parentHtml.replace('</body>', '</body></body>'),
    parentHtml.replace('<body', '<body></head><body'),
  ];
  for (const html of cases) assert.throws(() => runtime.projectE108CatalogueResponse(E108_CATALOGUE_PATH, html));
});

test('runtime source contains only insertion HTML and URLs; existing client remains page-local and exact-member gated', async () => {
  const source = compiled.sourceText;
  for (const forbidden of ['ensemble.json', 'media-check.json', 'build-proof.json', 'readFile(', 'node:fs', 'fetch(']) assert.equal(source.includes(forbidden), false, forbidden);
  assert.equal(source.includes('<style'), false);
  assert.equal(source.includes('onerror='), false);
  assert.equal(compiled.insertions.css, '<link rel="stylesheet" href="/assets/archives-catalogue-ensemble.css">\n');
  assert.equal(compiled.insertions.script, '<script src="/assets/archives-catalogue-ensemble.js" defer></script>\n');

  const assets = [
    ['catalogue-ensemble.css', '/assets/archives-catalogue-ensemble.css'],
    ['catalogue-ensemble.js', '/assets/archives-catalogue-ensemble.js'],
  ];
  for (const [file, route] of assets) {
    const pin = contract.assets.find((asset) => asset.run_file === file && asset.route === route);
    assert.ok(pin, `missing contract pin for ${file}`);
    const bytes = await readFile(join(REVIEW_ROOT, 'code-snapshot', file));
    assert.equal(digest(bytes), pin.sha256);
    assert.equal(bytes.length, pin.bytes);
  }

  const client = await readUtf8(join(REVIEW_ROOT, 'code-snapshot', 'catalogue-ensemble.js'));
  assert.match(client, /new URLSearchParams\(location\.search\)\.get\('folder'\)!==template\.dataset\.ensembleFolder/u);
  assert.match(client, /const cards=\[\.\.\.results\.children\]/u);
  assert.match(client, /if\(matches\.length!==1\)return;/u);
  assert.match(client, /first\.before\(group\);for\(const card of chosen\)card\.remove\(\)/u);
  assert.equal(client.includes('fetch('), false);
  const memberIds = [...compiled.insertions.template.matchAll(/data-ensemble-object-id="(object:path-[a-f0-9]+)"/gu)].map((match) => match[1]);
  assert.equal(memberIds.length, 4);
  assert.equal(new Set(memberIds).size, 4);
  assert.equal(compiled.insertions.template.includes('Photo inventoriée · aperçu à préparer'), true);
  assert.equal(compiled.insertions.template.includes('<img'), false);
});
