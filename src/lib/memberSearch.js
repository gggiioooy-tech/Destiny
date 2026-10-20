import { matchesHeroSearch, searchTokens } from './heroSearch.js';
export function matchesMemberSearch(user, query) {
  const fields = [user.gameNickname, user.id, user.memo].map(value => String(value || '').normalize('NFC').toLocaleLowerCase('ko-KR'));
  return searchTokens(query).every(token => {
    const term = token.toLocaleLowerCase('ko-KR');
    return fields.some(value => value.includes(term) || matchesHeroSearch(value, term));
  });
}
