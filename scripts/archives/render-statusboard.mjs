import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { adaptArchiveExport } from './render-reader.mjs';
import { prepareAnnexSearch } from './render-annex-search.mjs';

const MAX_ITEMS = 7;

const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};

const text = (value, label) => {
  ensure(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string.`);
  return value;
};

export const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const sourceLabelContainsTuce = label => label
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr')
  .includes('tuce');

const statusLabel = value => ({
  accepted: 'accepté',
  candidate: 'candidat',
  certain: 'certain',
  partial: 'partiel',
  pending: 'en attente',
  'review-pending': 'revue en attente',
  'blocked-pending-rights': 'bloqué — droits en attente',
  unreviewed: 'non relu',
  unresolved: 'non résolue',
  unknown: 'inconnu'
}[value] || String(value).replaceAll('-', ' '));

const uniqueBy = (items, key, label) => {
  const index = new Map();
  for (const item of items) {
    const id = text(item?.[key], `${label}.${key}`);
    ensure(!index.has(id), `Duplicate ${label}: ${id}`);
    index.set(id, item);
  }
  return index;
};

const priorityFor = label => sourceLabelContainsTuce(label)
  ? {
      level: 'prioritaire',
      reason: 'Le libellé source contient « Tucé » ; cette unité relève du périmètre Tucé déclaré prioritaire.'
    }
  : {
      level: 'ordinaire',
      reason: 'Unité conservée dans le lot borné ; aucun marqueur de priorité supplémentaire n’est fourni par la source.'
    };

const dossierNextAction = dossier => {
  const normalized = dossier.label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('monbezon')) {
    return 'Relire la transcription partielle contre les deux vues acceptées, consigner les lacunes, puis préparer une traduction distincte.';
  }
  if (normalized.includes('tuce')) {
    return 'Identifier puis faire revoir un endpoint image avant tout lien, départager les dates sur pièces et relire la transcription partielle.';
  }
  return 'Relire les textes et vérifier uniquement les liens image explicitement revus avant toute autre étape.';
};

const dossierBlockers = (dossier, rawCandidate, publication) => {
  const blockers = [];
  if (dossier.texts.length === 0) blockers.push('Transcription absente.');
  else if (dossier.texts.some(item => String(item.extent).toLowerCase() === 'partial')) blockers.push('Transcription partielle.');
  if (dossier.texts.length > 0 && dossier.texts.every(item => item.translation == null)) blockers.push('Traduction absente.');
  if (dossier.images.length === 0) {
    blockers.push((rawCandidate.view_ids || []).length === 0
      ? 'Aucune vue déclarée et aucun lien image accepté.'
      : 'Aucun lien image accepté pour les vues déclarées.');
  }
  if (dossier.readingStatus === 'unreviewed') blockers.push('Lecture non relue.');
  if (dossier.hasDateConflict) blockers.push('Dates concurrentes non départagées.');
  if (publication.approvedForPublication === false) blockers.push('Diffusion bloquée en attente de droits.');
  return blockers;
};

const sourceProvenanceForFiche = card => {
  const provenance = card.date?.provenance || card.citations[0]?.provenance;
  ensure(provenance, `Fiche ${card.number} has no provenance.`);
  return {
    table: provenance.table,
    record: provenance.recordNumber,
    field: provenance.field,
    sha256: provenance.sha256
  };
};

export function prepareStatusboard(readerExport, annexIndex) {
  const reader = adaptArchiveExport(readerExport, { mediaMode: 'local-preview' });
  const annex = prepareAnnexSearch(annexIndex);
  ensure(reader.dossiers.length === 2, 'Statusboard requires exactly two consultation dossiers.');
  ensure(annex.cards.length === 5, 'Statusboard requires exactly five editorial fiches.');
  ensure(reader.dossiers.length + annex.cards.length <= MAX_ITEMS, 'Statusboard is limited to seven entries.');
  ensure(reader.sourcePublication.approvedForPublication === false, 'Reader export must remain private and non-publishable.');
  ensure(annexIndex.publication?.approved_for_publication === false, 'Annex index must remain private and non-publishable.');

  const rawCandidates = uniqueBy(readerExport.candidates, 'candidate_id', 'candidate');
  const rawFiches = uniqueBy(annexIndex.fiches, 'fiche_id', 'fiche');

  const dossiers = reader.dossiers.map(dossier => {
    const raw = rawCandidates.get(dossier.candidateId);
    const blockers = dossierBlockers(dossier, raw, reader.sourcePublication);
    const textState = dossier.texts.length === 0
      ? 'Absente'
      : `${dossier.texts.length} transcription${dossier.texts.length > 1 ? 's' : ''} · ${dossier.texts.some(item => String(item.extent).toLowerCase() === 'partial') ? 'partielle' : 'étendue non qualifiée'} · ${statusLabel(dossier.readingStatus)}`;
    const translationState = dossier.texts.some(item => item.translation != null)
      ? 'Présente dans l’export'
      : 'Absente de l’export';
    const imageState = dossier.images.length
      ? `${dossier.images.length} lien${dossier.images.length > 1 ? 's' : ''} image accepté${dossier.images.length > 1 ? 's' : ''}`
      : 'Aucun lien image accepté';

    return {
      key: `dossier:${dossier.candidateId}`,
      unitType: 'Dossier de consultation',
      label: dossier.label,
      sourceId: dossier.candidateId,
      archivalReference: dossier.archivalReference || 'Référence non renseignée',
      status: blockers.length ? 'Action requise' : 'Prêt pour revue',
      priority: priorityFor(dossier.label),
      responsible: 'À attribuer',
      textState,
      translationState,
      imageState,
      identificationState: statusLabel(dossier.identificationStatus),
      publicationState: statusLabel(reader.sourcePublication.status),
      blockers,
      nextAction: dossierNextAction(dossier),
      uncertainties: dossier.uncertainties,
      dates: dossier.dateClaims.map(date => `${date.expression || 'Expression absente'} · ${statusLabel(date.certainty)}`),
      provenance: null
    };
  });

  const fiches = annex.cards.map(card => {
    const raw = rawFiches.get(card.id);
    const provenance = sourceProvenanceForFiche(card);
    const blockers = [
      'Identification non résolue.',
      'Lecture éditoriale non relue.',
      'Citations primaires non vérifiées.',
      ...(card.missingFields.length ? [`${card.missingFields.length} champ${card.missingFields.length > 1 ? 's' : ''} marqué${card.missingFields.length > 1 ? 's' : ''} absent${card.missingFields.length > 1 ? 's' : ''}.`] : []),
      ...(card.ambiguities.length ? ['Homonymie non résolue ; aucune fusion d’identité.'] : []),
      'Droits inconnus et diffusion en attente de revue.'
    ];
    return {
      key: `fiche:${card.id}`,
      unitType: 'Fiche éditoriale',
      label: card.label,
      sourceId: card.id,
      archivalReference: `Fiche ${card.number} · ${card.heading}`,
      status: 'À vérifier',
      priority: priorityFor(card.label),
      responsible: 'À attribuer',
      textState: 'Non applicable · cette fiche n’est pas un acte transcrit',
      translationState: 'Non applicable · aucune transcription d’acte',
      imageState: 'Non applicable · aucun original ou pixel lu',
      identificationState: statusLabel(card.identityStatus),
      publicationState: statusLabel(annexIndex.publication.status),
      blockers,
      nextAction: 'Relire la fiche et vérifier ses citations primaires, en gardant ses expressions distinctes des actes et des identités historiques.',
      uncertainties: [raw.candidate_basis, ...card.ambiguities.map(item => item.note)].filter(Boolean),
      dates: [`${card.date.expression} · ${statusLabel(card.date.certainty || 'unknown')}`],
      provenance
    };
  });

  return {
    packages: { reader: reader.packageId, annex: annex.packageId },
    dossiers,
    fiches,
    totalEntries: dossiers.length + fiches.length,
    publicationNotice: 'Prévisualisation privée : droits, lectures et identifications restent en attente.'
  };
}

const renderState = (label, value, modifier = '') => `<div class="statusboard-state${modifier ? ` statusboard-state--${modifier}` : ''}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;

const renderProvenance = provenance => provenance ? `<dl class="statusboard-provenance">
  <div><dt>Table source</dt><dd><code>${escapeHtml(provenance.table)}</code></dd></div>
  <div><dt>Enregistrement</dt><dd>${escapeHtml(provenance.record)}</dd></div>
  <div><dt>Champ daté</dt><dd>${escapeHtml(provenance.field)}</dd></div>
  <div><dt>SHA-256 source</dt><dd><code>${escapeHtml(provenance.sha256)}</code></dd></div>
</dl>` : '';

const renderEntry = entry => `<article class="statusboard-card" data-statusboard-entry data-unit-type="${escapeHtml(entry.unitType)}" aria-labelledby="${escapeHtml(entry.key)}-title">
  <header class="statusboard-card-header">
    <div><p class="statusboard-unit">${escapeHtml(entry.unitType)}</p><h3 id="${escapeHtml(entry.key)}-title">${escapeHtml(entry.label)}</h3><p class="statusboard-reference">${escapeHtml(entry.archivalReference)}</p></div>
    <span class="statusboard-priority statusboard-priority--${escapeHtml(entry.priority.level)}">${escapeHtml(entry.priority.level)}</span>
  </header>
  <p class="statusboard-priority-reason"><strong>Priorité motivée :</strong> ${escapeHtml(entry.priority.reason)}</p>
  <dl class="statusboard-meta">
    ${renderState('Statut', entry.status, 'status')}
    ${renderState('Responsable', entry.responsible, 'owner')}
    ${renderState('Texte', entry.textState)}
    ${renderState('Traduction', entry.translationState)}
    ${renderState('Images', entry.imageState)}
    ${renderState('Identification', entry.identificationState)}
    ${renderState('Diffusion', entry.publicationState)}
  </dl>
  <div class="statusboard-work">
    <section><h4>Blocages précis</h4><ul>${entry.blockers.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>
    <section><h4>Prochaine action</h4><p>${escapeHtml(entry.nextAction)}</p></section>
  </div>
  ${entry.dates.length ? `<p class="statusboard-dates"><strong>Date source :</strong> ${entry.dates.map(escapeHtml).join(' · ')}</p>` : ''}
  ${entry.uncertainties.length ? `<details class="statusboard-uncertainties"><summary>Incertitudes conservées</summary><ul>${entry.uncertainties.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></details>` : ''}
  <p class="statusboard-source"><strong>Identifiant source :</strong> <code>${escapeHtml(entry.sourceId)}</code></p>
  ${renderProvenance(entry.provenance)}
</article>`;

export function renderStatusboard(readerExport, annexIndex) {
  const model = prepareStatusboard(readerExport, annexIndex);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>État des unités d’archives — lot borné</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/css/archives-statusboard.css" />
</head>
<body class="statusboard-page">
  <a class="skip-link" href="#statusboard">Aller au tableau d’état</a>
  <div class="page">
    <main class="statusboard-main" id="statusboard">
      <header class="statusboard-hero">
        <div><p class="statusboard-kicker">Consultation privée · lot borné</p><h1>État des unités</h1></div>
        <p>Deux dossiers de consultation et cinq fiches éditoriales, présentés comme des unités distinctes. Cette vue ne mesure ni le fonds entier ni l’avancement d’une équipe.</p>
        <nav aria-label="Consultations liées"><a href="/archives/">Lecteur d’archives</a><a href="/archives/recherche/">Recherche dans cinq fiches</a></nav>
      </header>
      <aside class="statusboard-notice" aria-label="Limites de publication"><strong>${escapeHtml(model.publicationNotice)}</strong><span>Aucun pourcentage global ou d’agent n’est calculé.</span></aside>
      <section class="statusboard-section" aria-labelledby="statusboard-dossiers">
        <header><p>2 unités</p><h2 id="statusboard-dossiers">Dossiers de consultation</h2><p>Textes, traductions et images sont suivis séparément.</p></header>
        <div class="statusboard-grid">${model.dossiers.map(renderEntry).join('')}</div>
      </section>
      <section class="statusboard-section" aria-labelledby="statusboard-fiches">
        <header><p>5 unités</p><h2 id="statusboard-fiches">Fiches éditoriales</h2><p>Références de travail non assimilées à des actes transcrits, à des personnes identifiées ou à des originaux vérifiés.</p></header>
        <div class="statusboard-grid">${model.fiches.map(renderEntry).join('')}</div>
      </section>
    </main>
    <footer class="footer"><span class="footer-text">Prévisualisation privée · 7 unités maximum</span><span class="footer-text">Paquets ${escapeHtml(model.packages.reader)} · ${escapeHtml(model.packages.annex)}</span></footer>
  </div>
</body>
</html>`;
}

function main() {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      strict: true,
      options: {
        reader: { type: 'string' },
        annex: { type: 'string' }
      }
    });
    ensure(positionals.length === 0 && values.reader && values.annex,
      'Usage: node render-statusboard.mjs --reader <export-candidate.json> --annex <query-index.json>');
    const readerExport = JSON.parse(readFileSync(resolve(values.reader), 'utf8'));
    const annexIndex = JSON.parse(readFileSync(resolve(values.annex), 'utf8'));
    process.stdout.write(`${renderStatusboard(readerExport, annexIndex)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
