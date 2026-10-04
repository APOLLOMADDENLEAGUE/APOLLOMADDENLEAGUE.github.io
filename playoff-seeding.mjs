// The Madden standings export already applies its playoff tiebreakers. Preserve
// that order instead of replacing head-to-head / multi-team results with net_pts.
// Rule reference: https://www.nfl.com/standings/tie-breaking-procedures
export function conferenceSeeds(standings, conference) {
  const rows = standings.filter(row =>
    String(row.conference_name || row.division_name || row.div_name || '')
      .toUpperCase().startsWith(conference.toUpperCase()));
  const ordered = [...rows].sort((a, b) => Number(a.seed) - Number(b.seed));
  const valid = ordered.length === 16
    && new Set(ordered.map(row => String(row.team_id))).size === 16
    && ordered.every((row, index) => Number(row.seed) === index + 1)
    && new Set(ordered.slice(0, 4).map(row => row.division_name || row.div_name)).size === 4;
  if (!valid) throw new Error(`${conference} playoff seeds are missing or incomplete in the latest Madden export.`);
  return { seeds: ordered.slice(0, 7), hunt: ordered.slice(7), ordered };
}
