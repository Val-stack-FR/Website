import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';
import { decorateOtherHumanScreens } from './human-other-screens.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ARCHIVES = join(ROOT, '.private/archives-integration/publication-package-20261004-v14/site/dist/archives');
const paths = {
  m2: join(ARCHIVES, 'recherche/index.html'),
  map: join(ARCHIVES, 'cartes/extrait/index.html'),
};
const pins = {
  m2: { sha256: '1a08b887c4e3f5f166bf916aaa71e2b3fc0f2fb3769542984e244675d264b9c2', bytes: 93635 },
  map: { sha256: '3031f8aeae6699baf2c38040a0568182bda5c428b610e581c02dcb25af2df9dd', bytes: 7276 },
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readUtf8 = async (path) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(await readFile(path));
const samples = { m2: await readUtf8(paths.m2), map: await readUtf8(paths.map) };
const textOf = (html) => html
  .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, ' ')
  .replace(/<([a-z][\w:-]*)\b(?=[^>]*\bhidden(?:\s|=|>))[^>]*>[\s\S]*?<\/\1\s*>/giu, ' ')
  .replace(/<[^>]*>/gu, ' ')
  .replace(/&amp;/giu, '&').replace(/&nbsp;/giu, ' ')
  .replace(/&#39;|&apos;/giu, "'").replace(/&quot;/giu, '"')
  .replace(/\s+/gu, ' ').trim();
const blocks = (html, tag) => [...html.matchAll(new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '\\s*>', 'giu'))].map((m) => m[0]);
const dataAttributes = (html) => [...html.matchAll(/\bdata-[a-z0-9:_-]+\s*=\s*(?:"[^"]*"|'[^']*')/giu)].map((m) => m[0]).sort();
const provenanceLists = (html) => [...html.matchAll(/<dl\b[^>]*class=["'][^"']*\bannex-provenance\b[^"']*["'][^>]*>[\s\S]*?<\/dl>/giu)].map((m) => m[0]);
const divRows = (dl) => [...dl.matchAll(/<div\b[^>]*>[\s\S]*?<\/div>/giu)].map((m) => m[0]);
const dtDd = (row) => ({
  dt: row.match(/<dt\b[^>]*>([\s\S]*?)<\/dt>/iu)?.[1]?.replace(/<[^>]*>/gu, '').trim(),
  dd: row.match(/<dd\b[^>]*>([\s\S]*?)<\/dd>/iu)?.[1]?.replace(/<[^>]*>/gu, '').trim(),
});
const hasHidden = (row) => /^<div\b[^>]*\bhidden(?:\s|=|>)/iu.test(row);

test('M2 hides only technical provenance rows and package IDs while preserving the Name query hooks', async () => {
  const raw = await readFile(paths.m2);
  assert.equal(raw.length, pins.m2.bytes);
  assert.equal(digest(raw), pins.m2.sha256);

  const output = decorateOtherHumanScreens(samples.m2, '/archives/recherche/?query=Tucé');
  assert.notEqual(output, samples.m2);
  assert.equal(provenanceLists(output).length, 101);
  assert.equal(provenanceLists(samples.m2).length, 101);
  const outputRows = provenanceLists(output).flatMap(divRows);
  const inputRows = provenanceLists(samples.m2).flatMap(divRows);
  assert.equal(outputRows.length, inputRows.length);
  let hiddenTechnicalRows = 0;
  let hiddenNameHooks = 0;
  for (const row of outputRows) {
    const { dt, dd } = dtDd(row);
    if (['Table', 'Fiche candidate', 'Enregistrement', 'SHA-256 source'].includes(dt)) {
      assert.ok(hasHidden(row), `${dt} row must be hidden`);
      hiddenTechnicalRows += 1;
    }
    if (dt === 'Champ' && dd === 'Nom') {
      assert.ok(hasHidden(row), 'Champ/Nom stays in the DOM, hidden for people and available to the existing search-link script');
      hiddenNameHooks += 1;
    }
  }
  assert.equal(hiddenTechnicalRows, 404);
  assert.equal(hiddenNameHooks, 10);
  const queryPairs = outputRows.filter((row) => dtDd(row).dt === 'Champ' && dtDd(row).dd === 'Nom');
  assert.equal(queryPairs.length, 10, 'all ten exact Champ/Nom hooks remain in place');
  assert.ok(output.includes('person_heading') === false);
  assert.ok(output.includes('display_name') === false);
  assert.ok(output.includes('name_variants') === false);
  assert.match(output, /<dd>Intitulé de la fiche<\/dd>/u);
  assert.match(output, /<dd>Nom d’index<\/dd>/u);
  assert.match(output, /<dd>Variantes du nom<\/dd>/u);

  const visible = textOf(output);
  for (const technical of ['SHA-256 source', 'corpus/annexes/annexes-tables/fiches-individus.csv', 'corpus/people/people.csv', 'Paquets distincts package:atelier-', 'Enregistrement 28', 'Fiche candidate 28']) {
    assert.equal(visible.includes(technical), false, technical + ' is not human-visible');
  }
  for (const human of ['Baudouin de Tucé', 'Beaudouin 1er de Tucé', 'Guillaume de Tucé', 'Bilard : 58', 'Archives Dép. Sarthe', 'RHAM']) {
    assert.ok(visible.includes(human), human + ' remains visible');
  }
  assert.match(output, /<span class="footer-text" hidden>Paquets distincts package:atelier-/u);
  assert.deepEqual(blocks(output, 'h2'), blocks(samples.m2, 'h2'));
  assert.deepEqual(blocks(output, 'a'), blocks(samples.m2, 'a'));
  for (const tag of ['pre', 'q', 'blockquote']) assert.deepEqual(blocks(output, tag), blocks(samples.m2, tag));
  assert.deepEqual(dataAttributes(output), dataAttributes(samples.m2), 'pre-existing data attributes remain byte-identical');
  assert.equal(decorateOtherHumanScreens(output, '/archives/recherche/'), output, 'M2 projection is idempotent');
});

test('map moves technical proof/render details to inert tagged templates and keeps simple limits visible', async () => {
  const raw = await readFile(paths.map);
  assert.equal(raw.length, pins.map.bytes);
  assert.equal(digest(raw), pins.map.sha256);

  const output = decorateOtherHumanScreens(samples.map, '/archives/cartes/extrait/');
  assert.notEqual(output, samples.map);
  const visible = textOf(output);
  for (const technical of ['772ece56fdd2fcf5471184aa257c88131079148d17c8742a497eb271c3b515bd', '576 dpi', '1 920 × 1 640 pixels', 'CRS et transformation géographique nuls']) {
    assert.equal(visible.includes(technical), false, technical + ' is not human-visible');
  }
  for (const human of ['Origine et limites de la carte', 'L’original n’est pas inclus dans ce paquet.', 'Les droits sur ces fichiers ne sont pas connus.', 'La référence n’est pas confirmée', 'l’arbitrage des couleurs reste en attente', 'Aucun sens historique ou géographique n’est attribué']) {
    assert.ok(visible.includes(human), human + ' remains visible');
  }
  assert.match(output, /<template data-human-meta="cartography-source-proof"><p class="hash">Original source identifié dans la preuve fermée : SHA-256 772ece56fdd2fcf5471184aa257c88131079148d17c8742a497eb271c3b515bd\. Aucun original n’est inclus dans ce paquet\.<\/p><\/template>/u);
  assert.match(output, /<template data-human-meta="cartography-render-metadata"><p>Rendu 1 920 × 1 640 pixels à 576 dpi\. Les fichiers inclus sont des dérivés privés ; droits inconnus\. CRS et transformation géographique nuls\.<\/p><\/template>/u);
  assert.match(output, /<p id="hq-hash" class="hash" hidden><\/p>/u);
  assert.match(output, /<p id="status" class="hash"><\/p>/u);
  assert.deepEqual(blocks(output, 'a'), blocks(samples.map, 'a'));
  for (const tag of ['pre', 'q', 'blockquote']) assert.deepEqual(blocks(output, tag), blocks(samples.map, tag));
  assert.deepEqual(dataAttributes(output).filter((item) => !item.startsWith('data-human-meta=')), dataAttributes(samples.map));
  assert.equal(decorateOtherHumanScreens(output, '/archives/cartes/extrait/'), output, 'map projection is idempotent');
});

test('leaves unrelated routes and historical-looking text unchanged', () => {
  const counterfactual = '<main><blockquote>La copie historique mentionne SHA-256 ' + 'a'.repeat(64) + ' et corpus/people/people.csv ; package:atelier-' + 'b'.repeat(32) + ' est cité dans le registre.</blockquote></main>';
  assert.equal(decorateOtherHumanScreens(samples.m2, '/archives/autre/'), samples.m2);
  assert.equal(decorateOtherHumanScreens(samples.map, '/archives/'), samples.map);
  const onM2Route = decorateOtherHumanScreens(counterfactual, '/archives/recherche/');
  assert.equal(onM2Route, counterfactual, 'quoted historical-looking text is not globally rewritten');
  const onMapRoute = decorateOtherHumanScreens(counterfactual, '/archives/cartes/extrait/');
  assert.equal(onMapRoute, counterfactual, 'unmatched map structure remains unchanged');
  assert.equal(decorateOtherHumanScreens(counterfactual, new URL('https://example.invalid/elsewhere/')), counterfactual);
});
