document.querySelectorAll('[data-draft-fragments]').forEach(container => {
  const picker = container.querySelector('[data-fragment-picker]');
  picker.addEventListener('change', () => {
    container.querySelectorAll('[data-fragment-index]').forEach(fragment => {
      fragment.hidden = fragment.dataset.fragmentIndex !== picker.value;
    });
  });
});
