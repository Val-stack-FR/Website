import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { prepareCatalogue } from '../archives-catalogue/contract.mjs';
import { buildPreexistingTextIndex } from '../archives/preexisting-texts.mjs';
import { createReadonlyHandler, READONLY_ROUTE_CONTRACT } from './publication-readonly/handler.mjs';
import { buildDraftProjection, queryDraftProjection, renderDraftProjection } from './publication-drafts.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const ensure = (value, message) => { if (!value) throw new Error(message); };
const style = '/assets/archives-integration-navigation.css';
const navigation = '<nav class="atelier-navigation" aria-label="Navigation de l’atelier"><a href="/archives/">Actes</a><a href="/archives/catalogue/">Catalogue</a><a href="/archives/recherche/">Fiches du mémoire</a><a href="/archives/reperes/">Repères dans les textes</a><a href="/archives/formes-brouillons/">Lectures à revoir</a><a href="/archives/avancement/">Avancement</a><a href="/archives/corrections/">Proposer une correction</a></nav>';

export function decoratePublicationHtml(html) {
  let result = html;
  if (!html.includes('class="atelier-navigation"')) result = result.replace('</head>', `<link rel="stylesheet" href="${style}"></head>`).replace(/<body(?:\s[^>]*)?>/iu, value => value + navigation);
  // All 166 materialized pages have deterministic paths. Query URLs remain
  // handled for prior bookmarks and API/browser consumers.
  return result.replace(/href="\/archives\/texte\/\?object_id=object(?:%3[Aa]|:)path-([a-f0-9]{64})"/gu, (_, id) => `href="/archives/textes/fichier/${id}/"`);
}

export async function loadPublicationData(file, expectedSha256) {
  const info = await stat(file);
  ensure(info.isFile() && info.size <= 20 * 1024 * 1024, 'Selected runtime input budget exceeded.');
  const bytes = await readFile(file);
  ensure(bytes.length <= 20 * 1024 * 1024 && hash(bytes) === expectedSha256, 'Selected runtime data changed.');
  const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  ensure(data.format === 'archives-selected-runtime-data/1' && data.historical_confirmation === false && data.text_records.length === 166 && data.text_coverage.length === 166 && data.lexical.rows.length === 535, 'Runtime data selection drift.');
  const catalogue = prepareCatalogue(data.catalogue, { inputSha256: data.source_pins.catalogue });
  ensure(catalogue.records.length === 2989 && catalogue.records.every(row => row.collectionScope === 'clean'), 'Catalogue selection drift.');
  const index = buildPreexistingTextIndex(data.text_records, data.text_coverage, { indexSha256: data.source_pins.text_index, coverageSha256: data.source_pins.text_coverage });
  const drafts = buildDraftProjection(data.drafts);
  return { catalogue, index, lexical: data.lexical, drafts };
}

export function createPublicationRuntime(data) {
  const readonly = createReadonlyHandler({ ...data, transformHtml: decoratePublicationHtml });
  const routes = new Set(READONLY_ROUTE_CONTRACT.routes);
  const draftRoutes = new Set(['/__draft_review_data', '/archives/formes-brouillons/']);
  const send = (request, response, status, type, value) => {
    const bytes = Buffer.from(value);
    response.writeHead(status, { 'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  };
  return { routes: [...routes, ...draftRoutes], async handle(request, response, url) {
    if (routes.has(url.pathname)) { await readonly.handler(request, response); return true; }
    if (!draftRoutes.has(url.pathname)) return false;
    if (!['GET', 'HEAD'].includes(request.method)) { response.setHeader('Allow', 'GET, HEAD'); send(request, response, 405, 'text/plain; charset=utf-8', 'Method not allowed'); return true; }
    try {
      const page = queryDraftProjection(data.drafts, url.searchParams);
      send(request, response, 200, url.pathname.startsWith('/__') ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8', url.pathname.startsWith('/__') ? JSON.stringify(page) : decoratePublicationHtml(renderDraftProjection(page)));
    } catch { send(request, response, 400, 'text/plain; charset=utf-8', 'Invalid draft query'); }
    return true;
  } };
}
