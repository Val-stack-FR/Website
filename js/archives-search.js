(() => {
  'use strict';

  const form = document.getElementById('annex-search');
  const input = document.getElementById('annex-query');
  const scope = document.getElementById('annex-scope');
  const count = document.getElementById('annex-count');
  const empty = document.getElementById('annex-empty');
  const cards = Array.from(document.querySelectorAll('[data-annex-card]'));
  if (!form || !input || !scope || !count || !empty || cards.length === 0) return;

  const normalize = value => String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/\s+/g, ' ')
    .trim();

  const applyFilter = () => {
    const query = normalize(input.value);
    const selectedScope = scope.value;
    let visible = 0;

    for (const card of cards) {
      const haystack = selectedScope === 'all'
        ? card.dataset.searchAll
        : card.dataset[`search${selectedScope.charAt(0).toUpperCase()}${selectedScope.slice(1)}`];
      const matches = query.length === 0 || normalize(haystack).includes(query);
      card.hidden = !matches;
      if (matches) visible += 1;
    }

    count.textContent = `${visible} fiche${visible > 1 ? 's' : ''} affichée${visible > 1 ? 's' : ''} sur ${cards.length}`;
    empty.hidden = visible !== 0;
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    applyFilter();
  });
  input.addEventListener('input', applyFilter);
  scope.addEventListener('change', applyFilter);
  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      applyFilter();
      input.focus();
    }, 0);
  });
})();

