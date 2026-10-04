import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const { values } = parseArgs({ options: { base: { type: 'string' }, reading: { type: 'string' }, output: { type: 'string' } } });
const root = await realpath(resolve('.')), base = await realpath(resolve(values.base));
const selected = await realpath(resolve(values.reading));
const output = resolve(values.output), site = resolve(output, 'site');
ensure(relative(root, output).startsWith('.private' + sep + 'archives-integration' + sep) && await realpath(dirname(output)) === dirname(output), 'Fresh private output required.');
try { await lstat(output); throw new Error('Output exists.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const baseBytes = await readFile(resolve(base, 'assembly.json')), previous = JSON.parse(baseBytes);
ensure(sha(baseBytes) === '8f0ebba9df71dd2f048db5353eaa2b0f677bf2ea83c59466a22522a8cf18f273' && previous.counts.direct_api_functions === 12, 'Reviewed v9 parent required.');
const sealBytes = await readFile(resolve(selected, 'closeout.json')), seal = JSON.parse(sealBytes);
ensure(seal.format === 'p09-six-line-handoff-seal/1' && seal.status === 'frozen-ready-for-root-recomposition-with-navigation-limitations' && seal.selected_assets.length === 4, 'Frozen pilot handoff required.');
ensure(seal.historical_confirmation === false && seal.publication_approved === false, 'The working pilot must not claim historical or publication approval.');
const get = async name => {
  const pin = seal.inventory[name], file = resolve(selected, name);
  ensure(pin && await realpath(file) === file, 'Unselected or reparsed pilot input.');
  const bytes = await readFile(file);
  ensure(bytes.length === pin.bytes && sha(bytes) === pin.sha256, 'Pilot input drift: ' + name);
  return bytes;
};
const reading = JSON.parse(await get('reading-contract.json')), binding = JSON.parse(await get('photo-binding.json'));
const admissionBuffer = await get('root-admission.json');
ensure(sha(admissionBuffer) === '537ee38eb0ec1bbed43330c5eeac507884982d373b3da18ac50e065728119dbb', 'Root pilot admission changed.');
const sourceBuffers = new Map();
for (const version of reading.versions) {
  ensure(['diplomatic', 'modern-french'].includes(version.kind), 'Unexpected text kind.');
  sourceBuffers.set(version.source_locator.source_id, await get(version.kind === 'diplomatic' ? 'diplomatic.txt' : 'modern-french.txt'));
}
const historyBuffer = await get('author-r0.txt'), independentBuffer = await get('independent-working-text-r0.txt');
const adapterPath = resolve(root, 'scripts/archives-next-readings/adapter-v3.mjs');
ensure(await realpath(adapterPath) === adapterPath && sha(await readFile(adapterPath)) === 'a0a51e3afb906767ee6638afc80b4a84a53e728fd1d76d4695a5d68bed7c5380', 'Qualified adapter changed.');
const parentBytes = await readFile(resolve(base, 'site/dist/archives/index.html'));
ensure(sha(parentBytes) === seal.parent_v8_sha256, 'v9 reader differs from qualified pilot parent.');
const { composeNextReadingV3 } = await import(pathToFileURL(adapterPath).href);
const result = composeNextReadingV3({ enabled: true, parentHtml: parentBytes.toString('utf8'), parentSha256: sha(parentBytes), reading, qualifiedImages: [binding], sourceBuffers, historyBuffer, independentBuffer, admissionBuffer, admissionSha256: sha(admissionBuffer) });
const composed = Buffer.from(result.html);
ensure(sha(composed) === seal.reader_sha256, 'Recomposed reader differs from qualified source.');
const assets = new Map();
const allowed = new Set(['/assets/archives-next-reading.css', '/assets/archives-next-reading.js', reading.history_href, binding.route]);
for (const pin of seal.selected_assets) {
  ensure(allowed.delete(pin.route), 'Unexpected or duplicate public route.');
  const bytes = await get(pin.file);
  ensure(bytes.length === pin.bytes && sha(bytes) === pin.sha256, 'Selected asset pin mismatch.');
  const name = 'dist/' + pin.route.slice(1) + (pin.route.endsWith('/') ? 'index.html' : '');
  assets.set(name, bytes);
}
ensure(allowed.size === 0 && binding.derivative_sha256 === '2a7b6be96cff6891a061152cf4e8f25d8a010a1a8697f8d6cc57b2ba76a98c34', 'Qualified route set/view missing.');
const files = {};
const put = async (name, bytes) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..') && !files[name], 'Unsafe or duplicate destination.');
  await mkdir(dirname(resolve(site, name)), { recursive: true });
  await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  if (name === 'runtime/package-checksums.json') continue;
  const file = resolve(base, 'site', name);
  ensure(await realpath(file) === file, 'Base reparse refused.');
  const bytes = await readFile(file);
  ensure(bytes.length === pin.size_bytes && sha(bytes) === pin.sha256, 'Base candidate drift.');
  await put(name, name === 'dist/archives/index.html' ? composed : bytes);
}
for (const [name, bytes] of assets) await put(name, bytes);
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({
  ...previous, parent_assembly_sha256: sha(baseBytes),
  counts: { ...previous.counts, static_files: previous.counts.static_files + 4, new_reading_photos: 1, total_selected_photos: previous.counts.selected_photos + 1, new_reading_selected_files: 4 },
  next_reading: {
    slug: reading.slug, source_seal_sha256: sha(sealBytes), adapter_sha256: 'a0a51e3afb906767ee6638afc80b4a84a53e728fd1d76d4695a5d68bed7c5380',
    admission_sha256: sha(admissionBuffer), line_count: 6, versions_preserved: 4,
    photo_source_object_id: binding.source_object_id, derivative_sha256: binding.derivative_sha256,
    source_original_reopened: false, historical_confirmation: false, human_review: 'pending',
    pointer_history_navigation: 'requires Root browser qualification',
    browser_gate_replayed: false, preserved_baseline_photo_count: 19,
  }, files,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, static_files: previous.counts.static_files + 4, selected_photos_total: 20, new_reading_line_count: 6, direct_api_functions: 12, deployed: false }));
