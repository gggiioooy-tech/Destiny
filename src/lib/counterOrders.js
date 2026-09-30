const compact = value => String(value || '').replace(/\s/g, '');
export function resolveOrderHero(value, heroes) {
  const name = compact(value);
  if (!name) return '';
  const exact = heroes.find(hero => compact(hero) === name);
  if (exact) return exact;
  const matches = heroes.filter(hero => {
    let index = 0;
    for (const char of compact(hero)) if (char === name[index]) index++;
    return index === name.length;
  });
  return matches.length === 1 ? matches[0] : '';
}
export function parseCounterOrder(value, heroes, kind) {
  try {
    const data = JSON.parse(value);
    if (data && Array.isArray(data.steps)) return { steps: data.steps, note: String(data.note || '') };
  } catch { /* Legacy text. */ }
  const text = String(value || '').trim();
  if (kind === 'speed') {
    const steps = ['', '', ''];
    if (!text) return { steps, note: '' };
    const rank = text.match(/^(.+?)\s*(?:속\s*)?([123])등$/);
    if (rank) {
      const hero = resolveOrderHero(rank[1], heroes);
      if (hero) { steps[Number(rank[2]) - 1] = hero; return { steps, note: '' }; }
    }
    const comments = text.match(/\([^)]*\)/g) || [];
    const main = text.replace(/\([^)]*\)/g, '').trim();
    const parts = main.split(/\s*(?:->|→|>|\n|,)\s*/).filter(Boolean);
    const parsed = parts.map(part => resolveOrderHero(part, heroes));
    if (parts.length <= 3 && parsed.every(Boolean) && new Set(parsed).size === parsed.length) {
      parsed.forEach((hero, index) => { steps[index] = hero; });
      return { steps, note: comments.join('\n') };
    }
    // Keep ambiguous instructions intact rather than choosing a hero on the author's behalf.
    return { steps, note: text };
  }
  const steps = [];
  let cursor = 0;
  const pattern = /([^12]+?)(각성기|각성|스킬\s*[12]|[12]\s*스?)/g;
  let match;
  while ((match = pattern.exec(text))) {
    const hero = resolveOrderHero(match[1].replace(/^[\s→>,\-]+/, ''), heroes);
    if (!hero || text.slice(cursor, match.index).trim()) return { steps: Array.from({length:3}, () => ({hero:'',skill:''})), note: text };
    steps.push({ hero, skill: /각성/.test(match[2]) ? '각성기' : match[2].includes('1') ? '1' : '2' });
    cursor = pattern.lastIndex;
  }
  if (text.slice(cursor).trim()) return { steps: Array.from({length:3}, () => ({hero:'',skill:''})), note: text };
  return { steps: steps.length ? steps : Array.from({length:3}, () => ({hero:'',skill:''})), note: '' };
}
export function describeCounterOrder(value, heroes, kind) {
  const { steps, note } = parseCounterOrder(value, heroes, kind);
  return [...steps.map((step, index) => kind === 'speed'
    ? (step ? `속공순서${index + 1}: ${step}` : '')
    : (step.hero ? `스킬순서${index + 1}: ${step.hero} ${step.skill === '각성기' ? '각성기' : step.skill ? `스킬${step.skill}` : ''}` : '')).filter(Boolean), note].filter(Boolean).join('\n');
}
