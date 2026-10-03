import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const PROFILE = 'atelier-tuce-annex-query/0.1.0';
const ALLOWED_SCOPES = ['name', 'variant', 'title', 'place', 'holding', 'jurisdiction'];
const SHA256 = /^[a-f0-9]{64}$/;

const SCOPE_LABELS = {
  name: 'Noms de la fiche',
  variant: 'Variantes d’index',
  title: 'Qualificatifs',
  place: 'Lieux',
  holding: 'Seigneuries',
  jurisdiction: 'Juridictions'
};

const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};

const array = (value, label) => {
  ensure(Array.isArray(value), `${label} must be an array.`);
  return value;
};

const textValue = (value, label) => {
  ensure(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string.`);
  return value;
};

const uniqueIndex = (items, key, label) => {
  const result = new Map();
  for (const item of items) {
    const id = textValue(item?.[key], `${label}.${key}`);
    ensure(!result.has(id), `Duplicate ${label} reference: ${id}`);
    result.set(id, item);
  }
  return result;
};

const requireReference = (index, id, label) => {
  const value = index.get(textValue(id, label));
  ensure(value, `Unresolved ${label}: ${id}`);
  return value;
};

export const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export const normalizeSearchText = value => String(value ?? '')
  .normalize('NFD')
  .replace(/\p{M}+/gu, '')
  .toLocaleLowerCase('fr')
  .replace(/\s+/g, ' ')
  .trim();

const provenanceFrom = (locator, source, ficheNumber) => ({
  table: textValue(locator.table, `${locator.evidence_locator_id}.table`),
  ficheNumber,
  recordNumber: locator.record_number,
  field: textValue(locator.field, `${locator.evidence_locator_id}.field`),
  sha256: textValue(source.sha256, `${source.digital_object_id}.sha256`)
});

export function prepareAnnexSearch(index) {
  ensure(index && typeof index === 'object' && !Array.isArray(index), 'Index root must be an object.');
  ensure(index.index_profile === PROFILE, `Unsupported index profile: ${index.index_profile ?? 'missing'}`);
  ensure(index.access_tier === 'project' && index.publication?.approved_for_publication === false,
    'This renderer accepts only the private, non-publishable project index.');

  const scopes = array(index.scopes, 'scopes');
  ensure(scopes.length === ALLOWED_SCOPES.length
    && ALLOWED_SCOPES.every(scope => scopes.includes(scope))
    && new Set(scopes).size === scopes.length,
  'The annex search scopes must be exactly name, variant, title, place, holding and jurisdiction.');

  const fiches = array(index.fiches, 'fiches');
  ensure(fiches.length > 0 && fiches.length <= 5, 'The private annex search is bounded to one to five fiches.');
  const entries = array(index.entries, 'entries');
  ensure(entries.filter(entry => entry?.scope === 'name').length <= 10,
    'The private annex search is bounded to ten fiche name mentions.');

  const ficheIndex = uniqueIndex(fiches, 'fiche_id', 'fiche');
  const dateIndex = uniqueIndex(array(index.dates, 'dates'), 'date_id', 'date');
  uniqueIndex(entries, 'entry_id', 'entry');
  const locatorIndex = uniqueIndex(array(index.locators, 'locators'), 'evidence_locator_id', 'locator');
  const sourceIndex = uniqueIndex(array(index.sources, 'sources'), 'digital_object_id', 'source');

  for (const source of sourceIndex.values()) {
    ensure(SHA256.test(source.sha256), `Invalid source SHA-256: ${source.digital_object_id}`);
  }
  for (const locator of locatorIndex.values()) {
    requireReference(sourceIndex, locator.digital_object_id, `${locator.evidence_locator_id}.digital_object_id`);
    ensure(Number.isSafeInteger(locator.record_number) && locator.record_number > 0,
      `Invalid locator record number: ${locator.evidence_locator_id}`);
  }

  for (const entry of entries) {
    ensure(ALLOWED_SCOPES.includes(entry.scope), `Unsupported entry scope: ${entry.scope}`);
    textValue(entry.literal, `${entry.entry_id}.literal`);
    requireReference(locatorIndex, entry.evidence_locator_id, `${entry.entry_id}.evidence_locator_id`);
    if (entry.date_id != null) requireReference(dateIndex, entry.date_id, `${entry.entry_id}.date_id`);
    if (entry.scope === 'variant') {
      ensure(entry.fiche_id == null && entry.source_occurrence_in_fiche === false,
        `Variant must remain index-only: ${entry.entry_id}`);
      const candidates = array(entry.candidate_fiche_ids, `${entry.entry_id}.candidate_fiche_ids`);
      ensure(candidates.length > 0, `Variant has no candidate fiche: ${entry.entry_id}`);
      for (const ficheId of candidates) requireReference(ficheIndex, ficheId, `${entry.entry_id}.candidate_fiche_ids`);
    } else {
      const fiche = requireReference(ficheIndex, entry.fiche_id, `${entry.entry_id}.fiche_id`);
      if (entry.date_id != null) {
        ensure(entry.date_id === fiche.date_id, `Entry date does not belong to its fiche: ${entry.entry_id}`);
      }
      if (entry.claim_id != null) {
        ensure(array(fiche.claim_ids, `${fiche.fiche_id}.claim_ids`).includes(entry.claim_id),
          `Entry claim does not belong to its fiche: ${entry.entry_id}`);
      }
      if (entry.name_mention_id != null) {
        ensure(array(fiche.name_mention_ids, `${fiche.fiche_id}.name_mention_ids`).includes(entry.name_mention_id),
          `Entry name mention does not belong to its fiche: ${entry.entry_id}`);
      }
    }
  }

  const nameMentionIds = new Set();
  const ficheNumbers = new Set();
  for (const fiche of fiches) {
    textValue(fiche.fiche_n, `${fiche.fiche_id}.fiche_n`);
    ensure(/^[1-9][0-9]*$/.test(fiche.fiche_n) && !ficheNumbers.has(fiche.fiche_n),
      `Fiche number must be a unique positive integer: ${fiche.fiche_n}`);
    ficheNumbers.add(fiche.fiche_n);
    textValue(fiche.label, `${fiche.fiche_id}.label`);
    textValue(fiche.person_heading, `${fiche.fiche_id}.person_heading`);
    requireReference(dateIndex, fiche.date_id, `${fiche.fiche_id}.date_id`);
    ensure(fiche.identity_status === 'unresolved' && fiche.review_status === 'unreviewed',
      `Fiche status must remain unresolved and unreviewed: ${fiche.fiche_id}`);
    for (const claimId of array(fiche.claim_ids, `${fiche.fiche_id}.claim_ids`)) {
      textValue(claimId, `${fiche.fiche_id}.claim_ids item`);
    }
    for (const mentionId of array(fiche.name_mention_ids, `${fiche.fiche_id}.name_mention_ids`)) {
      ensure(!nameMentionIds.has(mentionId), `Duplicate fiche name mention reference: ${mentionId}`);
      nameMentionIds.add(mentionId);
      ensure(entries.some(entry => entry.name_mention_id === mentionId && entry.fiche_id === fiche.fiche_id),
        `Unresolved fiche name mention reference: ${mentionId}`);
    }
    for (const missing of array(fiche.missing_fields, `${fiche.fiche_id}.missing_fields`)) {
      requireReference(locatorIndex, missing.evidence_locator_id, `${fiche.fiche_id}.missing_fields.evidence_locator_id`);
      textValue(missing.field, `${fiche.fiche_id}.missing_fields.field`);
    }
    for (const citation of array(fiche.source_citations, `${fiche.fiche_id}.source_citations`)) {
      requireReference(locatorIndex, citation.evidence_locator_id, `${fiche.fiche_id}.source_citations.evidence_locator_id`);
      textValue(citation.field, `${fiche.fiche_id}.source_citations.field`);
      textValue(citation.literal, `${fiche.fiche_id}.source_citations.literal`);
    }
  }
  ensure(nameMentionIds.size <= 10, 'The private annex search is bounded to ten referenced name mentions.');

  const ambiguityByFiche = new Map(fiches.map(fiche => [fiche.fiche_id, []]));
  for (const ambiguity of array(index.ambiguities, 'ambiguities')) {
    ensure(ambiguity.merged === false, `Merged identities are outside this renderer: ${ambiguity.ambiguity_id}`);
    for (const ficheId of array(ambiguity.fiche_ids, `${ambiguity.ambiguity_id}.fiche_ids`)) {
      requireReference(ficheIndex, ficheId, `${ambiguity.ambiguity_id}.fiche_ids`);
      ambiguityByFiche.get(ficheId).push({
        status: textValue(ambiguity.status, `${ambiguity.ambiguity_id}.status`),
        note: textValue(ambiguity.notes, `${ambiguity.ambiguity_id}.notes`)
      });
    }
  }

  const cards = fiches.map(fiche => {
    const directEntries = entries.filter(entry => entry.fiche_id === fiche.fiche_id);
    const variants = entries.filter(entry => entry.scope === 'variant' && entry.candidate_fiche_ids.includes(fiche.fiche_id));
    const date = requireReference(dateIndex, fiche.date_id, `${fiche.fiche_id}.date_id`);
    const viewEntry = entry => {
      const locator = requireReference(locatorIndex, entry.evidence_locator_id, `${entry.entry_id}.evidence_locator_id`);
      const source = requireReference(sourceIndex, locator.digital_object_id, `${locator.evidence_locator_id}.digital_object_id`);
      return {
        id: entry.entry_id,
        literal: entry.literal,
        scope: entry.scope,
        identityStatus: entry.identity_status,
        origin: entry.origin,
        indexOnly: entry.scope === 'variant',
        provenance: provenanceFrom(locator, source, fiche.fiche_n)
      };
    };
    const grouped = Object.fromEntries(ALLOWED_SCOPES.map(scope => [scope, []]));
    for (const entry of directEntries) grouped[entry.scope].push(viewEntry(entry));
    for (const entry of variants) grouped.variant.push(viewEntry(entry));

    const dateEvidence = array(date.evidence_locator_ids, `${date.date_id}.evidence_locator_ids`);
    ensure(dateEvidence.length > 0, `Date has no evidence locator: ${date.date_id}`);
    for (const locatorId of dateEvidence) {
      requireReference(locatorIndex, locatorId, `${date.date_id}.evidence_locator_ids`);
    }
    const dateLocator = requireReference(locatorIndex, dateEvidence[0], `${date.date_id}.evidence_locator_ids`);
    const dateSource = requireReference(sourceIndex, dateLocator.digital_object_id, `${dateLocator.evidence_locator_id}.digital_object_id`);
    const citations = fiche.source_citations.map(citation => {
      const locator = requireReference(locatorIndex, citation.evidence_locator_id, `${fiche.fiche_id}.source_citations.evidence_locator_id`);
      const source = requireReference(sourceIndex, locator.digital_object_id, `${locator.evidence_locator_id}.digital_object_id`);
      return { ...citation, provenance: provenanceFrom(locator, source, fiche.fiche_n) };
    });
    const search = Object.fromEntries(ALLOWED_SCOPES.map(scope => [
      scope,
      normalizeSearchText(grouped[scope].map(entry => entry.literal).join(' '))
    ]));
    search.name = normalizeSearchText(`${fiche.label} ${fiche.person_heading} ${search.name}`);
    search.all = normalizeSearchText(ALLOWED_SCOPES.map(scope => search[scope]).join(' '));

    return {
      id: fiche.fiche_id,
      number: fiche.fiche_n,
      label: fiche.label,
      heading: fiche.person_heading,
      identityStatus: fiche.identity_status,
      reviewStatus: fiche.review_status,
      date: {
        expression: textValue(date.expression, `${date.date_id}.expression`),
        certainty: date.certainty,
        note: date.notes,
        provenance: provenanceFrom(dateLocator, dateSource, fiche.fiche_n)
      },
      groups: grouped,
      citations,
      missingFields: fiche.missing_fields.map(item => item.field),
      ambiguities: ambiguityByFiche.get(fiche.fiche_id),
      search
    };
  });

  ensure(cards.length === ficheIndex.size, 'Every selected fiche must produce exactly one result card.');
  return {
    cards,
    limitations: array(index.limitations, 'limitations').map((item, position) => textValue(item, `limitations[${position}]`)),
    packageId: textValue(index.package_id, 'package_id')
  };
}

export function filterAnnexCards(cards, query, scope = 'all') {
  ensure(scope === 'all' || ALLOWED_SCOPES.includes(scope), `Unsupported search scope: ${scope}`);
  const needle = normalizeSearchText(query);
  if (!needle) return [...cards];
  return cards.filter(card => card.search[scope].includes(needle));
}

const renderProvenance = provenance => `<dl class="annex-provenance">
  <div><dt>Table</dt><dd><code>${escapeHtml(provenance.table)}</code></dd></div>
  <div><dt>Fiche candidate</dt><dd>${escapeHtml(provenance.ficheNumber)}</dd></div>
  <div><dt>Enregistrement</dt><dd>${escapeHtml(provenance.recordNumber)}</dd></div>
  <div><dt>Champ</dt><dd>${escapeHtml(provenance.field)}</dd></div>
  <div><dt>SHA-256 source</dt><dd><code>${escapeHtml(provenance.sha256)}</code></dd></div>
</dl>`;

const renderEntry = entry => `<li class="annex-entry${entry.indexOnly ? ' annex-entry--variant' : ''}">
  <p><strong>${escapeHtml(entry.literal)}</strong></p>
  <p class="annex-entry-status">${entry.indexOnly
    ? 'Variante d’index uniquement · occurrence non attestée dans cette fiche · rattachement candidat'
    : `Expression de la fiche · identification ${escapeHtml(entry.identityStatus)}`}</p>
  ${renderProvenance(entry.provenance)}
</li>`;

const renderGroup = (scope, entries) => entries.length === 0 ? '' : `<section class="annex-group" aria-labelledby="group-${scope}-${escapeHtml(entries[0].provenance.ficheNumber)}">
  <h3 id="group-${scope}-${escapeHtml(entries[0].provenance.ficheNumber)}">${escapeHtml(SCOPE_LABELS[scope])}</h3>
  <ul>${entries.map(renderEntry).join('')}</ul>
</section>`;

const renderCard = card => {
  const attributes = ALLOWED_SCOPES.map(scope => `data-search-${scope}="${escapeHtml(card.search[scope])}"`).join(' ');
  return `<article class="annex-card" data-annex-card data-search-all="${escapeHtml(card.search.all)}" ${attributes} aria-labelledby="fiche-${escapeHtml(card.number)}-title">
  <header class="annex-card-header">
    <p class="annex-fiche-number">Fiche ${escapeHtml(card.number)} · sélection expérimentale</p>
    <h2 id="fiche-${escapeHtml(card.number)}-title">${escapeHtml(card.label)}</h2>
    <p class="annex-heading-literal">Intitulé littéral : ${escapeHtml(card.heading)}</p>
    <div class="annex-statuses" aria-label="États de la fiche">
      <span>Identification · ${escapeHtml(card.identityStatus)}</span><span>Lecture · ${escapeHtml(card.reviewStatus)}</span>
    </div>
  </header>
  ${card.ambiguities.map(ambiguity => `<aside class="annex-ambiguity"><strong>Homonymie non résolue</strong><p>${escapeHtml(ambiguity.note)}</p><p>État : ${escapeHtml(ambiguity.status)} · aucune fusion d’identité.</p></aside>`).join('')}
  <section class="annex-date" aria-labelledby="date-${escapeHtml(card.number)}">
    <h3 id="date-${escapeHtml(card.number)}">Date littérale</h3>
    <p><strong>${escapeHtml(card.date.expression)}</strong> · ${escapeHtml(card.date.certainty || 'unknown')}</p>
    ${card.date.note ? `<p>${escapeHtml(card.date.note)}</p>` : ''}
    ${renderProvenance(card.date.provenance)}
  </section>
  <div class="annex-groups">${ALLOWED_SCOPES.map(scope => renderGroup(scope, card.groups[scope])).join('')}</div>
  ${card.citations.length ? `<section class="annex-citations"><h3>Références éditoriales relevées</h3><p>Valeurs du tableau importé ; citations primaires non vérifiées.</p><ul>${card.citations.map(citation => `<li><strong>${escapeHtml(citation.field)} : ${escapeHtml(citation.literal)}</strong>${renderProvenance(citation.provenance)}</li>`).join('')}</ul></section>` : ''}
  ${card.missingFields.length ? `<details class="annex-missing"><summary>Champs marqués absents dans la fiche</summary><p>${card.missingFields.map(escapeHtml).join(' · ')}</p></details>` : ''}
</article>`;
};

export function renderAnnexSearch(index) {
  const model = prepareAnnexSearch(index);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>Recherche dans cinq fiches d’annexes</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/css/archives-search.css" />
</head>
<body class="annex-search-page">
  <a class="skip-link" href="#annex-search">Aller à la recherche</a>
  <div class="page">
    <main class="annex-main">
      <header class="annex-hero">
        <div><p class="annex-kicker">Consultation privée · index borné</p><h1>Rechercher dans cinq fiches</h1></div>
        <p>Cette recherche couvre uniquement cinq fiches expérimentales. Aucun résultat ne prouve une absence dans le reste du corpus.</p>
        <a class="annex-reader-link" href="/archives/">Ouvrir le lecteur d’archives <span aria-hidden="true">→</span></a>
      </header>
      <aside class="annex-notice" aria-label="Limites de la consultation">
        <strong>Données non publiables · lecture et identités non validées.</strong>
        <p>Les variantes d’index désignent des candidats possibles. Elles ne sont ni des occurrences attestées dans les fiches, ni des identités fusionnées.</p>
      </aside>
      <form class="annex-search" id="annex-search" role="search">
        <div class="annex-search-field"><label for="annex-query">Nom, variante, titre, lieu, seigneurie ou juridiction</label><input id="annex-query" name="q" type="search" autocomplete="off" aria-controls="annex-results" /></div>
        <div class="annex-scope-field"><label for="annex-scope">Chercher dans</label><select id="annex-scope" name="scope"><option value="all">Tous les champs</option>${ALLOWED_SCOPES.map(scope => `<option value="${scope}">${escapeHtml(SCOPE_LABELS[scope])}</option>`).join('')}</select></div>
        <button type="reset">Effacer</button>
      </form>
      <p class="annex-count" id="annex-count" role="status" aria-live="polite">${model.cards.length} fiches affichées sur ${model.cards.length}</p>
      <p class="annex-empty" id="annex-empty" hidden>Aucune de ces cinq fiches ne correspond. Ce résultat ne concerne pas le reste du corpus.</p>
      <section class="annex-results" id="annex-results" aria-label="Fiches sélectionnées">${model.cards.map(renderCard).join('')}</section>
      <aside class="annex-limitations"><h2>Limites de l’index</h2><ul>${model.limitations.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></aside>
    </main>
    <footer class="footer"><span class="footer-text">Prévisualisation privée · cinq fiches</span><span class="footer-text">Paquet ${escapeHtml(model.packageId)}</span></footer>
  </div>
  <script src="/js/archives-search.js" defer></script>
</body>
</html>`;
}

function main() {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      strict: true,
      options: { index: { type: 'string' } }
    });
    ensure(positionals.length === 0 && values.index, 'Usage: node render-annex-search.mjs --index <query-index.json>');
    const index = JSON.parse(readFileSync(resolve(values.index), 'utf8'));
    process.stdout.write(`${renderAnnexSearch(index)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
