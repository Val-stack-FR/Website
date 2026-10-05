import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bindOccurrenceMedia } from './reader-media-release.mjs';

export const OCCURRENCE_PROFILE = 'h05-real-occurrence/0.1.0';
const SHA256 = /^[a-f0-9]{64}$/;
const OBJECT_ID = /^object:path-[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9-]*:[A-Za-z0-9._:-]+$/;

const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};

const object = (value, keys, label) => {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} doit être un objet unique.`);
  ensure(Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), `${label} ne respecte pas les champs du profil.`);
  return value;
};

const literal = (value, label, max = 16000) => {
  ensure(typeof value === 'string' && value.length > 0 && value.length <= max, `${label} doit être un texte borné non vide.`);
  ensure(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value), `${label} contient un caractère de contrôle interdit.`);
  ensure(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value), `${label} contient un point de code Unicode invalide.`);
  return value;
};

const identifier = (value, label, pattern = ID) => {
  literal(value, label, 200);
  ensure(pattern.test(value), `${label} est invalide.`);
  return value;
};

const integer = (value, label, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  ensure(Number.isSafeInteger(value) && value >= min && value <= max, `${label} doit être un entier dans les limites.`);
  return value;
};

const literalList = (value, label) => {
  ensure(Array.isArray(value) && value.length > 0 && value.length <= 16, `${label} doit être une liste bornée de textes.`);
  value.forEach(item => literal(item, label));
};

export const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

// This adapter accepts the private H05 derivative only. It does not inspect media,
// validate historical readings, infer an orientation or promote research records.
export function prepareOccurrence(input) {
  object(input, ['schema_version', 'occurrence_id', 'scope', 'simulation', 'publication_status', 'review_status', 'reading_status', 'source', 'transcription', 'locator', 'alignment', 'pixel_observation', 'author', 'hand', 'language', 'date', 'entity_id', 'memory_promoted', 'measured_gain', 'canonical_closeout', 'limitations', 'document_id', 'act_id', 'witness_id'], 'occurrence');
  ensure(input.schema_version === OCCURRENCE_PROFILE, 'Profil H05 non pris en charge.');
  identifier(input.occurrence_id, 'occurrence_id', /^occurrence:[A-Za-z0-9._:-]+$/);
  ensure(input.scope === 'corpus' && input.simulation === false, 'Une seule observation de corpus est attendue.');
  ensure(input.publication_status === 'private' && input.review_status === 'unreviewed' && input.reading_status === 'unresolved', 'L’occurrence doit rester privée, non relue et non résolue.');
  ensure(input.memory_promoted === false && input.canonical_closeout === false && input.measured_gain === null, 'Toute promotion, clôture ou mesure de gain est refusée.');
  for (const key of ['entity_id', 'document_id', 'act_id', 'witness_id']) ensure(input[key] === null, 'Toute identification nouvelle est refusée.');
  for (const key of ['hand', 'language', 'date']) {
    const state = object(input[key], ['value', 'certainty', 'basis'], key);
    ensure(state.value === null && state.certainty === 'unknown', 'Une assertion de main, langue ou date est refusée.');
    literal(state.basis, `${key}.basis`);
  }
  literalList(input.limitations, 'limitations');

  const source = object(input.source, ['digital_object_id', 'view_id', 'relative_path', 'sha256', 'byte_size', 'width', 'height', 'corpus_root_reference', 'approved_review_id'], 'source');
  identifier(source.digital_object_id, 'source.digital_object_id', OBJECT_ID);
  ensure(source.view_id === source.digital_object_id, 'La vue doit désigner exactement l’objet image déclaré.');
  identifier(source.sha256, 'source.sha256', SHA256);
  identifier(source.approved_review_id, 'source.approved_review_id', /^review:[a-f0-9]{64}$/);
  integer(source.byte_size, 'source.byte_size', 1);
  integer(source.width, 'source.width', 1, 100000);
  integer(source.height, 'source.height', 1, 100000);
  // Required upstream provenance is validated but is never returned or rendered.
  literal(source.relative_path, 'source.relative_path');
  ensure(source.corpus_root_reference === 'env:PHD_CORPUS_ROOT', 'La référence de racine du profil est invalide.');

  const transcript = object(input.transcription, ['source_object_id', 'source_sha256', 'text_id', 'text_revision', 'profile_sha256', 'span', 'observed_text', 'context_line', 'context_before', 'context_after', 'working_reading', 'alternatives', 'alternatives_note'], 'transcription');
  identifier(transcript.source_object_id, 'transcription.source_object_id', OBJECT_ID);
  ensure(transcript.source_object_id !== source.digital_object_id, 'La source texte doit être distincte de l’image.');
  identifier(transcript.source_sha256, 'transcription.source_sha256', SHA256);
  identifier(transcript.text_revision, 'transcription.text_revision', SHA256);
  identifier(transcript.profile_sha256, 'transcription.profile_sha256', SHA256);
  identifier(transcript.text_id, 'transcription.text_id', /^text:[A-Za-z0-9._:-]+$/);
  ensure(transcript.text_revision === transcript.source_sha256, 'La révision doit être l’empreinte de la source texte importée.');
  const span = object(transcript.span, ['start', 'end', 'units'], 'transcription.span');
  integer(span.start, 'transcription.span.start');
  integer(span.end, 'transcription.span.end', 1);
  ensure(span.units === 'unicode-codepoints-half-open-r0', 'Les positions doivent utiliser les points de code Unicode et une borne de fin exclue.');
  ensure(transcript.observed_text === '----' && span.end - span.start === Array.from(transcript.observed_text).length, 'La sélection doit désigner les quatre tirets de la lacune.');
  literal(transcript.context_before, 'transcription.context_before');
  literal(transcript.context_after, 'transcription.context_after');
  literal(transcript.context_line, 'transcription.context_line');
  ensure(Array.from(transcript.context_before).length <= span.start, 'Le contexte précédent dépasse la position absolue de la sélection.');
  const lineBefore = transcript.context_before.split(/\r\n|\r|\n/u).at(-1);
  const lineAfter = transcript.context_after.split(/\r\n|\r|\n/u)[0];
  ensure(transcript.context_line === `${lineBefore}${transcript.observed_text}${lineAfter}`, 'La ligne de contexte ne correspond pas à la sélection littérale.');
  ensure(transcript.working_reading === '[lacune non resolue]' && Array.isArray(transcript.alternatives) && transcript.alternatives.length === 0, 'Toute lecture conjecturée ou alternative lexicale est refusée.');
  literal(transcript.alternatives_note, 'transcription.alternatives_note');

  const locator = object(input.locator, ['view_id', 'context_bbox', 'target_bbox'], 'locator');
  ensure(locator.view_id === source.view_id, 'Le repère doit référencer la même vue que la source.');
  ensure(locator.target_bbox === null, 'Un rectangle de mot exact est refusé dans ce MVP.');
  const box = object(locator.context_bbox, ['x', 'y', 'width', 'height', 'units', 'reference_frame'], 'locator.context_bbox');
  integer(box.x, 'locator.context_bbox.x');
  integer(box.y, 'locator.context_bbox.y');
  integer(box.width, 'locator.context_bbox.width', 1);
  integer(box.height, 'locator.context_bbox.height', 1);
  ensure(box.units === 'pixels' && box.reference_frame === 'original-view', 'Le repère de contexte doit utiliser les pixels de la vue originale.');
  ensure(box.x <= source.width - box.width && box.y <= source.height - box.height, 'Le rectangle de contexte sort de la vue originale.');

  const alignment = object(input.alignment, ['status', 'confidence', 'line_context_matches', 'basis'], 'alignment');
  ensure(alignment.status === 'candidate' && alignment.confidence === 'possible', 'L’alignement doit rester candidat et possible.');
  literalList(alignment.line_context_matches, 'alignment.line_context_matches');
  literal(alignment.basis, 'alignment.basis');

  const pixel = object(input.pixel_observation, ['tool', 'detail', 'completed', 'observed_at', 'native_width', 'native_height', 'display_measurement', 'measurement_method', 'viewer_resize_notice', 'evidence_ref'], 'pixel_observation');
  ensure(pixel.tool === 'view_image' && pixel.detail === 'original' && pixel.completed === true, 'Une observation originale terminée est requise.');
  ensure(pixel.native_width === source.width && pixel.native_height === source.height, 'Les dimensions observées et déclarées doivent coïncider.');
  literal(pixel.observed_at, 'pixel_observation.observed_at', 100);
  ensure(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(pixel.observed_at) && Number.isFinite(Date.parse(pixel.observed_at)), 'La date d’observation est invalide.');
  const display = object(pixel.display_measurement, ['width', 'height', 'x', 'y', 'selection_width', 'selection_height'], 'pixel_observation.display_measurement');
  for (const key of ['width', 'height', 'selection_width', 'selection_height']) integer(display[key], `display_measurement.${key}`, 1, 100000);
  for (const key of ['x', 'y']) integer(display[key], `display_measurement.${key}`);
  ensure(display.x <= display.width - display.selection_width && display.y <= display.height - display.selection_height, 'Le relevé dépasse l’affichage observé.');
  const left = Math.floor(display.x * source.width / display.width);
  const top = Math.floor(display.y * source.height / display.height);
  const right = Math.ceil((display.x + display.selection_width) * source.width / display.width);
  const bottom = Math.ceil((display.y + display.selection_height) * source.height / display.height);
  ensure(box.x === left && box.y === top && box.width === right - left && box.height === bottom - top, 'Le contexte doit correspondre au relevé conservateur déclaré.');
  for (const key of ['measurement_method', 'viewer_resize_notice', 'evidence_ref']) literal(pixel[key], `pixel_observation.${key}`);

  const author = object(input.author, ['kind', 'agent_id', 'provider', 'model', 'method_version'], 'author');
  ensure(author.kind === 'ai' && author.method_version === OCCURRENCE_PROFILE, 'L’auteur et sa méthode ne respectent pas le profil H05.');
  identifier(author.agent_id, 'author.agent_id');
  literal(author.provider, 'author.provider');
  literal(author.model, 'author.model');

  // Only explicit display fields cross this boundary. No raw object is embedded.
  return {
    occurrenceId: input.occurrence_id,
    sourceId: source.digital_object_id,
    viewId: source.view_id,
    sourceSha256: source.sha256,
    width: source.width,
    height: source.height,
    mediaUrl: `/__archive_media/${source.sha256}`,
    textId: transcript.text_id,
    textSourceId: transcript.source_object_id,
    textRevision: transcript.text_revision,
    span: { start: span.start, end: span.end },
    before: transcript.context_before,
    observedText: transcript.observed_text,
    after: transcript.context_after,
    contextBox: { x: box.x, y: box.y, width: box.width, height: box.height }
  };
}

const detail = (label, value) => `<div><dt>${escapeHtml(label)}</dt><dd><code>${escapeHtml(value)}</code></dd></div>`;

export function renderOccurrence(input, { mediaRelease=null }={}) {
  const originalModel = prepareOccurrence(input);
  const model = mediaRelease ? bindOccurrenceMedia(originalModel,mediaRelease) : originalModel;
  const box = model.contextBox;
  const media = escapeHtml(model.mediaUrl);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>Une lacune à relire — consultation privée</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/css/archives-occurrence.css" />
</head>
<body class="occurrence-page">
  <a class="occurrence-skip" href="#occurrence">Aller à la lacune</a>
  <div class="page">
    <main class="occurrence-main" id="occurrence" tabindex="-1">
      <header class="occurrence-hero">
        <p class="occurrence-kicker">Consultation privée · une occurrence</p>
        <h1>Une lacune à relire</h1>
        <p>Comparer le contexte littéral d’une transcription avec la même vue photographique.</p>
      </header>
      <aside class="occurrence-notice" aria-label="État de la lecture">
        <strong>Mot exact non aligné · lacune non résolue</strong>
        <p>La fenêtre indique un contexte candidat, de confiance possible. Aucun rectangle de mot ni aucune lecture alternative ne sont proposés. Cette observation reste non relue, privée et sans confirmation humaine.</p>
      </aside>
      <div class="occurrence-comparison">
        <section class="occurrence-panel" aria-labelledby="occurrence-text-title">
          <p class="occurrence-kicker">Texte importé</p>
          <h2 id="occurrence-text-title">Contexte littéral</h2>
          <p id="occurrence-span">La lacune à revoir est surlignée dans le texte importé.</p>
          <pre class="occurrence-transcript" aria-describedby="occurrence-span"><code>${escapeHtml(model.before)}<mark class="occurrence-gap" aria-label="Lacune sélectionnée, quatre tirets">${escapeHtml(model.observedText)}</mark>${escapeHtml(model.after)}</code></pre>
          <p class="occurrence-note">Les autres tirets et les retours à la ligne restent littéraux. Le surlignage repère la sélection dans le texte ; il ne confirme pas son emplacement dans l’image.</p>
        </section>
        <section class="occurrence-panel" aria-labelledby="occurrence-context-title">
          <p class="occurrence-kicker">Image · même source</p>
          <h2 id="occurrence-context-title">Fenêtre de contexte proposée</h2>
          <p id="occurrence-orientation"><strong>Cadrage à vérifier.</strong> L’orientation EXIF et l’affichage du navigateur n’ont pas encore été conciliés. Le repère de pixels déclaré ne constitue donc pas un alignement validé à l’écran.</p>
          <figure class="occurrence-context">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" role="img" aria-labelledby="occurrence-svg-title occurrence-svg-desc" aria-describedby="occurrence-orientation" preserveAspectRatio="xMidYMid meet">
              <title id="occurrence-svg-title">Fenêtre proposée dans la même vue complète</title>
              <desc id="occurrence-svg-desc">Contexte candidat uniquement ; mot exact non aligné. Le cadrage dépend de l’orientation du navigateur encore à vérifier.</desc>
              <image href="${media}" x="0" y="0" width="${model.width}" height="${model.height}" preserveAspectRatio="xMinYMin meet" />
            </svg>
            <figcaption>Contexte proposé dans la photo complète. L’emplacement précis du mot reste à établir.</figcaption>
          </figure>
        </section>
      </div>
      <section class="occurrence-panel occurrence-full" aria-labelledby="occurrence-full-title">
        <div class="occurrence-full-header"><div><p class="occurrence-kicker">Image complète</p><h2 id="occurrence-full-title">Vue source entière</h2></div><a class="occurrence-image-link" href="${media}">Ouvrir la même image complète</a></div>
        <figure>
          <img src="${media}" width="${model.width}" height="${model.height}" alt="Vue photographique complète utilisée pour le contexte candidat ; aucun mot exact n’est délimité." loading="lazy" decoding="async" />
          <figcaption>La fenêtre de contexte et cette vue utilisent la même photo. Son orientation à l’écran reste à vérifier.</figcaption>
        </figure>
      </section>
      <details class="occurrence-details">
        <summary>Révision, identifiants et limites</summary>
        <dl>
          ${detail('Occurrence', model.occurrenceId)}
          ${detail('Objet image et vue', model.viewId)}
          ${detail('SHA-256 de l’image', model.sourceSha256)}
          ${model.derivativeSha256 ? detail('SHA-256 du dérivé affiché',model.derivativeSha256)+detail('Objet numérique du dérivé',model.derivativeObjectId)+detail('Repère technique du dérivé',model.referenceFrame+' · sans rotation') : ''}
          ${detail('Texte', model.textId)}
          ${detail('Source du texte', model.textSourceId)}
          ${detail('Révision du texte · SHA-256', model.textRevision)}
          ${detail('Positions dans le texte', `[${model.span.start}, ${model.span.end}) · points de code Unicode à partir de zéro, borne de fin exclue`)}
          ${detail('Dimensions natives de l’image', `${model.width} × ${model.height} pixels`)}
          ${detail('Rectangle de contexte', `x ${box.x}, y ${box.y}, largeur ${box.width}, hauteur ${box.height} pixels · vue originale`)}
          ${detail('Profil privé', OCCURRENCE_PROFILE)}
          ${detail('Alignement / confiance', 'candidate / possible')}
          ${detail('Lecture / revue / diffusion', 'unresolved / unreviewed / private')}
          ${detail('Rectangle du mot / alternatives', 'null / []')}
        </dl>
        <p>La fenêtre utilise un cadrage SVG de la source complète ; aucun fichier recadré n’est créé. Aucune identification, date, main, langue ou lecture historique nouvelle n’est établie. Aucun enregistrement n’est promu en mémoire officielle. L’intention de rendre les travaux publics est acquise ; les crédits et bases de réutilisation de cet objet restent à documenter. La clôture du dossier technique reste incomplète.</p>
      </details>
    </main>
    <footer class="footer occurrence-footer"><span>Prévisualisation privée · une lacune non confirmée</span></footer>
  </div>
</body>
</html>`;
}

function main() {
  try {
    let values;
    try {
      const args = parseArgs({ args: process.argv.slice(2), strict: true, allowPositionals: false, options: { input: { type: 'string' } } });
      values = args.values;
    } catch {
      throw new Error('Usage : node render-occurrence.mjs --input <occurrence.json>');
    }
    ensure(values.input, 'Usage : node render-occurrence.mjs --input <occurrence.json>');
    let raw;
    try { raw = readFileSync(resolve(values.input), 'utf8'); }
    catch { throw new Error('Impossible de lire le dérivé JSON demandé.'); }
    const input = JSON.parse(raw);
    process.stdout.write(`${renderOccurrence(input)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof SyntaxError ? 'Entrée JSON invalide.' : error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
