import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';
import { decorateCatalogueHierarchyAsset, decorateHumanSourcePage } from './human-source-pages.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SNAPSHOT = join(REPO_ROOT, '.private/archives-integration/publication-package-20261004-v13-r2/site/dist/archives');
const HIERARCHY_ASSET = join(REPO_ROOT, '.private/archives-integration/publication-package-20261004-v14/site/dist/assets/archives-hierarchy.js');
const digest = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const readUtf8 = async (path) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readFile(path));
const tagBlocks = (html, tag) => [...html.matchAll(new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '\\s*>', 'giu'))].map((match) => match[0]);
const count = (html, needle) => html.split(needle).length - 1;
const cleanLabel = (markup) => markup.replace(/<[^>]*>/gu, '').replace(/&eacute;/giu, 'é').replace(/&egrave;/giu, 'è').replace(/&amp;/giu, '&').trim();
const pairBlocks = (html) => [...html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>[\s\S]*?<\/dd>/giu)];
const pairsForLabel = (html, regex) => pairBlocks(html)
  .filter((match) => regex.test(cleanLabel(match[1])))
  .map((match) => match[0]);
const hasDtLabel = (html, regex) => [...html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>/giu)]
  .some((match) => regex.test(cleanLabel(match[1])));
const firstArticle = (html) => {
  const start = html.search(/<article\b[^>]*class=["'][^"']*\blexical-card\b[^"']*["'][^>]*>/iu);
  if (start < 0) return '';
  const end = html.indexOf('</article>', start);
  return end < 0 ? '' : html.slice(start, end + '</article>'.length);
};

const samplePaths = {
  source: join(SNAPSHOT, 'textes/fichier/0d180353f37a9c5dd9036bf49a93e3e94e47116f589acd1edfecb6749dbbd5fd/index.html'),
  catalogue: join(SNAPSHOT, 'catalogue/index.html'),
  repere: join(SNAPSHOT, 'reperes/index.html'),
};
const samples = {
  source: await readUtf8(samplePaths.source),
  catalogue: await readUtf8(samplePaths.catalogue),
  repere: await readUtf8(samplePaths.repere),
};
const hierarchyAsset = await readUtf8(HIERARCHY_ASSET);

test('cleans one source-detail page while preserving transcription, reading status, rights, citation and data', async () => {
  const input = samples.source;
  const inputDigest = await digest(samplePaths.source);
  const output = decorateHumanSourcePage(input);
  assert.notEqual(output, input);
  assert.equal(hasDtLabel(output, /^SHA-256/i), false);
  assert.equal(hasDtLabel(output, /^Objet numérique/i), false);
  assert.equal(hasDtLabel(output, /^Occurrence textuelle/i), false);
  assert.equal(hasDtLabel(output, /^Taille source$/i), false);
  assert.equal(hasDtLabel(output, /^Encodage$/i), false);
  assert.equal(hasDtLabel(output, /^Provenance de l’encodage$/i), false);
  for (const label of [/^Transcription$/i, /^État de lecture$/i, /^Droits$/i]) {
    assert.deepEqual(pairsForLabel(output, label), pairsForLabel(input, label), label + ' pair remains byte-identical');
  }
  assert.deepEqual(tagBlocks(output, 'h1'), tagBlocks(input, 'h1'), 'human title remains unchanged');
  const pathParagraphs = (html) => tagBlocks(html, 'p').filter((block) => block.includes('class="catalogue-path"'));
  assert.deepEqual(pathParagraphs(output), pathParagraphs(input), 'human file citation remains unchanged');
  for (const tag of ['pre', 'q', 'blockquote', 'a']) {
    assert.deepEqual(tagBlocks(output, tag), tagBlocks(input, tag), tag + ' blocks remain byte-identical');
  }
  assert.deepEqual(
    [...input.matchAll(/\bdata-[a-z0-9:_-]+\s*=\s*(?:"[^"]*"|'[^']*')/giu)].map((m) => m[0]),
    [...output.matchAll(/\bdata-[a-z0-9:_-]+\s*=\s*(?:"[^"]*"|'[^']*')/giu)].map((m) => m[0]),
    'data attributes remain byte-identical',
  );
  assert.equal(await digest(samplePaths.source), inputDigest, 'source fixture was not modified');
});

test('removes the catalogue provenance block while retaining all human catalogue cards and links', () => {
  const input = samples.catalogue;
  const output = decorateHumanSourcePage(input);
  assert.notEqual(output, input);
  assert.equal(hasDtLabel(output, /^SHA-256/i), false);
  assert.equal(/<details\b[^>]*class=["'][^"']*\bcatalogue-provenance\b[^"']*["']/iu.test(output), false);
  assert.equal(count(output, 'class="catalogue-card"'), count(input, 'class="catalogue-card"'));
  assert.deepEqual(tagBlocks(output, 'article'), tagBlocks(input, 'article'), 'catalogue cards remain byte-identical');
  assert.deepEqual(tagBlocks(output, 'a'), tagBlocks(input, 'a'), 'catalogue links remain byte-identical');
});

test('removes repère offsets and technical references but preserves file labels and exact quotations', () => {
  const input = samples.repere;
  const output = decorateHumanSourcePage(input);
  const inputCard = firstArticle(input);
  const outputCard = firstArticle(output);
  assert.ok(inputCard && outputCard);
  assert.equal(hasDtLabel(outputCard, /^Empreinte du fichier source$/i), false);
  assert.equal(hasDtLabel(outputCard, /^Référence de la proposition$/i), false);
  assert.equal(hasDtLabel(outputCard, /^Emplacement dans le texte$/i), false);
  assert.deepEqual(pairsForLabel(outputCard, /^Fichier$/i), pairsForLabel(inputCard, /^Fichier$/i), 'human file/cote field remains exact');
  for (const tag of ['blockquote', 'pre', 'q', 'a']) {
    assert.deepEqual(tagBlocks(output, tag), tagBlocks(input, tag), tag + ' blocks remain byte-identical');
  }
  assert.equal(count(output, 'class="lexical-card"'), count(input, 'class="lexical-card"'));
});

test('keeps human text containing a historical SHA while removing only technical metadata pairs', () => {
  const historicalSha = 'a'.repeat(64);
  const objectId = 'object:path-' + 'b'.repeat(64);
  const input = [
    '<!doctype html><html><head></head><body>',
    '<main class="catalogue-main"><h1>' + objectId + '</h1>',
    '<p data-source-object="' + objectId + '" data-sha="' + historicalSha + '">Citation</p>',
    '<a href="/archives/textes/fichier/example/">Lien source conservé</a>',
    '<blockquote>La transcription historique contient SHA ' + historicalSha + '.</blockquote>',
    '<pre>⟦mot ?⟧ et chaîne ancienne ' + historicalSha + '</pre>',
    '<q>extrait ' + historicalSha + '</q>',
    '<details class="catalogue-provenance"><summary>Provenance</summary><dl>',
    '<dt>Objet numérique</dt><dd>' + objectId + '</dd>',
    '<dt>SHA-256 source</dt><dd>' + historicalSha + '</dd>',
    '<dt>Transcription</dt><dd>Corps historique ' + historicalSha + '</dd>',
    '<dt>Date</dt><dd>15 septembre</dd>',
    '<dt>État de lecture</dt><dd>À relire</dd>',
    '</dl></details>',
    '<script type="application/json">{"source":"' + objectId + '","historical":"' + historicalSha + '"}</script>',
    '</main></body></html>',
  ].join('');
  const output = decorateHumanSourcePage(input);
  assert.match(output, /Document à identifier/u);
  assert.equal(output.includes('<dt>Objet numérique</dt>'), false);
  assert.equal(output.includes('<dt>SHA-256 source</dt>'), false);
  assert.equal(output.includes('<dt>Transcription</dt><dd>Corps historique ' + historicalSha + '</dd>'), true);
  assert.equal(output.includes('<dt>Date</dt><dd>15 septembre</dd>'), true);
  assert.equal(output.includes('<dt>État de lecture</dt><dd>À relire</dd>'), true);
  assert.equal(output.includes('<a href="/archives/textes/fichier/example/">Lien source conservé</a>'), true);
  assert.equal(output.includes('<blockquote>La transcription historique contient SHA ' + historicalSha + '.</blockquote>'), true);
  assert.equal(output.includes('<pre>⟦mot ?⟧ et chaîne ancienne ' + historicalSha + '</pre>'), true);
  assert.equal(output.includes('<q>extrait ' + historicalSha + '</q>'), true);
  assert.equal(output.includes('data-source-object="' + objectId + '" data-sha="' + historicalSha + '"'), true);
  assert.equal(output.includes('<script type="application/json">{"source":"' + objectId + '","historical":"' + historicalSha + '"}</script>'), true);
  assert.equal(decorateHumanSourcePage(output), output, 'the projection is idempotent');
});

test('returns JSON, non-HTML and unrelated HTML unchanged', () => {
  const json = '{"source":"object:path-example","hash":"' + 'c'.repeat(64) + '"}';
  const plain = 'object:path-example ' + 'd'.repeat(64);
  const unrelated = '<!doctype html><html><body><main><p>Historical ' + 'e'.repeat(64) + '</p></main></body></html>';
  assert.equal(decorateHumanSourcePage(json), json);
  assert.equal(decorateHumanSourcePage(plain), plain);
  assert.equal(decorateHumanSourcePage(unrelated), unrelated);
  assert.equal(decorateHumanSourcePage(null), null);
});

test('projects only hierarchy metadata rows and the consultation label while preserving query-renderer code', async () => {
  const inputDigest = await digest(HIERARCHY_ASSET);
  assert.equal(inputDigest, 'e91717eb271a9e27dbd6ef24d6a83d22a26640287874eb610c73caf0860e54db');
  assert.equal(Buffer.byteLength(hierarchyAsset, 'utf8'), 7673);

  const before = "[['Fichier', record.fileName.literal], ['Chemin dans le classement', record.logicalPath], ['Objet numérique', record.digitalObjectId], ['Taille', count(record.sizeBytes) + ' octets'], ['Texte associé', record.transcription.status === 'none' ? 'Aucune transcription liée' : 'Texte préexistant à revoir'], ['Origine de la métadonnée', record.provenance.discovery_source]]";
  const after = "[['Fichier', record.fileName.literal], ['Chemin dans le classement', record.logicalPath], ['Texte associé', record.transcription.status === 'none' ? 'Aucune transcription liée' : 'Texte préexistant à revoir']]";
  const output = decorateCatalogueHierarchyAsset(hierarchyAsset);
  const expected = hierarchyAsset
    .replace(before, after)
    .replace("node('a', 'catalogue-reader-link', 'Ouvrir dans le lecteur privé')", "node('a', 'catalogue-reader-link', 'Consulter la photographie')");
  assert.equal(output, expected, 'only the visible details field list and consultation link label change');
  for (const label of ['Objet numérique', 'Taille', 'Origine de la métadonnée']) assert.equal(output.includes(label), false);
  for (const preserved of [
    "['Fichier', record.fileName.literal]",
    "['Chemin dans le classement', record.logicalPath]",
    "['Texte associé', record.transcription.status === 'none' ? 'Aucune transcription liée' : 'Texte préexistant à revoir']",
    "node('a', 'catalogue-reader-link', 'Consulter la photographie')",
    'if (record.consultation.available)',
    'link.href = record.consultation.href',
    'fetch(\'/__catalogue_hierarchy?\' + parameters()',
    'results.replaceChildren(...data.entries.map(card))',
    'state.page = action === \'first\' ? 1',
  ]) assert.ok(output.includes(preserved), preserved + ' remains in asset');
  assert.equal(decorateCatalogueHierarchyAsset(output), output, 'repeated build projection is a no-op');
  assert.throws(() => decorateCatalogueHierarchyAsset(output + output), /expected one exact details field list/u);
  assert.equal(await digest(HIERARCHY_ASSET), inputDigest, 'pinned source asset was not modified');
});
