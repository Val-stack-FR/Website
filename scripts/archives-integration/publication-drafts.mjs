import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readBounded } from './media-preview.mjs';

const ensure = (value, message) => { if (!value) throw new Error(message); };
const digest = value => createHash('sha256').update(value).digest('hex');
const normalize = value => String(value).normalize('NFD').replace(/\p{M}+/gu, '').toLocaleLowerCase('fr').replace(/\s+/gu, ' ').trim();
const h = value => String(value).replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]).replaceAll('\r', '&#13;');

export async function captureDraftProjection(origin) {
  ensure(/^http:\/\/127\.0\.0\.1:\d+$/u.test(origin), 'Literal loopback origin required.');
  const rows = []; let metadata;
  for (let page = 1; page <= 20; page++) {
    const response = await fetch(origin + '/__draft_review_data?page_size=50&page=' + page, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    ensure(response.status === 200, 'Draft projection unavailable.');
    const bytes = await readBounded(response, 4 * 1024 * 1024);
    ensure(bytes.length <= 4 * 1024 * 1024, 'Draft projection page too large.');
    const value = JSON.parse(bytes);
    ensure(value.format === 'private-draft-review-query/0.1.0' && value.publication_status === 'private' && value.confirmed_memory_count === 0 && value.total === 992 && value.total_pages === 20 && value.page === page && value.page_size === 50 && Array.isArray(value.items) && value.items.length <= 50, 'Draft projection scope changed.');
    const current = { format: value.format, publication_status: value.publication_status, confirmed_memory_count: value.confirmed_memory_count, media_profile: value.media_profile, lots: value.lots };
    ensure(!metadata || JSON.stringify(current) === JSON.stringify(metadata), 'Draft metadata changed during capture.');
    metadata = current; rows.push(...value.items);
  }
  return buildDraftProjection({ ...metadata, items: rows });
}

export function buildDraftProjection(value) {
  ensure(value.format === 'private-draft-review-query/0.1.0' && value.publication_status === 'private' && value.confirmed_memory_count === 0 && Array.isArray(value.lots) && Array.isArray(value.items) && value.items.length === 992 && new Set(value.items.map(row => row.occurrence_id)).size === 992, 'Unaccepted draft projection.');
  ensure(value.items.reduce((count, row) => count + row.proposals.length, 0) === 89, 'Old proposal count changed.');
  const lots = new Map(value.lots.map(lot => [lot.id, lot]));
  for (const row of value.items) {
    ensure(lots.has(row.lot) && row.confirmed_memory === false && row.entity_id === null && row.reading_status === 'unresolved' && row.review_status === 'pending-human-source-review' && row.base_revision === 'r0', 'Draft state changed.');
    ensure(Object.values(row.canonical_refs).every(ref => ref === null) && Array.from(row.passage).slice(row.span.start, row.span.end).join('') === row.observed_text, 'Draft identity/span changed.');
    ensure(row.image.rights_status === 'unknown' && /^\/__archive_draft_derivative\/[a-f0-9]{64}$/u.test(row.image.media_url) && row.image.media_url.endsWith(row.image.derivative.derivativeSha256), 'Draft selected media changed.');
    ensure(row.proposals.every(proposal => proposal.decision === null && proposal.entity_id === null), 'Applied decision in draft projection.');
  }
  return value;
}

export async function loadDraftProjection(path, expected) {
  const info = await stat(path);
  ensure(info.isFile() && info.size < 16 * 1024 * 1024, 'Draft artifact input budget exceeded.');
  const bytes = await readFile(path);
  ensure(bytes.length < 16 * 1024 * 1024 && /^[a-f0-9]{64}$/u.test(expected) && digest(bytes) === expected, 'Draft artifact changed.');
  return buildDraftProjection(JSON.parse(bytes));
}

export function queryDraftProjection(index, params = new URLSearchParams()) {
  const fields = ['lot', 'query', 'page', 'page_size'];
  ensure(params.toString().length <= 4096 && [...params.keys()].every(key => fields.includes(key)) && fields.every(key => params.getAll(key).length <= 1), 'Invalid draft parameters.');
  const lot = params.get('lot') ?? '', rawQuery = params.get('query') ?? '';
  ensure((lot === '' || index.lots.some(value => value.id === lot)) && rawQuery.length <= 200 && !/[\u0000-\u001f\u007f-\u009f]/u.test(rawQuery), 'Invalid draft query.');
  const query = rawQuery.trim();
  const integer = (key, fallback, max) => { const value = params.get(key); ensure(value === null || /^[1-9]\d*$/u.test(value) && Number(value) <= max, 'Invalid pagination.'); return value === null ? fallback : Number(value); };
  const page = integer('page', 1, 1000000), page_size = integer('page_size', 50, 50), needle = normalize(query);
  const items = index.items.filter(row => (lot === '' || row.lot === lot) && (!needle || normalize([row.observed_text, row.passage, row.category, ...row.alternatives.map(value => value.reading), ...row.proposals.flatMap(value => [value.reading, value.alternative ?? ''])].join(' ')).includes(needle)));
  const total_pages = Math.max(1, Math.ceil(items.length / page_size));
  ensure(page <= total_pages, 'Unknown draft page.');
  return { format: index.format, publication_status: index.publication_status, confirmed_memory_count: 0, media_profile: index.media_profile, lots: index.lots, lot, query, page, page_size, total: items.length, total_pages, items: items.slice((page - 1) * page_size, page * page_size) };
}

export function renderDraftProjection(page) {
  const url = number => '/archives/formes-brouillons/?' + new URLSearchParams({ lot: page.lot, query: page.query, page: String(number), page_size: String(page.page_size) });
  const cards = page.items.map(row => {
    const points = Array.from(row.passage), variants = [...row.alternatives, ...row.proposals];
    return `<article class="draft-review-card"><h2>${h(row.observed_text)}</h2><p>${h(row.lot_title)} · ${h(row.category)} · à revoir</p><p class="draft-review-citation">${h(points.slice(0, row.span.start).join(''))}<mark>${h(row.observed_text)}</mark>${h(points.slice(row.span.end).join(''))}</p><details><summary>Lectures proposées (${variants.length})</summary>${variants.length ? '<ul>' + variants.map(value => `<li><strong>${h(value.reading)}</strong>${value.alternative ? ' · ' + h(value.alternative) : ''}<p>${h(value.rationale)} · ${h(value.confidence)}</p></li>`).join('') + '</ul>' : '<p>Aucune variante proposée.</p>'}</details><p><a href="${h(row.image.media_url)}">Voir la photographie</a> · lien candidat, cadrage de mot non validé</p><details><summary>Provenance</summary><p>${h(row.occurrence_id)}<br>${h(row.segment_id)}<br>${h(row.source_id)} · ${h(row.base_revision)}</p><p>Caractères Unicode [${row.span.start}, ${row.span.end})</p><p>Empreinte source : ${h(row.source_sha256)}</p><p>${h(row.image.limits)}</p></details></article>`;
  }).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Lectures à revoir — atelier historique</title><link rel="stylesheet" href="/css/archives-draft-review.css"></head><body class="draft-review-page"><main><header><h1>Lectures à revoir</h1><p>Lectures proposées par IA, encore à vérifier sur les photographies. Aucune identité résolue ni lecture humaine confirmée.</p><a href="/archives/">Actes et photos</a></header><form method="get" action="/archives/formes-brouillons/"><label>Expression<input name="query" maxlength="200" value="${h(page.query)}"></label><label>Lot<select name="lot"><option value="">Tous les lots</option>${page.lots.map(lot => `<option value="${h(lot.id)}"${lot.id === page.lot ? ' selected' : ''}>${h(lot.title)}</option>`).join('')}</select></label><input type="hidden" name="page_size" value="${page.page_size}"><button type="submit">Rechercher</button></form><p role="status">${page.total} occurrences · page ${page.page} sur ${page.total_pages} · 992 occurrences et 89 propositions dans les éditions conservées.</p>${cards || '<p>Aucun résultat.</p>'}<nav aria-label="Pages">${page.page > 1 ? `<a href="${h(url(page.page - 1))}">Page précédente</a>` : ''} ${page.page < page.total_pages ? `<a href="${h(url(page.page + 1))}">Page suivante</a>` : ''}</nav></main></body></html>`;
}
