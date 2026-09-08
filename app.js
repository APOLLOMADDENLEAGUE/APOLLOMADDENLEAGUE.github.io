/* V19_LIVE_MADDEN */
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
    'rebranded', 'owner', 'regularSeasonRecord', 'divisionTitles',
    'playoffAppearances', 'playoffRecord', 'superBowlAppearances',
    'superBowlWins', 'franchiseMvps'
  ];

  fields.forEach(field => {
    const el = document.querySelector(`[data-team-field="${field}"]`);
    if (el) el.textContent = team[field] ?? '—';
  });

  const script = document.createElement('script');
  script.src = 'aml-live.js?v=6';
  script.onload = async () => {
    const live = window.AML_LIVE;
    const teamId = live?.teamIdForSlug(slug);
    if (!live || !teamId) return;

    const shell = document.querySelector('.team-shell');
    if (!shell) return;

    const section = document.createElement('section');
    section.className = 'franchise-profile aml-live-team';
    section.innerHTML = `
      <div class="profile-heading">
        <div><span class="profile-kicker">LIVE FROM MADDEN 27</span><h2>SEASON 14 TEAM HUB</h2></div>
        <span class="profile-season" data-live-status>LOADING...</span>
      </div>
      <div class="profile-grid" data-live-grid>
        <article class="profile-card"><span class="profile-label">SEASON 14 RECORD</span><strong class="profile-value" data-live-record>—</strong></article>
        <article class="profile-card"><span class="profile-label">TEAM OVERALL</span><strong class="profile-value" data-live-ovr>—</strong></article>
        <article class="profile-card"><span class="profile-label">MADDEN USER</span><strong class="profile-value" data-live-user>—</strong></article>
        <article class="profile-card"><span class="profile-label">DIVISION</span><strong class="profile-value" data-live-division>—</strong></article>
        <article class="profile-card profile-card-wide"><span class="profile-label">TOP PLAYERS</span><strong class="profile-value" data-live-top>—</strong></article>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        <a class="panel-link" data-live-roster href="#">VIEW LIVE ROSTER →</a>
        <a class="panel-link" data-live-schedule href="#">VIEW SCHEDULE →</a>
      </div>`;
    shell.appendChild(section);

    try {
      const [teamsData, standingsData, rosterData] = await Promise.all([
        live.api('/teams'),
        live.api('/standings'),
        live.api(`/roster?teamId=${teamId}&limit=5`)
      ]);
      const maddenTeam = teamsData.teams.find(t => Number(t.team_id) === Number(teamId));
      const standing = standingsData.standings.find(t => Number(t.team_id) === Number(teamId));
      const players = rosterData.players || [];

      section.querySelector('[data-live-status]').textContent = 'LIVE DATA';
      section.querySelector('[data-live-record]').textContent = live.currentRecord(standing);
      section.querySelector('[data-live-ovr]').textContent = maddenTeam?.ovr_rating ?? standing?.team_ovr ?? '—';
      section.querySelector('[data-live-user]').textContent = live.userName(maddenTeam?.team_id, maddenTeam?.user_name || 'CPU / OPEN');
      section.querySelector('[data-live-division]').textContent = maddenTeam?.div_name || standing?.division_name || '—';
      section.querySelector('[data-live-top]').textContent = players.length
        ? players.map(p => `${live.playerName(p)} (${p.player_best_ovr} OVR)`).join(' • ')
        : 'No roster data';
      section.querySelector('[data-live-roster]').href = live.rosterUrl(teamId);
      section.querySelector('[data-live-schedule]').href = live.scheduleUrl(teamId);

      const allTime = document.querySelector('[data-team-field="regularSeasonRecord"]');
      if (allTime && standing) {
        allTime.textContent = live.addRecords(team.regularSeasonRecord, standing);
        allTime.title = `Historical record ${team.regularSeasonRecord} + live Season 14 record ${live.currentRecord(standing)}`;
      }
    } catch (error) {
      section.querySelector('[data-live-status]').textContent = 'DATA UNAVAILABLE';
      console.error('AML live team data:', error);
    }
  };
  document.head.appendChild(script);
})();
