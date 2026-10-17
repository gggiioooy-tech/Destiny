import { resolveGameSide } from './gameNames.js';
const text=(v,n=100)=>typeof v==='string'&&v.length<=n;
export function collectorRecord(row,guild){
  const p=row?.payload;
  if(row?.kind!=='battle'||!/^pc-v1:[a-f0-9]{64}$/.test(row.sourceKey)||!text(row.occurredAt,40)||!Number.isFinite(Date.parse(row.occurredAt))||!p||p.sourceGuild!==guild||!/^\d{4}-\d{2}-\d{2}$/.test(p.warDate)||!['attack','defense'].includes(p.direction)||!['본성','내성1','내성2','내성3','외성1','외성2','외성3','외성4','외성5'].includes(p.castle)||typeof p.attackerWon!=='boolean'||!text(p.opponentGuild))throw new Error('PC 기록의 날짜·길드·전투 정보를 확인해 주세요.');
  function side(s){
    if(!s||!text(s.nickname)||!Array.isArray(s.heroes)||s.heroes.length!==3||!s.heroes.every(v=>text(v))||!Array.isArray(s.heroIds)||s.heroIds.length!==3||!s.heroIds.every(v=>Number.isSafeInteger(v)&&v>0)||!text(s.pet)||!Number.isSafeInteger(s.petId)||s.petId<0)throw new Error('PC 영웅 정보를 확인해 주세요.');
    const skills=Array.isArray(s.skills)&&s.skills.length<=3?s.skills.map(k=>{
      if(!text(k.hero)||!text(k.skill)||!s.heroIds.includes(k.heroId)||!Number.isSafeInteger(k.skillType)||!Number.isSafeInteger(k.order))throw new Error('PC 스킬 정보를 확인해 주세요.');
      return {hero:k.hero,skill:k.skill,heroId:k.heroId,skillType:k.skillType,order:k.order};
    }):[];
    return resolveGameSide({nickname:s.nickname,heroes:s.heroes,heroIds:s.heroIds,pet:s.pet,petId:s.petId,namesResolved:s.namesResolved===true,skills});
  }
  return {p_kind:'battle',p_source_key:row.sourceKey,p_occurred_at:row.occurredAt,p_payload:{warDate:p.warDate,direction:p.direction,sourceGuild:p.sourceGuild,opponentGuild:p.opponentGuild,periodSource:'owner-confirmed',castle:p.castle,attackerWon:p.attackerWon,attacker:side(p.attacker),defender:side(p.defender)}};
}
