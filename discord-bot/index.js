import http from 'node:http';
import {
  ActionRowBuilder,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  REST,
  Routes,
  StringSelectMenuBuilder,
  SlashCommandBuilder,
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
const divisionChoices = ['AFC North','AFC South','AFC East','AFC West','NFC North','NFC South','NFC East','NFC West'].map(value=>({name:value,value}));

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

async function latestStats(category){
  const data=await api('/weekly');
  return (data.exports||[]).filter(e=>e.success&&e.category===category&&Array.isArray(e.items)&&e.items.length).sort((a,b)=>n(b.week_index)-n(a.week_index))[0];
}

async function statsReply(category){
  const cfg=statConfig[category]||statConfig.passing;
  const entry=await latestStats(category);
  if(!entry) return {embeds:[baseEmbed(cfg.title).setDescription('No completed weekly stats have been imported yet.')]};
  const rows=entry.items.slice().sort((a,b)=>n(b[cfg.sort])-n(a[cfg.sort])).slice(0,10);
  const body=rows.map((r,i)=>`**${i+1}.** ${cfg.line(r)}`).join('\n');
  return {embeds:[baseEmbed(`${cfg.title} • ${weekLabel(entry.week_index)}`).setDescription(trim(body)).setURL(`${WEBSITE}/stats.html`)]};
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
  if(division) rows=rows.filter(r=>String(r.division_name||r.div_name).toLowerCase()===division.toLowerCase());
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

function statsMenu(){
  const menu=new StringSelectMenuBuilder().setCustomId('stats-category').setPlaceholder('Choose a stat category').addOptions(categoryChoices.map(c=>({label:c.name,value:c.value,description:`Show ${c.name.toLowerCase()} leaders`})));
  return new ActionRowBuilder().addComponents(menu);
}

client.once('ready',()=>console.log(`AML Bot online as ${client.user.tag}`));
client.on('interactionCreate',async interaction=>{
  try{
    if(interaction.isAutocomplete()){
      const q=interaction.options.getFocused();
      if(interaction.commandName==='roster'||interaction.commandName==='schedule')return interaction.respond(teamChoice(q));
      if(interaction.commandName==='player'){
        const players=await getPlayers();const needle=String(q).toLowerCase();
        return interaction.respond(players.filter(p=>`${p.first_name||''} ${p.last_name||''}`.toLowerCase().includes(needle)).slice(0,25).map(p=>({name:`${p.first_name||''} ${p.last_name||''} (${p.position||'—'}, ${n(p.player_best_ovr)} OVR)`.slice(0,100),value:String(p.roster_id)})));
      }
    }
    if(interaction.isStringSelectMenu()&&interaction.customId==='stats-category'){
      await interaction.deferUpdate();return interaction.editReply(await statsReply(interaction.values[0]));
    }
    if(!interaction.isChatInputCommand())return;
    if(interaction.commandName==='stats'){
      const category=interaction.options.getString('category');
      if(!category)return interaction.reply({content:'Choose the stats you want to see:',components:[statsMenu()]});
      await interaction.deferReply();return interaction.editReply(await statsReply(category));
    }
    await interaction.deferReply();
    if(interaction.commandName==='roster')return interaction.editReply(await rosterReply(n(interaction.options.getString('team'))));
    if(interaction.commandName==='standings')return interaction.editReply(await standingsReply(interaction.options.getString('division')));
    if(interaction.commandName==='scores')return interaction.editReply(await scoresReply(interaction.options.getInteger('week')));
    if(interaction.commandName==='schedule')return interaction.editReply(await scheduleReply(n(interaction.options.getString('team')),interaction.options.getInteger('week')));
    if(interaction.commandName==='player')return interaction.editReply(await playerReply(interaction.options.getString('name')));
    if(interaction.commandName==='rivalries')return interaction.editReply(await rivalriesReply());
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
