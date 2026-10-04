import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const sha = b => createHash('sha256').update(b).digest('hex');
const base = resolve('.private/archives-integration/publication-package-20261004-v11');
const selected = resolve('.private/archives-integration/p09-form-page-mvp-20261004-v3');
const output = resolve('.private/archives-integration/publication-package-20261004-v12-r2');
const site = resolve(output, 'site');
try { await lstat(output); throw new Error('Fresh v12 output required.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const parentBytes = await readFile(resolve(base, 'assembly.json')), previous = JSON.parse(parentBytes);
ensure(sha(parentBytes) === 'bfdc66ad6e1d4acafa37ddf38adff62fef772006a1563a17e8bf74f96a822c40', 'Reviewed v11 required.');
const pageBytes = await readFile(resolve(selected, 'index.html'));
const pageProof = JSON.parse(await readFile(resolve(selected, 'verification.json')));
ensure(sha(pageBytes) === '689366e18f7cbe2a1667b9e53d0653ce8a7923eb59a0d37cc107740a38c014b4' && pageProof.passed && pageProof.forms === 4 && pageProof.confirmed_memory === false && pageProof.comparison_offsets_asserted === false, 'Unconfirmed four-form page required.');
const page = pageBytes.toString('utf8');
ensure((page.match(/data-form-quote=/gu) || []).length === 4 && (page.match(/data-form-context=/gu) || []).length === 4 && !/(?:[A-Z]:[\\/]|\.private[\\/]|<script|<style|\son\w+=|\sstyle=)/iu.test(page), 'Unsafe or expanded page.');
const files = {}, changed = {};
const mainName = 'dist/archives/index.html', libraryName = 'dist/archives/formes-brouillons/index.html';
const sourceMain = (await readFile(resolve(base, 'site', mainName))).toString('utf8');
const sourceLibrary = (await readFile(resolve(base, 'site', libraryName))).toString('utf8');
const historyLink = '<a href="/archives/next-readings/versions/p09-full-view-proposed/">Voir les dix versions de lecture</a>';
const formLink = '<a href="/archives/formes/p09/">Quatre lectures à vérifier dans le brouillon auteur</a>';
ensure(sourceMain.split(historyLink).length === 2 && sourceLibrary.split('</header>').length === 2, 'Unique navigation insertion required.');
const libraryLink = '<p class="draft-review-meta"><a href="/archives/formes/p09/">P09 : quatre lectures à vérifier</a> · Nouveau lot distinct, issu du brouillon auteur, avec neuf hypothèses non confirmées et leurs contextes.</p>';
const main = sourceMain.replace(historyLink, historyLink + formLink);
const library = sourceLibrary.replace('</header>', libraryLink + '</header>');
ensure(main.replace(formLink, '') === sourceMain && library.replace(libraryLink, '') === sourceLibrary, 'Existing content changed beyond navigation.');
changed[mainName] = Buffer.from(main); changed[libraryName] = Buffer.from(library);
// This route also renders through its existing API rewrite for search queries.
// Apply the same navigation to that HTML path; JSON and other routes stay exact.
const runtimeName = 'scripts/archives-integration/publication-runtime.mjs';
const runtimeSource = (await readFile(resolve(base, 'site', runtimeName))).toString('utf8');
const originalRender = 'decoratePublicationHtml(renderDraftProjection(page))';
const linkedRender = originalRender + `.replace('</header>', ${JSON.stringify(libraryLink + '</header>')})`;
ensure(runtimeSource.split(originalRender).length === 2, 'Unique draft HTML render required.');
const runtime = runtimeSource.replace(originalRender, linkedRender);
ensure(runtime.replace(linkedRender, originalRender) === runtimeSource, 'Runtime change exceeds draft HTML navigation.');
changed[runtimeName] = Buffer.from(runtime);
const put = async (name, bytes) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..') && !files[name], 'Unsafe or duplicate destination.');
  await mkdir(dirname(resolve(site, name)), { recursive: true });
  await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  if (name === 'runtime/package-checksums.json') continue;
  const file = resolve(base, 'site', name);
  ensure(await realpath(file) === file, 'Parent reparse refused.');
  const bytes = await readFile(file);
  ensure(bytes.length === pin.size_bytes && sha(bytes) === pin.sha256, 'Parent pin drift.');
  await put(name, changed[name] || bytes);
}
await put('dist/archives/formes/p09/index.html', pageBytes);
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({
  ...previous, parent_assembly_sha256: sha(parentBytes),
  counts: { ...previous.counts, static_files: previous.counts.static_files + 1, p09_unconfirmed_form_examples: 4 },
  p09_forms: { route: '/archives/formes/p09/', source_edition: 'author-full-view-r0', page_sha256: sha(pageBytes), projection_sha256: pageProof.projection_sha256, source_body_sha256: pageProof.body_sha256, examples: 4, alternatives: 9, image_alignment: null, confirmed_memory: false, canonical_updates: 0, historical_confirmation: false, static_and_query_navigation: true, browser_gate_pending: true },
  files,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, static_files: previous.counts.static_files + 1, forms: 4, new_api_functions: 0, new_images: 0, browser_gate_pending: true }));
