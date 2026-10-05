import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PIN = '20e6ecface2b702a26bc32372e0397255ac095a213f92a6b49dfbfe5de066f61';
const KIND = { person_name_candidate: 'Nom', place_name_candidate: 'Lieu', title_or_office_candidate: 'Titre ou office' };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const escape = value => String(value).replace(/[&<>"']/gu, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const exactHtml = value => escape(value).replaceAll('\r', '&#13;');
const normalize = value => String(value).normalize('NFD').replace(/\p{M}+/gu, '').toLocaleLowerCase('fr').replace(/\s+/gu, ' ').trim();

export async function loadLexicalSearch(directory) {
  const manifestBytes = await readFile(resolve(directory, 'run-manifest.json'));
  ensure(digest(manifestBytes) === PIN, 'Unaccepted lexical run.');
  const manifest = JSON.parse(manifestBytes);
  const output = manifest.outputs.find(item => item.uri.endsWith('/search-index.jsonl'));
  ensure(output && manifest.agent.method_version === 'text-mentions-quality/0.4.1', 'Lexical method drift.');
  const bytes = await readFile(resolve(directory, 'search-index.jsonl'));
  ensure(bytes.length < 4 * 1024 * 1024 && digest(bytes) === output.sha256, 'Lexical index drift.');
  const rows = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trimEnd().split('\n').map(JSON.parse);
  ensure(rows.length === 535 && new Set(rows.map(row => row.candidate_id)).size === rows.length, 'Lexical candidate count drift.');
  for (const row of rows) {
    ensure(Object.hasOwn(KIND, row.candidate_kind) && /^mentioncandidate:[a-f0-9]{64}$/u.test(row.candidate_id), 'Invalid candidate.');
    ensure(typeof row.literal === 'string' && typeof row.citation === 'string' && row.literal.length <= 10000 && row.citation.length <= 20000, 'Invalid lexical quote.');
    ensure(/^object:path-[a-f0-9]{64}$/u.test(row.source?.object_id) && /^[a-f0-9]{64}$/u.test(row.source.source_sha256), 'Invalid source binding.');
    ensure(row.review_status === 'unreviewed' && row.resolution_status === 'not_attempted' && row.rights_status === 'unknown', 'Candidate status drift.');
    ensure(row.source.logical_path.startsWith('CLEAN/') && !/[\\:\u0000-\u001f]/u.test(row.source.logical_path), 'Invalid logical source path.');
    ensure(row.span?.unit === 'unicode_codepoint' && row.span.end_exclusive === true && Number.isSafeInteger(row.span.start) && Number.isSafeInteger(row.span.end) && row.span.start >= 0 && row.span.end > row.span.start, 'Invalid source span.');
  }
  return Object.freeze({ rows: Object.freeze(rows), manifestSha256: PIN, indexSha256: output.sha256 });
}

export function queryLexicalSearch(index, parameters) {
  const params = Object.fromEntries(parameters);
  ensure([...parameters.keys()].length === Object.keys(params).length && Object.keys(params).every(key => ['q', 'kind', 'match', 'page'].includes(key)), 'Invalid search parameter.');
  const query = params.q ?? '', kind = params.kind ?? 'all', match = params.match ?? 'contains', page = params.page ?? '1';
  ensure(query.length <= 100 && !/[\u0000-\u001f\u007f]/u.test(query) && ['all', ...Object.keys(KIND)].includes(kind) && ['contains', 'exact'].includes(match) && /^[1-9]\d{0,3}$/u.test(page), 'Invalid search value.');
  const needle = normalize(query);
  const matches = index.rows.filter(row => (kind === 'all' || row.candidate_kind === kind) && (!needle || (match === 'exact' ? normalize(row.literal) === needle : normalize(row.literal).includes(needle))));
  const current = Number(page), pages = Math.max(1, Math.ceil(matches.length / 25));
  ensure(current <= pages, 'Unknown search page.');
  return { query, kind, match, page: current, pages, total: matches.length, rows: matches.slice((current - 1) * 25, current * 25) };
}

export function renderLexicalSearch(index, parameters) {
  const result = queryLexicalSearch(index, parameters);
  const option = (value, label, selected) => `<option value="${escape(value)}"${selected === value ? ' selected' : ''}>${escape(label)}</option>`;
  const href = page => '/archives/reperes/?' + new URLSearchParams({ q: result.query, kind: result.kind, match: result.match, page: String(page) });
  const rows = result.rows.map(row => `<article class="lexical-card" data-candidate-id="${row.candidate_id}"><p class="lexical-kind">${KIND[row.candidate_kind]} · à vérifier</p><h2>${exactHtml(row.literal)}</h2><blockquote>${exactHtml(row.citation)}</blockquote><p>${escape(row.source.logical_path.split('/').at(-1))}</p><a href="/archives/texte/?object_id=${encodeURIComponent(row.source.object_id)}">Lire le texte source</a><details><summary>Voir la provenance</summary><dl><dt>Fichier</dt><dd>${escape(row.source.logical_path)}</dd><dt>Emplacement dans le texte</dt><dd>Caractères Unicode ${row.span.start} à ${row.span.end} (fin exclue)</dd><dt>Empreinte du fichier source</dt><dd><code>${row.source.source_sha256}</code></dd><dt>Référence de la proposition</dt><dd><code>${row.candidate_id}</code></dd></dl></details></article>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Repères dans les textes — atelier historique</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/archives-integration-lexical.css"></head><body><a class="skip" href="#search">Aller à la recherche</a><main><header><p>Atelier historique · travaux en cours</p><h1>Repères dans les textes</h1><p>Noms, lieux et titres repérés automatiquement dans les textes déjà conservés. Chaque résultat doit être vérifié dans son contexte.</p><nav aria-label="Atelier"><a href="/archives/">Actes et photos</a><a href="/archives/recherche/">Fiches du mémoire</a><a href="/archives/textes/">Textes conservés</a><a href="/archives/avancement/">Avancement</a></nav></header><form id="search" method="get" action="/archives/reperes/"><label>Expression<input name="q" type="search" maxlength="100" value="${escape(result.query)}"></label><label>Type<select name="kind">${option('all', 'Tous', result.kind)}${Object.entries(KIND).map(([value, label]) => option(value, label, result.kind)).join('')}</select></label><label>Correspondance<select name="match">${option('contains', 'Contient l’expression', result.match)}${option('exact', 'Expression exacte', result.match)}</select></label><button type="submit">Rechercher</button></form><p role="status">${result.total} résultat${result.total === 1 ? '' : 's'} · page ${result.page} sur ${result.pages} · 535 repères dans ce lot de 166 textes.</p><section aria-label="Résultats">${rows || '<p>Aucun résultat dans ce lot. Cela ne prouve pas une absence dans les autres sources.</p>'}</section><nav class="pagination" aria-label="Pages de résultats">${result.page > 1 ? `<a href="${escape(href(result.page - 1))}">Page précédente</a>` : ''}${result.page < result.pages ? `<a href="${escape(href(result.page + 1))}">Page suivante</a>` : ''}</nav><footer><p>Lectures préexistantes non relues ; identités non résolues. Une expression identique dans deux textes ne suffit pas à identifier une même personne ou un même lieu.</p></footer></main></body></html>`;
}
