document.body.classList.add('visible');

function slugifyCategory(cat) {
  return cat.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function buildCard(book) {
  const a = document.createElement('a');
  a.href = `book-review.html?book=${book.slug}`;
  a.className = 'book-card';

  const cover = document.createElement('div');
  cover.className = 'book-cover';

  const img = document.createElement('img');
  img.className = 'book-cover-img';
  img.alt = '';
  const initSpan = document.createElement('span');
  initSpan.className = 'book-cover-init';
  initSpan.textContent = book.initials;
  const accent = document.createElement('div');
  accent.className = 'book-cover-accent';

  img.addEventListener('load', () => {
    img.style.display = 'block';
    initSpan.style.display = 'none';
  });
  img.addEventListener('error', () => {
    img.src = `books/covers/${book.slug}.png`;
    img.onerror = null;
  });
  img.src = `books/covers/${book.slug}.jpg`;

  cover.appendChild(img);
  cover.appendChild(initSpan);
  cover.appendChild(accent);

  const title = document.createElement('div');
  title.className = 'book-title';
  title.textContent = book.title;

  const author = document.createElement('div');
  author.className = 'book-author';
  author.textContent = book.author;

  const note = document.createElement('div');
  note.className = 'book-note';

  const noteText = document.createElement('p');
  noteText.className = 'book-note-text';
  noteText.textContent = book.note || book.description;

  const cta = document.createElement('span');
  cta.className = 'book-note-cta';
  cta.textContent = 'Read review →';

  note.appendChild(noteText);
  note.appendChild(cta);

  a.appendChild(cover);
  a.appendChild(title);
  a.appendChild(author);
  a.appendChild(note);
  return a;
}

function activateTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(t => {
    const active = t.dataset.tab === tabId;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active);
  });
  document.querySelectorAll('.books-section').forEach(s => {
    s.classList.toggle('active', s.id === 'tab-' + tabId);
  });
}

fetch('books/index.json')
  .then(r => r.json())
  .then(books => {
    const categories = [...new Map(books.map(b => [b.category, b.category])).keys()];
    const tabBar = document.getElementById('tab-bar');
    const content = document.getElementById('books-content');

    categories.forEach((cat, i) => {
      const tabId = slugifyCategory(cat);
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (i === 0 ? ' active' : '');
      btn.role = 'tab';
      btn.setAttribute('aria-selected', i === 0);
      btn.dataset.tab = tabId;
      btn.textContent = cat;
      btn.addEventListener('click', () => activateTab(tabId));
      tabBar.appendChild(btn);

      const booksInCat = books.filter(b => b.category === cat);
      const section = document.createElement('section');
      section.className = 'books-section' + (i === 0 ? ' active' : '');
      section.id = 'tab-' + tabId;
      section.setAttribute('aria-label', cat + ' books');

      const grid = document.createElement('div');
      grid.className = 'books-grid';
      booksInCat.forEach(b => grid.appendChild(buildCard(b)));
      section.appendChild(grid);
      content.appendChild(section);
    });
  })
  .catch(() => {
    const p = document.createElement('p');
    p.className = 'books-error';
    p.textContent = 'Could not load books. Make sure the site is served over HTTP.';
    document.getElementById('books-content').appendChild(p);
  });
