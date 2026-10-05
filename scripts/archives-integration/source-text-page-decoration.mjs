function hasUnsafeMarkup(html) {
  if (/<style\b|\sstyle\s*=|\son[a-z]+\s*=/iu.test(html)) return true;
  const opens = html.match(/<script\b/giu) || [];
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu)];
  if (opens.length !== scripts.length) return true;
  return scripts.some(([, attrs, body]) => {
    const sources = [...attrs.matchAll(/(?:^|\s)src\s*=\s*(["'])([^"']*)\1/giu)];
    return body.trim() !== '' || sources.length !== 1 ||
      !/^\/assets\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:m?js)$/iu.test(sources[0][2]);
  });
}
const TARGET_ID = '81f2195b2dd92184859c2301a8da2f1126c3b7e25cdf8b1d1f6684029fa66a45';
const PHOTO_FOLDER = 'CLEAN/Photos des Archives/E.108 - 1470. — Baronnie de Milesse, dépendant du marquisat de Lavardin';
const PHOTO_HREF = `/archives/catalogue/?folder=${encodeURIComponent(PHOTO_FOLDER)}`;
const CLEAN_CRUMB = /(<a href="\/archives\/textes\/\?folder=CLEAN&amp;query=&amp;page=1&amp;page_size=20">)CLEAN(<\/a>)/u;

/** Display-only, idempotent decoration for generated pre-existing-text pages. */
export function decorateSourceTextPage(html, pageUrl) {
  if (typeof html !== 'string') throw new TypeError('Expected page HTML');
  const url = new URL(pageUrl, 'http://localhost');
  const route = url.pathname.match(/^\/archives\/textes\/fichier\/([a-f0-9]{64})\/$/u);
  if (!route) return { html, applied: false, reason: 'outside-source-file-route' };
  const objectId = route[1];
  if (html.includes('data-human-meta="source-logical-path"')) {
    return { html, applied: false, reason: 'already-decorated' };
  }

  const pathMatch = html.match(/<p class="catalogue-path">([\s\S]*?)<\/p>/u);
  const literalMatch = html.match(/<div class="archive-preexisting-literal" id="preexisting-text">([\s\S]*?)<\/div>/u);
  const emptyMatch = html.match(/<p class="catalogue-notice">Fichier vide : aucun texte dans cette occurrence\.<\/p>/u);
  const titleMatch = html.match(/<title>([\s\S]*?) — atelier privé<\/title>/u);
  if (!pathMatch || (!literalMatch && !emptyMatch) || !titleMatch || !CLEAN_CRUMB.test(html)) {
    throw new Error(`Unsupported source page shape for ${objectId}`);
  }
  if (pathMatch[1].includes('</template')) throw new Error(`Unsafe logical path on ${objectId}`);

  let result = html.replace(pathMatch[0], `<template data-human-meta="source-logical-path" hidden>${pathMatch[1]}</template>`);
  result = result.replace(titleMatch[0], `<title>${titleMatch[1]} — textes préexistants</title>`);
  result = result.replace(CLEAN_CRUMB, '$1Fonds classé$2');

  if (objectId === TARGET_ID) {
    const breadcrumbs = result.match(/<nav class="catalogue-breadcrumbs"[\s\S]*?<\/nav>/u)?.[0];
    if (!breadcrumbs) throw new Error('Pilot breadcrumb landmark missing');
    const notice = `<aside class="catalogue-notice" data-source-file-context="e108-folder"><p><a href="${PHOTO_HREF}">Photographies classées sous E.108</a></p><p>Ce classement commun ne confirme pas que les images et ce texte concernent la même pièce ou personne.</p></aside>`;
    result = result.replace(breadcrumbs, `${breadcrumbs}${notice}`);
  }

  if (literalMatch) {
    const afterLiteral = result.match(/<div class="archive-preexisting-literal" id="preexisting-text">([\s\S]*?)<\/div>/u);
    if (!afterLiteral || afterLiteral[1] !== literalMatch[1]) throw new Error(`Source literal changed for ${objectId}`);
  } else if (!result.includes(emptyMatch[0])) {
    throw new Error(`Empty occurrence marker changed for ${objectId}`);
  }
  if (hasUnsafeMarkup(result)) throw new Error(`Unexpected executable markup on ${objectId}`);
  return { html: result, applied: true, objectId, photoHref: objectId === TARGET_ID ? PHOTO_HREF : null };
}

export const SOURCE_TEXT_DECORATION = Object.freeze({
  version: '0.2.0',
  route: '/archives/textes/fichier/{64-lowercase-hex}/',
  inertPathAttribute: 'data-human-meta="source-logical-path"',
  humanCollectionLabel: 'Fonds classé',
  sourceLiteralPreserved: true,
  photoLink: 'pilot-only; exact-folder-classification; no file/person/document relation asserted',
});
