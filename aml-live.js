(() => {
  const API_BASE = 'https://nphetjaaobftmpeqyfwa.supabase.co/functions/v1/aml-public-data';
  const TEAM_SLUG_TO_ID = Object.freeze({
    'apollo':777781280,'black-cats':777781253,'blizzards':777781251,'dragons':777781282,'ducks':777781276,'empire':777781271,'falcons':777781265,'flamingos':777781254,'griffins':777781278,'guardians':777781252,'kloud-nine':777781267,'kush':777781264,'lake-hawks':777781274,'metros':777781255,'minions':777781275,'mob':777781250,'ocelots':777781248,'omnitrix':777781272,'order':777781273,'overdrive':777781269,'pheonixes':777781262,'phoenixes':777781262,'road-runners':777781249,'rhode-runners':777781249,'sharks':777781259,'sorcerers':777781263,'speed-racers':777781260,'stars':777781270,'stingers':777781281,'supermen':777781261,'surfers':777781279,'thunder-birds':777781258,'volts':777781268,'vodoo':777781277,'voodoo':777781277
  });
  const TEAM_ID_TO_PAGE = Object.freeze({
    777781280:'apollo',777781253:'black-cats',777781251:'blizzards',777781282:'dragons',777781276:'ducks',777781271:'empire',777781265:'falcons',777781254:'flamingos',777781278:'griffins',777781252:'guardians',777781267:'kloud-nine',777781264:'kush',777781274:'lake-hawks',777781255:'metros',777781275:'minions',777781250:'mob',777781248:'ocelots',777781272:'omnitrix',777781273:'order',777781269:'overdrive',777781262:'pheonixes',777781249:'rhode-runners',777781259:'sharks',777781263:'sorcerers',777781260:'speed-racers',777781270:'stars',777781281:'stingers',777781261:'supermen',777781279:'surfers',777781258:'thunder-birds',777781268:'volts',777781277:'vodoo'
  });
  // Madden generated a second set of franchise IDs during the Week 7 league-info
  // export. Keep one stable AML identity so old roster data and new standings/
  // schedule data join to the same 32 franchises.
  const TEAM_ID_ALIASES = Object.freeze({
    776994816:777781248,776994817:777781249,776994818:777781250,776994819:777781251,
    776994820:777781252,776994821:777781253,776994822:777781254,776994823:777781255,
    776994826:777781258,776994827:777781259,776994828:777781260,776994829:777781261,
    776994830:777781262,776994831:777781263,776994832:777781264,776994833:777781265,
    776994835:777781267,776994836:777781268,776994837:777781269,776994838:777781270,
    776994839:777781271,776994840:777781272,776994841:777781273,776994842:777781274,
    776994843:777781275,776994844:777781276,776994845:777781277,776994846:777781278,
    776994847:777781279,776994848:777781280,776994849:777781281,776994850:777781282
  });
  const DEV_TRAITS=Object.freeze({0:'NORMAL',1:'STAR',2:'SUPERSTAR',3:'X-FACTOR'});
  const USER_OVERRIDES=Object.freeze({777781252:'Carson',777781271:'Shady',777781260:'YFI'});
  const NAME_FIXES=Object.freeze({BlackCats:'Black Cats',SpeedRacers:'Speed Racers',OverDrive:'Overdrive',LakeHawks:'Lake Hawks',ThunderBirds:'Thunder Birds',RoadRunners:'Road Runners','Sorcerers ':'Sorcerers'});
  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
  function userName(teamId,fallback){return USER_OVERRIDES[Number(teamId)]||fallback||'CPU';}
  function cleanTeamName(value){const raw=String(value??'').trim();if(NAME_FIXES[raw])return NAME_FIXES[raw];return raw.replace(/([a-z])([A-Z])/g,'$1 $2');}
  function devLabel(value){return DEV_TRAITS[Number(value)]||'NORMAL';}
  function playerName(player){return [player?.first_name,player?.last_name].filter(Boolean).join(' ')||'Unknown Player';}
  function formatHeight(inches){const n=Number(inches);if(!Number.isFinite(n)||n<=0)return '—';return `${Math.floor(n/12)}'${n%12}"`;}
  function addRecords(baseRecord,standing){const parts=String(baseRecord||'0-0').split('-').map(v=>Number(v)||0);const wins=(parts[0]||0)+(Number(standing?.total_wins)||0);const losses=(parts[1]||0)+(Number(standing?.total_losses)||0);const ties=(parts[2]||0)+(Number(standing?.total_ties)||0);return ties?`${wins}-${losses}-${ties}`:`${wins}-${losses}`;}
  function currentRecord(standing){if(!standing)return '0-0';const w=Number(standing.total_wins)||0,l=Number(standing.total_losses)||0,t=Number(standing.total_ties)||0;return t?`${w}-${l}-${t}`:`${w}-${l}`;}
  function canonicalTeamId(value){const id=Number(value);return TEAM_ID_ALIASES[id]||id;}
  function normalizeIds(value){
    if(Array.isArray(value))return value.map(normalizeIds);
    if(!value||typeof value!=='object')return value;
    const row={};
    for(const [key,item] of Object.entries(value))row[key]=normalizeIds(item);
    for(const key of ['team_id','teamId','away_team_id','home_team_id'])if(row[key]!=null)row[key]=canonicalTeamId(row[key]);
    return row;
  }
  function latestTeamRows(rows){
    const byTeam=new Map();
    rows.slice().sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).forEach(row=>{
      const id=canonicalTeamId(row.team_id);
      if(!byTeam.has(id))byTeam.set(id,{...row,team_id:id});
    });
    return [...byTeam.values()];
  }
  function normalizePayload(payload){
    const data=normalizeIds(payload);
    if(Array.isArray(data.teams))data.teams=latestTeamRows(data.teams);
    if(Array.isArray(data.standings))data.standings=latestTeamRows(data.standings);
    if(Array.isArray(data.teams))data.count=data.teams.length;
    else if(Array.isArray(data.standings))data.count=data.standings.length;
    return data;
  }
  async function api(path){const response=await fetch(`${API_BASE}${path}`,{method:'GET',mode:'cors',cache:'no-store',headers:{Accept:'application/json'}});const raw=await response.json().catch(()=>({}));if(!response.ok||raw?.ok===false)throw new Error(raw?.error||`AML data request failed (${response.status})`);return normalizePayload(raw);}
  function teamIdForSlug(slug){return TEAM_SLUG_TO_ID[String(slug||'').toLowerCase()]||null;}
  function rosterUrl(teamId){return `rosters.html?teamId=${encodeURIComponent(teamId)}`;}
  function scheduleUrl(teamId){return teamId?`schedule.html?teamId=${encodeURIComponent(teamId)}`:'schedule.html';}
  function playerUrl(rosterId){return `player.html?rosterId=${encodeURIComponent(rosterId)}`;}
  function teamUrl(teamId){const slug=TEAM_ID_TO_PAGE[Number(teamId)];return slug?`team-${slug}.html`:'teams.html';}
  function gameUrl(scheduleId){return `game.html?scheduleId=${encodeURIComponent(scheduleId)}`;}
  function weekLabel(weekIndex){const n=Number(weekIndex);return Number.isFinite(n)?`Week ${n+1}`:'Week';}
  window.AML_LIVE=Object.freeze({API_BASE,TEAM_SLUG_TO_ID,TEAM_ID_TO_PAGE,TEAM_ID_ALIASES,DEV_TRAITS,api,esc,userName,cleanTeamName,devLabel,playerName,formatHeight,addRecords,currentRecord,teamIdForSlug,rosterUrl,scheduleUrl,playerUrl,teamUrl,gameUrl,weekLabel});
})();
