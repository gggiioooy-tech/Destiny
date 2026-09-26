import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesEnemyTeamSearch as matches, matchesHeroSearch } from '../src/lib/heroSearch.js';
const team = { title: '테스트 방어팀', heroes: '윤건, 오목, 하연' };
test('names, initials and mixed queries are independent of hero order', () => {
  for (const q of ['ㅇㄱ', 'ㅇㄱ ㅇㅁ ㅎㅇ', '윤건 하연 오목', '하연, ㅇㅁ, 윤건', '  ㅎㅇ   ㅇㄱ  ㅇㅁ ', '윤ㄱ 오ㅁ ㅎ연', '윤건\n하연\n오목']) assert.equal(matches(team, q), true, q);
});
test('every requested hero must be present', () => {
  for (const q of ['', '윤건 여포', 'ㅇㄱ ㅇㅍ', '윤건하연오목']) assert.equal(matches(team, q), false, q);
});
test('aliases, spaced names and existing title searches remain available', () => {
  assert.equal(matches({ heroes: '칼 헤론, 프레이야, 델론즈' }, 'ㅋㅎㄹ 프레 델롱'), true);
  assert.equal(matches({ heroes: '칼 헤론, 프레이야' }, '칼 헤론 프레'), true);
  assert.equal(matches(team, 'ㅌㅅㅌ'), true);
  assert.equal(matchesHeroSearch('윤건', 'ㅇㄱ'), true);
  assert.equal(matchesHeroSearch('오목', 'ㅇㄱ'), false);
});
