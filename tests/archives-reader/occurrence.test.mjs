import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { prepareOccurrence, renderOccurrence } from '../../scripts/archives/render-occurrence.mjs';
import { syntheticOccurrence } from './fixtures/synthetic-occurrence.mjs';

const rendererPath = fileURLToPath(new URL('../../scripts/archives/render-occurrence.mjs', import.meta.url));
const stylesheetPath = fileURLToPath(new URL('../../css/archives-occurrence.css', import.meta.url));

const set = (input, path, value) => {
  const keys = path.split('.');
  const key = keys.pop();
  keys.reduce((part, next) => part[next], input)[key] = value;
};

test('pure adapter keeps one uncertain occurrence and one hash-derived media URL', () => {
  const input = syntheticOccurrence();
  const snapshot = structuredClone(input);
  const model = prepareOccurrence(input);
  const html = renderOccurrence(input);
  assert.deepEqual(input, snapshot);
  assert.equal(model.mediaUrl, `/__archive_media/${input.source.sha256}`);
  assert.equal((html.match(/<mark\b/gu) || []).length, 1);
  assert.equal((html.match(/<img\b/gu) || []).length, 1);
  assert.match(html, /<html lang="fr">/u);
  assert.match(html, /Mot exact non aligné · lacune non résolue/u);
  assert.match(html, /candidate \/ possible/u);
  assert.match(html, /unresolved \/ unreviewed \/ private/u);
  assert.match(html, /null \/ \[\]/u);
  assert.match(html, /L’orientation EXIF et l’affichage du navigateur n’ont pas encore été conciliés/u);
  assert.match(html, /viewBox="50 100 250 50"/u);
  assert.equal((html.match(new RegExp(`/__archive_media/${input.source.sha256}`, 'gu')) || []).length, 3);
});

test('Unicode positions use code points, preserve CRLF and highlight the selected literal gap', () => {
  const input = syntheticOccurrence();
  assert.equal(input.transcription.context_before.length, Array.from(input.transcription.context_before).length + 1);
  const html = renderOccurrence(input);
  assert.ok(html.includes(`[${input.transcription.span.start}, ${input.transcription.span.end})`));
  assert.ok(html.includes('1. texte inventé\n2. dit 😀 <mark'));
  assert.ok(html.includes('>----</mark> suite inventée\r\n3. fin'));
  const leadingLine = syntheticOccurrence();
  leadingLine.transcription.context_before = `\n${leadingLine.transcription.context_before}`;
  const leadingHtml = renderOccurrence(leadingLine);
  // A code wrapper prevents HTML's pre-element parser from discarding the first LF.
  assert.match(leadingHtml, /<pre[^>]*><code>\n1\. texte inventé/u);
  const boundary = syntheticOccurrence();
  boundary.transcription.span.start = Array.from(boundary.transcription.context_before).length;
  boundary.transcription.span.end = boundary.transcription.span.start + 4;
  assert.doesNotThrow(() => prepareOccurrence(boundary));
  boundary.transcription.span.start -= 1;
  boundary.transcription.span.end -= 1;
  assert.throws(() => prepareOccurrence(boundary), /contexte précédent/u);
  const invalid = syntheticOccurrence();
  invalid.transcription.context_before += '\uD800';
  assert.throws(() => prepareOccurrence(invalid), /Unicode invalide/u);
});

test('profile refuses arrays, missing or additional fields and nonmatching revisions or views', () => {
  assert.throws(() => prepareOccurrence([syntheticOccurrence()]), /objet unique/u);
  for (const [path, value] of [
    ['schema_version', 'h05-real-occurrence/2.0.0'],
    ['occurrence_id', 'text:wrong-object-kind'],
    ['source.view_id', `object:path-${'1'.repeat(64)}`],
    ['locator.view_id', `object:path-${'2'.repeat(64)}`],
    ['transcription.text_revision', '1'.repeat(64)],
    ['transcription.span.units', 'utf16'],
    ['transcription.span.end', 2],
    ['transcription.context_line', 'different line'],
    ['pixel_observation.native_width', 401],
    ['pixel_observation.completed', false],
    ['source.width', 0]
  ]) {
    const input = syntheticOccurrence();
    set(input, path, value);
    assert.throws(() => prepareOccurrence(input), undefined, path);
  }
  const missing = syntheticOccurrence();
  delete missing.source.approved_review_id;
  assert.throws(() => prepareOccurrence(missing), /champs du profil/u);
  const extra = syntheticOccurrence();
  extra.locator.media_url = 'https://example.invalid/private.jpg';
  assert.throws(() => prepareOccurrence(extra), /champs du profil/u);
});

test('private, unresolved, unreviewed states cannot be promoted by input', () => {
  for (const [path, value] of [
    ['publication_status', 'public'], ['review_status', 'accepted'], ['reading_status', 'resolved'],
    ['simulation', true], ['scope', 'catalogue'], ['memory_promoted', true],
    ['canonical_closeout', true], ['measured_gain', 12], ['entity_id', 'entity:invented'],
    ['document_id', 'document:invented'], ['act_id', 'act:invented'], ['witness_id', 'witness:invented'],
    ['hand.value', 'invented hand'], ['language.value', 'fr'], ['date.value', '1400'],
    ['alignment.status', 'accepted'], ['alignment.confidence', 'certain'],
    ['locator.target_bbox', { x: 50, y: 100, width: 10, height: 10 }],
    ['transcription.working_reading', 'invented word'], ['transcription.alternatives', ['invented word']]
  ]) {
    const input = syntheticOccurrence();
    set(input, path, value);
    assert.throws(() => prepareOccurrence(input), undefined, path);
  }
});

test('coordinates are safe integers inside both native and observed displays', () => {
  for (const [path, value] of [
    ['locator.context_bbox.x', -1], ['locator.context_bbox.y', 0.5],
    ['locator.context_bbox.width', 0], ['locator.context_bbox.height', 201],
    ['locator.context_bbox.x', 151], ['locator.context_bbox.width', Number.MAX_SAFE_INTEGER + 1],
    ['locator.context_bbox.units', 'percent'], ['locator.context_bbox.reference_frame', 'browser'],
    ['pixel_observation.display_measurement.x', 151], ['pixel_observation.display_measurement.width', 399]
  ]) {
    const input = syntheticOccurrence();
    set(input, path, value);
    assert.throws(() => prepareOccurrence(input), undefined, path);
  }
  const full = syntheticOccurrence();
  full.locator.context_bbox = { x: 0, y: 0, width: 400, height: 300, units: 'pixels', reference_frame: 'original-view' };
  full.pixel_observation.display_measurement = { width: 400, height: 300, x: 0, y: 0, selection_width: 400, selection_height: 300 };
  assert.doesNotThrow(() => prepareOccurrence(full));
  const scaled = syntheticOccurrence();
  scaled.pixel_observation.display_measurement = { width: 200, height: 150, x: 25, y: 50, selection_width: 125, selection_height: 25 };
  assert.doesNotThrow(() => prepareOccurrence(scaled));
});

test('literal injection is escaped; media and attributes cannot take arbitrary URLs', () => {
  const input = syntheticOccurrence();
  const prefix = '2. <img src=x onerror="alert(1)"> & \' 😀 ';
  input.transcription.context_before = prefix;
  input.transcription.context_after = ' <script>alert(2)</script> & " fin';
  input.transcription.context_line = `${prefix}----${input.transcription.context_after}`;
  input.transcription.span.start = Array.from(prefix).length;
  input.transcription.span.end = input.transcription.span.start + 4;
  const html = renderOccurrence(input);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; &amp; &#39; 😀/u);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/u);
  assert.doesNotMatch((html.match(/<[^>]+>/gu) || []).join('\n'), /<script\b|\sonerror=|\sonload=|\sstyle=|<style\b/u);
  assert.doesNotMatch(html, /(?:href|src)="(?:https?:|javascript:|data:)/u);
  for (const [path, value] of [
    ['source.sha256', `${'a'.repeat(64)}" onload="alert(3)`],
    ['occurrence_id', 'occurrence:x" onclick="alert(4)'],
    ['transcription.text_id', '<svg onload=alert(5)>'],
    ['source.approved_review_id', 'not-accepted'],
    ['source.sha256', 'B'.repeat(64)]
  ]) {
    const invalid = syntheticOccurrence();
    set(invalid, path, value);
    assert.throws(() => renderOccurrence(invalid), undefined, path);
  }
});

test('private sidecar fields never cross the display boundary', () => {
  const input = syntheticOccurrence();
  const model = JSON.stringify(prepareOccurrence(input));
  const html = renderOccurrence(input);
  for (const marker of ['PRIVATE-PATH', 'PRIVATE-EVIDENCE', 'INTERNAL-ALIGNMENT', 'INTERNAL-METHOD', 'INTERNAL-VIEWER', 'INTERNAL-MODEL', 'PRIVATE-LIMITATION', 'env:PHD_CORPUS_ROOT', 'relative_path', 'corpus_root_reference', 'evidence_ref']) {
    assert.ok(!html.includes(marker), marker);
    assert.ok(!model.includes(marker), marker);
  }
  assert.match(html, /href="\/css\/archives-occurrence\.css"/u);
  assert.doesNotMatch(html, /<script\b|<style\b|\sstyle=|\son[a-z]+=/iu);
  const css = readFileSync(stylesheetPath, 'utf8');
  assert.match(css, /outline: 3px solid #0d3d25/u);
  assert.match(css, /@media \(max-width: 760px\)/u);
  assert.doesNotMatch(css, /@import|https?:\/\//u);
});

test('CLI emits only HTML to stdout and refuses writing options', () => {
  const tempFile = join(tmpdir(), `archives-occurrence-invented-${randomUUID()}.json`);
  try {
    writeFileSync(tempFile, JSON.stringify(syntheticOccurrence()), 'utf8');
    const valid = spawnSync(process.execPath, [rendererPath, '--input', tempFile], { encoding: 'utf8' });
    assert.equal(valid.status, 0);
    assert.equal(valid.stderr, '');
    assert.match(valid.stdout, /^<!DOCTYPE html>/u);
    const invalid = spawnSync(process.execPath, [rendererPath, '--input', tempFile, '--output', 'forbidden.html'], { encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stdout, '');
    assert.match(invalid.stderr, /^Usage/u);
    writeFileSync(tempFile, '{"private_path":"MUST-NOT-BE-LOGGED",', 'utf8');
    const badJson = spawnSync(process.execPath, [rendererPath, '--input', tempFile], { encoding: 'utf8' });
    assert.equal(badJson.status, 1);
    assert.equal(badJson.stdout, '');
    assert.equal(badJson.stderr.trim(), 'Entrée JSON invalide.');
  } finally {
    unlinkSync(tempFile);
  }
});

test('optional real derivative integration requires an explicit local input variable', { skip: !process.env.ARCHIVES_OCCURRENCE_INPUT }, () => {
  const input = JSON.parse(readFileSync(resolve(process.env.ARCHIVES_OCCURRENCE_INPUT), 'utf8'));
  const model = prepareOccurrence(input);
  const html = renderOccurrence(input);
  assert.equal(input.occurrence_id, 'occurrence:h05-monbezon-photo1-001');
  assert.equal(model.sourceSha256, '9d5a034f86206015b0e0e1f2d857a0ae2875c97a5bab8f401f1de5f665f89e5c');
  assert.equal(model.viewId, 'object:path-d409e2fd87b2f1ae2c423d684945dbfd79ef5d68b7e2e5bbfc0f2cf05692c02f');
  assert.deepEqual(model.span, { start: 133, end: 137 });
  assert.deepEqual(model.contextBox, { x: 648, y: 756, width: 3127, height: 564 });
  assert.deepEqual([model.width, model.height], [3968, 2976]);
  for (const value of [input.source.relative_path, input.source.corpus_root_reference, input.pixel_observation.evidence_ref]) assert.ok(!html.includes(value));
});
