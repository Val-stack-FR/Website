document.body.classList.add('visible');

let allBooks = [];
let activeTag = 'all';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRow(book, index) {
  const num = String(index + 1).padStart(2, '0');
  const tags = book.tags || [];
  const tagsHtml = tags.map(t =>
    `<button class="book-tag-inline" data-tag="${esc(t)}">${esc(t)}</button>`
  ).join('');
  const rating = book.rating ? `${esc(String(book.rating))} / 5` : '';
  return `
    <a href="/books/${esc(book.slug)}/" class="book-row" data-tags="${esc(JSON.stringify(tags))}">
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

function buildTagBar(books) {
  const tagBar = document.getElementById('tag-bar');
  tagBar.querySelectorAll('.tag:not([data-tag="all"])').forEach(b => b.remove());
  const allTags = [...new Set(books.flatMap(b => b.tags || []))];
  allTags.forEach(tag => {
    const btn = document.createElement('button');
    btn.className = 'tag';
    btn.dataset.tag = tag;
    btn.textContent = tag;
    tagBar.appendChild(btn);
  });
  tagBar.querySelectorAll('.tag[data-tag]').forEach(t => {
    t.addEventListener('click', () => filter(t.dataset.tag));
  });
}

function filter(tag) {
  activeTag = tag;
  document.querySelectorAll('#tag-bar .tag[data-tag]').forEach(t => {
    t.classList.toggle('active', t.dataset.tag === tag);
  });
  let visible = 0;
  document.querySelectorAll('.book-row').forEach(row => {
    const rowTags = JSON.parse(row.dataset.tags);
    const show = tag === 'all' || rowTags.includes(tag);
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  document.getElementById('empty-state').style.display = visible === 0 ? 'block' : 'none';
}

document.getElementById('book-list').addEventListener('click', e => {
  const btn = e.target.closest('.book-tag-inline');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  filter(btn.dataset.tag);
});

fetch('books/index.json')
  .then(r => r.json())
  .then(books => {
    allBooks = books;
    document.getElementById('book-list').innerHTML = books.map(renderRow).join('');
    document.querySelectorAll('.book-cover-img').forEach(img => {
      img.addEventListener('error', () => {
        if (!img.src.endsWith('.png')) img.src = img.src.replace(/\.jpg$/, '.png');
      });
    });
    buildTagBar(books);
    const urlTag = new URLSearchParams(window.location.search).get('tag');
    if (urlTag) filter(urlTag);
  })
  .catch(() => {
    document.getElementById('book-list').innerHTML =
      '<p class="empty-state">Could not load books. Make sure the site is served over HTTP.</p>';
  });
