'use strict';
const { readFileSync, writeFileSync, mkdirSync, existsSync } = require('fs');
const path = require('path');

// SITE_ROOT lets the deployment build render an isolated output tree instead of
// mutating the source checkout.
const ROOT = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.join(__dirname, '..');

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

// Only routes with an existing translated source are emitted. The titles and
// descriptions below are editorial translations of the English registry
// metadata; the article bodies remain the authored French source files.
const FRENCH_ESSAY_META = {
  'all-the-unwritten-processes': {
    title: 'Tous les processus non écrits',
    description: 'Avant qu’un agent puisse agir, quelqu’un doit rendre le travail lisible : un investissement massif, qualifié et rarement reconnu que les feuilles de route ignorent.'
  },
  'briefing-is-not-chatting': {
    title: 'Briefer n’est pas discuter',
    description: 'Le chat a comprimé l’écart de compétences ; les agents l’inversent, en récompensant la décomposition, la spécification et l’évaluation critique.'
  },
  'genai-adoption-people-in-the-middle': {
    title: 'Les personnes au cœur de l’adoption de la GenAI',
    description: 'L’adoption de la GenAI cale moins par peur de la technologie que parce que les organisations traitent le mauvais problème et épuisent la confiance à chaque déploiement raté.'
  },
  'linguistic-capital-ai-inequality': {
    title: 'Le fossé de l’articulation',
    description: 'L’avantage des super-utilisateurs d’IA n’est pas seulement technique : il prolonge le capital linguistique et transforme les LLM en puissants mécanismes de tri social.'
  },
  'no-clean-slate': {
    title: 'Pas de table rase',
    description: 'La confiance envers l’IA ne repart pas de zéro : elle s’épuise de manière asymétrique et les déploiements ratés laissent des filtres durables.'
  },
  'off-the-tracks': {
    title: 'Quand le train déraille',
    description: 'Quand la performance baisse, le réflexe du contrôle renforcé détruit l’environnement informationnel nécessaire pour comprendre et corriger le problème.'
  },
  'the-ghost-competence': {
    title: 'La compétence fantôme',
    description: 'Déployer des agents dès le premier jour ne supprime pas l’apprentissage : il le rend invisible et fragilise le jugement requis pour superviser ce qui est délégué.'
  },
  'the-hand-that-sorts-the-cards': {
    title: 'La main qui trie les cartes',
    description: 'Les tactiques de Michel de Certeau éclairent les LLM frontier : chaque ruse inventée dans ce « lieu propre » de la plateforme peut être captée, généralisée ou refermée.'
  },
  'the-human-bottleneck': {
    title: 'Le goulot d’étranglement humain',
    description: 'Dans le travail augmenté par l’IA, la contrainte s’est déplacée vers la personne qui doit orienter, vérifier et juger ce que produit la machine.'
  },
  'when-feedback-fails': {
    title: 'Quand le feedback échoue',
    description: 'Plus d’un tiers des interventions de feedback dégradent la performance lorsque les organisations ignorent les conditions de conception qui déterminent leur effet.'
  },
  'who-is-conducting-whom': {
    title: 'Qui dirige qui ?',
    description: 'Travailler avec l’IA ne prolonge pas seulement la pensée : cela change le plan sur lequel elle opère, avec des conséquences pour les systèmes qui dépendent du jugement humain.'
  },
  'who-pays-when-ai-is-wrong': {
    title: 'Qui paie quand l’IA se trompe ?',
    description: 'L’IA générative augmente le seuil pour recevoir le crédit sans modifier celui du blâme, concentrant le risque sur la personne qui signe l’output.'
  },
};

const FRENCH_BOOK_META = {
  'blindsight': {
    title: 'Vision aveugle',
    description: 'Un roman de premier contact qui utilise les extraterrestres comme un scalpel pour interroger la conscience.'
  },
  'genius-in-the-room': {
    title: 'Multipliers : comment les meilleurs dirigeants rendent chacun plus intelligent',
    description: 'La personne la plus intelligente de la pièce peut devenir son principal goulot d’étranglement, souvent par la conviction que sa contribution est indispensable.'
  },
  'stripping-away-the-degree': {
    title: 'Good Power',
    description: 'Le diplôme de quatre ans n’a jamais été un proxy fiable de la capacité : il est surtout devenu un filtre pratique dont le coût se cumule dans l’économie des compétences.'
  },
};

const routeFor = (type, slug, lang = 'en') =>
  lang === 'fr' ? `/fr/${type}/${slug}/` : `/${type}/${slug}/`;
const hasFrenchTranslation = (type, slug) =>
  existsSync(path.join(ROOT, type, 'fr', `${slug}.md`));
const localised = (item, type, lang) => {
  if (lang !== 'fr') return item;
  const translation = (type === 'essays' ? FRENCH_ESSAY_META : FRENCH_BOOK_META)[item.slug];
  if (!translation) throw new Error(`[prerender] missing French metadata for ${type}/${item.slug}`);
  return { ...item, ...translation };
};

// ── VALIDATE RESEARCH LINKS ──────────────────────────────────────────────────

research.forEach(node => {
  if (node.status === 'DONE' && node.link) {
    if (/^(essay-detail|book-review)\.html\?/.test(node.link)) {
      console.warn(`  ⚠ research "${node.slug}": link uses legacy URL format → ${node.link}`);
      console.warn(`    Use /essays/{slug}/ or /books/{slug}/ instead`);
    }
  }
});

// ── RENDER HELPERS ───────────────────────────────────────────────────────────

function renderEssayRow(essay) {
  const tagsHtml = essay.tags.map(t =>
    `<button class="essay-tag-inline" data-tag="${esc(t)}">${esc(t)}</button>`
  ).join('');
  return `<a href="/essays/${esc(essay.slug)}/" class="essay-row" data-tags="${esc(JSON.stringify(essay.tags))}">
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
  return `<a href="/books/${esc(book.slug)}/" class="book-row" data-tags="${esc(JSON.stringify(tags))}">
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
  return `<a href="/essays/${esc(essay.slug)}/" class="essay-preview">
      <div class="ep-meta">
        <time class="ep-date" datetime="${esc(essay.date)}">${esc(essay.date)}</time>
        ${tagsHtml}
      </div>
      <div class="ep-title">${esc(essay.title)}</div>
      <div class="ep-desc">${esc(essay.description)}</div>
    </a>`;
}

function renderBookPreview(book) {
  return `<a href="/books/${esc(book.slug)}/" class="book-preview">
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

// Bake the live item count into a page's header (no-JS / crawler fallback for the
// "N essays / N reviews / N books" figure that the page JS recomputes on load).
function patchPageCount(html, file, text) {
  html = ensureAnchor(html, file, 'PAGE-COUNT',
    '<span class="page-count" id="page-count">—</span>',
    '<span class="page-count" id="page-count"><!-- PRERENDER:PAGE-COUNT:START -->—<!-- PRERENDER:PAGE-COUNT:END --></span>'
  );
  return patchSection(html, file, 'PAGE-COUNT', esc(text));
}

// ── PATCH essays.html ─────────────────────────────────────────────────────────

{
  const file = 'essays.html';
  let html = readFileSync(path.join(ROOT, file), 'utf8');
  html = patchPageCount(html, file, `${essays.length} essay${essays.length !== 1 ? 's' : ''}`);

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
  html = patchPageCount(html, file, `${books.length} review${books.length !== 1 ? 's' : ''}`);

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

// ── MARKDOWN CONVERTER ────────────────────────────────────────────────────────

function inlineMd(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderMarkdown(md) {
  return md.split(/\n\n+/).map(block => {
    block = block.trim();
    if (!block) return '';
    if (block.startsWith('<')) return block;
    if (block.startsWith('## ')) {
      const text = block.slice(3).trim();
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      return `<h2 id="${id}">${inlineMd(text)}</h2>`;
    }
    return `<p>${inlineMd(block.replace(/\n/g, ' '))}</p>`;
  }).filter(Boolean).join('\n');
}

// ── CROSS-REFERENCE RESOLUTION (build-time) ───────────────────────────────────
// Mirror the runtime resolvers in js/essay-detail.js so crawlers and no-JS
// readers see resolved cross-links in the static HTML. The runtime skips any
// `.article-ref--loaded` div and any already-populated related grid, so these
// prerendered results are authoritative and never double-rendered.

// Resolve inline <div class="article-ref" data-slug data-type>SENTENCE</div>
// into the card markup, preserving the author's (localised) bridge sentence.
function resolveArticleRefs(html, lang = 'en') {
  return html.replace(
    /<div class="article-ref"\s+data-slug="([^"]+)"\s+data-type="([^"]+)"\s*>([\s\S]*?)<\/div>/g,
    (whole, slug, type, inner) => {
      const contentType = type === 'book' ? 'books' : 'essays';
      const item = (type === 'book' ? books : essays).find(x => x.slug === slug);
      if (!item) return whole; // leave raw if target unknown
      const targetLang = lang === 'fr' && hasFrenchTranslation(contentType, slug) ? 'fr' : 'en';
      const href = routeFor(contentType, slug, targetLang);
      const itemMeta = localised(item, contentType, targetLang);
      const desc = inner.trim() || item.description || '';
      return `<div class="article-ref article-ref--loaded" data-slug="${esc(slug)}" data-type="${esc(type)}">`
        + `<a href="${href}" class="article-ref-card">`
        + `<div class="article-ref-eyebrow">${esc(type)}</div>`
        + `<div class="article-ref-title">${esc(itemMeta.title)}</div>`
        + `<div class="article-ref-desc">${desc}</div>`
        + `<div class="article-ref-cta">Read →</div>`
        + `</a></div>`;
    }
  );
}

// "Read next" cards for an essay's `related` array (mirrors renderRelated).
function relatedEssaysHtml(essay, lang = 'en') {
  if (!essay.related || essay.related.length === 0) return '';
  return essay.related.map(r => {
    if (r.type === 'book') {
      const b = books.find(x => x.slug === r.slug);
      if (!b) return '';
      const targetLang = lang === 'fr' && hasFrenchTranslation('books', b.slug) ? 'fr' : 'en';
      const meta = localised(b, 'books', targetLang);
      return `<a href="${routeFor('books', esc(b.slug), targetLang)}" class="related-card related-card--essay"><div class="related-card-type">${lang === 'fr' ? 'livre' : 'book'}</div><div class="related-title">${esc(meta.title)}</div><div class="related-desc">${esc(meta.description || '')}</div></a>`;
    }
    const e = essays.find(x => x.slug === r.slug);
    if (!e) return '';
    const targetLang = lang === 'fr' && hasFrenchTranslation('essays', e.slug) ? 'fr' : 'en';
    const meta = localised(e, 'essays', targetLang);
    return `<a href="${routeFor('essays', esc(e.slug), targetLang)}" class="related-card related-card--essay"><div class="related-card-type">${lang === 'fr' ? 'essai' : 'essay'}</div><div class="related-title">${esc(meta.title)}</div><div class="related-desc">${esc(meta.description || '')}</div></a>`;
  }).filter(Boolean).join('');
}

// "Read next" cards for a book's `related` array (slugs → book cards).
function relatedBooksHtml(book, lang = 'en') {
  if (!book.related || book.related.length === 0) return '';
  return book.related.map(slug => {
    const b = books.find(x => x.slug === slug);
    if (!b) return '';
    const targetLang = lang === 'fr' && hasFrenchTranslation('books', b.slug) ? 'fr' : 'en';
    const meta = localised(b, 'books', targetLang);
    return `<a href="${routeFor('books', esc(b.slug), targetLang)}" class="related-card"><div class="related-title">${esc(meta.title)}</div><div class="related-author">${esc(b.author)}</div></a>`;
  }).filter(Boolean).join('');
}

// ── SHARED PAGE FRAGMENTS ─────────────────────────────────────────────────────

const NAV_LINKS = (active, lang = 'en') => {
  const labels = lang === 'fr'
    ? { essays: 'Essais', books: 'Livres', research: 'Recherche', about: 'À propos' }
    : { essays: 'Essays', books: 'Books', research: 'Research', about: 'About' };
  return `
  <nav class="nav" aria-label="primary">
    <a href="/" class="nav-logo">VT—</a>
    <div class="nav-links">
      <a href="/essays.html" class="nav-link${active === 'essays' ? ' active' : ''}">${labels.essays}</a>
      <a href="/books.html" class="nav-link${active === 'books' ? ' active' : ''}">${labels.books}</a>
      <a href="/research.html" class="nav-link">${labels.research}</a>
      <a href="/about/" class="nav-link">${labels.about}</a>
    </div>
  </nav>`;
};

const SITE_URL = process.env.SITE_URL || 'https://valerianteissier.com';

const HEAD = (title, description, canonical, css2, ogType = 'article', alternates = []) => `
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} — Valérian Teissier</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${SITE_URL}${canonical}" />
${alternates.map(({ lang, href }) => `  <link rel="alternate" hreflang="${lang}" href="${SITE_URL}${href}" />`).join('\n')}
  <meta property="og:type" content="${ogType}" />
  <meta property="og:title" content="${esc(title)} — Valérian Teissier" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${SITE_URL}${canonical}" />
  <meta property="og:site_name" content="Valérian Teissier" />
  <meta name="author" content="Valérian Teissier" />
  <link rel="alternate" type="text/plain" href="${SITE_URL}/llms.txt" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="${css2}" />`;

// ── ESSAY PAGE GENERATOR ──────────────────────────────────────────────────────

function essayPage(essay, bodyHtml, lang = 'en') {
  const page = localised(essay, 'essays', lang);
  const canonical = routeFor('essays', essay.slug, lang);
  const frenchAvailable = hasFrenchTranslation('essays', essay.slug);
  const alternates = frenchAvailable
    ? [{ lang: 'en', href: routeFor('essays', essay.slug) }, { lang: 'fr', href: routeFor('essays', essay.slug, 'fr') }, { lang: 'x-default', href: routeFor('essays', essay.slug) }]
    : [];
  const labels = lang === 'fr'
    ? { essays: 'Essais', published: 'Publié', readingTime: 'Temps de lecture', tags: 'Tags', contents: 'Sommaire', readNext: 'À lire ensuite', footer: '← Tous les essais' }
    : { essays: 'Essays', published: 'Published', readingTime: 'Reading time', tags: 'Tags', contents: 'Contents', readNext: 'Read next', footer: '← All essays' };
  const tagsHtml = page.tags.map(t =>
    `<a href="/essays.html?tag=${encodeURIComponent(t)}" class="tag sidebar-tag-link">${esc(t)}</a>`
  ).join('');
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': page.title,
    'description': page.description,
    'datePublished': page.date,
    'author': { '@type': 'Person', 'name': 'Valérian Teissier', 'url': SITE_URL },
    'publisher': { '@type': 'Person', 'name': 'Valérian Teissier', 'url': SITE_URL },
    'url': `${SITE_URL}${canonical}`,
    'keywords': page.tags.join(', '),
    'timeRequired': `PT${page.readTime.replace(' min', 'M')}`,
    'inLanguage': lang,
  });
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>${HEAD(page.title, page.description, canonical, '/css/essay-detail.css', 'article', alternates)}
  <script type="application/ld+json">${jsonLd}</script>
  <script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"
          integrity="sha384-odPBjvtXVM/5hOYIr3A1dB+flh0c3wAT3bSesIOqEGmyUA4JoKf/YTWy0XKOYAY7"
          crossorigin="anonymous" defer></script>
</head>
<body>
<div class="progress-bar" id="progress"></div>
<div class="page">
${NAV_LINKS('essays', lang)}
  <main class="main">
    <div class="essay-layout">
      <aside class="essay-sidebar">
        <a href="/essays.html" class="btn-back">← ${labels.essays}</a>
        <div class="lang-toggle">
          <button class="lang-btn${lang === 'en' ? ' lang-active' : ''}" id="btn-en"${lang === 'en' ? '' : ''}>EN</button>
          <span class="lang-sep">/</span>
          <button class="lang-btn${lang === 'fr' ? ' lang-active' : ''}" id="btn-fr"${frenchAvailable ? '' : ' disabled aria-disabled="true"'}>FR</button>
        </div>
        <div>
          <div class="essay-sidebar-label">${labels.published}</div>
          <time class="essay-sidebar-value" id="sidebar-date" datetime="${esc(page.date)}">${esc(page.date)}</time>
        </div>
        <div>
          <div class="essay-sidebar-label">${labels.readingTime}</div>
          <div class="essay-sidebar-value" id="sidebar-readtime">${esc(page.readTime)}</div>
        </div>
        <div>
          <div class="essay-sidebar-label">${labels.tags}</div>
          <div id="sidebar-tags" class="sidebar-tags-list">${tagsHtml}</div>
        </div>
        <div>
          <div class="essay-sidebar-label essay-sidebar-label--toc">${labels.contents}</div>
          <nav aria-label="Table of contents" id="toc-nav"></nav>
        </div>
      </aside>
      <div class="essay-content">
        <header class="essay-header">
          <div class="essay-meta-row">
            <span id="essay-num" class="essay-num-label">${lang === 'fr' ? 'Essai' : 'Essay'} №${esc(page.num)}</span>
            <span class="essay-sep"></span>
            <span id="essay-tags-inline" class="essay-tags-inline-label">${esc(page.tags.join(' · '))}</span>
          </div>
          <h1 class="essay-title" id="essay-title">${esc(page.title)}</h1>
          <p class="essay-desc" id="essay-desc">${esc(page.description)}</p>
        </header>
        <div class="essay-body" id="essay-body">${bodyHtml}</div>
        <div id="related-essays-block">
          <div class="related-essays-label">${labels.readNext}</div>
          <div id="related-essays-grid" class="related-essays-grid">${relatedEssaysHtml(essay, lang)}</div>
        </div>
      </div>
    </div>
  </main>
  <footer class="footer">
    <span class="footer-text">Valérian · <span class="footer-accent">Paris</span> · 2026</span>
    <a href="/essays.html" class="footer-text">${labels.footer}</a>
  </footer>
</div>
<script defer src="/js/essay-detail.js"></script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>`;
}

// ── BOOK PAGE GENERATOR ───────────────────────────────────────────────────────

function bookPage(book, bodyHtml, lang = 'en') {
  const page = localised(book, 'books', lang);
  const canonical = routeFor('books', book.slug, lang);
  const frenchAvailable = hasFrenchTranslation('books', book.slug);
  const alternates = frenchAvailable
    ? [{ lang: 'en', href: routeFor('books', book.slug) }, { lang: 'fr', href: routeFor('books', book.slug, 'fr') }, { lang: 'x-default', href: routeFor('books', book.slug) }]
    : [];
  const labels = lang === 'fr'
    ? { books: 'Livres', author: 'Auteur', published: 'Publié', read: 'Lu', rating: 'Note', contents: 'Dans cette critique', review: 'Critique de livre', related: 'À lire ensuite', footer: '← Tous les livres' }
    : { books: 'Books', author: 'Author', published: 'Published', read: 'Read', rating: 'Rating', contents: 'In this review', review: 'Book review', related: 'If you read this, read next', footer: '← All books' };
  const tagsHtml = (page.tags || []).map(t =>
    `<a href="/books.html?tag=${encodeURIComponent(t)}" class="book-tag-inline">${esc(t)}</a>`
  ).join('');
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Review',
    'itemReviewed': {
      '@type': 'Book',
      'name': book.title,
      'author': { '@type': 'Person', 'name': book.author },
      'datePublished': String(book.published),
      'genre': book.category,
    },
    'reviewRating': book.rating ? { '@type': 'Rating', 'ratingValue': book.rating, 'bestRating': 5 } : undefined,
    'author': { '@type': 'Person', 'name': 'Valérian Teissier', 'url': SITE_URL },
    'url': `${SITE_URL}${canonical}`,
    'description': page.description,
    'keywords': (page.tags || []).join(', '),
    'inLanguage': lang,
  });
  const ratingDots = Array.from({ length: 5 }, (_, i) =>
    `<div class="rating-dot${i < (page.rating || 0) ? ' filled' : ''}"></div>`
  ).join('');
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>${HEAD(page.title, page.description, canonical, '/css/book-review.css', 'article', alternates)}
  <script type="application/ld+json">${jsonLd}</script>
  <script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"
          integrity="sha384-odPBjvtXVM/5hOYIr3A1dB+flh0c3wAT3bSesIOqEGmyUA4JoKf/YTWy0XKOYAY7"
          crossorigin="anonymous" defer></script>
</head>
<body>
<div class="progress-bar" id="progress"></div>
<div class="page">
${NAV_LINKS('books', lang)}
  <main class="main">
    <div class="review-layout">
      <aside class="review-cover-panel">
        <a href="/books.html" class="btn-back btn-back--review">← ${labels.books}</a>
        <div class="lang-toggle lang-toggle--review">
          <button class="lang-btn${lang === 'en' ? ' lang-active' : ''}" id="btn-en">EN</button>
          <span class="lang-sep">/</span>
          <button class="lang-btn${lang === 'fr' ? ' lang-active' : ''}" id="btn-fr"${frenchAvailable ? '' : ' disabled aria-disabled="true"'}>FR</button>
        </div>
        <div class="book-cover-placeholder" id="cover-placeholder">
          <img id="cover-img" alt="${esc(page.title)}">
          <span class="book-cover-initials" id="cover-initials">${esc(page.initials)}</span>
          <div class="book-cover-label" id="cover-label">cover placeholder</div>
        </div>
        <div class="review-meta-item">
          <div class="review-meta-label">${labels.author}</div>
          <div class="review-meta-value" id="meta-author">${esc(page.author)}</div>
        </div>
        <div class="review-meta-item">
          <div class="review-meta-label">${labels.published}</div>
          <div class="review-meta-value"><time id="meta-published" datetime="${esc(String(page.published))}">${esc(String(page.published))}</time></div>
        </div>
        <div class="review-meta-item">
          <div class="review-meta-label">${labels.read}</div>
          <div class="review-meta-value"><time id="meta-read" datetime="${esc(page.readDate || '')}">${esc(page.readDate || '—')}</time></div>
        </div>
        <div class="review-meta-item">
          <div class="review-meta-label">${labels.rating}</div>
          <div class="review-rating review-rating--meta">
            <div class="rating-dots" id="rating-dots">${ratingDots}</div>
          </div>
        </div>
        <div class="toc-section-header">
          <div class="review-meta-label review-meta-label--toc">${labels.contents}</div>
          <nav aria-label="Review sections" id="toc-nav"></nav>
        </div>
      </aside>
      <div class="review-content">
        <a class="category-badge" id="badge" href="/books.html">${labels.review} · ${esc(page.category)}</a>
        <h1 class="review-book-title" id="book-title">${esc(page.title)}</h1>
        <div class="review-author" id="book-author-year">${esc(page.author)} · ${esc(String(page.published))}</div>
        <div class="review-body" id="review-body">${bodyHtml}</div>
        <div id="related-block" class="related-block">
          <div class="related-label">${labels.related}</div>
          <div class="related-grid" id="related-grid">${relatedBooksHtml(book, lang)}</div>
        </div>
      </div>
    </div>
  </main>
  <footer class="footer">
    <span class="footer-text">Valérian · <span class="footer-accent">Paris</span> · 2026</span>
    <a href="/books.html" class="footer-text">${labels.footer}</a>
  </footer>
</div>
<script defer src="/js/book-review.js"></script>
<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>`;
}

// ── GENERATE INDIVIDUAL PAGES ─────────────────────────────────────────────────

essays.forEach(essay => {
  const mdPath = path.join(ROOT, 'essays', `${essay.slug}.md`);
  if (!existsSync(mdPath)) { console.warn(`  ⚠ missing: essays/${essay.slug}.md`); return; }
  const bodyHtml = resolveArticleRefs(renderMarkdown(readFileSync(mdPath, 'utf8')));
  const dir = path.join(ROOT, 'essays', essay.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), essayPage(essay, bodyHtml), 'utf8');
  console.log(`  → essays/${essay.slug}/index.html`);

  const frenchMdPath = path.join(ROOT, 'essays', 'fr', `${essay.slug}.md`);
  if (existsSync(frenchMdPath)) {
    const frenchBody = resolveArticleRefs(renderMarkdown(readFileSync(frenchMdPath, 'utf8')), 'fr');
    const frenchDir = path.join(ROOT, 'fr', 'essays', essay.slug);
    mkdirSync(frenchDir, { recursive: true });
    writeFileSync(path.join(frenchDir, 'index.html'), essayPage(essay, frenchBody, 'fr'), 'utf8');
    console.log(`  → fr/essays/${essay.slug}/index.html`);
  }
});

books.forEach(book => {
  const mdPath = path.join(ROOT, 'books', `${book.slug}.md`);
  if (!existsSync(mdPath)) { console.warn(`  ⚠ missing: books/${book.slug}.md`); return; }
  const bodyHtml = resolveArticleRefs(renderMarkdown(readFileSync(mdPath, 'utf8')));
  const dir = path.join(ROOT, 'books', book.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.html'), bookPage(book, bodyHtml), 'utf8');
  console.log(`  → books/${book.slug}/index.html`);

  const frenchMdPath = path.join(ROOT, 'books', 'fr', `${book.slug}.md`);
  if (existsSync(frenchMdPath)) {
    const frenchBody = resolveArticleRefs(renderMarkdown(readFileSync(frenchMdPath, 'utf8')), 'fr');
    const frenchDir = path.join(ROOT, 'fr', 'books', book.slug);
    mkdirSync(frenchDir, { recursive: true });
    writeFileSync(path.join(frenchDir, 'index.html'), bookPage(book, frenchBody, 'fr'), 'utf8');
    console.log(`  → fr/books/${book.slug}/index.html`);
  }
});

// ── GENERATE sitemap.xml ──────────────────────────────────────────────────────

{
  const today = new Date().toISOString().split('T')[0];
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/essays.html', priority: '0.9', changefreq: 'weekly' },
    { url: '/books.html', priority: '0.9', changefreq: 'monthly' },
    { url: '/research.html', priority: '0.8', changefreq: 'weekly' },
    { url: '/about/', priority: '0.7', changefreq: 'monthly' },
  ];
  const essayUrls = essays.map(e => ({
    url: `/essays/${e.slug}/`,
    alternate: hasFrenchTranslation('essays', e.slug) ? routeFor('essays', e.slug, 'fr') : null,
    lang: 'en',
    lastmod: e.date,
    priority: '0.8',
    changefreq: 'monthly',
  }));
  const bookUrls = books.map(b => ({
    url: `/books/${b.slug}/`,
    alternate: hasFrenchTranslation('books', b.slug) ? routeFor('books', b.slug, 'fr') : null,
    lang: 'en',
    lastmod: b.readDate ? `${b.readDate}-01` : today,
    priority: '0.7',
    changefreq: 'monthly',
  }));

  const frenchEssayUrls = essays
    .filter(e => hasFrenchTranslation('essays', e.slug))
    .map(e => ({
      url: routeFor('essays', e.slug, 'fr'),
      alternate: routeFor('essays', e.slug),
      lang: 'fr',
      lastmod: e.date,
      priority: '0.8',
      changefreq: 'monthly',
    }));
  const frenchBookUrls = books
    .filter(b => hasFrenchTranslation('books', b.slug))
    .map(b => ({
      url: routeFor('books', b.slug, 'fr'),
      alternate: routeFor('books', b.slug),
      lang: 'fr',
      lastmod: b.readDate ? `${b.readDate}-01` : today,
      priority: '0.7',
      changefreq: 'monthly',
    }));
  const allUrls = [...staticPages, ...essayUrls, ...bookUrls, ...frenchEssayUrls, ...frenchBookUrls];
  const urlEntries = allUrls.map(({ url, alternate, lang, lastmod, priority, changefreq }) => {
    const englishUrl = lang === 'fr' ? alternate : url;
    const frenchUrl = lang === 'fr' ? url : alternate;
    return `  <url>
    <loc>${SITE_URL}${url}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
${alternate ? `    <xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}${englishUrl}" />\n    <xhtml:link rel="alternate" hreflang="fr" href="${SITE_URL}${frenchUrl}" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${englishUrl}" />\n` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>`;

  writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
  console.log('✓ sitemap.xml');
}

// ── GENERATE llms.txt ─────────────────────────────────────────────────────────

{
  function firstParagraph(mdPath) {
    if (!existsSync(mdPath)) return '';
    const raw = readFileSync(mdPath, 'utf8');
    const para = raw.split(/\n\n+/).find(b => {
      const t = b.trim();
      return t && !t.startsWith('<') && !t.startsWith('#');
    }) || '';
    return para.trim()
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*([^*\n]+?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n/g, ' ');
  }

  const PREAMBLE = `# Valérian Teissier — AI Researcher & Strategist, Paris

> Valérian Teissier is an AI expert and strategist at Ayming Innovation, based in Paris.
> He studies how artificial intelligence is reshaping organisations and turns those
> observations into strategy and change management frameworks.
> Field-first. Observation-grounded. Actionable.

## About

**Name:** Valérian Teissier (also written: Valerian Teissier)
**Role:** AI Expert — Ayming Innovation, Paris, France
**Focus:** Organisational AI adoption · AI strategy · Change management · Human-AI collaboration

Valérian has been building, deploying, and researching AI adoption systems inside a large
organisation since 2023. He ran controlled A/B studies comparing human vs. AI-augmented
performance, built the first internal AI drafting systems, created a 30-person AI Ambassador
network, produced 94-row tool-mapping frameworks and 28 training videos, and conducted a
200-person internal survey before being formally appointed to a 100% AI strategy role in 2026.

His writing focuses on the gap between AI enthusiasm and what actually changes when you
embed AI into real organisations at scale — the human bottleneck, the information asymmetries,
the adoption failures, and the design conditions that determine whether AI interventions help
or hurt.

**LinkedIn:** https://www.linkedin.com/in/val%C3%A9rian-teissier-1600a8177/?locale=en-US`;

  const CAREER = `## Career Timeline (key milestones)

2015 — Technical degree in Computer Science. Systems and industrial networks, including a
        project for STMicroelectronics.

2019–2021 — Master's in Research, History & Political Societies. Chivalry in post-Hundred
             Years' War Maine (~1450–1500). Two years in archives turning fragmented 15th-century
             data into coherent narrative.

Apr 2022 — Writing technical R&D narratives. The craft foundation that gave the AI work
            epistemic weight.

Mid 2023 — Began optimising his own work with AI. Public documents only. No mandate.

Feb 2024 — A/B test: Human vs. Human augmented with AI — 10 evaluators, ~40 documents.
            Converted intuition into evidence.

Mar 2024 — First AI strategy session with senior leadership. Comparative study was the entry
            ticket. Built the first technical/practitioner roadmap.

Mid 2024 — Built the first internal AI drafting system.

Jan 2025 — Launched AI Ambassador network — 30 people, 50% AI mandate.

Aug 2025 — Mapped every mission step to the right AI tool: 94 rows, 28 training videos.

Sep 2025 — Large-scale internal survey, 200 respondents.

Dec 2025 — First high-end multi-agent writing system.

Jan 2026 — Formally appointed to 100% AI strategy role.

Mar 2026 — Focused on Claude Skills as the future of agentic creation for non-technical experts.`;

  const sortedEssays = [...essays].sort((a, b) => new Date(b.date) - new Date(a.date));
  const essaysSection = [
    '## Essays',
    '',
    'All essays: /essays.html',
    'Machine-readable index: /essays/index.json',
    '',
    ...sortedEssays.flatMap(e => [
      `### ${e.title} (${e.date}) — ${e.readTime}`,
      `Tags: ${e.tags.join(', ')}`,
      e.description,
      `Full text: /essays/${e.slug}/`,
      '',
    ]),
  ].join('\n');

  const sortedBooks = [...books].sort((a, b) => new Date(b.readDate) - new Date(a.readDate));
  const booksSection = [
    '## Books & Reading Notes',
    '',
    'All books: /books.html',
    'Machine-readable index: /books/index.json',
    '',
    ...sortedBooks.flatMap(b => {
      const rating = b.rating ? ` · Rating: ${b.rating}/5` : '';
      const sub = b.subcategory ? `${b.category} / ${b.subcategory}` : b.category;
      const insight = firstParagraph(path.join(ROOT, 'books', `${b.slug}.md`));
      return [
        `### ${b.title} — ${b.author} (${b.published})${rating}`,
        `Category: ${sub} · Read: ${b.readDate}`,
        `Tags: ${(b.tags || []).join(', ')}`,
        b.description,
        ...(insight ? [`Key insight: ${insight}`] : []),
        `Full text: /books/${b.slug}/`,
        '',
      ];
    }),
  ].join('\n');

  const frenchTranslationsSection = [
    '## French translations',
    '',
    'The following authored French translations have dedicated, crawlable routes:',
    '',
    ...essays.filter(e => hasFrenchTranslation('essays', e.slug)).flatMap(e => {
      const fr = localised(e, 'essays', 'fr');
      return [`- ${fr.title}: ${routeFor('essays', e.slug, 'fr')}`, ''];
    }),
    ...books.filter(b => hasFrenchTranslation('books', b.slug)).flatMap(b => {
      const fr = localised(b, 'books', 'fr');
      return [`- ${fr.title}: ${routeFor('books', b.slug, 'fr')}`, ''];
    }),
  ].join('\n');

  const activeNodes = research.filter(n => n.status !== 'DONE');
  const doneNodes   = research.filter(n => n.status === 'DONE');
  const researchSection = [
    '## Current Research',
    '',
    'Research page: /research.html',
    'Machine-readable index: /research/index.json',
    '',
    'Active research nodes tracking literature review in progress:',
    '',
    ...activeNodes.flatMap(n => [
      `**${n.title}** [${n.status}]`,
      n.description,
      '',
    ]),
    'Completed research nodes (linked to published work):',
    ...doneNodes.map(n => `- ${n.description} → ${n.link}`),
  ].join('\n');

  const feedsSection = `## Data Feeds (machine-readable)

- Essay index (JSON): /essays/index.json
- Book index (JSON): /books/index.json
- Research index (JSON): /research/index.json
- Individual essays (Markdown): /essays/{slug}.md
- Individual book reviews (Markdown): /books/{slug}.md
- Individual essays (pre-rendered HTML): /essays/{slug}/
- Individual book reviews (pre-rendered HTML): /books/{slug}/
- Sitemap: /sitemap.xml`;

  const llmsTxt = [PREAMBLE, '', '---', '', essaysSection, '---', '', booksSection, '---', '', frenchTranslationsSection, '---', '', researchSection, '', '---', '', CAREER, '', '---', '', feedsSection, ''].join('\n');

  writeFileSync(path.join(ROOT, 'llms.txt'), llmsTxt, 'utf8');
  console.log('✓ llms.txt');
}

