import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const sha = b => createHash('sha256').update(b).digest('hex');
const formPath = resolve('../PHD-Maine-paleography-harness/data/private/p09-form-projection-mvp-20261004-v1/run02/forms.json');
const bodyPath = resolve('../PHD-Maine-paleography-harness/data/private/transcription-campaign/e99-p09-full-view-20261004-v1/transcription-body.full-r0.txt');
const formBytes = await readFile(formPath), bodyBytes = await readFile(bodyPath);
ensure(sha(formBytes) === '1824607dc38d3d71e76aba06e36d24befd7fa61592b728e96a6e35bc4f8ebe23' && sha(bodyBytes) === 'b827189b0e30ad119e825bfdd8e2267c3321c635891dd08581d16ac080c1dee1', 'Frozen form sources changed.');
const projection = JSON.parse(formBytes), body = bodyBytes.toString('utf8'), chars = Array.from(body);
ensure(projection.format === 'p09-form-projection/1.0.0' && projection.forms.length === 4 && projection.human_review === 'pending' && projection.confirmed_memory === false && projection.canonical_updates === 0, 'Four unconfirmed forms required.');
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const sourceLines = body.replace(/\n$/u, '').split('\n');
for (const f of projection.forms) {
  ensure(f.source_text_version === 'author-full-view-r0' && f.reading_status === 'unresolved' && f.entity_id === null && f.bbox === null && f.comparison_variant.span === null && f.comparison_variant.offset_mapping === null, 'A form promotes certainty or crosses edition offsets.');
  ensure(chars.slice(f.span.start, f.span.end).join('') === f.quote && sourceLines[Number(f.physical_line.slice(1)) - 1] === f.line_context_exact, 'Literal form anchor mismatch.');
  ensure(f.alternatives.every(a => a.status === 'proposed-unaccepted'), 'Accepted alternatives must not be invented.');
}
const slug = 'next-reading-p09-author-pilot', history = '/archives/next-readings/versions/p09-full-view-proposed/';
const descriptions = {
  'occ:p09-full-body-u002': {
    Beatrix: 'L’auteur du pilote propose cette lecture d’après l’initiale et le groupe « trix », tous deux incertains ; aucune confirmation.',
    Bertrix: 'L’auteur du pilote conserve la possibilité d’un « r » supplémentaire ; aucune confirmation.',
    Katherine: 'Hypothèse concurrente rapportée dans le compte rendu d’admission du pilote par le coordinateur, ligne 1 ; elle n’est pas une observation visuelle de l’auteur de ce brouillon.'
  },
  'occ:p09-full-body-u027': {
    souille: 'L’auteur conserve cette graphie du pilote avec des groupes de jambages intérieurs incertains.',
    soille: 'L’auteur envisage une liaison intérieure sans « u » ; aucune identification géographique.'
  },
  'occ:p09-full-body-abbr03': {
    vostre: 'Développement proposé de l’abréviation ; les lettres omises restent hors du brouillon diplomatique.',
    votre: 'Autre développement ou forme moderne proposée, distinguée de la graphie source.'
  },
  'occ:p09-full-body-u151': {
    septenbre: 'Dans la formule finale, l’auteur propose les lettres « s/e/p/t » et conserve l’ambiguïté du groupe « n/m ».',
    septembre: 'Autre regroupement « n/m » proposé par l’auteur ; le mois reste hypothétique et ne devient pas une date normalisée de l’acte.'
  }
};
const describeAlternative = (f, a) => {
  const description = descriptions[f.id]?.[a.reading];
  ensure(description, 'Unmapped proposal provenance.');
  if (a.reading === 'Katherine') ensure(a.rationale.includes('reported by Root admission line 1') && a.rationale.includes('not adopted'), 'Competing proposal provenance changed.');
  return description;
};
const cards = projection.forms.map((f, i) => `<section class="full-edition" id="forme-${i + 1}"><h2>Ligne ${Number(f.physical_line.slice(1))} · lecture à vérifier</h2><pre class="next-reading-text" data-form-quote="${i + 1}">${escape(f.quote)}</pre><p>Propositions conservées, toutes non confirmées :</p><ul>${f.alternatives.map(a => `<li><strong>${escape(a.reading)}</strong> — ${escape(describeAlternative(f, a))}</li>`).join('')}</ul><details><summary>Voir la ligne du brouillon auteur</summary><pre class="next-reading-text" data-form-context="${i + 1}">${escape(f.line_context_exact)}</pre></details><p><a href="${history}#full-history">Consulter les versions sources</a></p></section>`).join('');
const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lectures à vérifier — P09</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/css/archives.css"><link rel="stylesheet" href="/assets/archives-next-reading-full.css"></head><body><main class="next-reading-content full-versions-page"><p><a href="/archives/#${slug}">Revenir au document</a> · <a href="/archives/formes/">Répertoire des formes</a></p><h1>Quatre lectures à vérifier</h1><p>Premiers exemples du corps P09. Ces citations viennent du brouillon complet de l’auteur, conservé séparément de l’édition proposée après comparaison.</p><p>Les hypothèses restent ouvertes. Aucun nom, lieu ou fragment de date n’est identifié ou confirmé. Le mot n’est pas encore aligné précisément sur la photographie.</p>${cards}<p><a href="/archives/#${slug}">Revenir au document</a></p></main></body></html>`;
ensure(!/(?:[A-Z]:[\\/]|\.private[\\/]|object:|segment:|\.json\b|<script|\son\w+=|\sstyle=)/iu.test(html), 'Private data or inline code in the form page.');
const out = resolve('.private/archives-integration/p09-form-page-mvp-20261004-v3');
try { await lstat(out); throw new Error('Fresh form page output required.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
await mkdir(out);
await writeFile(resolve(out, 'index.html'), html, { flag: 'wx' });
await writeFile(resolve(out, 'verification.json'), JSON.stringify({ passed: true, forms: 4, literal_anchors_checked: 4, source_edition: 'author-full-view-r0', comparison_offsets_asserted: false, confirmed_memory: false, image_reads: 0, route: '/archives/formes/p09/', page_sha256: sha(Buffer.from(html)), projection_sha256: sha(formBytes), body_sha256: sha(bodyBytes), browser_gate_pending: true, publication_executed: false }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ out, forms: 4, public_route_prepared: '/archives/formes/p09/', browser_gate_pending: true }));
