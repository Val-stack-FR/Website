(() => {
  'use strict';
  document.body.classList.add('visible');
  const byId = id => document.getElementById(id);
  const form = byId('catalogue-search'), results = byId('catalogue-results'), status = byId('catalogue-status');
  const initial = new URLSearchParams(location.search);
  const state = { folder: initial.get('folder') ?? '', page: Number(initial.get('page') ?? 1), pages: 1, controller: null };
  const count = value => Number(value).toLocaleString('fr-FR');
  const node = (tag, className, text) => { const item = document.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item; };
  const parameters = () => { const params = new URLSearchParams(new FormData(form)); params.set('folder', state.folder); params.set('page', String(state.page)); return params; };
  const restoreForm = params => { for (const key of ['query', 'collection_scope', 'priority', 'status', 'collection_type', 'page_size']) { const control = form.elements.namedItem(key); if (!control) continue; control.value = params.has(key) ? params.get(key) : control instanceof HTMLSelectElement ? ([...control.options].find(option=>option.defaultSelected) ?? control.options[0]).value : control.defaultValue; } };
  restoreForm(initial);
  const folderLink = (folder, text, className = '') => { const link = node('a', className, text); const params = parameters(); params.set('folder', folder); params.set('page', '1'); link.href = '?' + params; link.addEventListener('click', event => { if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); state.folder = folder; state.page = 1; load(true); }); return link; };
  const details = record => { const wrapper = node('details', 'catalogue-record-provenance'); wrapper.append(node('summary', '', 'Informations de la photographie')); const list = node('dl', 'catalogue-facts'); for (const [label, text] of [['Fichier', record.fileName.literal], ['Chemin dans le classement', record.logicalPath], ['Objet numérique', record.digitalObjectId], ['Taille', count(record.sizeBytes) + ' octets'], ['Texte associé', record.transcription.status === 'none' ? 'Aucune transcription liée' : 'Texte préexistant à revoir'], ['Origine de la métadonnée', record.provenance.discovery_source]]) { const item = node('div'); item.append(node('dt', '', label), node('dd', '', text ?? 'Inconnu')); list.append(item); } wrapper.append(list); return wrapper; };
  const card = entry => {
    const article = node('article', 'catalogue-card');
    if (entry.kind === 'folder') {
      const folder = entry.folder; article.classList.add('catalogue-folder');
      const title = node('h3'); title.append(folderLink(folder.logicalPath, folder.name, 'catalogue-folder-link')); article.append(node('p', 'catalogue-kicker', 'Dossier du classement'), title);
      article.append(node('p', '', `${count(folder.descendantFileCount)} photographies · ${count(folder.childFolderCount)} sous-dossiers`));
      if (folder.matchedDescendantFileCount !== folder.descendantFileCount) article.append(node('p', 'catalogue-muted', `${count(folder.matchedDescendantFileCount)} photographies correspondent aux filtres`));
      article.append(node('p', 'catalogue-path', folder.logicalPath));
    } else {
      const record = entry.record; article.append(node('p', 'catalogue-kicker', 'Photographie du dossier'), node('h3', 'catalogue-photo-title', record.fileName.literal ?? 'Fichier sans libellé'));
      if (record.consultation.available) { const link = node('a', 'catalogue-reader-link', 'Ouvrir dans le lecteur privé'); link.href = record.consultation.href; article.append(link); }
      else article.append(node('p', 'catalogue-muted', 'Photo inventoriée · aperçu non préparé'));
      article.append(details(record));
    }
    return article;
  };
  async function load(focus = false, updateUrl = true) {
    state.controller?.abort(); state.controller = new AbortController(); results.setAttribute('aria-busy', 'true'); byId('catalogue-error').hidden = true;
    try {
      const response = await fetch('/__catalogue_hierarchy?' + parameters(), { signal: state.controller.signal, headers: { Accept: 'application/json' } });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Classement indisponible');
      state.folder = data.selected_folder.logicalPath; state.page = data.pagination.page; state.pages = data.pagination.page_count;
      byId('metric-inventory').textContent = count(data.counts.inventory_image_files ?? data.counts.clean_image_files);
      byId('metric-clean').textContent = count(data.counts.clean_image_files); byId('metric-links').textContent = count(data.counts.reader_links ?? 0); byId('metric-matched').textContent = count(data.counts.matched_image_files);
      byId('catalogue-breadcrumbs').replaceChildren(...data.breadcrumbs.map(crumb => folderLink(crumb.logicalPath, crumb.name)));
      byId('catalogue-folder-notes').replaceChildren(...(data.notes ?? []).map(note => { const box = node('aside', 'catalogue-candidate-note'); box.append(node('strong', '', 'Souvenir de Val · rapprochement probable · à vérifier'), node('p', '', note.text), node('p', '', `${count(note.object_ids.length)} photographies concernées · association historique non confirmée`)); return box; }));
      byId('catalogue-results-title').textContent = data.selected_folder.name;
      results.replaceChildren(...data.entries.map(card));
      status.textContent = `${count(data.counts.matched_child_folders)} sous-dossiers · ${count(data.counts.matched_files)} photographies dans ce dossier · ${count(data.counts.matched_image_files)} dans son arborescence.`;
      byId('catalogue-page-indicator').textContent = `Page ${count(state.page)} sur ${count(state.pages)}`;
      for (const button of document.querySelectorAll('[data-page]')) button.disabled = ['first', 'previous'].includes(button.dataset.page) ? state.page <= 1 : state.page >= state.pages;
      byId('provenance-package').textContent = data.package.package_id; byId('provenance-generated').textContent = data.package.generated_at; byId('provenance-source-sha').textContent = data.package.source_manifest_sha256; byId('provenance-input-sha').textContent = data.package.input_sha256;
      byId('catalogue-limitations').replaceChildren(...data.package.limitations.map(text => node('li', '', text)));
      results.setAttribute('aria-busy', 'false'); if (updateUrl && location.search !== '?' + parameters()) history.pushState(null, '', '?' + parameters()); if (focus) results.focus();
    } catch (reason) { if (reason.name === 'AbortError') return; results.setAttribute('aria-busy', 'false'); const error = byId('catalogue-error'); error.textContent = reason.message; error.hidden = false; status.textContent = 'Classement indisponible.'; }
  }
  form.addEventListener('submit', event => { event.preventDefault(); state.page = 1; load(); });
  form.addEventListener('reset', () => { state.page = 1; setTimeout(() => load(), 0); });
  for (const button of document.querySelectorAll('[data-page]')) button.addEventListener('click', () => { const action = button.dataset.page; state.page = action === 'first' ? 1 : action === 'last' ? state.pages : action === 'previous' ? Math.max(1, state.page - 1) : Math.min(state.pages, state.page + 1); load(true); });
  window.addEventListener('popstate', () => { const params = new URLSearchParams(location.search); state.folder = params.get('folder') ?? ''; state.page = Number(params.get('page') ?? 1); restoreForm(params); load(false, false); });
  load(false, false);
})();
