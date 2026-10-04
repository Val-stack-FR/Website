const INERT_BLOCK = /<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/giu;
const DL_BLOCK = /<dl\b[^>]*>[\s\S]*?<\/dl>/giu;
const DIV_BLOCK = /<div\b[^>]*>[\s\S]*?<\/div>/giu;
const HTML_TAG = /<[^>]*>/gu;

const ENTITY_MAP = Object.freeze({ amp: '&', apos: "'", nbsp: ' ', quot: '"', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', rsquo: '’', lsquo: '‘' });
const TECHNICAL_M2_ROWS = new Set(['table', 'fiche candidate', 'enregistrement', 'sha-256 source']);
const HUMAN_FIELD_NAMES = new Map([
  ['person_heading', 'Intitulé de la fiche'],
  ['display_name', 'Nom d’index'],
  ['name_variants', 'Variantes du nom'],
]);

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (match, entity) => {
    if (entity[0] === '#') {
      const codepoint = entity[1].toLowerCase() === 'x'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(codepoint) && codepoint >= 0 && codepoint <= 0x10ffff
        ? String.fromCodePoint(codepoint)
        : match;
    }
    return ENTITY_MAP[entity.toLowerCase()] ?? match;
  });
}

function textOf(markup) {
  return decodeEntities(markup.replace(HTML_TAG, ' ')).replace(/\s+/gu, ' ').trim();
}

function classNames(openTag) {
  const match = openTag.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').split(/\s+/u).filter(Boolean);
}

function addHidden(openTag) {
  return /\shidden(?:\s|=|>)/iu.test(openTag) ? openTag : openTag.replace(/>$/u, ' hidden>');
}

function decorateVisibleSegments(html, transform) {
  let result = '';
  let cursor = 0;
  for (const match of html.matchAll(INERT_BLOCK)) {
    result += transform(html.slice(cursor, match.index));
    result += match[0];
    cursor = match.index + match[0].length;
  }
  return result + transform(html.slice(cursor));
}

function provenanceRows(dl) {
  const openTag = dl.match(/^<dl\b[^>]*>/iu)?.[0] ?? '';
  const closeIndex = dl.lastIndexOf('</dl>');
  const inner = dl.slice(openTag.length, closeIndex);
  const rows = [...inner.matchAll(DIV_BLOCK)].map((match) => match[0]);
  const residue = inner.replace(DIV_BLOCK, '').trim();
  if (residue || rows.length !== 5) throw new Error('Unsupported M2 provenance list shape');
  const labels = rows.map((row) => {
    const label = row.match(/<dt\b[^>]*>([\s\S]*?)<\/dt>/iu)?.[1];
    const value = row.match(/<dd\b[^>]*>([\s\S]*?)<\/dd>/iu)?.[1];
    if (label === undefined || value === undefined) throw new Error('Unsupported M2 provenance row shape');
    return { row, label: textOf(label).toLocaleLowerCase('fr-FR').replace(/[–—]/gu, '-').replace(/\s+/gu, ' '), value: textOf(value) };
  });
  const expected = ['table', 'fiche candidate', 'enregistrement', 'champ', 'sha-256 source'];
  if (labels.map((entry) => entry.label).join('|') !== expected.join('|')) {
    throw new Error('Unsupported M2 provenance labels');
  }
  return labels;
}

function projectM2Provenance(dl) {
  const openDl = dl.match(/^<dl\b[^>]*>/iu)?.[0] ?? '';
  if (!classNames(openDl).includes('annex-provenance')) return dl;
  const rows = provenanceRows(dl);
  return dl.replace(DIV_BLOCK, (row) => {
    const entry = rows.find((candidate) => candidate.row === row);
    if (!entry) return row;
    if (TECHNICAL_M2_ROWS.has(entry.label) || (entry.label === 'champ' && entry.value === 'Nom')) {
      return row.replace(/^<div\b[^>]*>/iu, (open) => addHidden(open));
    }
    let output = row;
    const humanField = HUMAN_FIELD_NAMES.get(entry.value);
    if (humanField) {
      output = output.replace(/(<dd\b[^>]*>)[\s\S]*?(<\/dd>)/iu, `$1${humanField}$2`);
    }
    return output;
  });
}

function decorateM2Search(html) {
  return decorateVisibleSegments(html, (segment) => {
    let output = segment.replace(DL_BLOCK, projectM2Provenance);
    output = output.replace(/<span\b[^>]*>[\s\S]*?<\/span>/giu, (span) => {
      const open = span.match(/^<span\b[^>]*>/iu)?.[0] ?? '';
      const text = textOf(span.slice(open.length, -'</span>'.length));
      if (!classNames(open).includes('footer-text') || !/^Paquets distincts\s+package:atelier-[a-f0-9]{32}\s*[·•]\s*package:atelier-[a-f0-9]{32}$/iu.test(text)) return span;
      return span.replace(/^<span\b[^>]*>/iu, (tag) => addHidden(tag));
    });
    return output;
  });
}

function replaceExactParagraph(html, pattern, humanText, metadataKind) {
  const matches = [...html.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`Unsupported map metadata paragraph: ${metadataKind}`);
  const original = matches[0][0];
  const open = original.match(/^<p\b[^>]*>/iu)?.[0] ?? '<p>';
  return html.replace(original, `${open}${humanText}</p><template data-human-meta="${metadataKind}">${original}</template>`);
}

function decorateMapExcerpt(html) {
  return decorateVisibleSegments(html, (segment) => {
    let output = segment;
    if (/Provenance, empreintes et limites/u.test(output)) {
      output = output.replace('Provenance, empreintes et limites', 'Origine et limites de la carte');
      output = replaceExactParagraph(
        output,
        /<p\b[^>]*>Original source identifié dans la preuve fermée\s*:\s*SHA-256\s+[0-9a-f]{64}\.\s*Aucun original n’est inclus dans ce paquet\.<\/p>/giu,
        'L’original n’est pas inclus dans ce paquet.',
        'cartography-source-proof',
      );
      output = replaceExactParagraph(
        output,
        /<p\b[^>]*>Rendu\s+1\s*920\s*×\s*1\s*640\s+pixels\s+à\s+576\s+dpi\.\s*Les fichiers inclus sont des dérivés privés\s*;\s*droits inconnus\.\s*CRS et transformation géographique nuls\.<\/p>/giu,
        'Les droits sur ces fichiers ne sont pas connus.',
        'cartography-render-metadata',
      );
    }
    return output.replace(/<p\b[^>]*\bid=["']hq-hash["'][^>]*>/giu, (open) => addHidden(open));
  });
}

/**
 * Hide only the observed machine metadata on the two approved human-facing
 * routes. Other routes and unsupported input types pass through unchanged.
 * M2 technical rows remain in the DOM but hidden for existing DOM queries;
 * map proof/render metadata is preserved in inert, tagged templates.
 */
export function decorateOtherHumanScreens(html, url) {
  if (typeof html !== 'string' || typeof url !== 'string' && !(url instanceof URL)) return html;
  let pathname;
  try {
    pathname = new URL(String(url), 'http://archives.invalid').pathname;
  } catch {
    return html;
  }
  if (pathname === '/archives/recherche' || pathname === '/archives/recherche/') return decorateM2Search(html);
  if (pathname === '/archives/cartes/extrait' || pathname === '/archives/cartes/extrait/') return decorateMapExcerpt(html);
  return html;
}
