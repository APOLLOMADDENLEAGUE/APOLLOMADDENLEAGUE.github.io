import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeamIdentity } from './team-identity.mjs';

test('keeps the latest cumulative record across regenerated team IDs', () => {
  const identity = createTeamIdentity();
  const old = { team_id:777781254, total_wins:4, total_losses:2, updated_at:'2026-09-16T05:21:49Z' };
  const current = { team_id:776994822, total_wins:8, total_losses:3, updated_at:'2026-10-04T05:16:13Z' };
  for (const rows of [[old,current],[current,old]]) {
    const result = identity.normalizePayload({ count:2, standings:rows });
    assert.equal(result.count,1);
    assert.deepEqual(result.standings,[{...current,team_id:777781254}]);
  }
  assert.equal(current.team_id,776994822);
});

test('resolves future ID changes by the franchise nickname', () => {
  const identity = createTeamIdentity([{team_id:123456,nick_name:'BlackCats'}]);
  assert.equal(identity.canonicalTeamId(123456),777781253);
  assert.equal(identity.canonicalTeamId(654321),654321);
  assert.deepEqual(new Set(identity.teamIdsFor(777781253)),new Set([777781253,776994821,123456]));
});

test('normalizes schedule, roster and weekly stat references together', () => {
  const result = createTeamIdentity().normalizePayload({
    games:[{schedule_id:42,away_team_id:776994822,home_team_id:776994848}],
    players:[{roster_id:99,team_id:776994822}],
    exports:[{items:[{statId:7,teamId:776994848,passYds:300}]}],
  });
  assert.deepEqual(result.games,[{schedule_id:42,away_team_id:777781254,home_team_id:777781280}]);
  assert.deepEqual(result.players,[{roster_id:99,team_id:777781254}]);
  assert.equal(result.exports[0].items[0].teamId,777781280);
  assert.equal(result.exports[0].items[0].passYds,300);
});

test('game team lists retain the box score stat count', () => {
  const data = createTeamIdentity().normalizePayload({game:{schedule_id:42},count:20,teams:[{team_id:776994822},{team_id:777781254}]});
  assert.equal(data.teams.length,1);
  assert.equal(data.count,20);
});
