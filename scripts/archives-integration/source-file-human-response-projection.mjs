import { decorateSourceTextPage } from './source-text-page-decoration.mjs';

/** Normalize the existing HTML bookmark route; JSON responses never enter here. */
export function projectSourceFileHumanResponse(html, requestUrl) {
  const url = requestUrl instanceof URL ? requestUrl : new URL(String(requestUrl), 'https://private.invalid');
  let selected = url;
  if (url.pathname === '/archives/texte/') {
    const values = url.searchParams.getAll('object_id');
    const match = values.length === 1 && values[0].match(/^object:path-([a-f0-9]{64})$/u);
    if (!match) return html;
    selected = new URL('/archives/textes/fichier/' + match[1] + '/', url.origin);
  }
  if (!/^\/archives\/textes\/fichier\/[a-f0-9]{64}\/$/u.test(selected.pathname)) return html;
  return decorateSourceTextPage(html, selected).html;
}
