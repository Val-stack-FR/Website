document.body.classList.add('visible');

let allEssays = [];
let activeTag = 'all';

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRow(essay) {
  const tagsHtml = essay.tags.map(t =>
    `<button class="essay-tag-inline" data-tag="${esc(t)}">${esc(t)}</button>`
  ).join('');
  return `
    <a href="/essays/${esc(essay.slug)}/" class="essay-row" data-tags="${esc(JSON.stringify(essay.tags))}">
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

function buildTagBar(essays) {
  const tagBar = document.getElementById('tag-bar');
  tagBar.querySelectorAll('.tag:not([data-tag="all"])').forEach(b => b.remove());
  const allTags = [...new Set(essays.flatMap(e => e.tags))];
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
  document.querySelectorAll('.essay-row').forEach(row => {
    const rowTags = JSON.parse(row.dataset.tags);
    const show = tag === 'all' || rowTags.includes(tag);
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  document.getElementById('empty-state').style.display = visible === 0 ? 'block' : 'none';
}

// Event delegation for inline tag buttons
document.getElementById('essay-list').addEventListener('click', e => {
  const btn = e.target.closest('.essay-tag-inline');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  filter(btn.dataset.tag);
});

fetch('essays/index.json')
  .then(r => r.json())
  .then(essays => {
    allEssays = essays;
    document.getElementById('essay-list').innerHTML = essays.map(renderRow).join('');
    buildTagBar(essays);
    const urlTag = new URLSearchParams(window.location.search).get('tag');
    if (urlTag) filter(urlTag);
  })
  .catch(() => {
    document.getElementById('essay-list').innerHTML =
      '<p class="empty-state">Could not load essays. Make sure the site is served over HTTP.</p>';
  });
