import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
const { values } = parseArgs({ options: { selection: { type: 'string' }, version: { type: 'string', default: 'v15' } } });
const ensure = (ok, message) => { if (!ok) throw Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const root = resolve('.'), base = resolve('.private/archives-integration');
const selection = JSON.parse(await readFile(resolve(values.selection)));
ensure(selection.format === 'human-metadata-selection/1' && selection.independent_root_review === true, 'Closed selected handoffs and Root review required.');
ensure(['v15', 'v16', 'v17', 'v18', 'v19', 'v19-r2'].includes(values.version), 'Bounded metadata package version required.');
const parent = resolve(base, 'publication-package-20261004-v14'), output = resolve(base, 'publication-package-20261004-' + values.version), site = resolve(output, 'site');
try { await lstat(output); throw Error('Fresh metadata package required.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const parentBytes = await readFile(resolve(parent, 'assembly.json'));
ensure(sha(parentBytes) === 'a2819db2d57990e19478d0509b7ed8acb73adc918ed6619907dc1826b5472bcd', 'Selected v14 parent changed.');
const previous = JSON.parse(parentBytes), files = {}, changed = {}, added = {}, preservation = [];
const pinned = async (file, pin) => {
  ensure(await realpath(file) === file, 'Reparse input refused.');
  const bytes = await readFile(file);
  ensure(sha(bytes) === pin.sha256 && bytes.length === (pin.bytes ?? pin.size_bytes), 'Selected source changed.'); return bytes;
};
for (const entry of [selection.source, selection.secondary, selection.main, selection.catalogue_client, ...(selection.other ? [selection.other] : []), ...(selection.catalogue_labels ? [selection.catalogue_labels] : []), ...(selection.catalogue_style ? [selection.catalogue_style] : [])]) {
  ensure(entry.path && entry.handoff && entry.sha256 && entry.bytes, 'Exact selected input required.');
  await readFile(resolve(root, entry.handoff)); await pinned(resolve(root, entry.path), entry);
}
const source = await import(pathToFileURL(resolve(root, selection.source.path)).href);
const secondary = await import(pathToFileURL(resolve(root, selection.secondary.path)).href);
const main = await import(pathToFileURL(resolve(root, selection.main.path)).href);
const other = selection.other ? await import(pathToFileURL(resolve(root, selection.other.path)).href) : null;
if (other) ensure(typeof other.decorateOtherHumanScreens === 'function', 'Selected other-screen interface required.');
const catalogueLabels = selection.catalogue_labels ? await import(pathToFileURL(resolve(root, selection.catalogue_labels.path)).href) : null;
if (catalogueLabels) ensure(typeof catalogueLabels.decorateHumanCataloguePage === 'function', 'Selected catalogue-label interface required.');
ensure(Boolean(catalogueLabels) === Boolean(selection.catalogue_style), 'Catalogue labels require their selected external stylesheet.');
const catalogueStyleHref = '/assets/archives-human-catalogue-public-labels.css';
if (catalogueLabels) ensure(catalogueLabels.HUMAN_CATALOGUE_STYLE_HREF === catalogueStyleHref, 'Selected catalogue stylesheet interface changed.');
ensure(typeof source.decorateHumanSourcePage === 'function' && typeof secondary.decorateHumanSecondaryPage === 'function' && typeof main.decorateMainHumanLabels === 'function', 'Selected interfaces required.');
const protectedBlocks = html => [...html.matchAll(/<(pre|q|blockquote)\b[^>]*>[\s\S]*?<\/\1>|<div\b[^>]*class="archive-preexisting-literal"[^>]*>[\s\S]*?<\/div>/giu)].map(match => match[0]);
const links = html => [...html.matchAll(/\bhref="([^"]*)"/gu)].map(match => match[1]);
const attributes = html => [...html.matchAll(/\bdata-[a-z0-9-]+="[^"]*"/gu)].map(match => match[0]);
for (const [name, pin] of Object.entries(previous.files)) {
  if (!name.startsWith('dist/') || !name.endsWith('.html')) continue;
  const bytes = await pinned(resolve(parent, 'site', name), pin), html = bytes.toString('utf8');
  const route = '/' + name.slice('dist/'.length).replace(/index\.html$/u, '');
  let result = name === 'dist/archives/index.html' ? main.decorateMainHumanLabels(html) : html;
  result = source.decorateHumanSourcePage(result);
  if (other) result = other.decorateOtherHumanScreens(result, route);
  if (catalogueLabels) result = catalogueLabels.decorateHumanCataloguePage(result, route);
  result = secondary.decorateHumanSecondaryPage(result, route);
  if (result === html) continue;
  ensure(JSON.stringify(protectedBlocks(result)) === JSON.stringify(protectedBlocks(html)), 'Transcription or quotation changed: ' + name);
  const originalLinks = links(html), resultLinks = links(result);
  if (catalogueLabels && route === '/archives/catalogue/') {
    ensure(!originalLinks.includes(catalogueStyleHref) && resultLinks.filter(link => link === catalogueStyleHref).length === 1, 'Exactly one selected catalogue stylesheet required.');
    ensure(JSON.stringify(resultLinks.filter(link => link !== catalogueStyleHref)) === JSON.stringify(originalLinks), 'Existing link changed: ' + name);
  } else ensure(JSON.stringify(resultLinks) === JSON.stringify(originalLinks), 'Existing link changed: ' + name);
  const presentationMarker = attribute => /^(?:data-secondary-meta|data-human-meta)=/u.test(attribute);
  ensure(!attributes(html).some(presentationMarker), 'Parent already contains presentation markers.');
  const retainedAttributes = attributes(result).filter(attribute => !presentationMarker(attribute));
  ensure(JSON.stringify(retainedAttributes) === JSON.stringify(attributes(html)), 'Machine attributes changed: ' + name);
  changed[name] = Buffer.from(result);
  preservation.push({ file: name, before_sha256: sha(bytes), after_sha256: sha(changed[name]), protected_blocks: protectedBlocks(html).length, links: links(html).length, data_attributes: attributes(html).length });
}
const sourceTarget = 'scripts/archives-integration/human-source-pages.mjs', secondaryTarget = 'scripts/archives-integration/human-secondary-pages.mjs';
for (const [name, entry] of [[sourceTarget, selection.source], [secondaryTarget, selection.secondary]]) {
  ensure(!previous.files[name], 'Helper target overlaps parent.'); added[name] = await pinned(resolve(root, entry.path), entry);
}
if (other) {
  ensure(!previous.files['scripts/archives-integration/human-other-screens.mjs'], 'Other-screen helper overlaps parent.');
  added['scripts/archives-integration/human-other-screens.mjs'] = await pinned(resolve(root, selection.other.path), selection.other);
}
if (catalogueLabels) {
  ensure(!previous.files['scripts/archives-integration/human-catalogue-labels.mjs'], 'Catalogue-label helper overlaps parent.');
  added['scripts/archives-integration/human-catalogue-labels.mjs'] = await pinned(resolve(root, selection.catalogue_labels.path), selection.catalogue_labels);
  const styleTarget = 'dist' + catalogueStyleHref;
  ensure(!previous.files[styleTarget], 'Catalogue stylesheet overlaps parent.');
  added[styleTarget] = await pinned(resolve(root, selection.catalogue_style.path), selection.catalogue_style);
}
changed['dist/assets/archives-hierarchy.js'] = await pinned(resolve(root, selection.catalogue_client.path), selection.catalogue_client);
const runtimeName = 'scripts/archives-integration/publication-runtime.mjs';
const runtime = (await pinned(resolve(parent, 'site', runtimeName), previous.files[runtimeName])).toString('utf8');
const signature = 'export function decoratePublicationHtml(html) {', oldReturn = '  return result.replace(', nextFunction = '\n}\n\nexport async function loadPublicationData';
ensure([signature, oldReturn, nextFunction].every(marker => runtime.split(marker).length === 2), 'Runtime decoration landmarks changed.');
let presentation = 'decorateHumanSourcePage(presented)';
if (other) presentation = 'decorateOtherHumanScreens(' + presentation + ', url)';
if (catalogueLabels) presentation = 'decorateHumanCataloguePage(' + presentation + ', url)';
let projectedRuntime = runtime.replace(signature, "export function decoratePublicationHtml(html, url = '/archives/') {")
  .replace(oldReturn, '  const presented = result.replace(')
  .replace(nextFunction, '\n  return decorateHumanSecondaryPage(' + presentation + ', url);' + nextFunction);
projectedRuntime = "import { decorateHumanSourcePage } from './human-source-pages.mjs';\nimport { decorateHumanSecondaryPage } from './human-secondary-pages.mjs';\n" + projectedRuntime;
if (other) projectedRuntime = "import { decorateOtherHumanScreens } from './human-other-screens.mjs';\n" + projectedRuntime;
if (catalogueLabels) projectedRuntime = "import { decorateHumanCataloguePage } from './human-catalogue-labels.mjs';\n" + projectedRuntime;
changed[runtimeName] = Buffer.from(projectedRuntime);
const put = async (name, bytes) => {
  ensure(!files[name] && !name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe or duplicate target.');
  await mkdir(dirname(resolve(site, name)), { recursive: true }); await writeFile(resolve(site, name), bytes, { flag: 'wx' }); files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) if (name !== 'runtime/package-checksums.json') await put(name, changed[name] ?? await pinned(resolve(parent, 'site', name), pin));
for (const [name, bytes] of Object.entries(added)) await put(name, bytes);
const staticCount = Object.keys(files).filter(name => name.startsWith('dist/')).length;
ensure(staticCount === previous.counts.static_files + (catalogueLabels ? 1 : 0), 'Only the selected catalogue stylesheet may add a public file.');
ensure(Object.keys(files).filter(name => name.startsWith('api/') && name.endsWith('.mjs')).length === 10, 'Function selection changed.');
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'preservation.json'), JSON.stringify({ selection, changed_html: preservation, protected_blocks_exact: true, links_and_machine_attributes_exact: true, source_data_and_json_unchanged: true }, null, 2) + '\n', { flag: 'wx' });
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({ ...previous, parent_assembly_sha256: sha(parentBytes), counts: { ...previous.counts, static_files: staticCount, runtime_modules: previous.counts.runtime_modules + Object.keys(added).filter(name => name.startsWith('scripts/')).length, human_metadata_cleaned_pages: preservation.length }, human_metadata: { closed_handoffs_selected: true, static_and_dynamic_html: true, catalogue_client_rendering: true, source_data_unchanged: true, historical_confirmation: false, browser_gate_pending: true }, delta: { added: Object.keys(added), modified: Object.keys(changed).concat('runtime/package-checksums.json'), removed: [] }, files }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, cleaned_html_pages: preservation.length, static_files: staticCount, functions: 10, protected_texts_exact: true, browser_gate_pending: true }));
