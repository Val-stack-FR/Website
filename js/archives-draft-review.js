/* Read-only queries. No login, proposal, decision, corpus write or persistent browser cache. */
(() => {
  'use strict';
  const form = document.getElementById('draft-review-form');
  const results = document.getElementById('draft-review-results');
  const pagination = document.getElementById('draft-review-pagination');
  const status = document.getElementById('draft-review-status');
  if (!form || !results || !pagination || !status) return;
  let requestNumber = 0;
  let activeRequest;
  const make = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = String(text);
    if (className) element.className = className;
    return element;
  };
  const safeString = value => typeof value === 'string' && value.length <= 5000;
  const validRow = row => {
    const points = safeString(row.passage) ? Array.from(row.passage) : [];
    return row.confirmed_memory === false && row.entity_id === null
      && row.identification_status === 'unresolved' && row.reading_status === 'unresolved'
      && row.review_status === 'pending-human-source-review' && row.base_revision === 'r0'
      && row.canonical_refs && ['document_id', 'act_id', 'witness_id', 'view_id', 'text_id'].every(key => row.canonical_refs[key] === null)
      && row.span?.units === 'unicode-codepoints-half-open-r0'
      && Number.isSafeInteger(row.span.start) && Number.isSafeInteger(row.span.end)
      && row.span.start >= 0 && row.span.end > row.span.start && row.span.end <= points.length
      && points.slice(row.span.start, row.span.end).join('') === row.observed_text
      && ['occurrence_id', 'segment_id', 'source_id', 'source_sha256', 'lot_title', 'category'].every(key => safeString(row[key]))
      && /^[a-f0-9]{64}$/.test(row.source_sha256)
      && row.image?.link_status === 'candidate-folder-only' && row.image.rights_status === 'unknown'
      && /^object:path-[a-f0-9]{64}$/.test(row.image.object_id) && /^[a-f0-9]{64}$/.test(row.image.sha256)
      && row.image.media_url === `/__archive_draft_media/${row.image.sha256}` && row.image.individual_word_bbox === null
      && Array.isArray(row.image.reading_regions) && row.image.reading_regions.length <= 32
      && row.image.reading_regions.every(region => safeString(region.region_id) && region.status === 'candidate-reading-region'
        && region.individual_word_bbox === null && /^object:path-[a-f0-9]{64}$/.test(region.source_image_object_id)
        && /^[a-f0-9]{64}$/.test(region.source_image_sha256))
      && (!Object.hasOwn(row.image, 'analysis_tile_ids') || Array.isArray(row.image.analysis_tile_ids)
        && row.image.analysis_tile_ids.length <= 64
        && new Set(row.image.analysis_tile_ids).size === row.image.analysis_tile_ids.length
        && row.image.analysis_tile_ids.every(tile => safeString(tile) && /^[a-zA-Z0-9._:-]+$/.test(tile))
        && safeString(row.image.layer) && safeString(row.image.reading_notes)
        && row.image.line_numbering === 'editorial-fragment-order-not-manuscript-lines'
        && row.image.human_review_status === 'pending' && row.image.reading_regions.length === 0)
      && safeString(row.image.limits) && Array.isArray(row.alternatives) && row.alternatives.length <= 100
      && Array.isArray(row.proposals) && row.proposals.length <= 100
      && [...row.alternatives, ...row.proposals].every(value => value.author_kind === 'ai' && safeString(value.reading) && safeString(value.rationale)
        && ['possible', 'probable', 'uncertain', 'unknown'].includes(value.confidence))
      && row.proposals.every(value => value.decision === null && value.entity_id === null);
  };
  const validPage = page => page?.format === 'private-draft-review-query/0.1.0' && page.publication_status === 'private'
    && page.confirmed_memory_count === 0 && Number.isSafeInteger(page.page_size) && page.page_size >= 1 && page.page_size <= 50
    && Number.isSafeInteger(page.page) && page.page >= 1 && Number.isSafeInteger(page.total_pages) && page.page <= page.total_pages
    && Number.isSafeInteger(page.total) && page.total >= 0 && Array.isArray(page.items) && page.items.length <= page.page_size
    && page.items.every(validRow);

  const variants = values => {
    if (!values.length) return make('p', 'Aucune variante proposée dans ce dérivé.');
    const list = make('ul');
    for (const value of values) {
      const item = make('li');
      item.append(make('strong', value.reading), document.createTextNode(`${value.alternative ? ` · alternative ${value.alternative}` : ''} · proposition IA ${value.confidence}`), make('p', value.rationale));
      list.append(item);
    }
    return list;
  };
  const rowCard = row => {
    const card = make('article', undefined, 'draft-review-card');
    card.append(make('h2', row.observed_text), make('p', `${row.lot_title} · ${row.category} · non résolu`, 'draft-review-meta'));
    const points = Array.from(row.passage);
    const citation = make('p', undefined, 'draft-review-citation');
    citation.append(document.createTextNode(points.slice(0, row.span.start).join('')), make('mark', row.observed_text), document.createTextNode(points.slice(row.span.end).join('')));
    card.append(citation, make('p', `Offsets Unicode [${row.span.start}, ${row.span.end}) dans ${row.base_revision}. Identité non résolue ; mémoire confirmée : 0.`));
    const provenance = make('dl');
    provenance.append(make('dt', 'Occurrence / segment'), make('dd', `${row.occurrence_id}\n${row.segment_id}`), make('dt', 'Source / SHA-256 / révision'), make('dd', `${row.source_id}\n${row.source_sha256}\n${row.base_revision}`));
    const alternatives = make('details');
    alternatives.append(make('summary', `Variantes et propositions IA (${row.alternatives.length + row.proposals.length})`), variants([...row.alternatives, ...row.proposals]));
    const evidence = make('details');
    evidence.append(make('summary', 'Références photo candidates et limites de lecture'));
    const link = make('a', 'Ouvrir la photo source candidate');
    link.href = `/__archive_draft_media/${row.image.sha256}`;
    const linkLine = make('p');
    linkLine.append(link, document.createTextNode(' · candidate-folder-only · droits inconnus'));
    evidence.append(linkLine, make('p', `${row.image.object_id}\n${row.image.sha256}`, 'draft-review-meta'), make('p', row.image.limits));
    if (row.image.analysis_tile_ids) {
      evidence.append(make('p', `Couche candidate : ${row.image.layer}. Revue humaine : en attente.`),
        make('p', row.image.analysis_tile_ids.length ? `Repères techniques du dérivé : ${row.image.analysis_tile_ids.join(' · ')}.`
          : 'Aucun repère de découpe fourni pour ce fragment.'), make('p', row.image.reading_notes));
    }
    const regions = make('ul');
    for (const region of row.image.reading_regions) {
      const item = make('li', `${region.region_id} · repère ${region.reference_frame ?? 'non précisé'}${region.coordinate_transform ? ` · ${region.coordinate_transform}` : ''}`);
      item.append(make('p', `${region.source_image_object_id} · ${region.source_image_sha256}`, 'draft-review-meta'));
      regions.append(item);
    }
    evidence.append(regions);
    card.append(provenance, alternatives, evidence);
    return card;
  };
  const paramsFor = page => new URLSearchParams({ lot: form.elements.lot.value, query: form.elements.query.value,
    page: String(page), page_size: form.elements.page_size.value });
  const render = page => {
    results.replaceChildren(...(page.items.length ? page.items.map(rowCard) : [make('p', 'Aucune occurrence candidate pour cette recherche.')]));
    pagination.replaceChildren();
    for (const [number, label] of [[page.page - 1, 'Précédente'], [page.page + 1, 'Suivante']]) {
      if (number >= 1 && number <= page.total_pages) {
        const link = make('a', label); link.href = `?${paramsFor(number)}`; link.dataset.page = String(number); pagination.append(link);
      }
    }
    status.textContent = `${page.total} occurrences candidates · page ${page.page}/${page.total_pages} · ${page.page_size} maximum par page.`;
  };
  const load = async page => {
    activeRequest?.abort();
    activeRequest = new AbortController();
    const request = ++requestNumber;
    status.textContent = 'Recherche dans les brouillons privés…';
    const params = paramsFor(page);
    try {
      const response = await fetch(`/__draft_review_data?${params}`, { method: 'GET', cache: 'no-store', signal: activeRequest.signal });
      const data = await response.json();
      if (request !== requestNumber) return;
      if (!response.ok || !validPage(data)) throw new Error('Invalid private draft query response.');
      render(data);
      history.replaceState(null, '', `${location.pathname}?${params}`);
    } catch (error) {
      if (error.name !== 'AbortError' && request === requestNumber) status.textContent = 'Recherche indisponible ou réponse incompatible. Les résultats précédents sont conservés.';
    }
  };
  form.addEventListener('submit', event => { event.preventDefault(); load(1); });
  pagination.addEventListener('click', event => {
    const link = event.target.closest('a[data-page]');
    if (!link || !pagination.contains(link)) return;
    event.preventDefault(); load(Number(link.dataset.page));
  });
})();
