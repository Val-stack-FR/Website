const DT_DD_PAIR = /(<dt\b[^>]*>[\s\S]*?<\/dt>)(\s*)(<dd\b[^>]*>[\s\S]*?<\/dd>)/giu;
const DL_BLOCK = /<dl\b[^>]*>[\s\S]*?<\/dl>/giu;
const DETAILS_BLOCK = /<details\b[^>]*>[\s\S]*?<\/details>/giu;
const HTML_TAG = /<[^>]*>/gu;

const ENTITY_MAP = Object.freeze({
  amp: '&', apos: "'", nbsp: ' ', quot: '"',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  agrave: 'à', acirc: 'â', auml: 'ä', aacute: 'á', ccedil: 'ç',
  icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö',
  ugrave: 'ù', ucirc: 'û', uuml: 'ü', oelig: 'œ', aelig: 'æ',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  ndash: '–', mdash: '—', hellip: '…',
});

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (match, entity) => {
    if (entity[0] === '#') {
      const codepoint = entity[1].toLowerCase() === 'x'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      if (Number.isInteger(codepoint) && codepoint >= 0 && codepoint <= 0x10ffff) {
        return String.fromCodePoint(codepoint);
      }
      return match;
    }
    return ENTITY_MAP[entity.toLowerCase()] ?? match;
  });
}

function visibleText(markup) {
  return decodeEntities(markup.replace(HTML_TAG, ' ')).replace(/\s+/gu, ' ').trim();
}

function normalizeLabel(markup) {
  return visibleText(markup)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’‘]/gu, "'")
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function classNamesFromOpenTag(openTag) {
  const match = openTag.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').split(/\s+/u).filter(Boolean);
}

function hasClassedElement(html, tagName, className) {
  const openTag = new RegExp('<' + tagName + '\\b[^>]*>', 'giu');
  for (const match of html.matchAll(openTag)) {
    if (classNamesFromOpenTag(match[0]).includes(className)) return true;
  }
  return false;
}

function isSupportedHumanPage(html) {
  const catalogueMain = hasClassedElement(html, 'main', 'catalogue-main');
  const hasProvenance = hasClassedElement(html, 'details', 'catalogue-provenance');
  const hasResults = hasClassedElement(html, 'section', 'catalogue-results');
  const sourceDetail = catalogueMain && (
    hasClassedElement(html, 'p', 'catalogue-path')
    || (hasProvenance && !hasResults)
  );
  const catalogue = catalogueMain && (hasResults || hasProvenance);
  const lexicalPage = hasClassedElement(html, 'article', 'lexical-card')
    && /<blockquote\b/iu.test(html);
  return { supported: sourceDetail || catalogue || lexicalPage, sourceDetail };
}

function hasVisibleCodepointOffsets(ddMarkup) {
  const text = visibleText(ddMarkup).toLowerCase();
  return /\b(?:unicode|code\s*points?|points?\s+de\s+code|offsets?)\b/u.test(text)
    || /\b(?:start|end|debut|fin)\s*[:=]\s*\d/u.test(text);
}

function isTechnicalPair(labelMarkup, ddMarkup, inCatalogueProvenance) {
  const label = normalizeLabel(labelMarkup);

  if (/^sha(?:\s+.*)?$/u.test(label)) return true;
  if (/^empreinte (?:du fichier source|source|du manifeste|de l index|du catalogue)(?: .*)?$/u.test(label)) return true;

  if (/^objet (?:numerique(?: du texte)?|source|fichier source)$/u.test(label)) return true;
  if (/^(?:source )?object(?: id| path)?$/u.test(label)) return true;
  if (/^(?:occurrence textuelle|identifiant de l occurrence textuelle)$/u.test(label)) return true;

  if (/^(?:taille source|encodage|provenance de l encodage)$/u.test(label)) return true;
  if (/^(?:reference de la proposition|identifiant de la proposition|id de la proposition)$/u.test(label)) return true;

  if (label === 'emplacement dans le texte' && hasVisibleCodepointOffsets(ddMarkup)) return true;

  if (inCatalogueProvenance && /^(?:paquet|genere le)$/u.test(label)) return true;

  if (/^(?:run(?: id| identifier)?|identifiant du run|id du run|preuve(?: technique)?|proof(?: id)?|manifeste(?: source)?|identifiant du lot|lot technique)$/u.test(label)) {
    return true;
  }

  const technicalIdentifierValue = /^(?:object:path-|run:|proof:|manifest:|sha-?256:)/iu.test(visibleText(ddMarkup))
    || /^[0-9a-f]{64}$/iu.test(visibleText(ddMarkup));
  if (technicalIdentifierValue && /^(?:reference|identifiant|id)(?: .*)?$/u.test(label)) return true;

  return false;
}

function cleanDefinitionList(dlMarkup, inCatalogueProvenance = false) {
  return dlMarkup.replace(DT_DD_PAIR, (pair, dt, whitespace, dd) => (
    isTechnicalPair(dt, dd, inCatalogueProvenance) ? '' : pair
  ));
}

function removeEmptyCatalogueProvenanceDetails(html) {
  return html.replace(DETAILS_BLOCK, (details) => {
    const openTag = details.match(/^<details\b[^>]*>/iu)?.[0] ?? '';
    if (!classNamesFromOpenTag(openTag).includes('catalogue-provenance')) return details;

    const hasDefinitionPair = new RegExp(DT_DD_PAIR.source, 'iu').test(details);
    if (hasDefinitionPair) return details;

    const otherVisibleContent = details
      .replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/iu, '')
      .replace(/<dl\b[^>]*>[\s\S]*?<\/dl>/iu, '')
      .replace(HTML_TAG, '')
      .trim();
    return otherVisibleContent ? details : '';
  });
}

function escapeRegex(value) {
  return [...value].map((character) => (
    /[.*+?^$|()[\]{}\\]/u.test(character) ? '\\' + character : character
  )).join('');
}

function replaceGenericObjectTitle(html) {
  return html.replace(/(<h1\b[^>]*>)([\s\S]*?)(<\/h1>)/iu, (whole, open, inner, close) => {
    const title = visibleText(inner);
    if (!/^(?:object:(?:path-)?[a-z0-9._:/-]+|[0-9a-f]{64})$/iu.test(title)) return whole;

    const replacement = new RegExp(escapeRegex(title), 'iu');
    if (replacement.test(inner)) return open + inner.replace(replacement, 'Document à identifier') + close;
    if (!/<a\b/iu.test(inner)) return open + 'Document à identifier' + close;
    return whole;
  });
}

/**
 * Remove only visible, explicitly technical metadata from the observed archive
 * source, catalogue, and lexical-reference page shapes. Non-HTML and unrelated
 * HTML are returned byte-for-byte unchanged.
 */
export function decorateHumanSourcePage(html) {
  if (typeof html !== 'string' || (!/<main\b/iu.test(html) && !/<article\b/iu.test(html))) return html;
  const page = isSupportedHumanPage(html);
  if (!page.supported) return html;

  let result = html.replace(DETAILS_BLOCK, (details) => {
    const openTag = details.match(/^<details\b[^>]*>/iu)?.[0] ?? '';
    const inProvenance = classNamesFromOpenTag(openTag).includes('catalogue-provenance');
    if (!inProvenance) return details;
    return details.replace(DL_BLOCK, (dl) => cleanDefinitionList(dl, true));
  });

  result = result.replace(DL_BLOCK, (dl) => cleanDefinitionList(dl, false));
  result = removeEmptyCatalogueProvenanceDetails(result);
  if (page.sourceDetail) result = replaceGenericObjectTitle(result);
  return result;
}

const HIERARCHY_FIELDS_WITH_TECHNICAL_METADATA = "[['Fichier', record.fileName.literal], ['Chemin dans le classement', record.logicalPath], ['Objet numérique', record.digitalObjectId], ['Taille', count(record.sizeBytes) + ' octets'], ['Texte associé', record.transcription.status === 'none' ? 'Aucune transcription liée' : 'Texte préexistant à revoir'], ['Origine de la métadonnée', record.provenance.discovery_source]]";
const HIERARCHY_HUMAN_FIELDS = "[['Fichier', record.fileName.literal], ['Chemin dans le classement', record.logicalPath], ['Texte associé', record.transcription.status === 'none' ? 'Aucune transcription liée' : 'Texte préexistant à revoir']]";
const HIERARCHY_PRIVATE_LINK_LABEL = "node('a', 'catalogue-reader-link', 'Ouvrir dans le lecteur privé')";
const HIERARCHY_HUMAN_LINK_LABEL = "node('a', 'catalogue-reader-link', 'Consulter la photographie')";

/**
 * Project only the observed archive-hierarchy asset template. This is a
 * build-time source transform: it removes three visible metadata rows and
 * replaces one technical consultation label while preserving the JSON API,
 * identifiers, route, and the other displayed rows.
 * Unknown or changed asset shapes fail closed; already-projected input is a
 * no-op so repeated assembly does not duplicate the change.
 */
export function decorateCatalogueHierarchyAsset(source) {
  if (typeof source !== 'string') throw new TypeError('Expected JavaScript source text');
  if (!source.includes("const details = record =>") || !source.includes("'catalogue-record-provenance'")) {
    throw new Error('Unsupported archive-hierarchy asset: details template landmark missing');
  }

  const originalCount = source.split(HIERARCHY_FIELDS_WITH_TECHNICAL_METADATA).length - 1;
  const projectedCount = source.split(HIERARCHY_HUMAN_FIELDS).length - 1;
  const technicalLinkCount = source.split(HIERARCHY_PRIVATE_LINK_LABEL).length - 1;
  const humanLinkCount = source.split(HIERARCHY_HUMAN_LINK_LABEL).length - 1;
  if (originalCount === 1 && projectedCount === 0 && technicalLinkCount === 1 && humanLinkCount === 0) {
    return source
      .replace(HIERARCHY_FIELDS_WITH_TECHNICAL_METADATA, HIERARCHY_HUMAN_FIELDS)
      .replace(HIERARCHY_PRIVATE_LINK_LABEL, HIERARCHY_HUMAN_LINK_LABEL);
  }
  if (originalCount === 0 && projectedCount === 1 && technicalLinkCount === 0 && humanLinkCount === 1) return source;
  throw new Error('Unsupported archive-hierarchy asset: expected one exact details field list and consultation link');
}

export const HUMAN_SOURCE_PAGE_RULES = Object.freeze({
  recognizedLandmarks: ['main.catalogue-main', 'p.catalogue-path', 'section.catalogue-results', 'details.catalogue-provenance', 'article.lexical-card + blockquote'],
  preservedContent: ['transcriptions', 'pre', 'q', 'blockquote', 'human titles', 'dates', 'reading status', 'rights status', 'filenames/cotes', 'citations', 'links', 'data-* attributes', 'embedded JSON'],
  removedMetadata: ['source object identifiers', 'SHA-256 metadata', 'source file size', 'encoding and encoding provenance', 'visible codepoint offsets', 'run/proof/package metadata'],
});
