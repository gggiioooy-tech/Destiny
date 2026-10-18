export const guildTabId = name => `guildWar:${name}`;
export const memoGuilds = memo => [...new Set(String(memo || '').split(',').map(x => x.trim()).filter(Boolean))];
export const heroNames = value => (Array.isArray(value) ? value : String(value || '').split(/[\n,]/)).map(x => typeof x === 'string' ? x.trim() : '').filter(Boolean);
export const heroKey = value => heroNames(value).map(x => x.replace(/\s/g, '').toLowerCase()).sort().join('|');
export function groupDefenses(defenses) {
  const groups = new Map();
  for (const row of Array.isArray(defenses) ? defenses : []) {
    const heroes = heroNames(row?.heroes);
    if (!heroes.length) continue;
    const castle = String(row.castle || '위치 미확인');
    const pet = typeof row.pet === 'string' ? row.pet.trim() : '';
    const key = JSON.stringify([castle, heroKey(heroes), pet]);
    const group = groups.get(key) || { key, castle, heroes, pet, members: [], count: 0 };
    group.count++; group.members.push(String(row.nickname || '닉네임 미확인')); groups.set(key, group);
  }
  return [...groups.values()].sort((a,b) => a.castle.localeCompare(b.castle,'ko',{numeric:true}) || b.count-a.count);
}
export function uniqueBattles(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = row.source_key;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function defenseCopyText(defenses) {
  const locations = ['외성1','외성2','외성3','외성4','외성5','내성1','내성2','내성3','본성'];
  const byCastle = new Map(); const total = new Map();
  function add(map, heroes) {
    const key = heroKey(heroes);
    const entry = map.get(key) || { heroes, count: 0 };
    entry.count++; map.set(key, entry);
  }
  for (const row of Array.isArray(defenses) ? defenses : []) {
    const heroes = heroNames(row?.heroes);
    if (!heroes.length) continue;
    const castle = row.castle || '위치 미확인';
    if (!byCastle.has(castle)) byCastle.set(castle, new Map());
    add(byCastle.get(castle), heroes); add(total, heroes);
  }
  if (!total.size) return '';
  const lines = map => [...map.values()].sort((a,b) => b.count-a.count || a.heroes.join(' ').localeCompare(b.heroes.join(' '),'ko')).map(row => `${row.heroes.join(' ')} x${row.count}`).join('\n');
  const names = [...locations, ...[...byCastle.keys()].filter(name => !locations.includes(name))];
  return [...names.filter(name => byCastle.has(name)).map(name => `${name}\n${lines(byCastle.get(name))}`), `종합\n${lines(total)}`].join('\n\n');
}
