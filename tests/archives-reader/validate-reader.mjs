import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, '..', '..');
const archivesDirectory = join(repositoryRoot, 'archives');
const fixturePath = join(archivesDirectory, 'fixtures', 'reader-demo.json');
const htmlPath = join(archivesDirectory, 'index.html');
const cssPath = join(repositoryRoot, 'css', 'archives.css');
const javascriptPath = join(repositoryRoot, 'js', 'archives-reader.js');

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const html = readFileSync(htmlPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');
const javascript = readFileSync(javascriptPath, 'utf8');

assert.equal(fixture.fixture, true, 'The local data must remain explicitly marked as a fixture.');
assert.match(fixture.fixtureNotice, /démonstration/i);
assert.equal(fixture.acts.length, 3, 'Sprint 1 exercises three demo acts.');

const slugs = new Set();
const imageTypes = new Set();

for (const act of fixture.acts) {
  for (const field of ['id', 'slug', 'title', 'identificationStatus', 'readingStatus', 'publicationStatus']) {
    assert.ok(act[field], `${act.id || 'Act'} is missing ${field}.`);
  }

  assert.ok(!slugs.has(act.slug), `Duplicate slug: ${act.slug}`);
  slugs.add(act.slug);
  assert.ok(Array.isArray(act.dateClaims), `${act.id} must keep date claims as a list.`);
  assert.ok(Array.isArray(act.transcription.blocks), `${act.id} transcription blocks must be a list.`);
  assert.ok(Array.isArray(act.modernFrenchTranslation.blocks), `${act.id} translation blocks must be a list.`);
  assert.equal(act.modernFrenchTranslation.lang, 'fr');
  assert.match(html, new RegExp(`id="${act.slug}"`), `${act.slug} needs a static direct-link target.`);

  for (const image of act.images) {
    assert.ok(image.id, `${act.id} has an image without a stable view id.`);
    assert.ok(image.alt && image.caption && image.viewType, `${image.id} lacks accessible metadata.`);
    assert.equal(image.placeholder, true, `${image.id} must remain visibly identified as a placeholder.`);
    assert.ok(!/^(?:[a-z]:|\\\\)/i.test(image.src), `${image.id} exposes a local absolute path.`);
    assert.ok(existsSync(join(archivesDirectory, image.src)), `${image.id} references a missing local placeholder.`);
    imageTypes.add(image.viewType);
  }
}

for (const requiredType of ['recto', 'verso', 'copy', 'register', 'detail']) {
  assert.ok(imageTypes.has(requiredType), `The demo gallery does not exercise the ${requiredType} view type.`);
}

const articleBlocks = html.match(/<article class="archive-act"[\s\S]*?<\/article>/g) || [];
assert.equal(articleBlocks.length, fixture.acts.length, 'Every fixture act must be rendered as static HTML.');

for (const article of articleBlocks) {
  const transcription = article.indexOf('Transcription originale');
  const translation = article.indexOf('Traduction proposée en français moderne');
  const images = article.indexOf('Images associées');
  assert.ok(transcription >= 0 && transcription < translation && translation < images, 'Panel order must be transcription, translation, images.');
}

assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, 'Inline scripts are forbidden.');
assert.doesNotMatch(html, /\sstyle\s*=/i, 'Inline styles are forbidden.');
assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'Inline event handlers are forbidden.');
assert.doesNotMatch(`${html}\n${javascript}`, /localStorage|sessionStorage/, 'The demo must not simulate correction persistence.');
assert.doesNotMatch(`${html}\n${JSON.stringify(fixture)}`, /(?:Z:\\|C:\\Users\\|PERSO|Backblaze|B2 bucket)/i, 'Private paths or storage details leaked into public demo files.');
assert.match(css, /scroll-snap-type:\s*x mandatory/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(javascript, /ArrowLeft/);
assert.match(javascript, /ArrowRight/);

console.log('Archive reader checks passed: fixture, static panels, media, CSP hygiene and navigation hooks.');
