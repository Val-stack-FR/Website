/* library.js — Library reading-log table.
   Data is fetched from /library/index.json (baked at build time from the "Livres"
   sheet). Prerendered rows act as a no-JS / crawler fallback. CSP-safe: every
   handler is bound with addEventListener; no inline styles are emitted. */

/* ─── BACKGROUND ANIMATION ─────────────────────────────────────────────────── */
(function () {
  const cv = document.getElementById('bg-canvas');
  if (!cv) return;
  const cx = cv.getContext('2d');
  const BASE = '#e8f2ed';
  const blobs = [
    { ox:.50, oy:.40, ax:.36, ay:.26, fx:1.00, fy:0.70, ph:0.00, a:.14, rgb:[26, 92, 58] },
    { ox:.50, oy:.58, ax:.28, ay:.22, fx:1.30, fy:1.00, ph:1.26, a:.11, rgb:[13, 61, 37] },
    { ox:.50, oy:.50, ax:.40, ay:.30, fx:0.80, fy:1.30, ph:2.51, a:.09, rgb:[42, 88, 40] },
    { ox:.44, oy:.44, ax:.22, ay:.32, fx:1.60, fy:0.80, ph:3.77, a:.12, rgb:[18, 68, 52] },
    { ox:.55, oy:.52, ax:.32, ay:.20, fx:0.90, fy:1.50, ph:5.03, a:.08, rgb:[10, 46, 28] },
  ];
  const SPEED = 0.00022;
  const t0 = performance.now();
  // The blobs are soft radial gradients — render at half resolution and let CSS
  // stretch the canvas: visually identical, 4× fewer pixels per frame (big win on 4K).
  const SCALE = 0.5;
  function resize() { cv.width = Math.ceil(window.innerWidth * SCALE); cv.height = Math.ceil(window.innerHeight * SCALE); }
  resize();
  window.addEventListener('resize', () => { resize(); if (!running) paint(performance.now()); });

  function paint(now) {
    const t = (now - t0) * SPEED;
    const W = cv.width, H = cv.height, D = Math.min(W, H);
    cx.fillStyle = BASE; cx.fillRect(0, 0, W, H);
    blobs.forEach(b => {
      const bx = (b.ox + b.ax * Math.sin(b.fx * t + b.ph)) * W;
      const by = (b.oy + b.ay * Math.cos(b.fy * t + b.ph * .8)) * H;
      const r = 0.38 * D; const [R, G, B] = b.rgb;
      const g = cx.createRadialGradient(bx, by, 0, bx, by, r);
      g.addColorStop(0, `rgba(${R},${G},${B},${b.a})`);
      g.addColorStop(0.5, `rgba(${R},${G},${B},${(b.a * .45).toFixed(3)})`);
      g.addColorStop(1, `rgba(${R},${G},${B},0)`);
      cx.fillStyle = g; cx.beginPath(); cx.arc(bx, by, r, 0, Math.PI * 2); cx.fill();
    });
  }

  // Respect reduced-motion (paint a single static frame) and pause while hidden.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let running = false, rafId = 0;
  function loop(now) { paint(now); rafId = requestAnimationFrame(loop); }
  function start() { if (running || reduce.matches || document.hidden) return; running = true; rafId = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(rafId); }

  reduce.addEventListener('change', () => { stop(); reduce.matches ? paint(performance.now()) : start(); });
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });

  if (reduce.matches) paint(performance.now()); else start();
})();

/* ─── CATEGORY META ────────────────────────────────────────────────────────── */
const CAT_CLS = {
  'Sci-Fi': 'cat-scifi', 'Fantasy': 'cat-fantasy', 'Fiction': 'cat-fiction',
  'Non-fiction': 'cat-nonfiction', 'Untranslated': 'cat-untranslated',
};
const CAT_ORDER = ['Sci-Fi', 'Fantasy', 'Fiction', 'Non-fiction', 'Untranslated'];
const catCls = (c) => CAT_CLS[c] || 'cat-nonfiction';

/* ─── STATE ────────────────────────────────────────────────────────────────── */
let books      = [];
let activeType = 'Sci-Fi';
let activeTag  = 'all';
let sortState  = { key: null, dir: 1 };   // null = default order (author A→Z, then title)

/* ─── UTILITIES ────────────────────────────────────────────────────────────── */
// Only allow internal, same-origin paths into href (defense-in-depth vs javascript:/data: URLs).
function safeUrl(u) { return typeof u === 'string' && /^\/(?!\/)/.test(u) ? u : ''; }
// External source links: only http(s) (blocks javascript:/data:).
function safeExtUrl(u) { return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : ''; }
const coverSrc = (id) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`;   // M (180px): sharp on retina at 28px CSS
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function initials(t) {
  const s = String(t || '');
  const ini = s.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  return ini || s.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase();
}
function fmtGrade(g) { const n = Number(g); return n % 1 === 0 ? String(n) : n.toFixed(1); }
function makeDots(g) {
  const n = Number(g);
  return Array.from({ length: 5 }, (_, i) => `<span class="gdot${Math.round(n) > i ? ' on' : ''}"></span>`).join('');
}
function statusLabel(s) { return { read: 'Read', reading: 'Reading', tbr: 'TBR', dnf: 'DNF' }[s] || s; }

function filteredBooks() {
  return books.filter(b => {
    const typeOk = activeType === 'all' || b.category === activeType;
    const tagOk  = activeTag === 'all' || (b.tags || []).includes(activeTag);
    return typeOk && tagOk;
  });
}
const catsPresent = () =>
  CAT_ORDER.filter(c => books.some(b => b.category === c))
    .concat([...new Set(books.map(b => b.category))].filter(c => !CAT_ORDER.includes(c)).sort());

/* ─── CATEGORY FILTER ──────────────────────────────────────────────────────── */
function buildTypeBar() {
  const bar = document.getElementById('type-bar');
  bar.querySelectorAll('.type-tab:not(.all-tab)').forEach(el => el.remove());
  catsPresent().forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `type-tab ${catCls(cat)}`;
    btn.dataset.type = cat;
    btn.innerHTML = `<span class="type-dot"></span>${esc(cat)}`;
    bar.appendChild(btn);
  });
  if (!books.some(b => b.category === activeType)) activeType = catsPresent()[0] || 'all';
  refreshTypeTabs();
}
function setType(type) { activeType = type; activeTag = 'all'; refreshTypeTabs(); renderLog(); }
function refreshTypeTabs() {
  document.querySelectorAll('.type-tab').forEach(btn => {
    const on = btn.dataset.type === activeType;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

/* ─── SORT ─────────────────────────────────────────────────────────────────── */
function doSort(key) {
  // Cycle: 1st click asc → 2nd desc → 3rd back to the default author order.
  if (sortState.key === key && sortState.dir === -1) { sortState.key = null; sortState.dir = 1; }
  else if (sortState.key === key) sortState.dir = -1;
  else { sortState.key = key; sortState.dir = 1; }
  const active = sortState.key;                 // null after the 3rd click (back to default)
  ['title', 'format', 'year', 'grade'].forEach(k => {
    const el = document.getElementById('sa-' + k);
    if (!el) return;
    const th = el.closest('th');
    th.classList.toggle('sorted', k === active);
    th.setAttribute('aria-sort', k !== active ? 'none' : sortState.dir > 0 ? 'ascending' : 'descending');
    el.textContent = k !== active ? '↕' : sortState.dir > 0 ? '↑' : '↓';
  });
  renderLog();
}

/* ─── TAG BAR ──────────────────────────────────────────────────────────────── */
function buildTagBar() {
  const relevant = activeType === 'all'
    ? books.flatMap(b => b.tags || [])
    : books.filter(b => b.category === activeType).flatMap(b => b.tags || []);
  const allTags = [...new Set(relevant)].sort();
  const bar = document.getElementById('tag-bar');
  bar.classList.toggle('hidden', allTags.length === 0);
  while (bar.children.length > 2) bar.removeChild(bar.lastChild);
  allTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag' + (tag === activeTag ? ' active' : '');
    btn.dataset.tag = tag;
    btn.textContent = tag;
    btn.setAttribute('aria-pressed', String(tag === activeTag));
    bar.appendChild(btn);
  });
  // keep the static "All" chip's pressed-state honest
  const allChip = bar.querySelector('.tag[data-tag="all"]');
  if (allChip) allChip.setAttribute('aria-pressed', String(activeTag === 'all'));
}
function setTag(tag) {
  activeTag = tag;
  document.querySelectorAll('#tag-bar .tag').forEach(b => {
    b.classList.toggle('active', b.dataset.tag === tag);
    b.setAttribute('aria-pressed', String(b.dataset.tag === tag));
  });
  renderLog();
}

/* ─── RENDER ───────────────────────────────────────────────────────────────── */
// rowHtml() and the section header below are kept byte-for-byte in sync with
// scripts/prerender.js (renderLibraryRow) so the prerendered fallback and the
// JS render are interchangeable.
function rowHtml(book, i) {
  const cc = catCls(book.category);
  const volSuffix = book.volume ? ` <span class="vol-suffix">Vol.${esc(book.volume)}</span>` : '';
  const audioBadge = book.audio ? `<span class="audio-dot" title="Audiobook"></span>` : '';
  const gradeCell = (book.grade != null)
    ? `<div class="grade-score">${fmtGrade(book.grade)}<span class="grade-denom">&thinsp;/5</span></div><div class="grade-dots">${makeDots(book.grade)}</div>`
    : `<span class="grade-none" title="To read">—</span>`;
  const dateBlock = book.dateRead ? `<span class="expand-date">${esc(book.dateRead)}</span>` : '';
  const synopsis = book.synopsis ? esc(book.synopsis) : `<span class="expand-empty">No synopsis yet.</span>`;
  const exId = `ex-${esc(book.slug)}`;
  const url = safeUrl(book.url);
  const srcUrl = safeExtUrl(book.sourceUrl);
  const sourceLink = srcUrl
    ? `<a class="expand-link source-link" href="${esc(srcUrl)}" target="_blank" rel="noopener noreferrer">Read free online${book.source ? ` · ${esc(book.source)}` : ''} ↗</a>` : '';
  const coverImg = Number.isInteger(book.coverId)
    ? `<img class="cover-img" src="${coverSrc(book.coverId)}" alt="" loading="lazy">` : '';
  const collection = book.collection
    ? `<div class="book-collection" title="Found in this collection">↳ ${esc(book.collection)}</div>` : '';
  return `<tr class="log-row ${cc}" data-slug="${esc(book.slug)}" tabindex="0" role="button" aria-expanded="false" aria-controls="${exId}" aria-label="${esc(book.title)}, ${esc(book.author)} — show synopsis">
      <td class="td-num">${String(i + 1).padStart(2, '0')}</td>
      <td class="td-cover"><div class="cover-block"><span class="cover-init">${esc(initials(book.title))}</span>${coverImg}</div></td>
      <td class="td-book"><div class="book-title">${esc(book.title)}${volSuffix}</div><div class="book-author">${esc(book.author)}${audioBadge}</div>${collection}</td>
      <td class="td-type col-format"><span class="type-badge">${esc(book.format || '—')}</span></td>
      <td class="td-year">${book.year != null ? esc(String(book.year)) : '—'}</td>
      <td class="td-tags"><div class="tags-wrap">${(book.tags || []).map(t => `<span class="row-tag">${esc(t)}</span>`).join('')}</div></td>
      <td class="td-grade">${gradeCell}</td>
      <td class="td-status"><span class="status-pill ${esc(book.status)}">${book.audio && book.status === 'read' ? 'AUDIO' : esc(statusLabel(book.status).toUpperCase())}</span></td>
      <td class="td-link">${url
        ? `<a class="row-link" href="${esc(url)}" title="Full review of ${esc(book.title)}">↗</a>`
        : `<span class="row-link-empty">—</span>`}</td>
    </tr>
    <tr class="expand-row" id="${exId}"><td colspan="9"><div class="expand-inner">${synopsis}<div class="expand-foot">${sourceLink}${url ? `<a class="expand-link" href="${esc(url)}">Read full review →</a>` : ''}${dateBlock}</div></div></td></tr>`;
}

// Sort key for an author: surname-first (keeping particles like "Le Guin", "de …"),
// so a writer's works group together under their surname.
const NAME_PARTICLES = new Set(['le', 'la', 'de', 'du', 'des', 'von', 'van', 'der', 'den', 'ten', 'del', 'dos', "d'"]);
function authorKey(name) {
  const parts = String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '~';                          // unknown authors ("—") sort last
  let surname = parts[parts.length - 1];
  if (parts.length >= 2 && NAME_PARTICLES.has(parts[parts.length - 2])) {
    surname = parts[parts.length - 2] + ' ' + surname;
  }
  return surname + ' ' + parts.join(' ');
}

// Default order (no active column sort): alphabetical by author, then title A→Z.
// slug tiebreak keeps the comparator consistent for duplicate title+author pairs.
function defaultSort(a, b) {
  const ak = authorKey(a.author), bk = authorKey(b.author);
  if (ak !== bk) return ak < bk ? -1 : 1;
  const at = String(a.title).toLowerCase(), bt = String(b.title).toLowerCase();
  if (at !== bt) return at < bt ? -1 : 1;
  return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
}

function renderLog() {
  buildTagBar();
  let data = filteredBooks();

  if (sortState.key) {
    const k = sortState.key;
    data.sort((a, b) => {
      let av = a[k], bv = b[k];
      if (k === 'grade' || k === 'year') { av = av ?? -1; bv = bv ?? -1; }
      if (typeof av === 'string') { av = av.toLowerCase(); bv = String(bv).toLowerCase(); }
      return av < bv ? -sortState.dir : av > bv ? sortState.dir : 0;
    });
  } else {
    data.sort(defaultSort);
  }

  const tbody = document.getElementById('log-body');
  const n = data.length;
  document.getElementById('page-count').textContent = `${n} book${n !== 1 ? 's' : ''}`;
  const empty = document.getElementById('empty-state');
  if (!n) { tbody.innerHTML = ''; empty.classList.add('visible'); return; }
  empty.classList.remove('visible');

  tbody.innerHTML = data.map((book, i) => rowHtml(book, i)).join('');  // one paint
}

/* ─── ROW EXPAND (delegated — works for prerendered + dynamic rows) ─────────── */
function toggleRow(row) {
  const ex = row.nextElementSibling;
  if (!ex || !ex.classList.contains('expand-row')) return;
  const open = ex.classList.contains('open');
  document.querySelectorAll('.expand-row.open').forEach(r => r.classList.remove('open'));
  document.querySelectorAll('.log-row.expanded').forEach(r => {
    r.classList.remove('expanded'); r.setAttribute('aria-expanded', 'false');
  });
  if (!open) { ex.classList.add('open'); row.classList.add('expanded'); row.setAttribute('aria-expanded', 'true'); }
}

/* ─── EVENT DELEGATION (CSP-safe) ──────────────────────────────────────────── */
const logBody = document.getElementById('log-body');
logBody.addEventListener('click', (e) => {
  if (e.target.closest('a')) return;                 // let the ↗ review link navigate
  const row = e.target.closest('.log-row');
  if (row) toggleRow(row);
});
logBody.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  const row = e.target.closest('.log-row');
  if (row && row === e.target) { e.preventDefault(); toggleRow(row); }
});
// A cover that fails to load drops back to the coloured initials (capture phase:
// the load 'error' event does not bubble, so it must be caught on the way down).
logBody.addEventListener('error', (e) => {
  if (e.target.classList && e.target.classList.contains('cover-img')) e.target.remove();
}, true);
// Prerendered covers start loading before this script runs — sweep any that
// already failed (error fired before the listener above was attached).
document.querySelectorAll('.cover-img').forEach(img => {
  if (img.complete && img.naturalWidth === 0) img.remove();
});

document.getElementById('type-bar').addEventListener('click', (e) => {
  const tab = e.target.closest('.type-tab');
  if (tab && tab.dataset.type) setType(tab.dataset.type);
});
document.getElementById('tag-bar').addEventListener('click', (e) => {
  const t = e.target.closest('.tag');
  if (t && t.dataset.tag) setTag(t.dataset.tag);
});
const thead = document.querySelector('#log-table thead');
thead.addEventListener('click', (e) => {
  const th = e.target.closest('th.sortable');
  if (th && th.dataset.sort) doSort(th.dataset.sort);
});
thead.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  const th = e.target.closest('th.sortable');
  if (th && th.dataset.sort) { e.preventDefault(); doSort(th.dataset.sort); }
});

/* ─── INIT ─────────────────────────────────────────────────────────────────── */
fetch('/library/index.json')
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(data => {
    books = data;
    document.querySelector('.log-wrap').classList.toggle('show-year', books.some(b => b.year != null));
    buildTypeBar();
    renderLog();
  })
  .catch(() => { /* keep prerendered rows as fallback */ })
  .finally(() => document.body.classList.add('visible'));
