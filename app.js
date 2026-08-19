/* V15_FORCE_TOP */
if ('scrollRestoration' in history) history.scrollRestoration='manual';
window.scrollTo(0,0);
(() => {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const top = () => window.scrollTo(0, 0);
  top();
  requestAnimationFrame(top);
  window.addEventListener('load', top, { once: true });
  window.addEventListener('pageshow', top);
  document.querySelectorAll('.reveal').forEach(el => {
    el.classList.add('is-visible');
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
})();
