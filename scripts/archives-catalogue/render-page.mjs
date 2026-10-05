import {
  COLLECTION_TYPES,
  MAX_PAGE_SIZE,
  PRIORITIES,
  RECORD_STATUSES
} from './contract.mjs';

const labels = {
  collectionTypes: { photo: 'Photographie', scan: 'Numérisation', page: 'Page', unknown: 'Type inconnu' },
  statuses: {
    'metadata-only': 'Métadonnées seulement',
    'reader-linked': 'Consultation autorisée',
    unclassified: 'Non classé',
    'duplicate-candidate': 'Doublon possible',
    unknown: 'État inconnu'
  },
  priorities: { tuce: 'Famille Tucé prioritaire', 'other-family': 'Autre famille', unknown: 'Famille inconnue' }
};

const options = (values, dictionary) => values.map(value => `<option value="${value}">${dictionary[value]}</option>`).join('');

const escape = value => String(value).replace(/[&<>"']/gu, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const count = value => value === undefined ? '—' : Number(value).toLocaleString('fr-FR');
const initialCard = record => `<article class="catalogue-card"><p class="catalogue-badge">Fichier inventorié · pas un acte identifié</p><h3>${escape(record.fileName.literal)}</h3><p>${escape(record.logicalPath)}</p><p>${escape(labels.statuses[record.status])} · ${escape(labels.priorities[record.priority])}</p><p>Noms et groupes candidats · date inconnue</p>${record.consultation.available ? `<a href="${escape(record.consultation.href)}">Ouvrir le dossier de consultation</a>` : '<p>Aucun dossier lecteur allowlisté.</p>'}<details><summary>Provenance</summary><p><code>${escape(record.digitalObjectId)}</code></p><p>Lecture et droits non vérifiés</p></details></article>`;

export function renderCataloguePage({ initialPage = null, cleanOnly = false, hierarchy = false, preexistingTexts = false } = {}) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <title>Catalogue local des fonds — consultation privée</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/assets/archives-catalogue.css" />
</head>
<body class="catalogue-page">
  <a class="catalogue-skip" href="#catalogue-search">Aller à la recherche</a>
  <div class="page">
    <main class="catalogue-main" id="catalogue-main" tabindex="-1">
      <header class="catalogue-hero">
        <div>
          <p class="catalogue-kicker">Consultation privée · inventaire local</p>
          <h1>Catalogue des fonds</h1>
        </div>
        <p>${hierarchy ? 'Retrouver le classement de vos archives : fonds, dossiers « E. », sous-dossiers et photographies d’un document.' : 'Explorer des fichiers image inventoriés sans les transformer en actes, lectures ou identités confirmés.'}</p>
      </header>
      <nav class="catalogue-actions" aria-label="Autres vues de l’atelier"><a href="/archives/">Lecteur d’archives</a><a href="/archives/recherche/">Recherche dans les fiches</a><a href="/archives/avancement/">Avancement des travaux</a>${preexistingTexts ? '<a href="/archives/textes/">Textes préexistants</a>' : ''}</nav>

      <aside class="catalogue-notice" aria-label="Limites du catalogue">
        <strong>${hierarchy ? 'Classement historique des dossiers conservé.' : 'Métadonnées de découverte · état non canonique.'}</strong>
        <p>${hierarchy ? 'Les photos d’un même dossier restent ensemble. Une cote peut contenir plusieurs actes ; un acte peut être photographié en plusieurs parties, avec des détails, des marges ou un dos. Les libellés des dossiers sont conservés.' : 'Les noms, dates, groupes et doublons sont affichés comme candidats. Un fichier inventorié n’est pas un acte identifié. Les transcriptions préexistantes ne sont pas validées ici.'}</p>
      </aside>

      <section class="catalogue-metrics" aria-label="Compteurs du catalogue">
        <div><strong id="metric-inventory">${count(initialPage?.counts.inventory_image_files)}</strong><span>fichiers image inventoriés</span></div>
        <div><strong id="metric-clean">${count(initialPage?.counts.clean_image_files)}</strong><span>images dans CLEAN</span></div>
        <div><strong id="metric-links">${count(initialPage?.counts.reader_links)}</strong><span>liens de consultation autorisés</span></div>
        <div><strong id="metric-matched">${count(initialPage?.counts.matched_image_files)}</strong><span>images correspondant aux filtres</span></div>
      </section>

      <form class="catalogue-search" id="catalogue-search" role="search" tabindex="-1">
        <div class="catalogue-field catalogue-field--query">
          <label for="catalogue-query">Nom candidat ou chemin logique</label>
          <input id="catalogue-query" name="query" type="search" autocomplete="off" maxlength="100" aria-controls="catalogue-results" />
        </div>
        <div class="catalogue-field">
          <label for="catalogue-scope">Collections</label>
          <select id="catalogue-scope" name="collection_scope">
            <option value="clean" selected>Vue CLEAN par défaut</option>
            ${cleanOnly ? '' : '<option value="all">Toutes les collections</option>'}
          </select>
        </div>
        <div class="catalogue-field">
          <label for="catalogue-type">Type de collection</label>
          <select id="catalogue-type" name="collection_type"><option value="">Tous les types</option>${options(COLLECTION_TYPES, labels.collectionTypes)}</select>
        </div>
        <div class="catalogue-field">
          <label for="catalogue-status-filter">État</label>
          <select id="catalogue-status-filter" name="status"><option value="">Tous les états</option>${options(RECORD_STATUSES, labels.statuses)}</select>
        </div>
        <div class="catalogue-field">
          <label for="catalogue-priority">Priorité familiale</label>
          <select id="catalogue-priority" name="priority"><option value="">Toutes les priorités</option>${options(PRIORITIES, labels.priorities)}</select>
        </div>
        <div class="catalogue-field">
          <label for="catalogue-page-size">${hierarchy ? 'Éléments par page' : 'Fichiers par page'}</label>
          <select id="catalogue-page-size" name="page_size">
            <option value="20"${hierarchy ? ' selected' : ''}>20 ${hierarchy ? 'éléments' : 'fichiers'}</option>
            <option value="${MAX_PAGE_SIZE}"${hierarchy ? '' : ' selected'}>${MAX_PAGE_SIZE} ${hierarchy ? 'éléments' : 'fichiers'} maximum</option>
          </select>
        </div>
        <div class="catalogue-actions">
          <button type="submit">Rechercher</button>
          <button type="reset">Effacer</button>
        </div>
      </form>

      ${hierarchy ? '<nav id="catalogue-breadcrumbs" class="catalogue-breadcrumbs" aria-label="Classement des archives"></nav><div id="catalogue-folder-notes" role="note"></div>' : ''}
      <div class="catalogue-result-heading">
        <h2 id="catalogue-results-title">${hierarchy ? 'Dossiers et photographies' : 'Fichiers inventoriés'}</h2>
        <p id="catalogue-status" role="status" aria-live="polite">Chargement du catalogue local…</p>
      </div>
      <p class="catalogue-error" id="catalogue-error" role="alert" hidden></p>
      <noscript><p>${hierarchy ? 'Les liens de dossiers permettent de parcourir le classement. Activez JavaScript pour utiliser les filtres.' : `Les ${initialPage?.records.length ?? 0} premières images sont affichées. Activez JavaScript pour rechercher et parcourir toutes les pages.`}</p></noscript>
      <section class="catalogue-results" id="catalogue-results" aria-labelledby="catalogue-results-title" aria-busy="true" tabindex="-1">${hierarchy ? (initialPage?.entries ?? []).map(entry => entry.kind === 'folder' ? `<article class="catalogue-card"><h3><a href="?folder=${escape(encodeURIComponent(entry.folder.logicalPath))}">${escape(entry.folder.name)}</a></h3><p>${count(entry.folder.descendantFileCount)} photographies · ${count(entry.folder.childFolderCount)} sous-dossiers</p></article>` : initialCard(entry.record)).join('') : initialPage ? initialPage.records.map(initialCard).join('') : ''}</section>

      <nav class="catalogue-pagination" aria-label="Pagination du catalogue">
        <button type="button" data-page="first">Première page</button>
        <button type="button" data-page="previous">Page précédente</button>
        <span id="catalogue-page-indicator">Page — sur —</span>
        <button type="button" data-page="next">Page suivante</button>
        <button type="button" data-page="last">Dernière page</button>
      </nav>

      <details class="catalogue-provenance">
        <summary>Fraîcheur, provenance et limites</summary>
        <dl>
          <div><dt>Paquet</dt><dd id="provenance-package">—</dd></div>
          <div><dt>Généré le</dt><dd id="provenance-generated">—</dd></div>
          <div><dt>SHA-256 du manifeste source</dt><dd><code id="provenance-source-sha">—</code></dd></div>
          <div><dt>SHA-256 du fichier d’index chargé</dt><dd><code id="provenance-input-sha">—</code></dd></div>
        </dl>
        <ul id="catalogue-limitations"></ul>
      </details>
    </main>
    <footer class="footer catalogue-footer"><span>Prévisualisation privée · métadonnées seulement</span><span>50 fichiers maximum par page</span></footer>
  </div>
  <script src="/assets/${hierarchy ? 'archives-hierarchy' : 'archives-catalogue'}.js" defer></script>
</body>
</html>`;
}

