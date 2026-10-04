import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const campaign = resolve('../PHD-Maine-paleography-harness/data/private/transcription-campaign');
const author = resolve(campaign, 'e99-p09-reading-20261004-v1');
const independent = resolve(campaign, 'e99-p09-independent-20261004-v1');
const out = resolve('.private/archives-integration/p09-pilot-admission-20261004-v1');
try { await lstat(out); throw new Error('Admission output exists.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const entries = {
  author_freeze: [author, 'freeze-author.json'],
  author_validation: [author, 'validation-reading.json'],
  author_r0: [author, 'transcription.r0.txt', '54bfbd5c2e9889829b70444d6ce1671114424e217681cbf8bcdff6b6e93bef01'],
  author_r1: [author, 'transcription.r1.txt', '004f052c7e1cb8fd7740f49e592d72b8096bc48a8192026d07cc9f8dc56f9fe9'],
  modern: [author, 'modern-fr.r1.txt', '1f64889c697055a2ce41e863bc323d1736e15b5930ea4af3c86142e9a381b5dc'],
  author_region: [author, 'roi.json', '8d3811b979f06f731a386ff34993c894d9fe11f7f90ad60754a44b4017cf78c1'],
  independent_reading: [independent, 'independent-reading-frozen-r0.json', '15e3ac0475e36469e94a3c50598e78d4de540df3ec25b53ac018a9e7d742c38c'],
  independent_freeze: [independent, 'independent-freeze-receipt.json', '66be02208c7d5eab046115c882f49728bfc0ffe9772b4af6732303398332cf9c'],
  independent_validation: [independent, 'independent-package-validation.json'],
};
const pins = {}, data = {};
for (const [key, [dir, name, expected]] of Object.entries(entries)) {
  const path = resolve(dir, name), bytes = await readFile(path), digest = sha(bytes);
  if (expected && expected !== digest) throw new Error('Pilot source drift: ' + key);
  pins[key] = { path, sha256: digest, size_bytes: bytes.length };
  data[key] = name.endsWith('.json') ? JSON.parse(bytes) : bytes.toString('utf8');
}
if (!data.author_validation.passed || !data.independent_validation.passed || data.independent_validation.lines !== 6 || data.author_freeze.line_count !== 6 || data.author_freeze.independent_comparison_read_before_freeze || data.independent_freeze.author_output_opened_before_freeze || data.author_region.roi_sha256 !== data.independent_freeze.crop_sha256 || data.author_region.derivative_sha256 !== data.independent_reading.derived_sha256) throw new Error('Six-line independent pilot conditions missing.');
const comparison = [
  { line: 1, common: 'Noble et puissante dame Madame', open: 'Initiale, prénom, suite nominale et toponyme divergent; Beatrix/Bertrix et Katherine restent des propositions concurrentes.', treatment: 'Aucune personne identifiée; r1 est une variante auteur, pas une lecture arbitrée.' },
  { line: 2, common: 'enfans mineurs; foy et hommage simple', open: 'Possessifs, articles, termes du milieu et fin de ligne ne sont pas tous concordants.', treatment: 'Conserver les lacunes/alternatives; aucune relation familiale ou tenure résolue.' },
  { line: 3, common: 'dont je suis; foy et hommage simple', open: 'Groupes nominaux, aveu/entrée et groupe deffunt/en vie diffèrent.', treatment: 'Type canonique d’acte et personnes restent inconnus.' },
  { line: 4, common: 'choses suis; candidat Souille', open: 'Petit lieu/nommé et capitale/provousté/paroisse divergent.', treatment: 'Souille reste une chaîne proposée; aucune géographie ou seigneurie créée.' },
  { line: 5, common: 'terre/labourable; ung; ou environ', open: 'Journal et pièces sont plus développés chez l’auteur; pas confirmés par la lecture indépendante.', treatment: 'Pas de quantité surfacique normalisée, de propriété ou d’intervalle daté.' },
  { line: 6, common: 'par lequel; plusieurs lacunes de clause', open: 'Lieu, derrainement, hoirs et fin de clause ne sont pas tranchés.', treatment: 'Aucune restitution par vraisemblance; pas de septième ligne transcrite.' },
];
const receipt = {
  format: 'p09-six-line-root-admission/1', created_at_utc: new Date().toISOString(),
  decision: 'GO for a clearly labelled working pilot and extension of the same selected view; lexical variants remain unresolved.',
  pilot_protocol_passed: true, root_visual_comparison_performed: true,
  independent_freeze_preceded_author_exposure: true, pins, comparison,
  reader_pilot_authorized: true,
  reader_text_choice: 'author_r1 + its modern version, displayed as an uncertain author draft; r0 and independent reading retained separately.',
  reader_detailed_comparison_pending: true,
  same_view_body_extension_authorized: true,
  other_views_or_originals_authorized: false,
  extension_source_object_id: data.author_region.source_object_id,
  extension_derivative_sha256: data.author_region.derivative_sha256,
  extension_rules: [
    'New full-view run; six-line pilot files remain immutable.',
    'Retain competing names, quantities and clauses; no automatic consensus or historical identification.',
    'Number physical body lines; distinguish any separately read marginal annotation from the act body.',
    'Preserve full-view diplomatic and French working versions, gaps, source region and versioned changes.',
    'Complete all accessible body text on this one view; additional views need separate media qualification.',
  ],
  historical_reading_confirmed: false, human_review: 'pending',
  accuracy_score: null, CER: null, memory_events: 0,
  manuscript_pixels_changed: false, canonical_identity_or_date_resolved: false,
  public_deployment_executed: false,
};
await mkdir(out);
const bytes = Buffer.from(JSON.stringify(receipt, null, 2) + '\n');
const path = resolve(out, 'admission.json');
await writeFile(path, bytes, { flag: 'wx' });
console.log(JSON.stringify({ path, sha256: sha(bytes), pilot_protocol_passed: true, same_view_body_extension_authorized: true }));
