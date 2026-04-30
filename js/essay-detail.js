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

  const idx = allEssays.findIndex(e => e.slug === essay.slug);
  const next = allEssays[idx + 1];
  if (next) {
    const block = document.getElementById('next-essay-block');
    block.style.display = 'flex';
    document.getElementById('next-essay-link').href = 'essay-detail.html?essay=' + next.slug;
    document.getElementById('next-essay-title').textContent = next.title;
  }
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
}

async function loadEssay() {
  const params = new URLSearchParams(window.location.search);
  const allEssays = await fetch('essays/index.json').then(r => r.json());

  let slug = params.get('essay');
  let essay = allEssays.find(e => e.slug === slug);
  if (!essay) { essay = allEssays[0]; slug = essay.slug; }

  currentSlug = slug;
  const savedLang = (() => { try { return localStorage.getItem('site-lang'); } catch(e) { return null; } })();
  currentLang = params.get('lang') || savedLang || 'en';

  setLangButtons(currentLang);
  populateMeta(essay, allEssays);
  await loadContent();
}

loadEssay().catch(err => {
  const p = document.createElement('p');
  p.className = 'load-error';
  p.textContent = 'Could not load essay. Make sure the site is served over HTTP.';
  document.getElementById('essay-body').replaceChildren(p);
  console.error(err);
});
