import { canonicalizeHeroText, compactHeroText } from './businessRules.js';
const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
export function getKoreanInitials(value) {
  return Array.from(String(value || '').normalize('NFC'), char => {
    const code = char.charCodeAt(0) - 0xac00;
    return code >= 0 && code <= 11171 ? INITIALS[Math.floor(code / 588)] : char;
  }).join('');
}
export function searchTokens(query) {
  return String(query || '').normalize('NFC').trim().split(/[\s,，/、;]+/u).filter(Boolean);
}
export function matchesHeroSearch(hero, query) {
  const text = compactHeroText(canonicalizeHeroText(String(hero || '').normalize('NFC')));
  const keyword = compactHeroText(canonicalizeHeroText(String(query || '').normalize('NFC')));
  if (!keyword) return false;
  // Match each typed consonant against the initial at the same position.
  const initials = getKoreanInitials(text);
  for (let start = 0; start <= text.length - keyword.length; start++) {
    if (Array.from(keyword).every((char, i) => char === text[start + i] || (INITIALS.includes(char) && char === initials[start + i]))) return true;
  }
  return false;
}
export function matchesEnemyTeamSearch(team, query) {
  const tokens = searchTokens(query);
  if (!tokens.length) return false;
  const heroes = Array.isArray(team.heroes) ? team.heroes : String(team.heroes || '').split(/[,，\n/、;]+/u);
  if (tokens.every(token => heroes.some(hero => matchesHeroSearch(hero, token)))) return true;
  // Keep the existing single-keyword team-title search.
  return tokens.length === 1 && matchesHeroSearch(team.title, tokens[0]);
}
