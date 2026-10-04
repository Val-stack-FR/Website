/* Private ten-fiche view: local filtering, two separate source packages. */
(() => {
  'use strict';
  const form = document.getElementById('annex-search'), input = document.getElementById('annex-query'),
    scope = document.getElementById('annex-scope'), match = document.getElementById('annex-match'),
    count = document.getElementById('annex-count'), empty = document.getElementById('annex-empty');
  const cards = Array.from(document.querySelectorAll('[data-annex-card]'));
  if (!form || !input || !scope || !match || !count || !empty || cards.length !== 10) return;
  const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLocaleLowerCase('fr').replace(/\s+/g, ' ').trim();
  const allowed = ['all', 'name', 'variant', 'title', 'place', 'holding', 'jurisdiction'];
  let entries;
  try {
    entries = cards.map(card => ({ card, exact: JSON.parse(card.dataset.exactSearch) }));
    if (!entries.every(item => allowed.every(key => Array.isArray(item.exact[key]) && item.exact[key].length <= 100
      && item.exact[key].every(value => typeof value === 'string' && value.length <= 5000)))) return;
  } catch { return; }
  const apply = () => {
    const query = normalize(input.value), selected = scope.value;
    if (!allowed.includes(selected) || !['exact', 'contains'].includes(match.value)) return;
    let visible = 0;
    for (const { card, exact } of entries) {
      const haystack = selected === 'all' ? card.dataset.searchAll : card.dataset['search' + selected.charAt(0).toUpperCase() + selected.slice(1)];
      const matches = !query || (match.value === 'exact' ? exact[selected].includes(query) : normalize(haystack).includes(query));
      card.hidden = !matches; if (matches) visible++;
    }
    count.textContent = `${visible} fiche${visible > 1 ? 's' : ''} affichée${visible > 1 ? 's' : ''} sur ${cards.length}`;
    empty.hidden = visible !== 0;
  };
  form.addEventListener('submit', event => { event.preventDefault(); apply(); });
  input.addEventListener('input', apply); scope.addEventListener('change', apply); match.addEventListener('change', apply);
  form.addEventListener('reset', () => { window.setTimeout(() => { apply(); input.focus(); }, 0); });
})();
