'use strict';
const { readFileSync, writeFileSync } = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Insert sentinel anchors around a target string (first run only).
// Throws if target is not found and anchors are also absent.
function ensureAnchor(html, file, key, target, replacement) {
  const start = `<!-- PRERENDER:${key}:START -->`;
  if (html.includes(start)) return html; // already anchored
  if (!html.includes(target)) {
    throw new Error(`[prerender] ${file}: anchor target not found for key "${key}".\nExpected: ${JSON.stringify(target)}`);
  }
  return html.replace(target, replacement);
}

function patchSection(html, file, key, content) {
  const start = `<!-- PRERENDER:${key}:START -->`;
  const end   = `<!-- PRERENDER:${key}:END -->`;
  if (!html.includes(start)) {
    throw new Error(`[prerender] ${file}: sentinel missing for key "${key}". Run ensureAnchor first.`);
  }
  const re = new RegExp(
    `<!-- PRERENDER:${key}:START -->[\\s\\S]*?<!-- PRERENDER:${key}:END -->`,
    'g'
  );
  return html.replace(re, `${start}\n${content}\n${end}`);
}

// ── DATA ─────────────────────────────────────────────────────────────────────

const essays  = JSON.parse(readFileSync(path.join(ROOT, 'essays/index.json'),   'utf8'));
const books   = JSON.parse(readFileSync(path.join(ROOT, 'books/index.json'),    'utf8'));
const research = JSON.parse(readFileSync(path.join(ROOT, 'research/index.json'), 'utf8'));

// ── RENDER HELPERS ───────────────────────────────────────────────────────────

function renderEssayRow(essay) {
  const tagsHtml = essay.tags.map(t =>
    `<button class="essay-tag-inline" data-tag="${esc(t)}">${esc(t)}</button>`
  ).join('');
  return `<a href="essay-detail.html?essay=${esc(essay.slug)}" class="essay-row" data-tags="${esc(JSON.stringify(essay.tags))}">
      <span class="essay-row-num">${esc(essay.num)}</span>
      <time class="essay-row-date" datetime="${esc(essay.date)}">${esc(essay.date)}</time>
      <div class="essay-row-body">
        <div class="essay-row-title">${esc(essay.title)}</div>
        <div class="essay-row-desc">${esc(essay.description)}</div>
        <div class="essay-row-tags">${tagsHtml}</div>
      </div>
      <div class="essay-row-meta">
        <span class="essay-row-time">${esc(essay.readTime)}</span>
        <span class="essay-row-arrow">→</span>
      </div>
    </a>`;
}

function renderBookRow(book, index) {
  const num = String(index + 1).padStart(2, '0');
  const tags = book.tags || [];
  const tagsHtml = tags.map(t =>
    `<button class="book-tag-inline" data-tag="${esc(t)}">${esc(t)}</button>`
  ).join('');
  const rating = book.rating ? `${esc(String(book.rating))} / 5` : '';
  return `<a href="book-review.html?book=${esc(book.slug)}" class="book-row" data-tags="${esc(JSON.stringify(tags))}">
      <span class="book-row-num">${num}</span>
      <div class="book-row-cover" data-slug="${esc(book.slug)}">
        <img class="book-cover-img" src="books/covers/${esc(book.slug)}.jpg" alt="">
      </div>
      <div class="book-row-body">
        <div class="book-row-title">${esc(book.title)}</div>
        <div class="book-row-author">${esc(book.author)} · ${esc(String(book.published))}</div>
        <div class="book-row-desc">${esc(book.description)}</div>
        <div class="book-row-tags">${tagsHtml}</div>
      </div>
      <div class="book-row-meta">
        <span class="book-row-rating">${rating}</span>
        <span class="book-row-arrow">→</span>
      </div>
    </a>`;
}

function renderResearchCard(node, index) {
  const statusClass = node.status.toLowerCase().replace(/\s+/g, '-');
  const tagsHtml = (node.tags || []).map(t =>
    `<span class="card-tag">${esc(t)}</span>`
  ).join('');
  const linkHtml = (node.status === 'DONE' && node.link)
    ? `<span class="card-link">${esc(node.linkLabel || '→ READ')}</span>`
    : '';
  const coord = `x: 0.${(482 + index * 17) % 999} · y: 0.${(345 + index * 23) % 999}`;

  const article = `<article class="research-card fade-in">
      <span class="corner-tick corner-tick-tl"></span>
      <span class="corner-tick corner-tick-tr"></span>
      <span class="corner-tick corner-tick-bl"></span>
      <span class="corner-tick corner-tick-br"></span>
      <div class="card-header">
        <span>[${esc(node.id)}]</span>
        <span class="card-header-right">
          <span class="card-type-badge card-type-${statusClass}">${esc(node.status)}</span>
        </span>
      </div>
      <h2 class="card-title">${esc(node.title)}</h2>
      <p class="card-abstract">${esc(node.description)}</p>
      <div class="card-bottom">
        ${linkHtml}
        <div class="card-tags">${tagsHtml}</div>
      </div>
      <span class="hover-coord">${esc(coord)}</span>
    </article>`;

  if (node.link) {
    return `<a href="${esc(node.link)}" class="card-link-wrapper">${article}</a>`;
  }
  return article;
}

function renderTagButtons(tags) {
  return tags.map(t =>
    `<button class="tag" data-tag="${esc(t)}">${esc(t)}</button>`
  ).join('\n      ');
}

function renderEssayPreview(essay) {
  const tagsHtml = essay.tags.map(t =>
    `<span class="ep-tag">${esc(t)}</span>`
  ).join('');
  return `<a href="essay-detail.html?essay=${esc(essay.slug)}" class="essay-preview">
      <div class="ep-meta">
        <time class="ep-date" datetime="${esc(essay.date)}">${esc(essay.date)}</time>
        ${tagsHtml}
      </div>
      <div class="ep-title">${esc(essay.title)}</div>
      <div class="ep-desc">${esc(essay.description)}</div>
    </a>`;
}

function renderBookPreview(book) {
  return `<a href="book-review.html?book=${esc(book.slug)}" class="book-preview">
      <div class="bp-cover">
        <img class="bp-cover-img" src="books/covers/${esc(book.slug)}.jpg" alt="">
        <span class="bp-cover-init">${esc(book.initials)}</span>
      </div>
      <div class="bp-info">
        <div class="ep-meta ep-meta-compact">
          <time class="ep-date" datetime="${esc(book.readDate)}">${esc(book.readDate)}</time>
          <span class="ep-tag">${esc(book.category)}</span>
        </div>
        <div class="bp-title">${esc(book.title)}</div>
        <div class="bp-author">${esc(book.author)}</div>
        <div class="bp-note">${esc(book.note || book.description)}</div>
      </div>
    </a>`;
}

// ── PATCH essays.html ─────────────────────────────────────────────────────────

{
  const file = 'essays.html';
  let html = readFileSync(path.join(ROOT, file), 'utf8');

  html = ensureAnchor(html, file, 'ESSAY-LIST',
    '<div id="essay-list"></div>',
    '<div id="essay-list"><!-- PRERENDER:ESSAY-LIST:START --><!-- PRERENDER:ESSAY-LIST:END --></div>'
  );
  html = ensureAnchor(html, file, 'ESSAY-TAGS',
    '      <button class="tag active" data-tag="all">All</button>\n    </div>',
    '      <button class="tag active" data-tag="all">All</button>\n      <!-- PRERENDER:ESSAY-TAGS:START --><!-- PRERENDER:ESSAY-TAGS:END -->\n    </div>'
  );

  const essayListHtml = essays.map(renderEssayRow).join('\n      ');
  const essayTags = [...new Set(essays.flatMap(e => e.tags))];

  html = patchSection(html, file, 'ESSAY-LIST', essayListHtml);
  html = patchSection(html, file, 'ESSAY-TAGS', renderTagButtons(essayTags));

  writeFileSync(path.join(ROOT, file), html, 'utf8');
  console.log(`✓ ${file}`);
}

// ── PATCH books.html ──────────────────────────────────────────────────────────

{
  const file = 'books.html';
  let html = readFileSync(path.join(ROOT, file), 'utf8');

  html = ensureAnchor(html, file, 'BOOK-LIST',
    '<div id="book-list"></div>',
    '<div id="book-list"><!-- PRERENDER:BOOK-LIST:START --><!-- PRERENDER:BOOK-LIST:END --></div>'
  );
  html = ensureAnchor(html, file, 'BOOK-TAGS',
    '      <button class="tag active" data-tag="all">All</button>\n    </div>',
    '      <button class="tag active" data-tag="all">All</button>\n      <!-- PRERENDER:BOOK-TAGS:START --><!-- PRERENDER:BOOK-TAGS:END -->\n    </div>'
  );

  const bookListHtml = books.map((b, i) => renderBookRow(b, i)).join('\n      ');
  const bookTags = [...new Set(books.flatMap(b => b.tags || []))];

  html = patchSection(html, file, 'BOOK-LIST', bookListHtml);
  html = patchSection(html, file, 'BOOK-TAGS', renderTagButtons(bookTags));

  writeFileSync(path.join(ROOT, file), html, 'utf8');
  console.log(`✓ ${file}`);
}

// ── PATCH research.html ───────────────────────────────────────────────────────

{
  const file = 'research.html';
  let html = readFileSync(path.join(ROOT, file), 'utf8');

  html = ensureAnchor(html, file, 'RESEARCH-FILTERS',
    '    <div id="filter-bar"></div>',
    '    <div id="filter-bar"><!-- PRERENDER:RESEARCH-FILTERS:START --><!-- PRERENDER:RESEARCH-FILTERS:END --></div>'
  );
  html = ensureAnchor(html, file, 'RESEARCH-CARDS',
    '  <div id="cards-track"></div>',
    '  <div id="cards-track"><!-- PRERENDER:RESEARCH-CARDS:START --><!-- PRERENDER:RESEARCH-CARDS:END --></div>'
  );

  const nodes = research.map((item, i) => ({
    ...item,
    id: `NODE_${String(research.length - i).padStart(3, '0')}`,
  }));
  const cardsInner = nodes.map((node, i) => renderResearchCard(node, i)).join('\n    ');
  // Wrap in #cards-flex so the horizontal desktop layout is correct before JS hydrates.
  const cardsHtml = `<div id="cards-flex">\n    ${cardsInner}\n  </div>`;

  const allStatuses = ['TO REVIEW', 'TO SEARCH', 'DONE']
    .filter(s => research.some(n => n.status === s));
  const statusBtns = ['ALL', ...allStatuses].map((s, i) =>
    `<button class="filter-btn${i === 0 ? ' active' : ''}">${esc(s)}</button>`
  ).join('\n      ');
  const allTopics = [...new Set(research.flatMap(n => n.tags || []))];
  const topicBtns = ['ALL', ...allTopics].map((t, i) =>
    `<button class="filter-btn${i === 0 ? ' active' : ''}">${esc(t)}</button>`
  ).join('\n      ');
  const filtersHtml =
    `<div class="filter-row status-row">
      <span class="filter-row-label">STATUS /</span>
      ${statusBtns}
    </div>
    <div class="filter-row tag-row">
      <span class="filter-row-label">TOPIC /</span>
      ${topicBtns}
    </div>`;

  html = patchSection(html, file, 'RESEARCH-FILTERS', filtersHtml);
  html = patchSection(html, file, 'RESEARCH-CARDS', cardsHtml);

  writeFileSync(path.join(ROOT, file), html, 'utf8');
  console.log(`✓ ${file}`);
}

// ── PATCH index.html ──────────────────────────────────────────────────────────

{
  const file = 'index.html';
  let html = readFileSync(path.join(ROOT, file), 'utf8');

  html = ensureAnchor(html, file, 'ESSAYS-PREVIEW',
    '<div id="essays-preview"></div>',
    '<div id="essays-preview"><!-- PRERENDER:ESSAYS-PREVIEW:START --><!-- PRERENDER:ESSAYS-PREVIEW:END --></div>'
  );
  html = ensureAnchor(html, file, 'BOOKS-PREVIEW',
    '<div id="books-preview"></div>',
    '<div id="books-preview"><!-- PRERENDER:BOOKS-PREVIEW:START --><!-- PRERENDER:BOOKS-PREVIEW:END --></div>'
  );

  const sortedEssays = [...essays].sort((a, b) => new Date(b.date) - new Date(a.date));
  const sortedBooks  = [...books].sort((a, b) => new Date(b.readDate) - new Date(a.readDate));

  html = patchSection(html, file, 'ESSAYS-PREVIEW',
    sortedEssays.map(renderEssayPreview).join('\n      ')
  );
  html = patchSection(html, file, 'BOOKS-PREVIEW',
    sortedBooks.map(renderBookPreview).join('\n      ')
  );

  writeFileSync(path.join(ROOT, file), html, 'utf8');
  console.log(`✓ ${file}`);
}
