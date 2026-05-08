document.body.classList.add('visible');

function slugifyStatus(s) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function buildCard(item) {
  const article = document.createElement('article');
  article.className = 'research-card';

  const top = document.createElement('div');
  top.className = 'research-card-top';

  const title = document.createElement('h2');
  title.className = 'research-card-title';
  title.textContent = item.title;

  const badge = document.createElement('span');
  badge.className = 'research-status research-status--' + slugifyStatus(item.status);
  badge.textContent = item.status;

  top.appendChild(title);
  top.appendChild(badge);

  const desc = document.createElement('p');
  desc.className = 'research-card-desc';
  desc.textContent = item.description;

  const queryList = document.createElement('ul');
  queryList.className = 'research-queries';
  item.queries.forEach(q => {
    const li = document.createElement('li');
    li.className = 'research-query';
    li.textContent = q;
    queryList.appendChild(li);
  });

  article.appendChild(top);
  article.appendChild(desc);
  article.appendChild(queryList);
  return article;
}

function activateTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(t => {
    const active = t.dataset.tab === tabId;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active);
  });
  document.querySelectorAll('.research-section').forEach(s => {
    s.classList.toggle('active', s.id === 'tab-' + tabId);
  });
}

fetch('research/index.json')
  .then(r => r.json())
  .then(items => {
    const statuses = [...new Map(items.map(i => [i.status, i.status])).keys()];
    const tabBar = document.getElementById('tab-bar');
    const content = document.getElementById('research-content');

    statuses.forEach((status, i) => {
      const tabId = slugifyStatus(status);
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (i === 0 ? ' active' : '');
      btn.role = 'tab';
      btn.setAttribute('aria-selected', i === 0);
      btn.dataset.tab = tabId;
      btn.textContent = status;
      btn.addEventListener('click', () => activateTab(tabId));
      tabBar.appendChild(btn);

      const itemsInStatus = items.filter(it => it.status === status);
      const section = document.createElement('section');
      section.className = 'research-section' + (i === 0 ? ' active' : '');
      section.id = 'tab-' + tabId;
      section.setAttribute('aria-label', status + ' research threads');

      const grid = document.createElement('div');
      grid.className = 'research-grid';
      itemsInStatus.forEach(it => grid.appendChild(buildCard(it)));
      section.appendChild(grid);
      content.appendChild(section);
    });
  })
  .catch(() => {
    const p = document.createElement('p');
    p.className = 'research-error';
    p.textContent = 'Could not load research items. Make sure the site is served over HTTP.';
    document.getElementById('research-content').appendChild(p);
  });
