import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..', '..');
const EXPECTED_PROFILE = 'atelier-tuce-reader/0.1.0';
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const assertArray = (value, label) => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
};

const assertString = (value, label) => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value;
};

const indexUnique = (items, key, label) => {
  const index = new Map();
  for (const item of items) {
    const id = assertString(item?.[key], `${label}.${key}`);
    if (index.has(id)) throw new Error(`Duplicate ${label} reference: ${id}`);
    index.set(id, item);
  }
  return index;
};

const resolveReferences = (ids, index, label) => assertArray(ids, label).map((id) => {
  assertString(id, `${label} item`);
  const value = index.get(id);
  if (!value) throw new Error(`Unresolved ${label} reference: ${id}`);
  return value;
});

const candidateSlug = (candidateId) => {
  const slug = candidateId
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) throw new Error(`Candidate ID cannot produce a direct-link slug: ${candidateId}`);
  return slug;
};

const mediaAliases = (mediaItems) => {
  const index = new Map();
  for (const media of mediaItems) {
    const ids = [media.digital_object_id, media.view_id].filter(Boolean);
    for (const id of ids) {
      if (index.has(id) && index.get(id) !== media) throw new Error(`Ambiguous media reference: ${id}`);
      index.set(id, media);
    }
  }
  return index;
};

const normalizeTranslation = (translation) => {
  if (translation == null) return null;
  if (typeof translation === 'string') return { literal: translation, language: 'fr', status: 'unreviewed' };
  if (typeof translation === 'object' && typeof translation.literal === 'string') {
    return {
      literal: translation.literal,
      language: typeof translation.language === 'string' ? translation.language : 'fr',
      status: typeof translation.status === 'string' ? translation.status : 'unreviewed'
    };
  }
  throw new Error('Unsupported translation value.');
};

export function adaptArchiveExport(source, { mediaMode = 'local-preview' } = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Export root must be an object.');
  if (source.export_profile !== EXPECTED_PROFILE) throw new Error(`Unsupported export profile: ${source.export_profile ?? 'missing'}`);
  if (mediaMode !== 'local-preview') throw new Error(`Unsupported media mode: ${mediaMode}`);

  const candidates = assertArray(source.candidates, 'candidates');
  const texts = assertArray(source.texts, 'texts');
  const dates = assertArray(source.dates, 'dates');
  const media = assertArray(source.media, 'media');
  const approvedLinks = assertArray(source.approved_links, 'approved_links');
  const textIndex = indexUnique(texts, 'text_id', 'text');
  const dateIndex = indexUnique(dates, 'date_id', 'date');
  const mediaIndex = mediaAliases(media);
  const candidateIds = new Set();
  const slugs = new Set();

  for (const link of approvedLinks) {
    assertString(link.source_object_id, 'approved_link.source_object_id');
    const targetIds = new Set(assertArray(link.target_object_ids, 'approved_link.target_object_ids'));
    for (const targetId of assertArray(link.applied_target_object_ids, 'approved_link.applied_target_object_ids')) {
      if (!targetIds.has(targetId)) throw new Error(`Applied target is absent from reviewed targets: ${targetId}`);
      const endpoint = mediaIndex.get(targetId);
      if (!endpoint) throw new Error(`Approved link endpoint does not resolve to media: ${targetId}`);
      if (endpoint.media_kind !== 'image' || !endpoint.view_id) throw new Error(`Approved link endpoint is not an image view: ${targetId}`);
    }
  }

  const dossiers = candidates.map((candidate) => {
    const candidateId = assertString(candidate.candidate_id, 'candidate.candidate_id');
    if (candidateIds.has(candidateId)) throw new Error(`Duplicate candidate reference: ${candidateId}`);
    candidateIds.add(candidateId);
    const slug = candidateSlug(candidateId);
    if (slugs.has(slug)) throw new Error(`Candidate slugs collide: ${slug}`);
    slugs.add(slug);

    const candidateTexts = resolveReferences(candidate.text_ids, textIndex, `${candidateId}.text_ids`);
    const candidateDates = resolveReferences(candidate.date_ids, dateIndex, `${candidateId}.date_ids`);
    const declaredViews = resolveReferences(candidate.view_ids, mediaIndex, `${candidateId}.view_ids`);
    const declaredViewIds = new Set();
    for (const view of declaredViews) {
      if (view.media_kind !== 'image' || !view.view_id) throw new Error(`Candidate view is not an image: ${view.digital_object_id}`);
      declaredViewIds.add(view.digital_object_id);
      declaredViewIds.add(view.view_id);
    }

    const acceptedAssociations = [];
    const associationKeys = new Set();
    for (const text of candidateTexts) {
      const matchingLinks = approvedLinks.filter((link) =>
        link.review_status === 'accepted' &&
        link.decision === 'link-after-evidence' &&
        link.source_object_id === text.source_object_id
      );

      for (const link of matchingLinks) {
        for (const targetId of link.applied_target_object_ids) {
          if (!declaredViewIds.has(targetId)) continue;
          const endpoint = mediaIndex.get(targetId);
          const key = `${text.text_id}\u0000${endpoint.view_id}`;
          if (associationKeys.has(key)) continue;
          associationKeys.add(key);
          if (!SHA256_PATTERN.test(endpoint.sha256)) throw new Error(`Invalid SHA-256 for ${endpoint.view_id}`);
          acceptedAssociations.push({
            textId: text.text_id,
            sourceObjectId: text.source_object_id,
            reviewId: link.review_id,
            associationStatus: link.review_status,
            confidence: link.confidence,
            viewId: endpoint.view_id,
            digitalObjectId: endpoint.digital_object_id,
            sha256: endpoint.sha256,
            mediaType: endpoint.media_type || 'application/octet-stream',
            mediaUrl: `/__archive_media/${endpoint.sha256}`,
            rightsStatus: endpoint.rights_status,
            publicationStatus: endpoint.publication_status
          });
        }
      }
    }

    return {
      candidateId,
      slug,
      documentId: candidate.document_id ?? null,
      actId: candidate.act_id ?? null,
      label: assertString(candidate.label, `${candidateId}.label`),
      archivalReference: typeof candidate.archival_reference === 'string' ? candidate.archival_reference : null,
      identificationStatus: assertString(candidate.identification_status, `${candidateId}.identification_status`),
      readingStatus: assertString(candidate.reading_status, `${candidateId}.reading_status`),
      uncertainties: assertArray(candidate.uncertainties, `${candidateId}.uncertainties`).map(String),
      dateClaims: candidateDates.map((date) => ({
        dateId: date.date_id,
        expression: typeof date.expression === 'string' && date.expression ? date.expression : null,
        certainty: typeof date.certainty === 'string' ? date.certainty : 'unknown',
        precision: typeof date.precision === 'string' ? date.precision : 'unknown',
        notes: typeof date.notes === 'string' ? date.notes : null
      })),
      hasDateConflict: candidateDates.length > 1 || candidateDates.some((date) => date.certainty === 'disputed'),
      texts: candidateTexts.map((text) => ({
        textId: text.text_id,
        transcriptionId: text.transcription_id,
        sourceObjectId: text.source_object_id,
        literal: typeof text.literal === 'string' ? text.literal : '',
        language: assertString(text.language, `${text.text_id}.language`),
        revision: assertString(text.revision, `${text.text_id}.revision`),
        extent: typeof text.extent === 'string' ? text.extent : null,
        readingStatus: assertString(text.reading_status, `${text.text_id}.reading_status`),
        translation: normalizeTranslation(text.translation)
      })),
      images: acceptedAssociations
    };
  });

  return {
    schemaVersion: 'archive-reader-view/0.1.0',
    packageId: assertString(source.package_id, 'package_id'),
    mediaMode,
    sourcePublication: {
      status: source.publication?.status ?? 'unknown',
      rightsReview: source.publication?.rights_review ?? 'unknown',
      approvedForPublication: source.publication?.approved_for_publication === true
    },
    dossiers
  };
}

export const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const textWithBreaks = (value) => escapeHtml(value).replace(/\r?\n/g, '<br />');

const statusLabel = (value) => ({
  candidate: 'candidat',
  unreviewed: 'non relu',
  accepted: 'accepté',
  certain: 'certain',
  disputed: 'contesté',
  unknown: 'non établi',
  pending: 'en attente',
  'review-pending': 'revue en attente',
  'blocked-pending-rights': 'bloqué — droits en attente'
}[value] || value.replaceAll('-', ' '));

const renderDates = (dossier) => {
  if (dossier.dateClaims.length === 0) return '<p class="act-cote">Date non renseignée</p>';
  const heading = dossier.hasDateConflict ? '<strong>Dates en conflit ou non départagées</strong>' : '<strong>Date alléguée</strong>';
  const items = dossier.dateClaims.map((date) => {
    const expression = date.expression || 'Expression absente';
    const note = date.notes ? ` — ${escapeHtml(date.notes)}` : '';
    return `<li><span>${escapeHtml(expression)}</span> <small>${escapeHtml(statusLabel(date.certainty))}${note}</small></li>`;
  }).join('');
  return `<div class="date-claims">${heading}<ul>${items}</ul></div>`;
};

const renderTranscription = (dossier) => {
  if (dossier.texts.length === 0) {
    return '<div class="empty-panel"><strong>Transcription absente</strong><p>Aucun texte n’est relié à ce dossier de consultation.</p></div>';
  }
  return dossier.texts.map((text) => `
    <section class="transcription-item" aria-label="Transcription ${escapeHtml(text.textId)}">
      <div class="text-reading" lang="${escapeHtml(text.language)}"><p>${textWithBreaks(text.literal)}</p></div>
      <p class="panel-source">Texte ${escapeHtml(text.textId)} · révision ${escapeHtml(text.revision)} · état ${escapeHtml(statusLabel(text.readingStatus))}${text.extent ? ` · étendue ${escapeHtml(text.extent)}` : ''}</p>
    </section>`).join('');
};

const renderTranslation = (dossier) => {
  const translations = dossier.texts.map((text) => text.translation).filter(Boolean);
  if (translations.length === 0) {
    return '<div class="empty-panel"><strong>Traduction absente</strong><p>Aucune traduction en français moderne n’est fournie dans cet export.</p></div>';
  }
  return translations.map((translation) => `
    <div class="text-reading" lang="${escapeHtml(translation.language)}"><p>${textWithBreaks(translation.literal)}</p></div>
    <p class="panel-source">Traduction proposée · état ${escapeHtml(statusLabel(translation.status))}</p>`).join('');
};

const renderImages = (dossier) => {
  if (dossier.images.length === 0) {
    return '<div class="empty-panel"><strong>Images non reliées</strong><p>Aucun endpoint image accepté ne correspond aux textes et aux vues déclarées de ce dossier.</p></div>';
  }
  return `<div class="archive-gallery">${dossier.images.map((image, index) => `
    <figure class="archive-view">
      <a href="${escapeHtml(image.mediaUrl)}" class="archive-image-link" data-zoom-image="${escapeHtml(image.mediaUrl)}" data-zoom-alt="Vue photographique ${index + 1} reliée au dossier ${escapeHtml(dossier.candidateId)}" data-zoom-caption="Lien image accepté · droits ${escapeHtml(statusLabel(image.rightsStatus))}">
        <img src="${escapeHtml(image.mediaUrl)}" alt="Vue photographique ${index + 1} reliée au dossier ${escapeHtml(dossier.candidateId)}" loading="lazy" />
        <span class="zoom-label">Agrandir</span>
      </a>
      <figcaption><span class="view-type">Vue ${index + 1}</span> Lien ${escapeHtml(statusLabel(image.associationStatus))} · ${escapeHtml(statusLabel(image.confidence))} · publication ${escapeHtml(statusLabel(image.publicationStatus))}</figcaption>
    </figure>`).join('')}</div>`;
};

const renderBottomNavigation = (dossiers, index) => {
  const previous = dossiers[index - 1];
  const next = dossiers[index + 1];
  const previousControl = previous
    ? `<a class="reader-button" href="#${escapeHtml(previous.slug)}" data-act-target="${escapeHtml(previous.slug)}"><span aria-hidden="true">←</span> Dossier précédent</a>`
    : '<span class="reader-button" aria-disabled="true"><span aria-hidden="true">←</span> Premier dossier</span>';
  const nextControl = next
    ? `<a class="reader-button" href="#${escapeHtml(next.slug)}" data-act-target="${escapeHtml(next.slug)}">Dossier suivant <span aria-hidden="true">→</span></a>`
    : '<span class="reader-button" aria-disabled="true">Dernier dossier <span aria-hidden="true">→</span></span>';
  return `<nav class="act-bottom-nav" aria-label="Passer à un autre dossier">${previousControl}${nextControl}</nav>`;
};

const renderDossier = (dossier, index, dossiers) => `
  <article class="archive-act" id="${escapeHtml(dossier.slug)}" tabindex="-1" data-act-index="${index}" aria-labelledby="${escapeHtml(dossier.slug)}-title">
    <header class="act-header">
      <div class="act-sequence" aria-hidden="true">${String(index + 1).padStart(2, '0')} / ${String(dossiers.length).padStart(2, '0')}</div>
      <div class="act-title-block">
        <p class="act-fonds">Dossier de consultation · identité non créée</p>
        <h2 id="${escapeHtml(dossier.slug)}-title">${escapeHtml(dossier.label)}</h2>
        <p class="act-cote">${dossier.archivalReference ? `Référence importée <strong>${escapeHtml(dossier.archivalReference)}</strong>` : 'Référence archivistique non renseignée'}</p>
        ${renderDates(dossier)}
      </div>
      <div class="act-statuses" aria-label="États du dossier">
        <span class="status-badge status-draft">Publication · ${escapeHtml(statusLabel(dossier.images[0]?.publicationStatus || 'review-pending'))}</span>
        <span class="status-badge">Identification · ${escapeHtml(statusLabel(dossier.identificationStatus))}</span>
        <span class="status-badge status-missing">Lecture · ${escapeHtml(statusLabel(dossier.readingStatus))}</span>
        ${dossier.images.length ? '<span class="status-badge">Lien image · accepté</span>' : '<span class="status-badge status-missing">Lien image · absent</span>'}
      </div>
    </header>
    <div class="act-panels">
      <section class="act-panel" aria-labelledby="${escapeHtml(dossier.slug)}-transcription">
        <header class="panel-header"><span class="panel-number">01</span><div><h3 id="${escapeHtml(dossier.slug)}-transcription">Transcription originale</h3><p>Texte importé · état de lecture conservé</p></div></header>
        ${renderTranscription(dossier)}
      </section>
      <section class="act-panel" aria-labelledby="${escapeHtml(dossier.slug)}-translation">
        <header class="panel-header"><span class="panel-number">02</span><div><h3 id="${escapeHtml(dossier.slug)}-translation">Traduction proposée en français moderne</h3><p>Version distincte de la transcription</p></div></header>
        ${renderTranslation(dossier)}
      </section>
      <section class="act-panel images-panel" aria-labelledby="${escapeHtml(dossier.slug)}-images">
        <header class="panel-header"><span class="panel-number">03</span><div><h3 id="${escapeHtml(dossier.slug)}-images">Images associées</h3><p>${dossier.images.length} endpoint${dossier.images.length > 1 ? 's' : ''} accepté${dossier.images.length > 1 ? 's' : ''}</p></div></header>
        ${renderImages(dossier)}
      </section>
    </div>
    ${dossier.uncertainties.length ? `<aside class="uncertainty-note"><strong>Incertitudes importées</strong><ul>${dossier.uncertainties.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></aside>` : ''}
    ${renderBottomNavigation(dossiers, index)}
  </article>`;

export function renderReaderHtml(viewModel, { privatePreview = false } = {}) {
  if (!privatePreview) throw new Error('Reader rendering is restricted to explicit private preview mode.');
  if (viewModel.sourcePublication?.approvedForPublication !== false) {
    throw new Error('This renderer only accepts the pending-rights private-preview profile.');
  }
  if (!Array.isArray(viewModel.dossiers) || viewModel.dossiers.length === 0) throw new Error('At least one consultation dossier is required.');

  const first = viewModel.dossiers[0];
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>Consultation privée des archives</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/css/archives.css" />
</head>
<body class="archives-page">
  <a class="skip-link" href="#archive-reader">Aller au lecteur</a>
  <div class="page">
    <main class="archives-main">
      <header class="archives-header"><div><p class="archives-kicker">Prévisualisation locale · données réelles</p><h1>Consultation</h1></div><p class="archives-intro">Dossiers expérimentaux issus de l’export d’import. Une entrée n’est pas présentée comme un acte identifié lorsque ses IDs canoniques sont absents.</p></header>
      <nav class="reader-actions" aria-label="Autres vues de l’atelier"><a class="reader-button" href="/archives/recherche/">Rechercher dans les fiches</a><a class="reader-button" href="/archives/avancement/">Avancement des travaux</a></nav>
      <aside class="fixture-notice" aria-label="Avertissement de publication"><strong>Privé — droits en attente.</strong><span>Cette sortie sert à la consultation locale. Elle n’est pas autorisée pour la publication.</span></aside>
      <section class="archive-reader" id="archive-reader" aria-labelledby="reader-heading" data-item-singular="Dossier">
        <h2 class="visually-hidden" id="reader-heading">Lecteur horizontal des dossiers</h2>
        <div class="reader-toolbar" aria-label="Navigation entre les dossiers">
          <div class="reader-position"><span class="reader-position-label">Dossier</span><strong id="reader-position-value">1 / ${viewModel.dossiers.length}</strong><span id="reader-current-title">${escapeHtml(first.label)}</span></div>
          <p class="reader-hint">Glissez horizontalement ou utilisez les flèches gauche et droite. Avec une souris : Maj + molette.</p>
          <div class="reader-actions">
            <a class="reader-button" id="reader-prev" href="#${escapeHtml(first.slug)}" aria-disabled="true" tabindex="-1" data-act-target="${escapeHtml(first.slug)}"><span aria-hidden="true">←</span> Précédent</a>
            ${viewModel.dossiers[1] ? `<a class="reader-button" id="reader-next" href="#${escapeHtml(viewModel.dossiers[1].slug)}" data-act-target="${escapeHtml(viewModel.dossiers[1].slug)}">Suivant <span aria-hidden="true">→</span></a>` : `<a class="reader-button" id="reader-next" href="#${escapeHtml(first.slug)}" aria-disabled="true" tabindex="-1"><span>Suivant</span></a>`}
          </div>
        </div>
        <p class="visually-hidden" id="reader-announcement" role="status" aria-live="polite" aria-atomic="true"></p>
        <div class="acts-viewport" id="acts-viewport" tabindex="0" aria-label="Dossiers de consultation sur une piste horizontale"><div class="acts-track">${viewModel.dossiers.map(renderDossier).join('')}</div></div>
      </section>
    </main>
    <footer class="footer"><span class="footer-text">Prévisualisation privée · paquet ${escapeHtml(viewModel.packageId)}</span><span class="footer-text">Aucune publication autorisée</span></footer>
  </div>
  <dialog class="image-dialog" id="image-dialog" aria-labelledby="image-dialog-caption"><form method="dialog" class="dialog-toolbar"><button class="dialog-close" value="close">Fermer <span aria-hidden="true">×</span></button></form><div class="dialog-media"><img id="image-dialog-img" alt="" /></div><p id="image-dialog-caption"></p></dialog>
  <script src="/js/archives-reader.js" defer></script>
</body>
</html>`;

  if (/(?:[A-Za-z]:[\\/]|\\\\[^<\s]+)/.test(html)) throw new Error('A local source path would leak into rendered HTML.');
  return html;
}

export function buildMediaManifest(viewModel) {
  const bySha = new Map();
  for (const dossier of viewModel.dossiers) {
    for (const image of dossier.images) {
      if (!SHA256_PATTERN.test(image.sha256)) throw new Error(`Invalid manifest SHA-256: ${image.sha256}`);
      const current = bySha.get(image.sha256);
      const item = {
        sha256: image.sha256,
        url: image.mediaUrl,
        mediaType: image.mediaType,
        viewId: image.viewId
      };
      if (current && JSON.stringify(current) !== JSON.stringify(item)) throw new Error(`Conflicting media metadata for SHA-256: ${image.sha256}`);
      bySha.set(image.sha256, item);
    }
  }
  return {
    schemaVersion: 'archive-reader-media-selection/0.1.0',
    mode: 'local-preview',
    allowedSha256: [...bySha.keys()].sort(),
    items: [...bySha.values()].sort((a, b) => a.sha256.localeCompare(b.sha256))
  };
}

export function assertPrivateIgnoredOutput(outputPath, repositoryRoot = REPOSITORY_ROOT) {
  const absoluteOutput = resolve(outputPath);
  const relativeOutput = relative(repositoryRoot, absoluteOutput);
  if (!relativeOutput || relativeOutput.startsWith('..') || isAbsolute(relativeOutput)) {
    throw new Error('Private preview output must stay inside the repository checkout.');
  }

  let existingAncestor = absoluteOutput;
  while (!existsSync(existingAncestor)) {
    const parent = dirname(existingAncestor);
    if (parent === existingAncestor) throw new Error('Private preview output has no resolvable parent directory.');
    existingAncestor = parent;
  }
  const physicalRepositoryRoot = realpathSync(repositoryRoot);
  const physicalOutput = resolve(realpathSync(existingAncestor), relative(existingAncestor, absoluteOutput));
  const physicalRelativeOutput = relative(physicalRepositoryRoot, physicalOutput);
  if (!physicalRelativeOutput || physicalRelativeOutput.startsWith('..') || isAbsolute(physicalRelativeOutput)) {
    throw new Error('Private preview output resolves outside the repository checkout.');
  }

  for (const ignoredPath of new Set([relativeOutput, physicalRelativeOutput])) {
    const check = spawnSync('git', ['check-ignore', '--quiet', '--no-index', ignoredPath], {
      cwd: physicalRepositoryRoot,
      windowsHide: true
    });
    if (check.status !== 0) throw new Error(`Private preview output is not ignored by Git: ${ignoredPath}`);
  }
  return physicalOutput;
}

export function writePrivatePreview({ inputPath, outputPath, mediaMode = 'local-preview', privatePreview = false }) {
  if (!privatePreview) throw new Error('The --private-preview flag is required.');
  const absoluteOutput = assertPrivateIgnoredOutput(outputPath);
  const source = JSON.parse(readFileSync(resolve(inputPath), 'utf8'));
  const viewModel = adaptArchiveExport(source, { mediaMode });
  const html = renderReaderHtml(viewModel, { privatePreview: true });
  const manifest = buildMediaManifest(viewModel);
  mkdirSync(absoluteOutput, { recursive: true });
  const htmlPath = resolve(absoluteOutput, 'index.html');
  const manifestPath = resolve(absoluteOutput, 'reader-media-selection.json');
  writeFileSync(htmlPath, `${html}\n`, 'utf8');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { htmlPath, manifestPath, dossiers: viewModel.dossiers.length, images: manifest.items.length };
}

const usage = () => [
  'Usage:',
  '  node scripts/archives/render-reader.mjs --input <export-candidate.json> --output <ignored-directory> --media-mode local-preview --private-preview',
  '',
  'The output directory must be inside this checkout and ignored by Git.'
].join('\n');

const parseArguments = (argumentsList) => {
  const options = {};
  const optionNames = {
    '--input': 'inputPath',
    '--output': 'outputPath',
    '--media-mode': 'mediaMode'
  };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--private-preview') {
      options.privatePreview = true;
      continue;
    }
    if (!optionNames[argument]) throw new Error(`Unknown argument: ${argument}`);
    const value = argumentsList[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
    options[optionNames[argument]] = value;
    index += 1;
  }
  if (!options.inputPath || !options.outputPath || !options.mediaMode) throw new Error(usage());
  return options;
};

const main = () => {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = writePrivatePreview(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
