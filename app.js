
(() => {
  const selectors = [
    '.menu-card','.history-card','.season-tile','.team-card','.team-panel',
    '.champion-card','.mvp-card','.coming','.placeholder-inner'
  ];
  const nodes = [...document.querySelectorAll(selectors.join(','))];
  if (!nodes.length) return;
  nodes.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${Math.min(i % 8, 7) * 34}ms`;
  });
  if (!('IntersectionObserver' in window)) {
    nodes.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
  nodes.forEach(el => io.observe(el));
})();
