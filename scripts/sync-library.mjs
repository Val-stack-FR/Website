#!/usr/bin/env node
/**
 * sync-library.mjs — regenerate library/index.json from the "Livres" Google Sheet.
 *
 * Source resolution (in order):
 *   1. LIVRES_XLSX env var → read that local .xlsx file (used for the initial seed).
 *   2. otherwise fetch the published-to-web xlsx export of LIVRES_SHEET_ID.
 *
 * The sheet must be made public once: File → Share → Publish to web.
 * Run weekly by .github/workflows/sync-library.yml (commits only if the JSON changed).
 *
 * Deps: xlsx (SheetJS) — declared in scripts/package.json, isolated from prerender.js.
 */
import XLSX from 'xlsx';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const LIVRES_SHEET_ID = process.env.LIVRES_SHEET_ID
  || '19ql2wuZ2fwOG_c6R6fyq0BoYKT9ENgYlHlsuaf-YR74';

// Tab name → site category (drives sections, tabs, cover colours).
const TAB_CATEGORY = {
  'SF':                  'Sci-Fi',
  'Heroic Fantasy':      'Fantasy',
  'Classique':           'Fiction',
  'Autres':              'Non-fiction',
  'En attente de trad':  'Untranslated',
};

// French → English title aliases, so library rows can link to existing curated reviews.
const REVIEW_ALIASES = {
  'vision aveugle': 'blindsight',
};

/* ─── helpers ──────────────────────────────────────────────────────────────── */
const norm = (s) => String(s ?? '').toLowerCase().trim()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');           // strip accents

function slugify(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
}

function clean(s) {
  // strip markdown escapes + collapse newlines/whitespace
  return String(s ?? '').replace(/\\([!\[\]()*_])/g, '$1')
    .replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanTitle(s) {
  let t = clean(s)
    .replace(/\s*[\(\[]\s*https?:\/\/[^)\]]*[\)\]]/gi, '')   // (http…) / [http…]
    .replace(/\s*[-–—]?\s*https?:\/\/\S+.*$/i, '')           // trailing - http…
    .replace(/https?:\/\/\S+/gi, '')                         // any stray url
    .replace(/^["“”']+|["“”']+$/g, '')                       // wrapping quotes
    .replace(/\s*[-–—:]\s*$/, '')                            // dangling dash/colon
    .trim();
  return t;
}

// Google Sheets silently parsed many "N/5" grades as dates (5/5 → May 5), so the
// xlsx stores them as Excel date serials. Recover: month = denominator, day = grade.
function excelSerialGrade(s) {
  if (!/^\d{4,6}$/.test(s)) return undefined;
  const n = Number(s);
  if (n <= 367) return undefined;                       // too small to be a date serial
  const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  const month = d.getUTCMonth() + 1, day = d.getUTCDate();
  if (![5, 10, 20].includes(month)) return undefined;   // only plausible denominators
  let g = (day / month) * 5;
  return Math.round(Math.min(5, Math.max(0, g)) * 100) / 100;
}

function parseGrade(raw) {
  const s = clean(raw);
  if (!s) return null;
  if (/indispensable/i.test(s)) return 5;
  const recovered = excelSerialGrade(s);
  if (recovered !== undefined) return recovered;
  let g;
  // Prefer an explicit X/Y fraction ("4,5/5", "4/5 - bon", "7/10") — rescale to /5.
  const frac = s.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+)/);
  if (frac) {
    const num = parseFloat(frac[1].replace(',', '.'));
    const den = parseInt(frac[2], 10);
    g = den > 0 ? (num / den) * 5 : num;
  } else {
    // else first standalone small number — skip years like 2024.
    const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map(x => parseFloat(x.replace(',', '.')));
    g = nums.find(x => x <= 20);
  }
  if (g == null || !isFinite(g)) return null;
  if (g > 5) g = 5;                 // "6/5", "7/5" superlatives → clamp
  if (g < 0) g = 0;
  return Math.round(g * 100) / 100;
}

function deriveFormat(tomeRaw, category) {
  if (category === 'Non-fiction') return 'Non-fiction';
  const t = norm(tomeRaw);
  if (!t) return '';
  if (t.includes('heure')) return 'Novella';                 // "une heure lumière"
  if (/dans\s+["“]/.test(t) || t.includes('nouvelle')) return 'Short Story';
  return 'Novel';
}

function deriveVolume(tomeRaw) {
  const t = clean(tomeRaw);
  const m = t.match(/tome\s*(\d+)/i) || t.match(/n°\s*(\d+)/i) || t.match(/cycle\s*(\d+)/i);
  return m ? m[1] : '';
}

// Some nouvelles are free online (e.g. Clarkesworld) — the Tome column stores that URL.
function deriveSourceUrl(tomeRaw) {
  const m = String(tomeRaw ?? '').match(/https?:\/\/[^\s"'<>)]+/i);
  return m ? m[0] : '';
}
function sourceLabel(url) {
  const host = (url.match(/\/\/(?:www\.)?([^/]+)/) || [])[1] || '';
  if (/clarkesworld/i.test(host)) return 'Clarkesworld';
  if (/tor\.com/i.test(host)) return 'Tor.com';
  if (/uncannymagazine/i.test(host)) return 'Uncanny';
  if (/lightspeedmagazine/i.test(host)) return 'Lightspeed';
  return host.replace(/magazine\.com$/i, '');
}

// For short stories the Tome column locates the source anthology ("dans le recueil …",
// 'Dans "…"', "une heure lumière"). Surface it so short stories are findable on their own.
function deriveCollection(tomeRaw) {
  const t = clean(tomeRaw);
  if (!t) return '';
  // « … dans [le recueil/la collection] "Titre" »  or  « … dans Titre »
  const m = t.match(/\bdans\s+(?:le\s+recueil\s+|la\s+collection\s+|l[’']?\s*anthologie\s+)?["“«»']?\s*(.+?)\s*["”«»']?\s*$/i);
  if (m && m[1]) {
    const name = m[1]
      .replace(/["”«»']*\s*[-–—(]?\s*\d{9,13}\s*\)?\s*$/, '')   // trailing ISBN: "… - 978…" or "… (978…)"
      .replace(/^["“«»']+|["”«»']+$/g, '').trim();
    if (name && name.length > 1) return name;
  }
  if (/une\s+heure[-\s]?lumi[èe]re/i.test(t)) {
    const num = t.match(/n°\s*\d+/i);
    return 'Une Heure-Lumière' + (num ? ` ${num[0].replace(/\s+/g, '')}` : '');
  }
  return '';
}

function isAudio(...vals) {
  return vals.some(v => /audio|écout|ecout/i.test(String(v ?? '')));
}

function deriveStatus(luRaw, grade) {
  const lu = norm(luRaw);
  if (lu.includes('dnf')) return 'dnf';
  if (lu.includes('cours')) return 'reading';
  if (lu.startsWith('oui') || grade != null) return 'read';
  return 'tbr';                                              // no grade ⇒ "pile to read"
}

/* Build a header-name → column-index map for one sheet. Returns {map, dataStart}. */
function headerMap(rows) {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = (rows[i] || []).map(norm);
    const hasTitle  = cells.includes('titre') || cells.includes('nom');
    const hasAuthor = cells.includes('auteur');
    if (hasTitle && hasAuthor) {
      const map = Object.create(null);   // null prototype: header named "__proto__"/"constructor" can't pollute
      cells.forEach((c, idx) => { if (c && !(c in map)) map[c] = idx; });
      return { map, dataStart: i + 1 };
    }
  }
  return { map: {}, dataStart: 1 };
}

function pick(map, row, ...aliases) {
  for (const a of aliases) {
    const i = map[norm(a)];
    if (i != null && row[i] != null && String(row[i]).trim() !== '') return row[i];
  }
  return '';
}

/* ─── load workbook ────────────────────────────────────────────────────────── */
async function loadWorkbook() {
  if (process.env.LIVRES_XLSX) {
    return XLSX.readFile(process.env.LIVRES_XLSX);
  }
  const url = `https://docs.google.com/spreadsheets/d/${LIVRES_SHEET_ID}/export?format=xlsx`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not fetch sheet (HTTP ${res.status}). `
      + `Make sure it is published: File → Share → Publish to web.`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return XLSX.read(buf, { type: 'buffer' });
}

/* ─── cover resolution (Open Library, best-effort, cached) ─────────────────── */
const OL = 'https://openlibrary.org';
const coverKey = (title, author) => `${norm(title)}|${norm(author)}`;

async function olJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'valerianteissier.com library sync (valerian.teissier@gmail.com)' } });
    if (!res.ok) return undefined;                       // transient → retry next run
    return await res.json();
  } catch { return undefined; }
  finally { clearTimeout(timer); }
}

// Edition preference: French (0) → UK English (1) → US English (2) → other English (3)
// → anything else (4). UK/US inferred from the MARC publish_country code (…k = UK
// nations like enk/wlk/stk/xxk; …u = US, i.e. xxu + the state codes nyu/cau/…).
function editionRank(ed) {
  const langs = (ed.languages || []).map(l => String(l.key || '').split('/').pop());
  const c = String(ed.publish_country || '').trim().toLowerCase();
  if (langs.includes('fre')) return 0;
  if (langs.includes('eng')) {
    if (c.endsWith('k')) return 1;
    if (c.endsWith('u')) return 2;
    return 3;
  }
  return 4;
}

async function fetchCoverId(title, author) {
  const p = new URLSearchParams({ title, fields: 'key,cover_i', limit: '1' });
  if (author && author !== '—') p.set('author', author);
  const search = await olJson(`${OL}/search.json?${p}`);
  if (search === undefined) return undefined;            // transient → retry next run
  const doc = search?.docs?.[0];
  if (!doc) return null;                                 // searched, nothing found
  const fallback = Number.isInteger(doc.cover_i) ? doc.cover_i : null;  // work's default cover

  // Walk the work's editions and pick the cover from the most-preferred edition.
  if (!doc.key) return fallback;
  const eds = await olJson(`${OL}${doc.key}/editions.json?limit=50`);
  if (eds === undefined) return fallback;                // editions call failed → work cover
  let best = null, bestRank = 99;
  for (const ed of (eds?.entries || [])) {
    const cover = (ed.covers || []).find(c => Number.isInteger(c) && c > 0);
    if (!cover) continue;
    const rank = editionRank(ed);
    if (rank < bestRank) { best = cover; bestRank = rank; if (rank === 0) break; }
  }
  return best ?? fallback;
}

// Resolve covers only for books with no cached value (coverId === undefined).
// Pooled, rate-limited, and aborts if the API looks unreachable (offline / blocked).
async function resolveCovers(books) {
  if (process.env.SKIP_COVERS === '1') return;
  const todo = books.filter(b => b.coverId === undefined);
  if (!todo.length) { console.log('  covers: all cached'); return; }

  let done = 0, found = 0, notFound = 0, fails = 0, aborted = false;
  const POOL = 3;                                         // 2 API calls per book → stay gentle
  async function worker() {
    while (todo.length && !aborted) {
      const b = todo.pop();
      const id = await fetchCoverId(b.title, b.author);
      if (id === undefined) {
        if (++fails >= 12 && found === 0) { aborted = true; break; }   // API unreachable → stop
      } else {
        b.coverId = id;
        if (id !== null) found++; else notFound++;
      }
      if (++done % 100 === 0) console.log(`  covers: ${done}/${todo.length + done} (${found} found)`);
      await new Promise(r => setTimeout(r, 200));         // be polite to Open Library
    }
  }
  await Promise.all(Array.from({ length: POOL }, worker));
  console.log(aborted
    ? `  ⚠ covers: API unreachable, skipped (will retry next run)`
    : `  covers: ${found} resolved, ${notFound} not found`);
}

/* ─── main ─────────────────────────────────────────────────────────────────── */
async function main() {
  const reviews = existsSync(path.join(ROOT, 'books/index.json'))
    ? JSON.parse(readFileSync(path.join(ROOT, 'books/index.json'), 'utf8'))
    : [];
  const reviewBySlug = new Set(reviews.map(r => r.slug));
  const reviewByTitle = new Map(reviews.map(r => [norm(r.title), r.slug]));

  // Carry forward already-resolved Open Library cover ids so each weekly run only
  // looks up books it hasn't seen (number = found, null = searched-and-missing).
  const dest = path.join(ROOT, 'library', 'index.json');
  const prevBooks = existsSync(dest) ? JSON.parse(readFileSync(dest, 'utf8')) : [];
  const coverCache = new Map(prevBooks.map(b => [coverKey(b.title, b.author), b.coverId]));

  // COVERS_ONLY: resolve missing covers on the existing JSON without touching the sheet
  // (lets covers be populated before the sheet is published to web).
  if (process.env.COVERS_ONLY === '1') {
    if (!prevBooks.length) { console.error('No library/index.json to update.'); process.exit(1); }
    await resolveCovers(prevBooks);
    // Re-serialize in the canonical key order a full sync emits, so the next
    // weekly sync doesn't rewrite every object just to move coverId.
    const KEYS = ['slug', 'title', 'author', 'year', 'category', 'format', 'volume', 'collection',
      'grade', 'synopsis', 'dateRead', 'status', 'audio', 'coverId', 'url', 'sourceUrl', 'source'];
    const canon = prevBooks.map(b => Object.fromEntries(KEYS.filter(k => k in b || k === 'coverId').map(k => [k, b[k]])));
    const json = JSON.stringify(canon, null, 2) + '\n';
    if (json === readFileSync(dest, 'utf8')) { console.log('✓ covers unchanged'); return; }
    writeFileSync(dest, json, 'utf8');
    console.log(`✓ covers updated — ${prevBooks.length} books`);
    return;
  }

  const wb = await loadWorkbook();
  const out = [];
  const seenSlugs = new Set();

  for (const [tab, category] of Object.entries(TAB_CATEGORY)) {
    const ws = wb.Sheets[tab];
    if (!ws) { console.warn(`  ⚠ tab not found: ${tab}`); continue; }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
    const { map, dataStart } = headerMap(rows);

    let kept = 0;
    for (let i = dataStart; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const rawTitle = pick(map, row, 'titre', 'nom');
      if (!String(rawTitle).trim()) continue;                 // blank-title series rows
      // section-label / banner rows have only the first cell filled ("Nouvelles :", "BD:", …)
      const titleCol = map['titre'] ?? map['nom'] ?? 0;
      const rest = row.filter((_, idx) => idx !== titleCol)
        .map(c => String(c).trim()).join('');
      // Drop banner/section-label rows (only the first cell filled, and it reads
      // like a heading: ends with ":" or is ALL CAPS). A title-only book is kept.
      const tnorm = String(rawTitle).trim();
      if (!rest && (/[:：]\s*$/.test(tnorm) || tnorm === tnorm.toUpperCase())) continue;
      const title = cleanTitle(rawTitle);
      if (!title) {                                          // e.g. a Titre cell that is only a URL
        console.warn(`  ⚠ ${tab} row ${i + 1}: unusable title, skipped: ${String(rawTitle).slice(0, 60)}`);
        continue;
      }

      const author   = clean(pick(map, row, 'auteur')) || '—';
      const tome     = pick(map, row, 'tome', 'genre/style', 'tome ');
      const pitch    = clean(pick(map, row, 'pitch'));
      const achete   = pick(map, row, 'acheté', 'acheté ?', 'achete');
      const lu       = pick(map, row, 'lu / écouté', 'lu / ecoute', 'lu ?', 'statut', 'lu');
      const noteRaw  = pick(map, row, 'note', 'notes');
      // NB: the sheet's "Commentaire" column holds private notes — intentionally NOT
      // emitted so they never reach the public site. Only the synopsis (Pitch) is shown.

      const grade  = parseGrade(noteRaw);
      const status = deriveStatus(lu, grade);
      const audio  = isAudio(lu, achete);

      // unique slug — probe against every emitted slug so a derived "base-2"
      // can't collide with a real title that already slugifies to "base-2".
      const base = slugify(title);
      let slug = base;
      for (let k = 2; seenSlugs.has(slug); k++) slug = `${base}-${k}`;
      seenSlugs.add(slug);

      // link to a curated review if one exists
      let url = '';
      const aliasSlug = REVIEW_ALIASES[norm(title)] || reviewByTitle.get(norm(title));
      if (aliasSlug && reviewBySlug.has(aliasSlug)) url = `/books/${aliasSlug}/`;

      // free online source (Clarkesworld &c., stored as a URL in the Tome column)
      const sourceUrl = deriveSourceUrl(tome);
      let format = deriveFormat(tome, category);
      let collection = deriveCollection(tome);
      let source = '';
      if (sourceUrl) {
        source = sourceLabel(sourceUrl);
        format = 'Short Story';                         // a bare source URL ⇒ a nouvelle
        if (!collection) collection = source;
      }

      out.push({
        slug,
        title,
        author,
        year: null,
        category,
        format,
        volume: deriveVolume(tome),
        collection,
        grade,
        synopsis: pitch,
        dateRead: '',
        status,
        audio,
        coverId: coverCache.get(coverKey(title, author)),   // number | null | undefined
        url,
        sourceUrl,
        source,
      });
      kept++;
    }
    console.log(`  ${tab} → ${category}: ${kept} books`);
  }

  // Drop the "to-read" pile (TBR) — keep books actually read, in progress, or DNF.
  const library = out.filter(b => b.status !== 'tbr');
  console.log(`  filtered out TBR: ${out.length - library.length} → ${library.length} kept`);

  await resolveCovers(library);

  library.sort((a, b) => {
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    return (b.grade ?? -1) - (a.grade ?? -1);
  });

  const json = JSON.stringify(library, null, 2) + '\n';
  const prevJson = existsSync(dest) ? readFileSync(dest, 'utf8') : '';
  if (prevJson === json) {
    console.log(`✓ library/index.json unchanged (${out.length} books)`);
    return;
  }
  writeFileSync(dest, json, 'utf8');
  console.log(`✓ library/index.json written — ${library.length} books`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
