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

function formatReadDate(readDate) {
  if (!readDate) return '—';
  const [year, month] = readDate.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return (month ? months[parseInt(month) - 1] + ' ' : '') + year;
}

function setupTOC() {
  const headings = document.querySelectorAll('.review-body h2');
  const tocNav = document.getElementById('toc-nav');
  tocNav.innerHTML = '';

  headings.forEach((h, i) => {
    if (!h.id) h.id = 'section-' + (i + 1);
    h.dataset.section = '§0' + (i + 1);
    const link = document.createElement('a');
    link.href = '#' + h.id;
    link.className = 'toc-link';
    link.textContent = h.textContent;
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
  }, { rootMargin: '-20% 0px -65% 0px' });

  headings.forEach(s => obs.observe(s));
}

function populateMeta(book) {
  document.getElementById('page-title').textContent = book.title + ' — Valérian';
  document.getElementById('meta-desc').setAttribute('content', book.description);

  document.getElementById('schema-json').textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    author: { '@type': 'Person', name: book.author }
  });

  document.getElementById('cover-initials').textContent = book.initials;
  const coverImg = document.getElementById('cover-img');
  const exts = ['jpg', 'jpeg', 'png', 'webp'];
  (function tryExt(i) {
    if (i >= exts.length) return;
    coverImg.onerror = () => tryExt(i + 1);
    coverImg.onload = () => {
      coverImg.style.display = 'block';
      document.getElementById('cover-placeholder').classList.add('cover-loaded');
      document.getElementById('cover-initials').style.display = 'none';
      document.getElementById('cover-label').style.display = 'none';
    };
    coverImg.src = `books/covers/${book.slug}.${exts[i]}`;
  })(0);
  document.getElementById('meta-author').textContent = book.author;
  document.getElementById('meta-published').textContent = book.published;
  document.getElementById('meta-published').setAttribute('datetime', String(book.published));
  document.getElementById('meta-category').textContent =
    book.subcategory ? book.category + ' · ' + book.subcategory : book.category;
  document.getElementById('meta-read').textContent = formatReadDate(book.readDate);
  document.getElementById('meta-read').setAttribute('datetime', book.readDate || '');

  const dots = document.getElementById('rating-dots');
  for (let i = 1; i <= 5; i++) {
    const d = document.createElement('div');
    d.className = 'rating-dot' + (i <= book.rating ? ' filled' : '');
    dots.appendChild(d);
  }

  document.getElementById('badge').textContent = 'Book review · ' + book.category;
  document.getElementById('book-title').textContent = book.title;
  document.getElementById('book-author-year').textContent = book.author + ' · ' + book.published;
}

function renderRelated(relatedSlugs, allBooks) {
  if (!relatedSlugs || relatedSlugs.length === 0) return;
  const relatedBooks = relatedSlugs.map(s => allBooks.find(b => b.slug === s)).filter(Boolean);
  if (relatedBooks.length === 0) return;

  const block = document.getElementById('related-block');
  block.style.display = 'block';
  document.getElementById('related-grid').innerHTML = relatedBooks.map(b => `
    <a href="book-review.html?book=${b.slug}" class="related-card">
      <div class="related-title">${b.title}</div>
      <div class="related-author">${b.author}</div>
    </a>`).join('');
}

async function loadContent() {
  const bodyEl = document.getElementById('review-body');
  const prefix = currentLang === 'fr' ? 'books/fr/' : 'books/';

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
      p.textContent = 'This review is not yet available in French.';
      bodyEl.replaceChildren(p);
    } else {
      const p = document.createElement('p');
      p.className = 'load-error';
      p.textContent = 'Review content not found.';
      bodyEl.replaceChildren(p);
    }
  }
  setupTOC();
}

async function loadReview() {
  const params = new URLSearchParams(window.location.search);
  const allBooks = await fetch('books/index.json').then(r => r.json());

  let slug = params.get('book');
  let book = allBooks.find(b => b.slug === slug);
  if (!book) { book = allBooks[0]; slug = book.slug; }

  currentSlug = slug;
  const savedLang = (() => { try { return localStorage.getItem('site-lang'); } catch(e) { return null; } })();
  currentLang = params.get('lang') || savedLang || 'en';

  setLangButtons(currentLang);
  populateMeta(book);
  await loadContent();
  renderRelated(book.related, allBooks);
}

loadReview().catch(err => {
  const p = document.createElement('p');
  p.className = 'load-error';
  p.textContent = 'Could not load review. Make sure the site is served over HTTP.';
  document.getElementById('review-body').replaceChildren(p);
  console.error(err);
});
