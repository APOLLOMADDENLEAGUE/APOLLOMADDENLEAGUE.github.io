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


(() => {
  const body = document.body;
  if (!body.classList.contains('team-page')) return;

  const slug = body.dataset.team;
  const team = (window.AML_TEAM_DATA || {})[slug];
  if (!team) return;

  const fields = [
    'rebranded',
    'owner',
    'regularSeasonRecord',
    'divisionTitles',
    'playoffAppearances',
    'playoffRecord',
    'superBowlAppearances',
    'superBowlWins',
    'franchiseMvps'
  ];

  fields.forEach(field => {
    const el = document.querySelector(`[data-team-field="${field}"]`);
    if (el) el.textContent = team[field] ?? '—';
  });
})();
