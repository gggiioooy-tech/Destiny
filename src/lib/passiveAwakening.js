import {restoreHp} from './passiveRules.js';
import {cleanseDebuffs} from './statusEffects.js';

export const hasPassiveAwakening=unit=>unit.name==='아리스';
export function awakeningGaugeLabel(unit){
  if(unit.passiveAwakenActive)return `각성 패시브 활성 · ${unit.awakenGauge}/${unit.awakenMax}`;
  if(unit.awakenUsed)return hasPassiveAwakening(unit)?'각성 패시브 종료':'각성기 사용 완료';
  return `각성 ${unit.awakenGauge}/${unit.awakenMax}`;
}
export function awakeningIgnore(unit,skillIgnore=0){return Math.max(skillIgnore,unit.passiveAwakenActive?.4:0);}

// Aris activates without an extra skill turn. Her counter is a separate timed
// reaction. Native passive auras are kept apart from removable timed debuffs.
export function refreshPassiveAwakenings(units,events=[]){
  for(const u of units){
    if(!hasPassiveAwakening(u))continue;
    if(u.passiveAwakenActive&&u.awakenGauge<=0)u.passiveAwakenActive=false;
    if(u.hp<=0||u.awakenUsed||u.awakenMax<=0||u.awakenGauge<u.awakenMax)continue;
    u.awakenUsed=true;u.passiveAwakenActive=true;u.awakenGauge=u.awakenMax;
    for(const ally of units.filter(v=>v.side===u.side&&v.hp>0)){
      u.healingDone=(u.healingDone||0)+restoreHp(ally,u.attack*.95);
      cleanseDebuffs(ally,2);
    }
    events.push('아리스 · 위태로운 공존 자동 활성화');
  }
  for(const target of units){
    const active=units.some(u=>u.side!==target.side&&u.hp>0&&u.passiveAwakenActive&&hasPassiveAwakening(u));
    target.awakeningHealingReduction=active?52:0;
    target.awakeningBlockDebuff=active?23:0;
  }
}
export function consumePassiveAwakeningTurn(unit){
  if(hasPassiveAwakening(unit)&&unit.passiveAwakenActive){
    // 75 -> 50 observed in 119 unambiguous personal-basic transitions.
    unit.awakenGauge=Math.max(0,unit.awakenGauge-Math.ceil(unit.awakenMax/3));
    if(!unit.awakenGauge)unit.passiveAwakenActive=false;
  }
}
export function queueAwakeningBlock(unit,queue,actionToken){
  if(unit.hp<=0||!hasPassiveAwakening(unit)||!unit.passiveAwakenActive)return;
  // All 114 observed damaging responses were once per owner/packet, even
  // when that packet contained two to four blocked damage results.
  if(actionToken!==undefined&&unit.awakeningBlockToken===actionToken)return;
  unit.awakeningBlockToken=actionToken;
  queue.push({source:unit.id,code:7,kind:'hero_passive',spec:{name:'아리스 · 위태로운 공존 막기 대응',targetDefense:1.78,hits:1,reduceBuff:2,ignore:.4}});
}
