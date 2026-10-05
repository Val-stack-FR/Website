(() => {
  'use strict';

  document.body.classList.add('visible');

  const labels = {
    collectionScope: { clean: 'CLEAN', other: 'Autre collection' },
    collectionType: { photo: 'Photographie', scan: 'Numérisation', page: 'Page', unknown: 'Type inconnu' },
    status: {
      'metadata-only': 'Métadonnées seulement',
      'reader-linked': 'Consultation autorisée',
      unclassified: 'Non classé',
      'duplicate-candidate': 'Doublon possible',
      unknown: 'État inconnu'
    },
    priority: { tuce: 'Tucé prioritaire', 'other-family': 'Autre famille', unknown: 'Famille inconnue' },
    transcription: {
      none: 'Aucune transcription liée',
      'preexisting-unvalidated': 'Texte préexistant non validé',
      'multiple-unresolved': 'Versions de texte distinctes non départagées'
    }
  };

  const byId = id => document.getElementById(id);
  const form = byId('catalogue-search');
  const results = byId('catalogue-results');
  const status = byId('catalogue-status');
  const error = byId('catalogue-error');
  const pageIndicator = byId('catalogue-page-indicator');
  const pageButtons = [...document.querySelectorAll('[data-page]')];
  const state = { page: 1, pageCount: 1, controller: null, metadataRendered: false };

  const node = (tag, className, value) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (value !== undefined) item.textContent = value;
    return item;
  };

  const localized = value => Number(value).toLocaleString('fr-FR');

  const addTerm = (list, label, value, code = false) => {
    const wrapper = node('div');
    wrapper.append(node('dt', '', label));
    const definition = node('dd');
    definition.append(code ? node('code', '', value) : document.createTextNode(value));
    wrapper.append(definition);
    list.append(wrapper);
  };

  const badge = (value, tone = '') => node('span', `catalogue-badge${tone ? ` catalogue-badge--${tone}` : ''}`, value);

  const renderNames = record => {
    const section = node('section', 'catalogue-card-section');
    section.append(node('h3', '', 'Noms candidats'));
    if (record.names.length === 0) {
      section.append(node('p', 'catalogue-muted', 'Aucun nom candidat dans les métadonnées de découverte.'));
      return section;
    }
    const list = node('ul', 'catalogue-candidate-list');
    for (const candidate of record.names) {
      const item = node('li');
      item.append(node('strong', '', candidate.literal));
      item.append(node('span', '', `Candidat · ${candidate.basis}`));
      list.append(item);
    }
    section.append(list);
    return section;
  };

  const renderWarnings = record => {
    const fragment = document.createDocumentFragment();
    for (const candidate of record.groups) {
      const group = node('aside', 'catalogue-candidate-note');
      group.append(node('strong', '', 'Groupe candidat · non classé'));
      group.append(node('p', '', `${candidate.label} — ${candidate.basis}`));
      fragment.append(group);
    }
    if (record.duplicate) {
      const duplicate = node('aside', 'catalogue-candidate-note catalogue-candidate-note--duplicate');
      duplicate.append(node('strong', '', 'Doublon possible · fichiers conservés séparément'));
      duplicate.append(node('p', '', record.duplicate.basis));
      duplicate.append(node('code', '', record.duplicate.candidate_set_id));
      fragment.append(duplicate);
    }
    return fragment;
  };

  const renderTranscription = record => {
    const section = node('section', 'catalogue-card-section');
    section.append(node('h3', '', 'Texte associé'));
    section.append(node('p', '', labels.transcription[record.transcription.status]));
    if (record.transcription.versionLabels.length) {
      const list = node('ul', 'catalogue-version-list');
      for (const version of record.transcription.versionLabels) list.append(node('li', '', version));
      section.append(list);
    }
    section.append(node('p', 'catalogue-muted', 'Aucune version n’est validée ou fusionnée par ce catalogue.'));
    return section;
  };

  const renderCard = record => {
    const article = node('article', 'catalogue-card');
    article.setAttribute('aria-labelledby', `catalogue-title-${record.catalogueId.replace(/[^A-Za-z0-9_-]/gu, '-')}`);
    const header = node('header', 'catalogue-card-header');
    const title = node('h2', '', record.fileName.status === 'candidate' ? record.fileName.literal : 'Nom de fichier inconnu');
    title.id = article.getAttribute('aria-labelledby');
    header.append(title);
    header.append(node('p', 'catalogue-path', record.logicalPath));
    const badges = node('div', 'catalogue-badges', undefined);
    badges.setAttribute('aria-label', 'État du fichier');
    badges.append(
      badge(labels.priority[record.priority], record.priority === 'tuce' ? 'priority' : ''),
      badge(labels.status[record.status]),
      badge(`${labels.collectionScope[record.collectionScope]} · ${labels.collectionType[record.collectionType]}`)
    );
    header.append(badges);
    article.append(header);

    const caution = node('p', 'catalogue-file-not-act');
    caution.append(node('strong', '', 'Fichier inventorié · pas un acte identifié.'));
    article.append(caution, renderWarnings(record), renderNames(record));

    const facts = node('dl', 'catalogue-facts');
    addTerm(facts, 'Date', record.date.status === 'candidate' ? `${record.date.literal} · candidate` : 'Inconnue');
    addTerm(facts, 'Collection', record.collectionLabel);
    addTerm(facts, 'Extension', record.extension ?? 'Inconnue');
    addTerm(facts, 'Taille', `${localized(record.sizeBytes)} octets`);
    addTerm(facts, 'Type média', record.mediaType);
    addTerm(facts, 'Objet numérique', record.digitalObjectId ?? 'Non attribué');
    article.append(facts, renderTranscription(record));

    const consultation = node('section', 'catalogue-card-section');
    consultation.append(node('h3', '', 'Consultation'));
    if (record.consultation.available) {
      const link = node('a', 'catalogue-reader-link', 'Ouvrir dans le lecteur privé');
      link.href = record.consultation.href;
      consultation.append(link, node('p', 'catalogue-muted', 'Lien conservé depuis une allowlist déjà approuvée.'));
    } else {
      consultation.append(node('p', 'catalogue-muted', 'Aucun lien de consultation autorisé pour ce fichier.'));
    }
    article.append(consultation);

    const details = node('details', 'catalogue-record-provenance');
    details.append(node('summary', '', 'Provenance de cette métadonnée'));
    const provenance = node('dl', 'catalogue-facts');
    addTerm(provenance, 'ID catalogue', record.catalogueId, true);
    addTerm(provenance, 'Enregistrement manifeste', record.provenance.manifest_record_id, true);
    addTerm(provenance, 'Source de découverte', record.provenance.discovery_source);
    addTerm(provenance, 'SHA-256 source', record.provenance.source_sha256, true);
    addTerm(provenance, 'Fraîcheur de l’empreinte', record.provenance.hash_freshness);
    addTerm(provenance, 'Inventaire observé le', record.provenance.inventory_observed_at ?? 'Inconnu');
    addTerm(provenance, 'Fichier modifié le', record.provenance.inventory_modified_at ?? 'Inconnu');
    details.append(provenance);
    article.append(details);
    return article;
  };

  const renderMetadata = data => {
    byId('metric-inventory').textContent = localized(data.counts.inventory_image_files);
    byId('metric-clean').textContent = localized(data.counts.clean_image_files);
    byId('metric-links').textContent = localized(data.counts.reader_links);
    byId('provenance-package').textContent = data.package.package_id;
    byId('provenance-generated').textContent = data.package.generated_at;
    byId('provenance-source-sha').textContent = data.package.source_manifest_sha256;
    byId('provenance-input-sha').textContent = data.package.input_sha256;
    const limitations = byId('catalogue-limitations');
    limitations.replaceChildren(...data.package.limitations.map(value => node('li', '', value)));
    state.metadataRendered = true;
  };

  const renderResults = data => {
    if (!state.metadataRendered) renderMetadata(data);
    byId('metric-matched').textContent = localized(data.counts.matched_image_files);
    results.replaceChildren(...data.records.map(renderCard));
    const { page, page_size: pageSize, page_count: pageCount, returned_records: returned } = data.pagination;
    state.page = page;
    state.pageCount = pageCount;
    const first = returned ? (page - 1) * pageSize + 1 : 0;
    const last = returned ? first + returned - 1 : 0;
    status.textContent = returned
      ? `${localized(first)}–${localized(last)} sur ${localized(data.counts.matched_image_files)} fichiers image correspondant aux filtres.`
      : `Aucun fichier sur ${localized(data.counts.matched_image_files)} correspondance.`;
    pageIndicator.textContent = `Page ${localized(page)} sur ${localized(pageCount)}`;
    for (const button of pageButtons) {
      const action = button.dataset.page;
      button.disabled = action === 'first' || action === 'previous' ? page <= 1 : page >= pageCount;
    }
    results.setAttribute('aria-busy', 'false');
  };

  const currentParameters = () => {
    const values = new FormData(form);
    const parameters = new URLSearchParams();
    for (const [key, value] of values) if (String(value)) parameters.set(key, String(value));
    parameters.set('page', String(state.page));
    return parameters;
  };

  const load = async ({ focusResults = false } = {}) => {
    state.controller?.abort();
    state.controller = new AbortController();
    results.setAttribute('aria-busy', 'true');
    error.hidden = true;
    status.textContent = 'Chargement du catalogue local…';
    try {
      const response = await fetch(`/__catalogue_data?${currentParameters()}`, {
        headers: { Accept: 'application/json' },
        signal: state.controller.signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Réponse locale invalide.');
      renderResults(data);
      if (focusResults) results.focus({ preventScroll: false });
    } catch (reason) {
      if (reason.name === 'AbortError') return;
      results.setAttribute('aria-busy', 'false');
      error.textContent = `Le catalogue local n’a pas pu être chargé : ${reason.message}`;
      error.hidden = false;
      status.textContent = 'Chargement interrompu.';
    }
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    state.page = 1;
    load();
  });

  form.addEventListener('reset', event => {
    event.preventDefault();
    for (const control of form.elements) {
      if (control instanceof HTMLSelectElement) {
        const initial = [...control.options].find(option => option.defaultSelected) ?? control.options[0];
        control.value = initial.value;
      } else if (control instanceof HTMLInputElement) {
        control.value = control.defaultValue;
      }
    }
    state.page = 1;
    load();
    byId('catalogue-query').focus();
  });

  for (const button of pageButtons) button.addEventListener('click', () => {
    const action = button.dataset.page;
    if (action === 'first') state.page = 1;
    else if (action === 'previous') state.page = Math.max(1, state.page - 1);
    else if (action === 'next') state.page = Math.min(state.pageCount, state.page + 1);
    else if (action === 'last') state.page = state.pageCount;
    load({ focusResults: true });
  });

  load();
})();

