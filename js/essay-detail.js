document.body.classList.add('visible');

const navEl = document.querySelector('.nav');
if (navEl) document.documentElement.style.setProperty('--nav-h', navEl.offsetHeight + 'px');

const bar = document.getElementById('progress');
window.addEventListener('scroll', () => {
  const h = document.documentElement;
  const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
  bar.style.width = pct + '%';
});

let currentSlug = '';
let currentLang = 'en';

document.getElementById('btn-en').addEventListener('click', () => switchLang('en'));
document.getElementById('btn-fr').addEventListener('click', () => switchLang('fr'));

function setLangButtons(lang) {
  document.getElementById('btn-en').classList.toggle('lang-active', lang === 'en');
  document.getElementById('btn-fr').classList.toggle('lang-active', lang === 'fr');
}

function switchLang(lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  try { localStorage.setItem('site-lang', lang); } catch(e) {}
  const params = new URLSearchParams(window.location.search);
  if (lang === 'en') params.delete('lang'); else params.set('lang', lang);
  history.replaceState(null, '', '?' + params.toString());
  setLangButtons(lang);
  loadContent();
}

let cachedAllEssays = [];

function setupTOC() {
  const headings = document.querySelectorAll('.essay-body h2');
  const tocNav = document.getElementById('toc-nav');
  tocNav.innerHTML = '';

  headings.forEach((h, i) => {
    if (!h.id) h.id = 'section-' + (i + 1);
    const link = document.createElement('a');
    link.href = '#' + h.id;
    link.className = 'toc-link';
    link.textContent = h.textContent.replace(/^§\s*/, '');
    tocNav.appendChild(link);
  });

  const tocLinks = tocNav.querySelectorAll('.toc-link');
  if (headings.length === 0 || tocLinks.length === 0) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        tocLinks.forEach(l => l.classList.toggle('toc-active', l.getAttribute('href') === '#' + id));
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });

  headings.forEach(s => obs.observe(s));
}

function setupFootnotes() {
  const bodyEl = document.getElementById('essay-body');
  const items = bodyEl.querySelectorAll('.reference-item');
  if (items.length === 0) return;

  const refMap = new Map();
  items.forEach(item => {
    const numEl = item.querySelector('.ref-num');
    const textEl = item.querySelector('.ref-text');
    if (!numEl || !textEl) return;
    const num = numEl.textContent.replace(/[[\]]/g, '').trim();
    const url = textEl.querySelector('a')?.href || extractUrl(textEl.textContent);
    refMap.set(num, { html: textEl.innerHTML, url: url || null, el: item });
  });

  let tooltip = document.getElementById('fn-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'fn-tooltip';
    tooltip.className = 'fn-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);
  }

  const fns = bodyEl.querySelectorAll('.fn');
  fns.forEach(span => {
    const num = span.textContent.replace(/[[\]]/g, '').trim();
    const entry = refMap.get(num);
    if (!entry) return;

    span.classList.add('fn--ref');
    if (entry.url) span.classList.add('fn--linked');

    span.addEventListener('mouseenter', () => {
      tooltip.innerHTML = entry.html;
      tooltip.classList.remove('fn-tooltip--below');
      tooltip.classList.add('fn-tooltip--visible');

      const rect = span.getBoundingClientRect();
      const ttW = Math.min(360, window.innerWidth - 24);
      tooltip.style.maxWidth = ttW + 'px';

      const left = clamp(rect.left + window.scrollX + rect.width / 2 - ttW / 2, 12, window.scrollX + window.innerWidth - ttW - 12);
      const topAbove = rect.top + window.scrollY - tooltip.offsetHeight - 8;
      if (rect.top - tooltip.offsetHeight - 8 < 8) {
        tooltip.classList.add('fn-tooltip--below');
        tooltip.style.top = (rect.bottom + window.scrollY + 8) + 'px';
      } else {
        tooltip.style.top = topAbove + 'px';
      }
      tooltip.style.left = left + 'px';
    });

    span.addEventListener('mouseleave', () => {
      tooltip.classList.remove('fn-tooltip--visible', 'fn-tooltip--below');
    });

    span.addEventListener('click', () => {
      if (entry.url) {
        window.open(entry.url, '_blank', 'noopener,noreferrer');
      } else {
        entry.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
}

function extractUrl(text) {
  const m = text.match(/https?:\/\/[^\s<]+/);
  return m ? m[0] : null;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function populateMeta(essay, allEssays) {
  document.getElementById('page-title').textContent = essay.title + ' — Valérian';
  document.getElementById('meta-desc').setAttribute('content', essay.description);

  const schema = document.getElementById('schema-json');
  schema.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: essay.title,
    author: { '@type': 'Person', name: 'Valérian' },
    datePublished: essay.date,
    description: essay.description
  });

  document.getElementById('sidebar-date').textContent = essay.date;
  document.getElementById('sidebar-date').setAttribute('datetime', essay.date);
  document.getElementById('sidebar-readtime').textContent = essay.readTime;

  const tagsContainer = document.getElementById('sidebar-tags');
  tagsContainer.innerHTML = '';
  essay.tags.forEach(t => {
    const a = document.createElement('a');
    a.href = `essays.html?tag=${encodeURIComponent(t)}`;
    a.className = 'tag sidebar-tag-link';
    a.textContent = t;
    tagsContainer.appendChild(a);
  });

  document.getElementById('essay-num').textContent = 'Essay № ' + essay.num;
  document.getElementById('essay-tags-inline').textContent = essay.tags.join(' · ');
  document.getElementById('essay-title').textContent = essay.title;
  document.getElementById('essay-desc').textContent = essay.description;

  // next-essay-block removed from HTML; guard retained for backward compatibility

}

async function renderRelated(essay) {
  if (!essay.related || essay.related.length === 0) return;

  const needsBooks = essay.related.some(r => r.type === 'book');
  const allBooks = needsBooks ? await fetch('books/index.json').then(r => r.json()) : [];

  const items = essay.related.map(r => {
    if (r.type === 'essay') {
      const e = cachedAllEssays.find(x => x.slug === r.slug);
      if (!e) return null;
      return { title: e.title, description: e.excerpt || e.description, href: 'essay-detail.html?essay=' + e.slug, type: 'essay' };
    } else {
      const b = allBooks.find(x => x.slug === r.slug);
      if (!b) return null;
      return { title: b.title, description: b.description, href: 'book-review.html?book=' + b.slug, type: 'book' };
    }
  }).filter(Boolean);

  if (items.length === 0) return;

  const block = document.getElementById('related-essays-block');
  block.style.display = 'block';
  document.getElementById('related-essays-grid').innerHTML = items.map(item => `
    <a href="${item.href}" class="related-card related-card--essay">
      <div class="related-card-type">${item.type}</div>
      <div class="related-title">${item.title}</div>
      <div class="related-desc">${item.description}</div>
    </a>`).join('');
}

async function setupArticleRefs() {
  const bodyEl = document.getElementById('essay-body');
  const refs = bodyEl.querySelectorAll('.article-ref[data-slug]');
  if (refs.length === 0) return;

  const needsBooks = Array.from(refs).some(el => el.dataset.type === 'book');
  const allBooks = needsBooks ? await fetch('books/index.json').then(r => r.json()) : [];

  refs.forEach(el => {
    const slug = el.dataset.slug;
    const type = el.dataset.type || 'essay';
    let item = null;
    if (type === 'essay') item = cachedAllEssays.find(e => e.slug === slug);
    else item = allBooks.find(b => b.slug === slug);
    if (!item) return;

    const href = type === 'essay'
      ? 'essay-detail.html?essay=' + slug
      : 'book-review.html?book=' + slug;

    el.innerHTML = `
      <a href="${href}" class="article-ref-card">
        <div class="article-ref-eyebrow">${type}</div>
        <div class="article-ref-title">${item.title}</div>
        <div class="article-ref-desc">${item.description || ''}</div>
        <div class="article-ref-cta">Read →</div>
      </a>`;
    el.classList.add('article-ref--loaded');
  });
}

async function loadContent() {
  const bodyEl = document.getElementById('essay-body');
  const prefix = currentLang === 'fr' ? 'essays/fr/' : 'essays/';

  if (typeof marked === 'undefined') {
    throw new Error('marked library failed to load — check network or CDN availability');
  }

  let res = await fetch(prefix + currentSlug + '.md');
  if (res.ok) {
    bodyEl.innerHTML = marked.parse(await res.text());
  } else {
    res = await fetch(prefix + currentSlug + '.html');
    if (res.ok) {
      bodyEl.innerHTML = await res.text();
    } else if (currentLang !== 'en') {
      const p = document.createElement('p');
      p.className = 'load-error load-error-fr';
      p.textContent = 'This essay is not yet available in French.';
      bodyEl.replaceChildren(p);
    } else {
      const p = document.createElement('p');
      p.className = 'load-error';
      p.textContent = 'Essay content not found.';
      bodyEl.replaceChildren(p);
    }
  }
  setupTOC();
  setupFootnotes();
  setupArticleRefs();
}

async function loadEssay() {
  const params = new URLSearchParams(window.location.search);
  const allEssays = await fetch('essays/index.json').then(r => r.json());
  cachedAllEssays = allEssays;

  let slug = params.get('essay');
  let essay = allEssays.find(e => e.slug === slug);
  if (!essay) { essay = allEssays[0]; slug = essay.slug; }

  currentSlug = slug;
  const savedLang = (() => { try { return localStorage.getItem('site-lang'); } catch(e) { return null; } })();
  currentLang = params.get('lang') || savedLang || 'en';

  setLangButtons(currentLang);
  populateMeta(essay, allEssays);
  await loadContent();
  renderRelated(essay);
}

loadEssay().catch(err => {
  const p = document.createElement('p');
  p.className = 'load-error';
  p.textContent = 'Could not load essay. Make sure the site is served over HTTP.';
  document.getElementById('essay-body').replaceChildren(p);
  console.error(err);
});
