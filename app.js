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


/* AML_SITE_SEARCH_V1 */
(() => {
  if (document.getElementById('aml-site-search')) return;
  const style=document.createElement('style');
  style.textContent=`.aml-search-open{position:fixed;right:16px;top:16px;z-index:900;border:1px solid #ffffff2b;background:#11131aeF;color:#fff;border-radius:999px;padding:11px 15px;font-weight:900;cursor:pointer}.aml-search-modal{position:fixed;inset:0;z-index:1000;background:#030407eF;padding:clamp(16px,5vw,60px);display:none}.aml-search-modal.open{display:block}.aml-search-box{width:min(760px,100%);margin:auto}.aml-search-head{display:flex;gap:10px}.aml-search-input{flex:1;border:1px solid #ffffff30;background:#11131a;color:#fff;border-radius:15px;padding:15px 17px;font:inherit;font-size:16px}.aml-search-close{border:1px solid #ffffff30;background:#1a1c24;color:#fff;border-radius:15px;padding:0 16px;font-size:22px}.aml-search-results{margin-top:12px;max-height:70vh;overflow:auto;display:grid;gap:8px}.aml-search-result{display:block;text-decoration:none;color:#fff;border:1px solid #ffffff18;background:#ffffff09;border-radius:14px;padding:13px 15px}.aml-search-result:hover,.aml-search-result:focus{border-color:#ff63b7}.aml-search-result small{display:block;color:#ff63b7;font-weight:900;margin-bottom:3px}.aml-search-empty{color:#9fa4b3;padding:20px 4px}@media(max-width:700px){.aml-search-open{top:auto;bottom:14px;right:14px}}`;
  document.head.appendChild(style);
  const open=document.createElement('button');open.id='aml-site-search';open.className='aml-search-open';open.type='button';open.textContent='⌕ SEARCH';
  const modal=document.createElement('div');modal.className='aml-search-modal';modal.innerHTML='<div class="aml-search-box"><div class="aml-search-head"><input class="aml-search-input" type="search" placeholder="Search players, teams, users, seasons…" aria-label="Search AML"><button class="aml-search-close" aria-label="Close search">×</button></div><div class="aml-search-results"><div class="aml-search-empty">Start typing to search AML.</div></div></div>';
  document.body.append(open,modal);
  const input=modal.querySelector('input'),results=modal.querySelector('.aml-search-results');
  let index=[
    ['PAGE','Current League','Live standings, rosters, schedules and stats','current-league.html'],['PAGE','Standings','Season 14 live standings','standings.html'],['PAGE','Playoff Picture','Live AFC and NFC seeds','playoff-picture.html'],['PAGE','League Records','Single-game, season and career records','records.html'],['PAGE','Schedule & Scores','Weekly matchups and final scores','schedule.html'],['PAGE','Season Stats','Passing, rushing, receiving and defense','stats.html'],['PAGE','MSPN Power Rankings','Season 14 rankings','mspn.html'],['PAGE','AML Teams','All 32 franchises','teams.html'],['PAGE','AML Users','Current AML users','users.html'],...Array.from({length:14},(_,i)=>['SEASON',`Season ${i+1}`,'AML history',`season-${i+1}.html`])
  ];let loaded=false;
  async function loadLive(){if(loaded)return;loaded=true;try{if(!window.AML_LIVE){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='aml-live.js?v=6';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}const live=window.AML_LIVE,[td,pd]=await Promise.all([live.api('/teams'),live.api('/players?limit=2000')]);(td.teams||[]).forEach(t=>index.push(['TEAM',live.cleanTeamName(t.display_name||t.nick_name),live.userName(t.team_id,t.user_name||''),live.teamUrl(t.team_id)]));(pd.players||[]).forEach(p=>index.push(['PLAYER',`${p.first_name||''} ${p.last_name||''}`.trim(),`${p.position||''} • ${p.player_best_ovr||0} OVR`,live.playerUrl(p.roster_id)]))}catch(e){console.error('AML search:',e)}}
  function render(){const q=input.value.trim().toLowerCase();if(!q){results.innerHTML='<div class="aml-search-empty">Start typing to search AML.</div>';return}const found=index.filter(x=>(x[1]+' '+x[2]).toLowerCase().includes(q)).slice(0,30);results.innerHTML=found.length?found.map(x=>`<a class="aml-search-result" href="${x[3]}"><small>${x[0]}</small><strong>${x[1]}</strong><div>${x[2]}</div></a>`).join(''):'<div class="aml-search-empty">No AML results found.</div>'}
  open.onclick=async()=>{modal.classList.add('open');input.focus();await loadLive();render()};modal.querySelector('button').onclick=()=>modal.classList.remove('open');input.oninput=render;document.addEventListener('keydown',e=>{if(e.key==='Escape')modal.classList.remove('open');if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();open.click()}})
})();
