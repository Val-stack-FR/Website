import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { parseArgs } from 'node:util';
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const { values } = parseArgs({ options: { base: { type: 'string' }, map: { type: 'string' }, output: { type: 'string' } } });
const root = await realpath(resolve('.')), base = await realpath(resolve(values.base));
const map = await realpath(resolve(values.map)), output = resolve(values.output), site = resolve(output, 'site');
ensure(relative(root, output).startsWith('.private' + sep + 'archives-integration' + sep) && await realpath(dirname(output)) === dirname(output), 'Fresh private output required.');
try { await lstat(output); throw new Error('Output exists.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const previousBytes = await readFile(resolve(base, 'assembly.json')), previous = JSON.parse(previousBytes);
const mapPinsBytes = await readFile(resolve(map, 'pins.json')), mapPins = JSON.parse(mapPinsBytes);
ensure(mapPins.outputs.length === 5 && previous.counts.direct_api_functions === 12, 'Expected selected map and twelve functions.');
const files = {}, changedNavigation = [];
const put = async (name, bytes) => {
  ensure(!name.startsWith('/') && !/[\\\u0000-\u001f]/u.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..') && !files[name], 'Unsafe or duplicate file.');
  await mkdir(dirname(resolve(site, name)), { recursive: true }); await writeFile(resolve(site, name), bytes, { flag: 'wx' });
  files[name] = { size_bytes: bytes.length, sha256: sha(bytes) };
};
for (const [name, pin] of Object.entries(previous.files)) {
  if (name === 'runtime/package-checksums.json') continue;
  const source = resolve(base, 'site', name); ensure(await realpath(source) === source, 'Base reparse refused.');
  let bytes = await readFile(source); ensure(bytes.length === pin.size_bytes && sha(bytes) === pin.sha256, 'Base candidate drift.');
  if (name.startsWith('dist/archives/') && name.endsWith('.html')) {
    let html = bytes.toString('utf8');
    const nav = /(<nav class="atelier-navigation"[^>]*>)([\s\S]*?)(<\/nav>)/u;
    if (nav.test(html)) {
      html = html.replace(nav, (_, start, links, end) => start + links + '<a href="/archives/cartes/extrait/">Carte en préparation</a>' + end);
      changedNavigation.push(name);
    }
    if (name === 'dist/archives/index.html') {
      html = html.replace('<title>Consultation privée des archives</title>', '<title>Archives — travaux en cours</title>');
      html = html.replace('Dossiers expérimentaux issus de l’export d’import. Une entrée n’est pas présentée comme un acte identifié lorsque ses IDs canoniques sont absents.', 'Consultez les transcriptions, leur version en français moderne et les photos. Les lectures en cours restent signalées comme brouillons.');
    }
    bytes = Buffer.from(html);
  }
  await put(name, bytes);
}
ensure(changedNavigation.length >= 7, 'Common navigation missing.');
const navSource = (await readFile(resolve(base, 'site/dist/archives/index.html'), 'utf8')).match(/<nav class="atelier-navigation"[^>]*>[\s\S]*?<\/nav>/u)?.[0];
ensure(navSource, 'Reader common navigation unavailable.');
for (const pin of mapPins.outputs) {
  ensure(pin.path.startsWith('sourcepacket/site/'), 'Map allowlist path refused.');
  const source = resolve(map, pin.path); ensure(await realpath(source) === source, 'Map reparse refused.');
  let bytes = await readFile(source); ensure(bytes.length === pin.bytes && sha(bytes) === pin.sha256, 'Map source pin mismatch.');
  const name = 'dist/archives/cartes/extrait/' + pin.path.slice('sourcepacket/site/'.length);
  if (pin.path.endsWith('/index.html')) {
    let html = bytes.toString('utf8');
    html = html.replace('<title>Régions — extrait hybride de navigation</title>', '<title>Carte — extrait navigable</title>');
    html = html.replace('<link rel="stylesheet" href="assets/map.css">', '<link rel="stylesheet" href="assets/map.css">\n<link rel="stylesheet" href="/assets/archives-integration-navigation.css">');
    html = html.replace('<body>', '<body>' + navSource);
    html = html.replace('CANDIDAT · navigation hybride · extrait local', 'TRAVAIL EN COURS · extrait de carte');
    html = html.replace('Consulter un extrait cartographique et ses sélections techniques', 'Explorer un extrait de carte');
    html = html.replace('<strong>Fond raster haute qualité et cinq sélections.</strong> Le rendu PDF demeure un raster de résolution finie ; les cinq sélections sont des annotations techniques provenant de la représentation PDF.', '<strong>Agrandissez la carte, déplacez-vous et sélectionnez les repères.</strong> La référence et le sens des couleurs restent à confirmer.');
    html = html.replace(/<p class="foot">Extrait borné:[\s\S]*?<\/p>/u, '');
    html = html.replace(/<p class="foot">Extrait borné :[\s\S]*?<\/p>/u, '');
    html = html.replace('Navigation hybride · rendu haute définition', 'Consulter la carte');
    html = html.replace('Rendu PDF · 576 dpi · arrière-plan raster', 'Carte et repères');
    html = html.replace('Cinq objets techniques', 'Repères sélectionnables');
    html = html.replace('Choisir un objet technique', 'Choisir un repère');
    html = html.replace('<p id="bbox" class="technical"></p>', '<details><summary>Dimensions du repère</summary><p id="bbox" class="technical"></p></details>');
    ensure(!/<(?:script|style)(?![^>]*\bsrc=)[^>]*>[\s\S]*?[^\s][\s\S]*?<\//u.test(html.replace(/<script[^>]+src=[^>]+><\/script>/gu, '')) && !/\son[a-z]+\s*=/iu.test(html), 'Unexpected inline executable content.');
    bytes = Buffer.from(html);
  }
  await put(name, bytes);
}
await put('runtime/package-checksums.json', Buffer.from(JSON.stringify(files, null, 2) + '\n'));
await writeFile(resolve(output, 'assembly.json'), JSON.stringify({
  ...previous, parent_assembly_sha256: sha(previousBytes),
  counts: { ...previous.counts, static_files: previous.counts.static_files + 5, cartography_selected_files: 5 },
  cartography: { route: '/archives/cartes/extrait/', source_pins_sha256: sha(mapPinsBytes), selected_objects: 5, georeferenced: false, time_ownership_claims: false, historical_color_interpretation: 'pending', navigation_pages_changed: changedNavigation, ui_delta: 'Simple labels, common navigation and collapsed dimensions; geometry and assets unchanged.' },
  files,
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ assembled: true, static_files: 320, selected_map_files: 5, navigation_pages_changed: changedNavigation.length, direct_api_functions: 12, deployed: false }));
