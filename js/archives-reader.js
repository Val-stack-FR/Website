(() => {
  'use strict';

  const viewport = document.getElementById('acts-viewport');
  if (!viewport) return;

  const acts = Array.from(viewport.querySelectorAll('.archive-act'));
  const prevLink = document.getElementById('reader-prev');
  const nextLink = document.getElementById('reader-next');
  const positionValue = document.getElementById('reader-position-value');
  const currentTitle = document.getElementById('reader-current-title');
  const announcement = document.getElementById('reader-announcement');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let currentIndex = 0;
  let scrollFrame = null;
  let wheelLocked = false;

  const actTitle = (act) => {
    const heading = act.querySelector('h2');
    return heading ? heading.textContent.trim() : 'Acte sans titre';
  };

  const setLinkState = (link, index, label) => {
    if (!link) return;
    const isDisabled = index < 0 || index >= acts.length;

    if (isDisabled) {
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('tabindex', '-1');
      link.removeAttribute('data-act-target');
      link.href = `#${acts[currentIndex].id}`;
      return;
    }

    const target = acts[index];
    link.removeAttribute('aria-disabled');
    link.removeAttribute('tabindex');
    link.dataset.actTarget = target.id;
    link.href = `#${target.id}`;
    link.setAttribute('aria-label', `${label} : ${actTitle(target)}`);
  };

  const updateToolbar = (index, shouldAnnounce) => {
    const act = acts[index];
    if (!act) return;

    currentIndex = index;
    positionValue.textContent = `${index + 1} / ${acts.length}`;
    currentTitle.textContent = actTitle(act);
    acts.forEach((item, itemIndex) => {
      item.toggleAttribute('data-current', itemIndex === index);
    });
    setLinkState(prevLink, index - 1, 'Acte précédent');
    setLinkState(nextLink, index + 1, 'Acte suivant');

    if (shouldAnnounce) {
      announcement.textContent = `Acte ${index + 1} sur ${acts.length} : ${actTitle(act)}`;
    }
  };

  const updateAddress = (act, mode) => {
    const hash = `#${act.id}`;
    if (window.location.hash === hash) return;
    const method = mode === 'push' ? 'pushState' : 'replaceState';
    window.history[method](null, '', hash);
  };

  const navigateTo = (index, options = {}) => {
    const boundedIndex = Math.max(0, Math.min(acts.length - 1, index));
    const act = acts[boundedIndex];
    const behavior = reduceMotion.matches ? 'auto' : 'smooth';

    viewport.scrollTo({ left: act.offsetLeft, behavior });
    updateToolbar(boundedIndex, options.announce !== false);

    if (options.history !== false) {
      updateAddress(act, options.history === 'replace' ? 'replace' : 'push');
    }

    if (options.focus) {
      window.setTimeout(() => act.focus({ preventScroll: true }), reduceMotion.matches ? 0 : 260);
    }
  };

  const nearestActIndex = () => {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    acts.forEach((act, index) => {
      const distance = Math.abs(act.offsetLeft - viewport.scrollLeft);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  };

  viewport.addEventListener('scroll', () => {
    if (scrollFrame !== null) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = null;
      const nextIndex = nearestActIndex();
      if (nextIndex === currentIndex) return;
      updateToolbar(nextIndex, true);
      updateAddress(acts[nextIndex], 'replace');
    });
  }, { passive: true });

  viewport.addEventListener('wheel', (event) => {
    if (!event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    if (wheelLocked) return;

    wheelLocked = true;
    navigateTo(currentIndex + Math.sign(event.deltaY), { history: 'push' });
    window.setTimeout(() => {
      wheelLocked = false;
    }, reduceMotion.matches ? 80 : 420);
  }, { passive: false });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-act-target]');
    if (!link || link.getAttribute('aria-disabled') === 'true') return;

    const targetIndex = acts.findIndex((act) => act.id === link.dataset.actTarget);
    if (targetIndex === -1) return;
    event.preventDefault();
    navigateTo(targetIndex, { focus: true, history: 'push' });
  });

  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    if (event.target.closest('a, button, input, textarea, select, summary, dialog, [contenteditable="true"]')) return;

    let targetIndex = currentIndex;
    if (event.key === 'ArrowLeft') targetIndex -= 1;
    if (event.key === 'ArrowRight') targetIndex += 1;
    if (event.key === 'Home') targetIndex = 0;
    if (event.key === 'End') targetIndex = acts.length - 1;
    const boundedIndex = Math.max(0, Math.min(acts.length - 1, targetIndex));
    if (boundedIndex === currentIndex) return;

    event.preventDefault();
    navigateTo(boundedIndex, { focus: true, history: 'push' });
  });

  window.addEventListener('hashchange', () => {
    const id = window.location.hash.slice(1);
    const index = acts.findIndex((act) => act.id === id);
    if (index !== -1) navigateTo(index, { announce: true, history: false });
  });

  const dialog = document.getElementById('image-dialog');
  const dialogImage = document.getElementById('image-dialog-img');
  const dialogCaption = document.getElementById('image-dialog-caption');

  if (dialog && dialogImage && dialogCaption && typeof dialog.showModal === 'function') {
    document.querySelectorAll('[data-zoom-image]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        event.preventDefault();
        dialogImage.src = link.dataset.zoomImage;
        dialogImage.alt = link.dataset.zoomAlt || '';
        dialogCaption.textContent = link.dataset.zoomCaption || '';
        dialog.showModal();
      });
    });
  }

  const initialId = window.location.hash.slice(1);
  const initialIndex = acts.findIndex((act) => act.id === initialId);
  updateToolbar(initialIndex === -1 ? 0 : initialIndex, false);
  window.requestAnimationFrame(() => {
    if (initialIndex !== -1) navigateTo(initialIndex, { announce: false, history: false });
  });
})();
