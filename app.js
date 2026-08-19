(() => {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  const goTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

  // Make sure a newly opened AML page never lands in a preserved blank/old scroll position.
  goTop();
  window.addEventListener('pageshow', goTop);

  // Remove any reveal classes left from an older cached stylesheet/script.
  document.querySelectorAll('.reveal').forEach(el => {
    el.classList.add('is-visible');
    el.style.opacity = '1';
    el.style.transform = 'none';
    el.style.transitionDelay = '0ms';
  });
})();
