/* Add exact-name lexical-search links to the explicitly selected annex cards. */
(() => {
  'use strict';

  const cards = document.querySelectorAll('[data-annex-card]');
  if (!cards.length) return;

  const hasNameField = entry => Array.from(entry.querySelectorAll('dl.annex-provenance div')).some(row => {
    const label = row.querySelector('dt')?.textContent;
    const value = row.querySelector('dd')?.textContent;
    return label === 'Champ' && value === 'Nom';
  });

  for (const card of cards) {
    const nameEntries = Array.from(card.querySelectorAll('.annex-entry')).filter(hasNameField);
    const entry = nameEntries[0];
    if (!entry || entry.querySelector('[data-annex-text-search]')) continue;

    const literal = entry.querySelector('p > strong')?.textContent;
    if (typeof literal !== 'string' || literal.trim().length === 0) continue;

    if (literal.length > 100) {
      const message = document.createElement('p');
      message.className = 'annex-search-link-unavailable';
      message.setAttribute('role', 'status');
      message.textContent = 'Recherche dans les textes indisponible : le nom dépasse 100 caractères.';
      entry.append(message);
      continue;
    }

    const link = document.createElement('a');
    link.dataset.annexTextSearch = 'true';
    link.href = `/archives/reperes/?q=${encodeURIComponent(literal)}&kind=person_name_candidate&match=contains`;
    link.textContent = 'Chercher ce nom dans les textes';
    link.setAttribute('aria-label', `Chercher « ${literal} » dans les textes`);
    entry.append(link);
  }
})();
