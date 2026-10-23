// User-confirmed guild-war model: random ready skill, healing priority below
// approximately 60% HP. This threshold is an assumption, not a server constant.
export const AUTO_HEAL_THRESHOLD=.6;
export function chooseAutoSkill(candidates,units,side,rng){
  if(!candidates.length)return null;
  const injured=units.some(u=>u.side===side&&u.hp>0&&!u.healBlock&&!u.immortal&&!u.indomitableHits&&u.hp/u.maxHp<AUTO_HEAL_THRESHOLD);
  const dead=units.some(u=>u.side===side&&u.hp===0&&!u.annihilation);
  const revival=dead?candidates.filter(c=>c.spec.effects.some(e=>e.type==='revive')):[];
  const healing=injured?candidates.filter(c=>c.spec.effects.some(e=>e.type==='heal'||e.type==='drain')):[];
  // Confirmed by user: a ready awakening precedes healing after reservations.
  const awakening=candidates.filter(c=>c.code===7);
  const pool=awakening.length?awakening:revival.length?revival:healing.length?healing:candidates;
  return pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];
}
