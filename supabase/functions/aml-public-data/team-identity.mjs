// Public AML IDs stay stable when Madden regenerates its franchise IDs.
const stableTeams = [
  [777781280, 'Apollo'], [777781253, 'Black Cats'], [777781251, 'Blizzards'], [777781282, 'Dragons'],
  [777781276, 'Ducks'], [777781271, 'Empire'], [777781265, 'Falcons'], [777781254, 'Flamingos'],
  [777781278, 'Griffins'], [777781252, 'Guardians'], [777781267, 'Kloud Nine'], [777781264, 'Kush'],
  [777781274, 'Lake Hawks'], [777781255, 'Metros'], [777781275, 'Minions'], [777781250, 'Mob'],
  [777781248, 'Ocelots'], [777781272, 'Omnitrix'], [777781273, 'Order'], [777781269, 'Overdrive'],
  [777781262, 'Phoenixes'], [777781249, 'Road Runners'], [777781259, 'Sharks'], [777781263, 'Sorcerers'],
  [777781260, 'Speed Racers'], [777781270, 'Stars'], [777781281, 'Stingers'], [777781261, 'Supermen'],
  [777781279, 'Surfers'], [777781258, 'Thunder Birds'], [777781268, 'Volts'], [777781277, 'Voodoo'],
];
const knownAliases = [
  [776994816,777781248], [776994817,777781249], [776994818,777781250], [776994819,777781251],
  [776994820,777781252], [776994821,777781253], [776994822,777781254], [776994823,777781255],
  [776994826,777781258], [776994827,777781259], [776994828,777781260], [776994829,777781261],
  [776994830,777781262], [776994831,777781263], [776994832,777781264], [776994833,777781265],
  [776994835,777781267], [776994836,777781268], [776994837,777781269], [776994838,777781270],
  [776994839,777781271], [776994840,777781272], [776994841,777781273], [776994842,777781274],
  [776994843,777781275], [776994844,777781276], [776994845,777781277], [776994846,777781278],
  [776994847,777781279], [776994848,777781280], [776994849,777781281], [776994850,777781282],
];
const nameKey = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const stableByName = new Map(stableTeams.map(([id, name]) => [nameKey(name), id]));
const teamIdKeys = new Set(['team_id', 'teamId', 'away_team_id', 'home_team_id', 'awayTeamId', 'homeTeamId']);
const ownerOverrides = new Map([[777781271, 'Shady'], [777781260, 'YFI']]);

export function createTeamIdentity(teamRows = []) {
  const aliases = new Map([...knownAliases, ...stableTeams.map(([id]) => [id, id])]);
  // Resolve later exports by their exact franchise nickname, never by array position.
  for (const row of teamRows) {
    const id = Number(row.team_id);
    const stable = stableByName.get(nameKey(row.nick_name || row.display_name));
    if (Number.isFinite(id) && stable) aliases.set(id, stable);
  }
  const canonicalTeamId = value => aliases.get(Number(value)) ?? Number(value);
  const teamIdsFor = value => {
    const stable = canonicalTeamId(value);
    return [...new Set([stable, ...[...aliases].filter(([, id]) => id === stable).map(([id]) => id)])];
  };
  function normalizeIds(value) {
    if (Array.isArray(value)) return value.map(normalizeIds);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key, teamIdKeys.has(key) && item != null ? canonicalTeamId(item) : normalizeIds(item),
    ]));
  }
  function latestTeamRows(rows) {
    const byTeam = new Map();
    const timestamp = row => String(row.source_received_at || row.updated_at || '');
    for (const row of [...rows].sort((a, b) => timestamp(b).localeCompare(timestamp(a)))) {
      const id = canonicalTeamId(row.team_id);
      if (!byTeam.has(id)) byTeam.set(id, {
        ...row, team_id: id,
        ...(ownerOverrides.has(id) ? { user_name: ownerOverrides.get(id) } : {}),
      });
    }
    return [...byTeam.values()];
  }
  function normalizePayload(payload) {
    const data = normalizeIds(payload);
    if (!data || typeof data !== 'object') return data;
    // Records are cumulative snapshots. Keep the newest; never add the old record.
    for (const key of ['teams', 'standings']) {
      if (Array.isArray(data[key])) {
        data[key] = latestTeamRows(data[key]);
        if (data.count != null && !(key === 'teams' && data.game)) data.count = data[key].length;
      }
    }
    return data;
  }
  return { canonicalTeamId, teamIdsFor, normalizePayload };
}
