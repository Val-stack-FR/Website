import { queryCatalogue } from '../../archives-catalogue/contract.mjs';
import { buildCatalogueHierarchy, queryCatalogueHierarchy } from '../../archives-catalogue/hierarchy.mjs';
import { renderCataloguePage } from '../../archives-catalogue/render-page.mjs';
import { renderPreexistingText, renderPreexistingTexts } from '../../archives/preexisting-texts.mjs';
import { renderLexicalSearch } from '../lexical-search.mjs';

const HTML = 'text/html; charset=utf-8';
const JSON_TYPE = 'application/json; charset=utf-8';
const MAX_URL = 4096;
const RECORD_ID = /^[a-z][a-z0-9-]*:[A-Za-z0-9._:-]{1,200}$/u;
const ROUTES = new Set([
  '/__catalogue_data', '/__catalogue_hierarchy', '/archives/catalogue/',
  '/archives/textes/', '/archives/texte/', '/archives/reperes/'
]);
const ROUTE_FIELDS = {
  '/__catalogue_data': ['query', 'collection_scope', 'collection_type', 'status', 'priority', 'page', 'page_size'],
  '/__catalogue_hierarchy': ['query', 'folder', 'page', 'page_size', 'priority', 'status', 'collection_type', 'collection_scope'],
  '/archives/catalogue/': ['query', 'folder', 'page', 'page_size', 'priority', 'status', 'collection_type', 'collection_scope'],
  '/archives/textes/': ['folder', 'query', 'page', 'page_size'],
  '/archives/texte/': ['object_id'],
  '/archives/reperes/': ['q', 'kind', 'match', 'page']
};
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const bytes = value => Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');

function requestUrl(request) {
  const raw = request.url;
  ensure(typeof raw === 'string' && raw.length <= MAX_URL && raw.startsWith('/'), 'Invalid request URL.');
  const url = new URL(raw, 'http://localhost');
  ensure(!url.username && !url.password && !url.hash, 'Invalid request URL.');
  return url;
}

function strictParameters(url, allowed) {
  ensure(url.search.length <= 2048, 'Query string is too long.');
  const result = Object.create(null);
  for (const [key, value] of url.searchParams) {
    ensure(allowed.includes(key), `Unsupported query parameter: ${key}`);
    ensure(!Object.hasOwn(result, key), `Duplicate query parameter: ${key}`);
    ensure(value.length <= 1200, `Query parameter is too long: ${key}`);
    result[key] = value;
  }
  return result;
}

function htmlAttribute(value) {
  return String(value).replace(/[&<>"']/gu, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
}

function validateFolderNotes(notes) {
  if (notes === null) return null;
  ensure(Array.isArray(notes) && notes.length <= 100, 'folderNotes must be null or a bounded array.');
  const seen = new Set();
  return Object.freeze(notes.map(note => {
    ensure(note && Object.keys(note).length === 3 && Object.hasOwn(note, 'folderPath') && Object.hasOwn(note, 'text') && Object.hasOwn(note, 'object_ids'), 'Invalid folder note.');
    ensure(typeof note.folderPath === 'string' && (note.folderPath === 'CLEAN' || note.folderPath.startsWith('CLEAN/')) && note.folderPath.length <= 1200 && note.folderPath.split('/').every(part => part && part !== '.' && part !== '..') && !/[\\:\u0000-\u001f\u007f]/u.test(note.folderPath), 'Invalid folder note path.');
    ensure(typeof note.text === 'string' && note.text.length > 0 && note.text.length <= 1200 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(note.text) && !/[A-Za-z]:[\\/]/u.test(note.text), 'Invalid folder note text.');
    ensure(Array.isArray(note.object_ids) && note.object_ids.length <= 500 && note.object_ids.every(id => typeof id === 'string' && RECORD_ID.test(id)), 'Invalid folder note object IDs.');
    const key = `${note.folderPath}\u0000${note.text}`;
    ensure(!seen.has(key), 'Duplicate folder note.');
    seen.add(key);
    return Object.freeze({ folderPath: note.folderPath, text: note.text, object_ids: Object.freeze([...new Set(note.object_ids)]) });
  }));
}

// Seed the canonical catalogue form so query/folder URLs still work when its existing client starts.
function seedCatalogueForm(html, params) {
  const fields = ['query', 'priority', 'status', 'collection_type', 'collection_scope', 'page_size'];
  let output = html;
  if (params.query !== undefined) output = output.replace(/(<input\b[^>]*\bid="catalogue-query"[^>]*)(\s*\/?\s*>)/u, `$1 value="${htmlAttribute(params.query)}"$2`);
  for (const field of fields.slice(1)) {
    if (params[field] === undefined) continue;
    const escaped = htmlAttribute(params[field]);
    const option = new RegExp(`(<select\\b[^>]*\\bname="${field}"[^>]*>[\\s\\S]*?<option\\b[^>]*value="${escaped}")`, 'u');
    output = output.replace(option, '$1 selected');
  }
  return output;
}

function send(request, response, status, contentType, payload, extraHeaders = {}) {
  const body = bytes(payload);
  response.statusCode = status;
  response.setHeader('Content-Type', contentType);
  response.setHeader('Content-Length', String(body.length));
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value);
  response.end(request.method === 'HEAD' ? undefined : body);
}

/**
 * Create a read-only Node/Vercel-compatible request handler. All indexes are explicit,
 * already validated inputs; this handler does not read files, crawl, or accept path names.
 * `transformHtml(html, url)` is the integration point for trusted navigation decoration.
 */
export function createReadonlyHandler({ catalogue, index, lexical, hierarchy, folderNotes = null, transformHtml = html => html, render = {} }) {
  ensure(catalogue?.schemaVersion && Array.isArray(catalogue.records), 'Prepared catalogue model required.');
  ensure(index && lexical?.rows && typeof transformHtml === 'function', 'Explicit private text and lexical indexes required.');
  const folders = hierarchy ?? buildCatalogueHierarchy(catalogue);
  const notes = validateFolderNotes(folderNotes);
  if (notes) {
    const recordsById = new Map(catalogue.records.map(record => [record.catalogueId, record]));
    for (const note of notes) {
      ensure(folders.folders.has(note.folderPath), 'Unknown folder note path.');
      for (const id of note.object_ids) {
        const record = recordsById.get(id);
        ensure(record?.collectionScope === 'clean' && record.logicalPath.startsWith(`${note.folderPath}/`), 'Folder note object is outside its exact folder.');
      }
    }
  }
  const catalogueMetrics = queryCatalogue(catalogue, { collection_scope: 'all', page_size: '1' }).counts;
  const hierarchyResult = params => {
    const result = queryCatalogueHierarchy(folders, params);
    return { ...result,
      counts: { ...result.counts, inventory_image_files: catalogueMetrics.inventory_image_files, clean_image_files: catalogueMetrics.clean_image_files, reader_links: catalogueMetrics.reader_links },
      notes: notes === null ? null : notes.filter(note => note.folderPath === result.selected_folder.logicalPath).map(note => ({ text: note.text, object_ids: note.object_ids }))
    };
  };

  async function handler(request, response) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      send(request, response, 405, 'text/plain; charset=utf-8', 'Method not allowed');
      return;
    }
    try {
      const url = requestUrl(request);
      if (!ROUTES.has(url.pathname)) return send(request, response, 404, 'text/plain; charset=utf-8', 'Not found');
      const params = strictParameters(url, ROUTE_FIELDS[url.pathname]);
      if (url.pathname === '/__catalogue_data') {
        const result = queryCatalogue(catalogue, params);
        return send(request, response, 200, JSON_TYPE, `${globalThis.JSON.stringify(result)}\n`);
      }
      if (url.pathname === '/__catalogue_hierarchy') {
        const result = hierarchyResult(params);
        return send(request, response, 200, JSON_TYPE, `${globalThis.JSON.stringify(result)}\n`);
      }
      if (url.pathname === '/archives/texte/') {
        const page = renderPreexistingText(index, url.searchParams);
        if (page === null) return send(request, response, 404, 'text/plain; charset=utf-8', 'Not found');
        return send(request, response, 200, HTML, await transformHtml(page, url));
      }
      if (url.pathname === '/archives/textes/') {
        const page = render?.texts ? await render.texts({ index, params, url }) : renderPreexistingTexts(index, url.searchParams);
        return send(request, response, 200, HTML, await transformHtml(page, url));
      }
      if (url.pathname === '/archives/reperes/') {
        const page = render?.lexical ? await render.lexical({ lexical, params, url }) : renderLexicalSearch(lexical, url.searchParams);
        return send(request, response, 200, HTML, await transformHtml(page, url));
      }
      const initialPage = hierarchyResult(params);
      const page = render?.catalogue
        ? await render.catalogue({ catalogue, hierarchy: folders, initialPage, params, url, hierarchyMode: true })
        : renderCataloguePage({ initialPage, hierarchy: true, preexistingTexts: true });
      return send(request, response, 200, HTML, await transformHtml(seedCatalogueForm(page, params), url));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request refused.';
      const isJson = request.url?.startsWith('/__catalogue_');
      return send(request, response, 400, isJson ? JSON_TYPE : 'text/plain; charset=utf-8', isJson ? `${globalThis.JSON.stringify({ error: message })}\n` : 'Invalid request.');
    }
  }

  return Object.freeze({ handler, catalogue, hierarchy: folders, index, lexical,
    pins: Object.freeze({ catalogueInputSha256: catalogue.inputSha256 ?? null, textIndexSha256: index.indexSha256 ?? null, lexicalManifestSha256: lexical.manifestSha256 ?? null, lexicalIndexSha256: lexical.indexSha256 ?? null }) });
}

export const READONLY_ROUTE_CONTRACT = Object.freeze({
  format: 'archives-publication-readonly/1.0.0',
  nodeRuntime: 'Node.js built-ins only; import canonical repository ESM modules listed in dependencies.json',
  methods: ['GET', 'HEAD'],
  routes: [...ROUTES],
  inputs: ['prepared catalogue model', 'prepared private preexisting-text index', 'pinned lexical search index'],
  readsFilesystem: false,
  writes: false,
  pathParameters: false
});

