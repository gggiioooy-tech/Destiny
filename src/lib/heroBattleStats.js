export const statColumns=[
 [['physicalAttack','물리 공격력'],['magicalAttack','마법 공격력'],['defence','방어력'],['hp','생명력'],['attackSpeed','속공'],['critical','치명타 확률',true],['criticalDamage','치명타 피해',true],['weakPoint','약점 공격 확률',true],['blockRate','막기 확률',true]],
 [['accuracyRate','효과 적중',true],['resistRate','효과 저항',true],['takeDamageRate','받는 피해 감소',true],['damageIncrease','피해 증폭',true],['fracture','파쇄',true],['resilience','탄성',true],['rejuvenation','재생',true]]
];
export const statKeys=new Set(statColumns.flat().map(([key])=>key));
export function formatHeroStat(value,percent=false){const n=Number.isSafeInteger(value)?value:0;return (percent?n/10:n).toLocaleString('ko-KR',{maximumFractionDigits:1})+(percent?'%':'');}
export function canViewHeroStats(user){return user?.role==='admin'&&user?.isOwner===true;}
export function resolvedHeroStats(id,stats,speeds,health){const values={...(stats?.find(v=>v.heroId===id)?.stats||{})};if(values.attackSpeed==null)values.attackSpeed=speeds?.find(v=>v.heroId===id)?.value??0;if(values.hp==null)values.hp=health?.find(v=>v.heroId===id)?.value??0;return values;}
