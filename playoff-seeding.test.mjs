import assert from 'node:assert/strict';
import test from 'node:test';
import { conferenceSeeds } from './playoff-seeding.mjs';

const conference = () => Array.from({ length: 16 }, (_, i) => ({
  team_id: i + 1, seed: i + 1, division_name: `AFC ${['East','North','South','West'][i % 4]}`,
  total_wins: 8, total_losses: 3, net_pts: (i + 1) * 100,
}));

test('preserves exported tiebreaker order despite tied records and reversed point differentials', () => {
  const rows = conference().reverse();
  const result = conferenceSeeds(rows, 'AFC');
  assert.deepEqual(result.seeds.map(row => row.seed), [1,2,3,4,5,6,7]);
  assert.deepEqual(result.hunt.map(row => row.seed), [8,9,10,11,12,13,14,15,16]);
  assert.equal(rows[0].seed, 16);
});

test('keeps division leaders 1–4 even when a wild card has a better record', () => {
  const rows = conference();
  rows[3].total_wins = 6;
  rows[4].total_wins = 10;
  assert.deepEqual(conferenceSeeds(rows, 'AFC').seeds.map(row => row.team_id), [1,2,3,4,5,6,7]);
});

test('separates conferences and accepts numeric seed strings', () => {
  const rows = conference();
  rows[0].seed = '1';
  const nfc = rows.map(row => ({ ...row, team_id: Number(row.team_id) + 100, division_name: row.division_name.replace('AFC', 'NFC') }));
  assert.equal(conferenceSeeds([...rows, ...nfc], 'NFC').seeds[0].team_id, 101);
});

test('does not invent seed order when the export is missing or duplicated', () => {
  const rows = conference();
  assert.throws(() => conferenceSeeds(rows.slice(1), 'AFC'), /incomplete/);
  rows[1].seed = 1;
  assert.throws(() => conferenceSeeds(rows, 'AFC'), /incomplete/);
  const duplicates = conference();
  duplicates[1].team_id = 1;
  assert.throws(() => conferenceSeeds(duplicates, 'AFC'), /incomplete/);
});
