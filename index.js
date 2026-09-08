import http from 'node:http';
import {
  ActionRowBuilder,
  Client,
  ChannelType,
  EmbedBuilder,
  GatewayIntentBits,
  REST,
  Routes,
  StringSelectMenuBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const API_BASE = process.env.AML_API_BASE || 'https://nphetjaaobftmpeqyfwa.supabase.co/functions/v1/aml-public-data';
const WEBSITE = 'https://apollomaddenleague.github.io';
const PINK = 0xff2bbf;

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or DISCORD_CLIENT_ID.');
  process.exit(1);
}

const teams = [
  ['Apollo',777781280],['Black Cats',777781253],['Blizzards',777781251],['Dragons',777781282],
  ['Ducks',777781276],['Empire',777781271],['Falcons',777781265],['Flamingos',777781254],
  ['Griffins',777781278],['Guardians',777781252],['K9',777781267],['Kush',777781264],
  ['Lake Hawks',777781274],['Metros',777781255],['Minions',777781275],['Mob',777781250],
  ['Ocelots',777781248],['Omnitrix',777781272],['Order',777781273],['Overdrive',777781269],
  ['Phoenix',777781262],['Road Runners',777781249],['Sharks',777781259],['Sorcerers',777781263],
  ['Speed Racers',777781260],['Stars',777781270],['Stingers',777781281],['Supermen',777781261],
  ['Surfers',777781279],['Thunder Birds',777781258],['Volts',777781268],['Voodoo',777781277],
].map(([name,id])=>({name,id}));
const teamById = new Map(teams.map(t=>[t.id,t]));
const userOverrides = new Map([[777781252,'Carson']]);
const rivalryPairs = [
  [777781250,777781279],[777781276,777781253],[777781260,777781280],[777781281,777781268],
  [777781251,777781269],[777781263,777781273],[777781252,777781259],[777781274,777781258],
  [777781249,777781282],[777781271,777781270],[777781254,777781272],[777781277,777781265],
  [777781267,777781262],[777781264,777781261],[777781278,777781255],[777781248,777781275],
];

const statConfig = {
  passing:{title:'Passing Leaders',sort:'passYds',line:r=>`${r.fullName} — **${n(r.passYds)} YDS** | ${n(r.passTDs)} TD | ${n(r.passInts)} INT`},
  rushing:{title:'Rushing Leaders',sort:'rushYds',line:r=>`${r.fullName} — **${n(r.rushYds)} YDS** | ${n(r.rushTDs)} TD | ${n(r.rushAtt)} ATT`},
  receiving:{title:'Receiving Leaders',sort:'recYds',line:r=>`${r.fullName} — **${n(r.recYds)} YDS** | ${n(r.recCatches)} REC | ${n(r.recTDs)} TD`},
  defense:{title:'Defensive Leaders',sort:'defTotalTackles',line:r=>`${r.fullName} — **${n(r.defTotalTackles)} TKL** | ${n(r.defSacks)} SACK | ${n(r.defInts)} INT`},
  kicking:{title:'Kicking Leaders',sort:'kickPts',line:r=>`${r.fullName} — **${n(r.kickPts)} PTS** | ${n(r.fGMade)}/${n(r.fGAtt)} FG`},
  punting:{title:'Punting Leaders',sort:'puntYds',line:r=>`${r.fullName} — **${n(r.puntYds)} YDS** | ${n(r.puntAtt)} PUNTS | ${n(r.puntsIn20)} IN 20`},
  team:{title:'Team Offense Leaders',sort:'offTotalYds',line:r=>`${teamName(r.teamId,r.teamName)} — **${n(r.offTotalYds)} YDS** | ${n(r.offPtsPerGame)} PPG`},
};

const categoryChoices = Object.keys(statConfig).map(name=>({name:name[0].toUpperCase()+name.slice(1),value:name}));
const divisionChoices = ['AFC','NFC','AFC North','AFC South','AFC East','AFC West','NFC North','NFC South','NFC East','NFC West'].map(value=>({name:value,value}));

const commands = [
  new SlashCommandBuilder().setName('stats').setDescription('Show the latest AML stat leaders')
    .addStringOption(o=>o.setName('category').setDescription('Stat category').addChoices(...categoryChoices)),
  new SlashCommandBuilder().setName('roster').setDescription('Show an AML team roster')
    .addStringOption(o=>o.setName('team').setDescription('AML team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('standings').setDescription('Show Season 14 standings')
    .addStringOption(o=>o.setName('division').setDescription('Optional division').addChoices(...divisionChoices)),
  new SlashCommandBuilder().setName('scores').setDescription('Show AML scores by week')
    .addIntegerOption(o=>o.setName('week').setDescription('Week 1-18').setMinValue(1).setMaxValue(18)),
  new SlashCommandBuilder().setName('schedule').setDescription("Show a team's Season 14 schedule")
    .addStringOption(o=>o.setName('team').setDescription('AML team').setRequired(true).setAutocomplete(true))
    .addIntegerOption(o=>o.setName('week').setDescription('Optional week').setMinValue(1).setMaxValue(18)),
  new SlashCommandBuilder().setName('player').setDescription('Look up an AML player')
    .addStringOption(o=>o.setName('name').setDescription('Player name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('rivalries').setDescription('Show all Season 14 rivalry records'),
  new SlashCommandBuilder().setName('help').setDescription('Show AML bot commands'),
  new SlashCommandBuilder().setName('game').setDescription('Show a complete AML game box score').addStringOption(o=>o.setName('game').setDescription('Select a matchup').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('team').setDescription('Show an AML team profile').addStringOption(o=>o.setName('team').setDescription('AML team').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('leaders').setDescription('Rank players by an exact stat').addStringOption(o=>o.setName('stat').setDescription('Statistic').setRequired(true).addChoices({name:'Passing TDs',value:'passTDs'},{name:'Passing Interceptions',value:'passInts'},{name:'Rushing TDs',value:'rushTDs'},{name:'Receptions',value:'recCatches'},{name:'Receiving TDs',value:'recTDs'},{name:'Tackles',value:'defTotalTackles'},{name:'Sacks',value:'defSacks'},{name:'Defensive Interceptions',value:'defInts'},{name:'Forced Fumbles',value:'defForcedFum'})),
  new SlashCommandBuilder().setName('compare').setDescription('Compare two AML players').addStringOption(o=>o.setName('player1').setDescription('First player').setRequired(true).setAutocomplete(true)).addStringOption(o=>o.setName('player2').setDescription('Second player').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('user').setDescription('Show an AML owner and their current team').addStringOption(o=>o.setName('team').setDescription("Owner's team").setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('playoffs').setDescription('Show the current AFC and NFC playoff picture'),
  new SlashCommandBuilder().setName('power-rankings').setDescription('Show the MSPN Season 14 power rankings'),
  new SlashCommandBuilder().setName('create-game-channels').setDescription('Owner only: create every matchup channel for a week').addIntegerOption(o=>o.setName('week').setDescription('Week 1-18').setRequired(true).setMinValue(1).setMaxValue(18)),
  new SlashCommandBuilder().setName('records').setDescription('Show AML records tracked since Season 14').addStringOption(o=>o.setName('type').setDescription('Record type').setRequired(true).addChoices({name:'Single Game',value:'game'},{name:'Season Records',value:'season'},{name:'Career Records',value:'career'})).addStringOption(o=>o.setName('category').setDescription('Stat category').setRequired(true).addChoices({name:'Passing',value:'passing'},{name:'Rushing',value:'rushing'},{name:'Receiving',value:'receiving'},{name:'Defense',value:'defense'},{name:'Kicking',value:'kicking'})),
].map(c=>c.toJSON());

const client = new Client({intents:[GatewayIntentBits.Guilds]});
let playerCache = {expires:0,items:[]};

async function api(path){
  const response=await fetch(`${API_BASE}${path}`,{headers:{accept:'application/json'}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok===false) throw new Error(data.error||`AML API ${response.status}`);
  return data;
}

function n(value){const x=Number(value);return Number.isFinite(x)?x:0;}
function clean(value){return String(value??'').trim().replace(/([a-z])([A-Z])/g,'$1 $2');}
function teamName(teamId,fallback){return teamById.get(Number(teamId))?.name||clean(fallback)||'Unknown Team';}
function username(row){return userOverrides.get(Number(row.team_id))||row.user_name||'CPU';}
function weekLabel(index){return `Week ${n(index)+1}`;}
function baseEmbed(title){return new EmbedBuilder().setColor(PINK).setTitle(title).setFooter({text:'Apollo Madden League • Live Madden 27 Data'}).setTimestamp();}
function trim(text,max=4000){return text.length>max?`${text.slice(0,max-1)}…`:text;}
function teamChoice(query){
  const q=query.toLowerCase();
  return teams.filter(t=>t.name.toLowerCase().includes(q)).slice(0,25).map(t=>({name:t.name,value:String(t.id)}));
}

async function registerCommands(){
  const rest=new REST({version:'10'}).setToken(TOKEN);
  const route=GUILD_ID?Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID):Routes.applicationCommands(CLIENT_ID);
  await rest.put(route,{body:commands});
  console.log(`Registered ${commands.length} AML commands ${GUILD_ID?'in guild':'globally'}.`);
}

async function seasonStats(category){
  const data=await api('/weekly');
  const exports=(data.exports||[]).filter(e=>e.success&&e.category===category&&Array.isArray(e.items));
  const rows=exports.flatMap(e=>e.items);
  const unique=[...new Map(rows.map((r,i)=>[r.statId??`${r.scheduleId}-${r.rosterId??r.teamId}-${i}`,r])).values()];
  const grouped=new Map();
  for(const row of unique){
    const key=category==='team'?`team-${row.teamId}`:`player-${row.rosterId??row.fullName}`;
    if(!grouped.has(key))grouped.set(key,{...row});
    else{
      const total=grouped.get(key);
      for(const [field,value] of Object.entries(row))if(typeof value==='number'&&!['statId','rosterId','teamId','scheduleId','weekIndex','stageIndex','seasonIndex'].includes(field))total[field]=n(total[field])+value;
    }
  }
  return [...grouped.values()];
}

async function statsReply(category){
  const cfg=statConfig[category]||statConfig.passing;
  const seasonRows=await seasonStats(category);
  if(!seasonRows.length) return {embeds:[baseEmbed(cfg.title).setDescription('No completed weekly stats have been imported yet.')]};
  const rows=seasonRows.sort((a,b)=>n(b[cfg.sort])-n(a[cfg.sort])).slice(0,10);
  const body=rows.map((r,i)=>`**${i+1}.** ${cfg.line(r)}`).join('\n');
  return {embeds:[baseEmbed(`${cfg.title} • Season 14`).setDescription(trim(body)).setURL(`${WEBSITE}/stats.html`)]};
}

async function rosterReply(teamId){
  const data=await api(`/roster?teamId=${encodeURIComponent(teamId)}&limit=500`);
  const rows=(data.players||[]).slice().sort((a,b)=>n(b.player_best_ovr)-n(a.player_best_ovr));
  const name=teamName(teamId,rows[0]?.team_name);
  const body=rows.slice(0,25).map((p,i)=>`**${i+1}. ${p.first_name||''} ${p.last_name||''}** — ${p.position||'—'} | ${n(p.player_best_ovr)} OVR`).join('\n');
  return {embeds:[baseEmbed(`${name} Roster`).setDescription(trim(body||'No players found.')).setURL(`${WEBSITE}/rosters.html?teamId=${teamId}`)]};
}

async function standingsReply(division){
  const data=await api('/standings');
  let rows=(data.standings||[]).slice();
  if(division){
    const selected=division.toLowerCase();
    rows=rows.filter(r=>{const name=String(r.division_name||r.div_name).toLowerCase();return selected==='afc'||selected==='nfc'?name.startsWith(selected):name===selected;});
  }
  rows.sort((a,b)=>n(b.win_pct)-n(a.win_pct)||n(b.total_wins)-n(a.total_wins));
  const body=rows.map((r,i)=>`**${i+1}. ${teamName(r.team_id,r.display_name||r.team_name)}** — ${n(r.total_wins)}-${n(r.total_losses)}${n(r.total_ties)?`-${n(r.total_ties)}`:''} • ${username(r)}`).join('\n');
  return {embeds:[baseEmbed(division?`${division} Standings`:'Season 14 Standings').setDescription(trim(body||'No standings found.')).setURL(`${WEBSITE}/standings.html`)]};
}

async function scheduleData(){const d=await api('/schedule');return d.games||[];}
async function scoresReply(requestedWeek){
  const games=await scheduleData();
  const completed=games.filter(g=>n(g.stage_index)===1&&(n(g.status)>1||n(g.away_score)>0||n(g.home_score)>0));
  const week=requestedWeek||Math.max(1,...completed.map(g=>n(g.week_index)+1));
  const rows=completed.filter(g=>n(g.week_index)+1===week);
  const body=rows.map(g=>`**${teamName(g.away_team_id,g.away_team_name||g.away_abbr)} ${n(g.away_score)}** — **${n(g.home_score)} ${teamName(g.home_team_id,g.home_team_name||g.home_abbr)}**`).join('\n');
  return {embeds:[baseEmbed(`Week ${week} Scores`).setDescription(trim(body||'No completed games for this week.')).setURL(`${WEBSITE}/schedule.html?week=${week-1}`)]};
}

async function scheduleReply(teamId,requestedWeek){
  let rows=(await scheduleData()).filter(g=>n(g.stage_index)===1&&(n(g.home_team_id)===teamId||n(g.away_team_id)===teamId));
  if(requestedWeek) rows=rows.filter(g=>n(g.week_index)+1===requestedWeek);
  rows.sort((a,b)=>n(a.week_index)-n(b.week_index));
  const body=rows.map(g=>{const played=n(g.status)>1||n(g.away_score)>0||n(g.home_score)>0;return `**${weekLabel(g.week_index)}:** ${teamName(g.away_team_id,g.away_team_name||g.away_abbr)} ${played?n(g.away_score):''} ${played?'—':'vs'} ${played?n(g.home_score):''} ${teamName(g.home_team_id,g.home_team_name||g.home_abbr)}`;}).join('\n');
  return {embeds:[baseEmbed(`${teamName(teamId)} Schedule`).setDescription(trim(body||'No imported games found.')).setURL(`${WEBSITE}/schedule.html?teamId=${teamId}`)]};
}

async function getPlayers(){
  if(Date.now()<playerCache.expires)return playerCache.items;
  const data=await api('/players?limit=2000');
  playerCache={items:data.players||[],expires:Date.now()+300000};
  return playerCache.items;
}

async function playerReply(rosterId){
  const [playerData,statsData,teamsData]=await Promise.all([api(`/player?rosterId=${encodeURIComponent(rosterId)}`),api(`/player-stats?rosterId=${encodeURIComponent(rosterId)}`),api('/teams')]);
  const p=playerData.player; if(!p)throw new Error('Player not found');
  const team=(teamsData.teams||[]).find(t=>n(t.team_id)===n(p.team_id));
  const rows=statsData.stats||[];
  const sums=(category,keys)=>keys.map(([label,key])=>`${label}: **${rows.filter(r=>r.category===category).reduce((a,r)=>a+n(r.stats?.[key]),0)}**`).join(' • ');
  const lines=[`**${p.position||'—'} • #${p.jersey_num??'—'} • ${n(p.player_best_ovr)} OVR**`,`Team: ${teamName(p.team_id,team?.display_name)}`,sums('passing',[['Pass YDS','passYds'],['TD','passTDs'],['INT','passInts']]),sums('rushing',[['Rush YDS','rushYds'],['TD','rushTDs']]),sums('receiving',[['REC','recCatches'],['Rec YDS','recYds'],['TD','recTDs']]),sums('defense',[['TKL','defTotalTackles'],['SACK','defSacks'],['INT','defInts']])].filter(x=>x&&!x.endsWith('**0** • TD: **0** • INT: **0**'));
  return {embeds:[baseEmbed(`${p.first_name||''} ${p.last_name||''}`.trim()).setDescription(lines.join('\n')).setURL(`${WEBSITE}/player.html?rosterId=${rosterId}`)]};
}

async function rivalriesReply(){
  const finals=(await scheduleData()).filter(g=>n(g.stage_index)===1&&(n(g.status)>1||n(g.away_score)>0||n(g.home_score)>0));
  const body=rivalryPairs.map(([a,b])=>{let aw=0,bw=0,t=0;finals.filter(g=>[n(g.home_team_id),n(g.away_team_id)].includes(a)&&[n(g.home_team_id),n(g.away_team_id)].includes(b)).forEach(g=>{if(n(g.home_score)===n(g.away_score))t++;else{const w=n(g.home_score)>n(g.away_score)?n(g.home_team_id):n(g.away_team_id);w===a?aw++:bw++;}});return `**${teamName(a)} ${aw}–${bw} ${teamName(b)}**${t?` (${t} tie${t===1?'':'s'})`:''}`;}).join('\n');
  return {embeds:[baseEmbed('AML Rivalries • Season 14').setDescription(body).setURL(`${WEBSITE}/rivalries.html`)]};
}

async function gameChoices(query){
  const q=String(query).toLowerCase();
  return (await scheduleData()).filter(g=>n(g.status)>1||n(g.away_score)>0||n(g.home_score)>0).sort((a,b)=>n(b.week_index)-n(a.week_index)).map(g=>({name:`Week ${n(g.week_index)+1}: ${teamName(g.away_team_id,g.away_team_name)} ${n(g.away_score)}-${n(g.home_score)} ${teamName(g.home_team_id,g.home_team_name)}`.slice(0,100),value:String(g.schedule_id)})).filter(x=>x.name.toLowerCase().includes(q)).slice(0,25);
}

async function gameReply(id){
  const d=await api(`/game/${id}`),g=d.game,stats=d.stats||[];
  const title=`${teamName(g.away_team_id,g.away_team_name)} ${n(g.away_score)}–${n(g.home_score)} ${teamName(g.home_team_id,g.home_team_name)}`;
  const leaders=category=>stats.filter(x=>x.category===category).map(x=>x.stats).sort((a,b)=>n(b[statConfig[category]?.sort])-n(a[statConfig[category]?.sort])).slice(0,3).map(r=>statConfig[category].line(r)).join('\n');
  const body=['**Passing**',leaders('passing'),'**Rushing**',leaders('rushing'),'**Receiving**',leaders('receiving'),'**Defense**',leaders('defense')].filter(Boolean).join('\n');
  return {embeds:[baseEmbed(`FINAL • Week ${n(g.week_index)+1}`).setDescription(`**${title}**\n\n${body}`).setURL(`${WEBSITE}/game.html?scheduleId=${id}`)]};
}

async function teamReply(id){
  const [sd,rd,gd]=await Promise.all([api('/standings'),api(`/roster?teamId=${id}&limit=500`),api('/schedule')]);
  const s=(sd.standings||[]).find(x=>n(x.team_id)===id)||{},roster=(rd.players||[]).sort((a,b)=>n(b.player_best_ovr)-n(a.player_best_ovr));
  const recent=(gd.games||[]).filter(g=>(n(g.home_team_id)===id||n(g.away_team_id)===id)&&(n(g.status)>1||n(g.away_score)>0||n(g.home_score)>0)).sort((a,b)=>n(b.week_index)-n(a.week_index)).slice(0,3);
  const body=[`Owner: **${username(s)}**`,`Record: **${n(s.total_wins)}-${n(s.total_losses)}**`,`Division: **${s.division_name||s.div_name||'—'}**`,'','**Top Players**',...roster.slice(0,5).map(p=>`${p.first_name} ${p.last_name} • ${p.position} • ${n(p.player_best_ovr)} OVR`),'','**Recent Games**',...recent.map(g=>`Week ${n(g.week_index)+1}: ${teamName(g.away_team_id)} ${n(g.away_score)}–${n(g.home_score)} ${teamName(g.home_team_id)}`)].join('\n');
  return {embeds:[baseEmbed(`${teamName(id)} Team Profile`).setDescription(trim(body)).setURL(`${WEBSITE}/schedule.html?teamId=${id}`)]};
}

const exactStats={passTDs:['passing','Passing Touchdowns','TD'],passInts:['passing','Passing Interceptions','INT'],rushTDs:['rushing','Rushing Touchdowns','TD'],recCatches:['receiving','Receptions','REC'],recTDs:['receiving','Receiving Touchdowns','TD'],defTotalTackles:['defense','Total Tackles','TKL'],defSacks:['defense','Sacks','SACK'],defInts:['defense','Defensive Interceptions','INT'],defForcedFum:['defense','Forced Fumbles','FF']};
async function leadersReply(key){const [category,title,label]=exactStats[key];const rows=(await seasonStats(category)).sort((a,b)=>n(b[key])-n(a[key])).slice(0,10);return {embeds:[baseEmbed(`${title} Leaders • Season 14`).setDescription(rows.map((r,i)=>`**${i+1}.** ${r.fullName} — **${n(r[key])} ${label}**`).join('\n'))]};}

async function compareReply(a,b){const players=await getPlayers(),p1=players.find(p=>String(p.roster_id)===a),p2=players.find(p=>String(p.roster_id)===b);const all=await Promise.all(Object.keys(statConfig).filter(x=>x!=='team').map(seasonStats));const flat=all.flat();const line=p=>{const rows=flat.filter(r=>n(r.rosterId)===n(p.roster_id));const sum=k=>rows.reduce((v,r)=>v+n(r[k]),0);return `**${p.first_name} ${p.last_name}** • ${p.position} • ${n(p.player_best_ovr)} OVR\nPass: ${sum('passYds')} YDS, ${sum('passTDs')} TD | Rush: ${sum('rushYds')} YDS, ${sum('rushTDs')} TD | Rec: ${sum('recYds')} YDS, ${sum('recTDs')} TD | DEF: ${sum('defTotalTackles')} TKL, ${sum('defSacks')} SACK, ${sum('defInts')} INT`;};return {embeds:[baseEmbed('Player Comparison • Season 14').setDescription(`${line(p1)}\n\n**VS**\n\n${line(p2)}`)]};}

async function playoffsReply(){const d=await api('/standings'),rows=d.standings||[];const side=c=>rows.filter(r=>String(r.division_name||r.div_name).startsWith(c)).sort((a,b)=>n(b.win_pct)-n(a.win_pct)||n(b.total_wins)-n(a.total_wins)).slice(0,7).map((r,i)=>`**${i+1}. ${teamName(r.team_id,r.display_name)}** ${n(r.total_wins)}-${n(r.total_losses)}`).join('\n');return {embeds:[baseEmbed('Season 14 Playoff Picture').addFields({name:'AFC',value:side('AFC')||'No data',inline:true},{name:'NFC',value:side('NFC')||'No data',inline:true})]};}

const rankings=['Speed Racers','Apollo','Omnitrix','Phoenix','Voodoo','Flamingos','Order','K9','Sorcerers','Stingers','Kush','Supermen','Overdrive','Griffins','Blizzards','Volts','Falcons','Ocelots','Metros','Minions','Mob','Lake Hawks','Sharks','Dragons','Stars','Empire','Black Cats','Thunder Birds','Road Runners','Ducks','Guardians','Surfers'];
function rankingsReply(){return {embeds:[baseEmbed('MSPN Season 14 Power Rankings').setDescription(rankings.map((t,i)=>`**${i+1}.** ${t}`).join('\n')).setURL(`${WEBSITE}/mspn.html`)]};}

function roleForTeam(guild,teamId){
  const wanted=teamName(teamId).toLowerCase().replace(/[^a-z0-9]/g,'');
  const aliases={phoenix:['phoenixes'],k9:['kloudnine','cloudnine'],thunderbirds:['thunderbird'],roadrunners:['roadrunner'],lakehawks:['lakehawk'],omnitrix:['omnitrix','omnitrix']};
  return guild.roles.cache.find(role=>{const name=role.name.toLowerCase().replace(/[^a-z0-9]/g,'');return name===wanted||name.endsWith(wanted)||(aliases[wanted]||[]).some(alias=>name===alias||name.endsWith(alias));});
}

async function createGameChannels(interaction){
  const guild=interaction.guild;
  if(!guild)throw new Error('This command only works inside the AML server.');
  if(interaction.user.id!==guild.ownerId)return {content:'Only the AML server owner can use this command.'};
  const me=guild.members.me||await guild.members.fetchMe();
  if(!me.permissions.has(PermissionFlagsBits.ManageChannels))return {content:'The AML Bot needs the **Manage Channels** permission first.'};
  const week=interaction.options.getInteger('week',true);
  const games=(await scheduleData()).filter(g=>n(g.stage_index)===1&&n(g.week_index)+1===week);
  if(!games.length)return {content:`No Week ${week} games are in the imported schedule yet.`};
  await guild.roles.fetch();await guild.channels.fetch();
  const categoryName=`WEEK ${week}`;
  let category=guild.channels.cache.find(c=>c.type===ChannelType.GuildCategory&&c.name.toUpperCase()===categoryName);
  if(!category)category=await guild.channels.create({name:categoryName,type:ChannelType.GuildCategory,position:guild.channels.cache.size,reason:`AML Week ${week} matchup channels`});
  const made=[],missing=[];
  for(const game of games){
    const away=teamName(game.away_team_id,game.away_team_name),home=teamName(game.home_team_id,game.home_team_name);
    const channelName=`${away}-vs-${home}`.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
    let channel=guild.channels.cache.find(c=>c.parentId===category.id&&c.name===channelName);
    if(!channel)channel=await guild.channels.create({name:channelName,type:ChannelType.GuildText,parent:category.id,reason:`AML Week ${week}: ${away} vs ${home}`});
    const roles=[roleForTeam(guild,game.away_team_id),roleForTeam(guild,game.home_team_id)].filter(Boolean);
    if(roles.length<2)missing.push(`${away} vs ${home}`);
    await channel.send({content:`${roles.map(r=>`<@&${r.id}>`).join(' ')} — your **Week ${week}** matchup is **${away} vs ${home}**.`,allowedMentions:{roles:roles.map(r=>r.id)}});
    made.push(`<#${channel.id}>`);
  }
  return {content:`Created **${categoryName}** with ${made.length} matchup channels.${missing.length?`\nCould not find both team roles for: ${missing.join(', ')}`:''}`};
}

async function recordsReply(type,category){
  const definitions={passing:[['passYds','Passing Yards','YDS'],['passTDs','Passing Touchdowns','TD']],rushing:[['rushYds','Rushing Yards','YDS'],['rushTDs','Rushing Touchdowns','TD']],receiving:[['recCatches','Receptions','REC'],['recYds','Receiving Yards','YDS'],['recTDs','Receiving Touchdowns','TD']],defense:[['defTotalTackles','Tackles','TKL'],['defSacks','Sacks','SACK'],['defInts','Interceptions','INT']],kicking:[['kickPts','Kicking Points','PTS'],['fGLongest','Longest Field Goal','YDS']]};
  const data=await api('/weekly'),raw=(data.exports||[]).filter(e=>e.success&&e.category===category&&Array.isArray(e.items)).flatMap(e=>e.items),unique=[...new Map(raw.map((r,i)=>[r.statId??`${r.scheduleId}-${r.rosterId}-${i}`,r])).values()];
  const lines=(definitions[category]||[]).map(([key,label,unit])=>{let rows=unique;if(type!=='game'){const grouped=new Map();rows.forEach(r=>{const season=14+n(r.seasonIndex),id=type==='season'?`${season}-${r.rosterId}`:String(r.rosterId),x=grouped.get(id)||{...r,[key]:0,season};x[key]=key==='fGLongest'?Math.max(n(x[key]),n(r[key])):n(x[key])+n(r[key]);grouped.set(id,x)});rows=[...grouped.values()]};const top=rows.sort((a,b)=>n(b[key])-n(a[key]))[0];const detail=type==='game'?`Week ${n(top?.weekIndex)+1}, Season ${14+n(top?.seasonIndex)}`:type==='season'?`Season ${top?.season}`:'Since Season 14';return `**${label}:** ${top?.fullName||'—'} — **${n(top?.[key])} ${unit}** (${detail})`;});
  return {embeds:[baseEmbed(`${type==='game'?'Single-Game':type==='season'?'Season':'Career'} ${category[0].toUpperCase()+category.slice(1)} Records`).setDescription(lines.join('\n')).setURL(`${WEBSITE}/records.html`)]};
}

function statsMenu(){
  const menu=new StringSelectMenuBuilder().setCustomId('stats-category').setPlaceholder('Choose a stat category').addOptions(categoryChoices.map(c=>({label:c.name,value:c.value,description:`Show ${c.name.toLowerCase()} leaders`})));
  return new ActionRowBuilder().addComponents(menu);
}

function standingsMenu(){
  const menu=new StringSelectMenuBuilder().setCustomId('standings-division').setPlaceholder('Choose a division').addOptions(divisionChoices.map(c=>({label:c.name,value:c.value,description:`Show the ${c.name} standings`})));
  return new ActionRowBuilder().addComponents(menu);
}

client.once('ready',()=>console.log(`AML Bot online as ${client.user.tag}`));
client.on('interactionCreate',async interaction=>{
  try{
    if(interaction.isAutocomplete()){
      const q=interaction.options.getFocused();
      if(['roster','schedule','team','user'].includes(interaction.commandName))return interaction.respond(teamChoice(q));
      if(interaction.commandName==='game')return interaction.respond(await gameChoices(q));
      if(interaction.commandName==='player'||interaction.commandName==='compare'){
        const players=await getPlayers();const needle=String(q).toLowerCase();
        return interaction.respond(players.filter(p=>`${p.first_name||''} ${p.last_name||''}`.toLowerCase().includes(needle)).slice(0,25).map(p=>({name:`${p.first_name||''} ${p.last_name||''} (${p.position||'—'}, ${n(p.player_best_ovr)} OVR)`.slice(0,100),value:String(p.roster_id)})));
      }
    }
    if(interaction.isStringSelectMenu()&&interaction.customId==='stats-category'){
      await interaction.deferUpdate();return interaction.editReply(await statsReply(interaction.values[0]));
    }
    if(interaction.isStringSelectMenu()&&interaction.customId==='standings-division'){
      await interaction.deferUpdate();return interaction.editReply({...await standingsReply(interaction.values[0]),components:[standingsMenu()]});
    }
    if(!interaction.isChatInputCommand())return;
    if(interaction.commandName==='stats'){
      const category=interaction.options.getString('category');
      if(!category)return interaction.reply({content:'Choose the stats you want to see:',components:[statsMenu()]});
      await interaction.deferReply();return interaction.editReply(await statsReply(category));
    }
    if(interaction.commandName==='standings'&&!interaction.options.getString('division'))return interaction.reply({content:'Choose the division you want to see:',components:[standingsMenu()]});
    await interaction.deferReply();
    if(interaction.commandName==='roster')return interaction.editReply(await rosterReply(n(interaction.options.getString('team'))));
    if(interaction.commandName==='standings')return interaction.editReply(await standingsReply(interaction.options.getString('division')));
    if(interaction.commandName==='scores')return interaction.editReply(await scoresReply(interaction.options.getInteger('week')));
    if(interaction.commandName==='schedule')return interaction.editReply(await scheduleReply(n(interaction.options.getString('team')),interaction.options.getInteger('week')));
    if(interaction.commandName==='player')return interaction.editReply(await playerReply(interaction.options.getString('name')));
    if(interaction.commandName==='rivalries')return interaction.editReply(await rivalriesReply());
    if(interaction.commandName==='game')return interaction.editReply(await gameReply(interaction.options.getString('game')));
    if(interaction.commandName==='team')return interaction.editReply(await teamReply(n(interaction.options.getString('team'))));
    if(interaction.commandName==='leaders')return interaction.editReply(await leadersReply(interaction.options.getString('stat')));
    if(interaction.commandName==='compare')return interaction.editReply(await compareReply(interaction.options.getString('player1'),interaction.options.getString('player2')));
    if(interaction.commandName==='user')return interaction.editReply(await teamReply(n(interaction.options.getString('team'))));
    if(interaction.commandName==='playoffs')return interaction.editReply(await playoffsReply());
    if(interaction.commandName==='power-rankings')return interaction.editReply(rankingsReply());
    if(interaction.commandName==='create-game-channels')return interaction.editReply(await createGameChannels(interaction));
    if(interaction.commandName==='records')return interaction.editReply(await recordsReply(interaction.options.getString('type'),interaction.options.getString('category')));
    if(interaction.commandName==='game')return interaction.editReply(await gameReply(interaction.options.getString('game')));
    if(interaction.commandName==='team')return interaction.editReply(await teamReply(n(interaction.options.getString('team'))));
    if(interaction.commandName==='leaders')return interaction.editReply(await leadersReply(interaction.options.getString('stat')));
    if(interaction.commandName==='compare')return interaction.editReply(await compareReply(interaction.options.getString('player1'),interaction.options.getString('player2')));
    if(interaction.commandName==='user')return interaction.editReply(await teamReply(n(interaction.options.getString('team'))));
    if(interaction.commandName==='playoffs')return interaction.editReply(await playoffsReply());
    if(interaction.commandName==='power-rankings')return interaction.editReply(rankingsReply());
    if(interaction.commandName==='help')return interaction.editReply({embeds:[baseEmbed('AML Bot Commands').setDescription('`/stats` Stat leaders\n`/roster` Team roster\n`/standings` League standings\n`/scores` Weekly scores\n`/schedule` Team schedule\n`/player` Player profile\n`/rivalries` Rivalry records')]});
  }catch(error){
    console.error(error);
    const message={content:'I could not load the AML data right now. Try again in a moment.',components:[]};
    if(interaction.deferred||interaction.replied)await interaction.editReply(message).catch(()=>{});else await interaction.reply({...message,ephemeral:true}).catch(()=>{});
  }
});

http.createServer((req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,service:'aml-discord-bot',discordReady:client.isReady()}));}).listen(Number(process.env.PORT)||3000);

await registerCommands();
await client.login(TOKEN);
