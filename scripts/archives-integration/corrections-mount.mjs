import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guardRequest } from './media-preview.mjs';
import { addAtelierNavigation } from './atelier-preview.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const CLIENT = '/assets/archives-integration-corrections.js';
const STYLE = '/assets/archives-integration-corrections.css';
const PAGE = '/archives/corrections/';
const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Proposer une lecture — atelier historique</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="${STYLE}"></head><body><main><p>Atelier historique · travaux en cours</p><h1>Proposer une lecture</h1><p>Ce premier passage concerne le dossier Monbezon. <a href="/archives/#candidate-atelier-47958c7faa376f7e4729edd9babe9b40">Voir le dossier et ses photos</a>.</p><h2>Lecture conservée</h2><div class="source-text" id="correction-source">Chargement du passage…</div><details><summary>Historique des versions</summary><ol id="correction-history"></ol></details><form id="correction-form"><label for="correction-replacement">Votre lecture du passage</label><textarea id="correction-replacement" name="replacement" rows="10" minlength="1" maxlength="5000" required></textarea><label for="correction-reason">Ce qui motive votre proposition</label><textarea id="correction-reason" name="reason" rows="3" minlength="1" maxlength="1000" required></textarea><button id="correction-submit" type="submit" disabled>Enregistrer la proposition</button></form><p id="correction-status" role="status" aria-live="polite">Chargement du passage…</p><p class="notice">Les propositions sont conservées dans cet atelier local. La validation par le propriétaire sera activée après le raccord de son accès. La lecture conservée reste intacte.</p></main><script src="${CLIENT}" defer></script></body></html>`;

export async function loadMountedCorrections({ readyFile, readySha256, origin }) {
  ensure(/^[a-f0-9]{64}$/u.test(readySha256), 'Explicit mount-ready pin required.');
  const bytes = await readFile(readyFile);
  ensure(bytes.length < 16384 && digest(bytes) === readySha256, 'Mount-ready drift.');
  const ready = JSON.parse(bytes);
  ensure(ready.version === 'd8-direct-mount-ready/v1' && ready.gate_passed === true && ready.test_store_released === true && ready.test_processes_exited === true && ready.origin === origin && ready.historical_decisions_enabled === false && ready.human_identity_verified === false, 'Correction gate or origin mismatch.');
  const factoryRoot = dirname(ready.factory_module);
  const factoryPins = { 'app.mjs': '150f8f47008a0a5006ef6c8fe9ea4db32c1d4f91096b7f660f5bf3af75da3a8c', 'handler.mjs': '953718b5f1bdb3422e9dfb26c72518eb682f3cba0b9b1febf19e3aa510c349fc', 'config.mjs': '081cf83ed0dd2531c376e40d07f2163e948106b044b62cec07ef4edd934f76a0' };
  for (const [name, expected] of Object.entries(factoryPins)) ensure(digest(await readFile(resolve(factoryRoot, name))) === expected, 'Accepted correction factory drift.');
  const local = dirname(fileURLToPath(import.meta.url));
  const client = await readFile(resolve(local, 'corrections-client.js'));
  const css = await readFile(resolve(local, 'lexical-search.css'));
  const style = Buffer.concat([css, Buffer.from('.source-text{white-space:pre-wrap;overflow-wrap:anywhere;padding:24px;border:1px solid var(--line);background:#f7faf8}#correction-form{display:grid}textarea{font:inherit;line-height:1.5;max-width:100%;padding:12px;resize:vertical}#correction-status{overflow-wrap:anywhere}.notice{font-size:.9rem}')]);
  const factory = await import(pathToFileURL(ready.factory_module).href);
  const app = await factory.openIntegrated(ready.config_file, { origin });
  return { origin, readySha256, app, isRoute: path => [PAGE, CLIENT, STYLE].includes(path) || path.startsWith('/api/archive/preview/') || path.startsWith('/api/archive/fixture/'), async handle(request, response) {
    if (request.url.startsWith('/api/archive/')) return app.handler(request, response);
    const guard = guardRequest(request, origin);
    const send = (status, type, content) => { response.writeHead(status, { 'Content-Type': type, 'Content-Length': content.length }); response.end(request.method === 'HEAD' ? undefined : content); };
    if (guard.status) { send(guard.status, 'text/plain; charset=utf-8', Buffer.from('Request refused')); return; }
    if (guard.url.search) { send(404, 'text/plain; charset=utf-8', Buffer.from('Not found')); return; }
    if (guard.url.pathname === CLIENT) send(200, 'text/javascript; charset=utf-8', client);
    else if (guard.url.pathname === STYLE) send(200, 'text/css; charset=utf-8', style);
    else send(200, 'text/html; charset=utf-8', Buffer.from(addAtelierNavigation(page, { corrections: true })));
  }, close: () => app.close() };
}
