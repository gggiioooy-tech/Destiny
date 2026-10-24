// Visible set stats are already in the hero panel. Only non-panel effects are
// added here. Source: NamuWiki Re:BIRTH equipment table, checked 2026-10-23.
import {applyShield} from './shieldEffects.js';
export const RING_SHIELDS=[
  {id:'none',name:'없음 · 확인 안 됨'},
  {id:'vigor',name:'기합 · 공격력 90%',scale:'attack',value:.9},
  {id:'ironwall',name:'철벽 · 방어력 100%',scale:'defense',value:1},
  {id:'health',name:'건강 · 최대 생명력 18%',scale:'maxHp',value:.18},
];
export const EQUIPMENT_SETS=[
  {id:'none',name:'4세트 없음 · 혼합',description:'선택한 별도 4세트 효과 없음'},
  {id:'vanguard',name:'선봉장',description:'공격력·효과 적중은 정보창 수치에 포함'},
  {id:'tracker',name:'추적자',description:'약점 공격 피해 +35%'},
  {id:'paladin',name:'성기사',description:'받는 회복량 +20%'},
  {id:'gatekeeper',name:'수문장',description:'막기 피해 감소율 +10%'},
  {id:'guardian',name:'수호자',description:'방어력·효과 저항은 정보창 수치에 포함'},
  {id:'assassin',name:'암살자',description:'방어 무시 +15%'},
  {id:'avenger',name:'복수자',description:'주는 피해량 +30% · 길드전에는 보스 보너스 없음'},
  {id:'shaman',name:'주술사',description:'효과 적용 확률 +10%'},
  {id:'coordinator',name:'조율자',description:'전투 시작 행동 제어 면역 1턴'},
];
export function applyEquipment(unit){
  const shield=RING_SHIELDS.find(v=>v.id===(unit.ringShield||'none'));
  if(!shield)throw Error('반지 시작 보호막 종류를 확인해 주세요.');
  const set=unit.equipmentSet||'none';if(!EQUIPMENT_SETS.some(v=>v.id===set))throw Error('장비 세트 종류를 확인해 주세요.');
  if(set==='tracker')unit.weakBonus=(unit.weakBonus||0)+35;
  if(set==='assassin')unit.defenseIgnore=(unit.defenseIgnore||0)+.15;
  if(set==='avenger'){unit.damageIncrease=(unit.damageIncrease||0)+30;unit.refluxDamageIncrease=(unit.refluxDamageIncrease||0)+30;}
  if(set==='paladin')unit.healingIncrease=(unit.healingIncrease||0)+20;
  if(set==='gatekeeper')unit.blockReduction=Math.min(100,(unit.blockReduction||50)+10);
  if(set==='shaman')unit.effectChanceBonus=(unit.effectChanceBonus||0)+10;
  if(set==='coordinator')unit.controlImmune=Math.max(unit.controlImmune||0,1);
  // Explicit user equipment input only; never infer this from observed HP,
  // barriers or a historical battle outcome. Native shields do not add to it.
  if(shield.scale)applyShield(unit,unit[shield.scale]*shield.value,2);
}
