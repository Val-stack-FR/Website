import { createHash } from 'node:crypto';

export const E108_PARENT_CATALOGUE_SHA256 = '13376bd64cfa99499638e73d3e22138eda188bad793e25374087da2d74e8d0b4';
export const E108_COMPOSED_CATALOGUE_SHA256 = '39323337b307c7d2116cb07536dca722ddc543b8bb582596b3a7765b4687ae63';
export const E108_CATALOGUE_PATH = '/archives/catalogue/';

const NOTICE = '<aside class="catalogue-notice" aria-label="Limites du catalogue">';
const INTRO_START = '<aside class="catalogue-ensemble-entry" aria-label="Ensemble proposé E.108">';
const TEMPLATE_START = '<template id="e108-ensemble-template"';
const SCRIPT_START = '<script src="/assets/archives-catalogue-ensemble.js" defer></script>';
const CSS_HREF = 'href="/assets/archives-catalogue-ensemble.css"';
const DOUBLE_PROJECTION_MARKERS = [
  'class="catalogue-ensemble-entry"',
  CSS_HREF,
  'id="e108-ensemble-template"',
  SCRIPT_START,
];

const ensure = (condition, message) => {
  if (!condition) throw new Error(`E108 response projection: ${message}`);
};

const digestText = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const count = (value, token) => value.split(token).length - 1;

function strictLandmarks(html) {
  const headOpen = html.match(/<head(?=[\s>])[^>]*>/giu) ?? [];
  const headClose = html.match(/<\/head\s*>/giu) ?? [];
  const bodyOpen = html.match(/<body(?=[\s>])[^>]*>/giu) ?? [];
  const bodyClose = html.match(/<\/body\s*>/giu) ?? [];
  ensure(headOpen.length === 1 && headClose.length === 1, 'head landmarks must each be unique');
  ensure(bodyOpen.length === 1 && bodyClose.length === 1, 'body landmarks must each be unique');
  const headOpenAt = html.search(/<head(?=[\s>])[^>]*>/iu);
  const headCloseAt = html.search(/<\/head\s*>/iu);
  const bodyOpenAt = html.search(/<body(?=[\s>])[^>]*>/iu);
  const bodyCloseAt = html.search(/<\/body\s*>/iu);
  ensure(headOpenAt < headCloseAt && headCloseAt < bodyOpenAt && bodyOpenAt < bodyCloseAt, 'head/body landmark order is invalid');
  return { headCloseAt, bodyCloseAt };
}

function replaceOnce(source, needle, insertion, label) {
  ensure(count(source, needle) === 1, `${label} landmark must be unique`);
  return source.replace(needle, insertion);
}

function removeOnce(source, needle, label) {
  ensure(count(source, needle) === 1, `${label} insertion must occur exactly once`);
  return source.replace(needle, '');
}

function generatedRuntimeSource(insertions) {
  const embedded = JSON.stringify(insertions);
  return `// Generated from the pinned E.108 parent/composed catalogue difference.\nconst INSERTIONS = Object.freeze(${embedded});\nconst CATALOGUE_PATH = '/archives/catalogue/';\nconst NOTICE = '<aside class="catalogue-notice" aria-label="Limites du catalogue">';\nconst INTRO_MARKER = 'class="catalogue-ensemble-entry"';\nconst CSS_MARKER = 'href="/assets/archives-catalogue-ensemble.css"';\nconst TEMPLATE_MARKER = 'id="e108-ensemble-template"';\nconst SCRIPT_MARKER = '<script src="/assets/archives-catalogue-ensemble.js" defer></script>';\nconst ensure = (condition, message) => { if (!condition) throw new Error('E108 response projection: ' + message); };\nconst count = (value, token) => value.split(token).length - 1;\nconst replaceOnce = (source, needle, insertion, label) => { ensure(count(source, needle) === 1, label + ' landmark must be unique'); return source.replace(needle, insertion); };\nconst removeOnce = (source, needle, label) => { ensure(count(source, needle) === 1, label + ' insertion must occur exactly once'); return source.replace(needle, ''); };\nfunction restoreE108Projection(projectedHtml) { let restored = projectedHtml; restored = removeOnce(restored, INSERTIONS.intro, 'intro'); restored = removeOnce(restored, INSERTIONS.css, 'stylesheet'); restored = removeOnce(restored, INSERTIONS.template, 'template'); restored = removeOnce(restored, INSERTIONS.script, 'script'); return restored; }\nexport function projectE108CatalogueResponse(requestUrl, html) {\n  const url = requestUrl instanceof URL ? requestUrl : new URL(String(requestUrl), 'http://e108.invalid');\n  if (url.pathname !== CATALOGUE_PATH || typeof html !== 'string') return html;\n  const already = [INTRO_MARKER, CSS_MARKER, TEMPLATE_MARKER, SCRIPT_MARKER].some(marker => html.includes(marker));\n  ensure(!already, 'response already or partially projected');\n  const noticeCount = count(html, NOTICE);\n  if (noticeCount === 0) return html;\n  ensure(noticeCount === 1, 'catalogue-notice landmark must be unique');\n  const landmarks = { headClose: html.match(/<\\/head\\s*>/giu) ?? [], bodyClose: html.match(/<\\/body\\s*>/giu) ?? [] };\n  const headOpen = html.match(/<head(?=[\\s>])[^>]*>/giu) ?? [];\n  const bodyOpen = html.match(/<body(?=[\\s>])[^>]*>/giu) ?? [];\n  ensure(headOpen.length === 1 && landmarks.headClose.length === 1, 'head landmarks must each be unique');\n  ensure(bodyOpen.length === 1 && landmarks.bodyClose.length === 1, 'body landmarks must each be unique');\n  const headAt = html.search(/<head(?=[\\s>])[^>]*>/iu), headEnd = html.search(/<\\/head\\s*>/iu), bodyAt = html.search(/<body(?=[\\s>])[^>]*>/iu), bodyEnd = html.search(/<\\/body\\s*>/iu);\n  ensure(headAt < headEnd && headEnd < bodyAt && bodyAt < bodyEnd, 'head/body landmark order is invalid');\n  let projected = replaceOnce(html, NOTICE, INSERTIONS.intro + NOTICE, 'catalogue-notice');\n  projected = replaceOnce(projected, '</head>', INSERTIONS.css + '</head>', 'head-close');\n  projected = replaceOnce(projected, '</body>', INSERTIONS.template + INSERTIONS.script + '</body>', 'body-close');\n  ensure(restoreE108Projection(projected) === html, 'reversible projection invariant failed');\n  return projected;\n}\nexport { INSERTIONS as E108_RESPONSE_INSERTIONS, restoreE108Projection };\n`;
}

/** Extract the four reversible insertions from the two closed, pinned catalogue snapshots. */
export function extractE108Insertions({ parentHtml, composedHtml, parentSha256, composedSha256 }) {
  ensure(typeof parentHtml === 'string' && typeof composedHtml === 'string', 'UTF-8 HTML strings required');
  ensure(parentSha256 === E108_PARENT_CATALOGUE_SHA256 && digestText(parentHtml) === parentSha256, 'pinned parent catalogue required');
  ensure(composedSha256 === E108_COMPOSED_CATALOGUE_SHA256 && digestText(composedHtml) === composedSha256, 'pinned composed catalogue required');
  const parentLandmarks = strictLandmarks(parentHtml);
  strictLandmarks(composedHtml);
  ensure(count(parentHtml, NOTICE) === 1 && count(composedHtml, NOTICE) === 1, 'catalogue-notice must be unique in both snapshots');
  ensure(DOUBLE_PROJECTION_MARKERS.every((marker) => !parentHtml.includes(marker)), 'parent already contains a projection insertion');

  const introAt = composedHtml.indexOf(INTRO_START);
  const noticeAt = composedHtml.indexOf(NOTICE);
  ensure(count(composedHtml, INTRO_START) === 1 && introAt >= 0 && introAt < noticeAt, 'E108 intro insertion missing or duplicated');
  const intro = composedHtml.slice(introAt, noticeAt);
  ensure(intro.includes('</aside>') && /\n\s*$/u.test(intro), 'E108 intro boundary is not exact');

  const composedHeadClose = composedHtml.indexOf('</head>');
  ensure(count(composedHtml, CSS_HREF) === 1, 'E108 stylesheet URL missing or duplicated');
  const cssAt = composedHtml.lastIndexOf('<link ', composedHeadClose);
  const css = composedHtml.slice(cssAt, composedHeadClose);
  ensure(css.startsWith('<link rel="stylesheet" ') && css.includes(CSS_HREF) && css.endsWith('\n'), 'E108 stylesheet insertion boundary is not exact');

  const templateAt = composedHtml.indexOf(TEMPLATE_START);
  const templateEndToken = '</template>\n';
  const templateEndAt = composedHtml.indexOf(templateEndToken, templateAt);
  ensure(count(composedHtml, TEMPLATE_START) === 1 && templateAt >= 0 && templateEndAt > templateAt, 'E108 template missing or duplicated');
  const template = composedHtml.slice(templateAt, templateEndAt + templateEndToken.length);
  const scriptAt = composedHtml.indexOf(SCRIPT_START, templateEndAt + templateEndToken.length);
  ensure(count(composedHtml, SCRIPT_START) === 1 && scriptAt === templateEndAt + templateEndToken.length, 'E108 script must follow template directly');
  const scriptEndToken = '</script>\n';
  const scriptEndAt = composedHtml.indexOf(scriptEndToken, scriptAt);
  ensure(scriptEndAt >= scriptAt, 'E108 script boundary is not exact');
  const script = composedHtml.slice(scriptAt, scriptEndAt + scriptEndToken.length);
  const bodyCloseAt = composedHtml.indexOf('</body>');
  ensure(scriptEndAt + scriptEndToken.length === bodyCloseAt, 'E108 template/script must directly precede body close');

  ensure(parentLandmarks.headCloseAt < parentLandmarks.bodyCloseAt, 'parent head/body order invalid');
  const insertions = { intro, css, template, script };
  let restored = composedHtml;
  restored = removeOnce(restored, intro, 'intro');
  restored = removeOnce(restored, css, 'stylesheet');
  restored = removeOnce(restored, template, 'template');
  restored = removeOnce(restored, script, 'script');
  ensure(restored === parentHtml, 'removing the four insertions does not restore parent bytes');
  return insertions;
}

/** Compile a self-contained runtime-only projection module from the pinned snapshots. */
export function compileE108ResponseProjection(inputs) {
  const insertions = extractE108Insertions(inputs);
  return {
    sourceText: generatedRuntimeSource(insertions),
    insertions,
    parentRestoredExactly: true,
    parentSha256: E108_PARENT_CATALOGUE_SHA256,
    composedSha256: E108_COMPOSED_CATALOGUE_SHA256,
  };
}

