import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, realpath, lstat, stat } from 'node:fs/promises';
import { resolve, relative, dirname, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loopbackBase, readBounded } from './media-preview.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const check = (value, message) => { if (!value) throw new Error(message); };
const pages = ['/archives/', '/archives/catalogue/', '/archives/recherche/', '/archives/formes/', '/archives/formes-brouillons/', '/archives/avancement/', '/archives/textes/', '/archives/reperes/', '/archives/corrections/'];
const asset = path => ['/styles.css', '/favicon.svg'].includes(path) || /^\/(?:assets|css|js)\/archives[-a-z0-9]*\.(?:css|js)$/u.test(path);
const image = path => /^\/__archive_draft_derivative\/[a-f0-9]{64}$/u.test(path) || /^\/archives\/media-releases\/[a-f0-9]{32}\/media\/[a-f0-9]{64}\.jpg$/u.test(path);
const textId = /^object:path-[a-f0-9]{64}$/u;

export function candidateFile(route) {
  check(typeof route === 'string' && route.startsWith('/') && !route.startsWith('//') && !/[\\%?#\u0000-\u001f]/u.test(route) && route.split('/').every(part => !['..', '.'].includes(part)), 'Unsafe snapshot route.');
  if (route.startsWith('/__archive_draft_derivative/')) return 'archives/media/draft/' + route.split('/').at(-1) + '.jpg';
  return route.slice(1) + (route.endsWith('/') ? 'index.html' : '');
}

// Capture only the already mounted consultation surface. No corpus file walker,
// database export, API proposal/session or repository internals enter dist.
export async function capturePublicationSnapshot({ origin, readerSha256, output, textIndexPath, textIndexSha256, scope = 'pilot' }) {
  const base = loopbackBase(origin);
  check(/^[a-f0-9]{64}$/u.test(readerSha256) && /^[a-f0-9]{64}$/u.test(textIndexSha256) && ['pilot', 'full'].includes(scope), 'Explicit snapshot inputs required.');
  const checkout = await realpath(resolve('.'));
  const target = resolve(output);
  const part = relative(checkout, target);
  check(part.startsWith('.private' + sep + 'archives-integration' + sep) && !isAbsolute(part) && !part.split(sep).includes('..'), 'Output must be a fresh private integration directory.');
  try { await lstat(target); throw new Error('Snapshot output already exists.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const parent = await realpath(dirname(target));
  check(parent === dirname(target), 'Output parent reparse points refused.');
  const allowedIndex = await realpath('Z:/Codex/repos/PHD-Maine-archives-import/data/private/coordinator-review/c07-complete-20261003-v1/reader-text-index.jsonl');
  check(await realpath(textIndexPath) === allowedIndex && textIndexSha256 === '9a0f3b57aea6c21f72132ef1c8af58564eface9f1ca9d267942718fbac772afe', 'Text index must be the accepted closed source.');
  const indexInfo = await stat(allowedIndex);
  check(indexInfo.isFile() && indexInfo.size <= 8 * 1024 * 1024, 'Text index input budget exceeded.');
  const indexBytes = await readFile(allowedIndex);
  check(indexBytes.length < 8 * 1024 * 1024 && hash(indexBytes) === textIndexSha256, 'Accepted text index changed.');
  const records = indexBytes.toString('utf8').trimEnd().split('\n').map(JSON.parse);
  check(records.length === 166 && new Set(records.map(row => row.object_id)).size === 166 && records.every(row => textId.test(row.object_id) && row.publication_status === 'private'), 'Text selection drift.');
  const selected = scope === 'pilot' ? records.slice(0, 1) : records;
  const fetched = new Map(), routes = [], queue = new Set(); let totalBytes = 0;
  const get = async route => {
    const response = await fetch(base + route, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    check(response.status === 200, 'Selected consultation route unavailable: ' + route.split('?')[0]);
    const bytes = await readBounded(response);
    return { bytes, type: response.headers.get('content-type') ?? '' };
  };
  const main = await get('/archives/');
  check(hash(main.bytes) === readerSha256, 'Mounted reader changed.');
  const collect = (bytes, type) => {
    if (!/^(?:text\/html|text\/css|(?:text|application)\/javascript)/u.test(type)) return;
    const source = bytes.toString('utf8');
    check(!/(?:file:\/\/|[CZ]:[\\/]|PHD_CORPUS_ROOT|http:\/\/(?:localhost|127\.0\.0\.1):)/u.test(source), 'Local locator in selected page or asset.');
    for (const match of source.matchAll(/["'(](\/(?:assets|css|js|styles\.css|favicon\.svg|__archive[^"'()\s]*|archives\/media-releases)[^"'()\s]*)["')]/gu)) {
      const route = match[1];
      if (asset(route) || image(route)) queue.add(route);
      else if (route.startsWith('/__archive') && !route.includes('${')) throw new Error('Original or unselected media route in export.');
    }
  };
  const keep = (route, value, file = candidateFile(route)) => {
    check(!fetched.has(route), 'Duplicate snapshot route.');
    totalBytes += value.bytes.length;
    check(totalBytes <= 256 * 1024 * 1024, 'Snapshot cumulative byte budget exceeded.');
    fetched.set(route, value); routes.push({ route, file, content_type: value.type, sha256: hash(value.bytes), size_bytes: value.bytes.length });
    collect(value.bytes, value.type);
  };
  keep('/archives/', main);
  for (const route of pages.slice(1)) keep(route, await get(route));
  // Static, discoverable per-file pages coexist with the existing query URL.
  for (const row of selected) {
    const route = '/archives/texte/?object_id=' + encodeURIComponent(row.object_id);
    const value = await get(route);
    const canonicalRoute = '/archives/textes/fichier/' + row.object_id.slice('object:path-'.length) + '/';
    keep(route, value, candidateFile(canonicalRoute));
  }
  while ([...queue].some(route => !fetched.has(route))) {
    const route = [...queue].find(item => !fetched.has(item));
    check(fetched.size < 240, 'Snapshot route budget exceeded.');
    const value = await get(route);
    if (image(route)) check(hash(value.bytes) === route.split('/').at(-1).replace(/\.jpg$/u, ''), 'Selected derivative hash changed.');
    keep(route, value);
  }
  const images = routes.filter(row => image(row.route));
  check(images.length === 19, 'Selected 19-photo surface incomplete.');
  await mkdir(resolve(target, 'site/dist'), { recursive: true });
  for (const row of routes) {
    const file = resolve(target, 'site/dist', row.file);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, fetched.get(row.route).bytes, { flag: 'wx' });
  }
  const result = { format: 'archives-publication-snapshot/1', scope, canonical_origin: 'https://valerianteissier.com', deployment_executed: false, public_activation_qualified: false, historical_confirmation: false, source_reader_sha256: readerSha256, source_text_index_sha256: textIndexSha256, counts: { text_files: selected.length, selected_derivatives: images.length, routes: routes.length }, routes };
  await writeFile(resolve(target, 'snapshot.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { origin: { type: 'string' }, 'reader-sha256': { type: 'string' }, output: { type: 'string' }, 'text-index': { type: 'string' }, 'text-index-sha256': { type: 'string' }, scope: { type: 'string', default: 'pilot' } } });
    const result = await capturePublicationSnapshot({ origin: values.origin, readerSha256: values['reader-sha256'], output: values.output, textIndexPath: values['text-index'], textIndexSha256: values['text-index-sha256'], scope: values.scope });
    console.log(JSON.stringify({ status: 'captured', counts: result.counts, activation: false }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
