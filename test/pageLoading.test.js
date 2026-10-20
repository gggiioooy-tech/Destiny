import test from 'node:test';
import assert from 'node:assert/strict';
import { pageTables, pageQuery } from '../src/lib/pageData.js';
import { matchesMemberSearch } from '../src/lib/memberSearch.js';
test('tab queries do not fetch unrelated content or member profiles', () => {
  assert.deepEqual(pageTables('total', {role:'guest'}), []);
  assert.deepEqual(pageTables('members', {role:'member'}), []);
  assert.deepEqual(pageTables('attack', null), []);
  assert.deepEqual(pageTables('historyCounter', {role:'member'}), []);
  assert.deepEqual(pageTables('board', {role:'member'}), []);
  assert.deepEqual(pageTables('members', {role:'admin'}), ['profiles']);
  assert.deepEqual(pageTables('guildWar:서리', {role:'guest'}), []);
  assert.deepEqual(pageTables('guildWar:서리', {role:'admin'}), ['enemy_defense_teams']);
  assert.deepEqual(pageTables('total', {role:'member'}), ['total_war_teams']);
  assert.deepEqual(pageTables('attack', {role:'member'}), ['enemy_defense_teams','attack_teams']);
});
test('tab requests retain ordering, range and cancellation', () => {
  const calls = [], signal = new AbortController().signal;
  const builder = { select(...v){calls.push(['select',...v]);return this;}, order(...v){calls.push(['order',...v]);return this;}, range(...v){calls.push(['range',...v]);return this;}, abortSignal(v){calls.push(['signal',v]);return this;} };
  pageQuery({from(table){calls.push(['from',table]);return builder;}}, 'enemy_defense_teams', signal);
  assert.deepEqual(calls, [['from','enemy_defense_teams'],['select','*'],['order','sort_order'],['range',0,5000],['signal',signal]]);
});
test('members can be found by nickname, id, guild and mixed initials', () => {
  const user = {gameNickname:'눈꽃기사',id:'GuildUser15',memo:'서리, 철폐'};
  for (const query of ['', '눈꽃', 'ㄴㄲㄱㅅ', 'guilduser15', 'ㅅㄹ', '철폐', 'ㄴㄲ, ㅅㄹ', 'GUILDUSER ㅊㅍ']) assert.equal(matchesMemberSearch(user,query),true,query);
  for (const query of ['없는회원', '서리 티니핑', 'ㄴㄲ 다른길드']) assert.equal(matchesMemberSearch(user,query),false,query);
  assert.equal(matchesMemberSearch({},'서리'),false);
});
