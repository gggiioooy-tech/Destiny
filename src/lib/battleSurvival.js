import {calculateShield} from './combatDamage.js';

// Explicit experimental ordering: immunity → nullification → blessing → shield → HP
// → immortality/guts → revival. Complex simultaneous trigger order remains unverified.
export function receiveDamage(unit,amount,{pierce=false}={}){
  const target={...unit},events=[];
  const result={target,events,damage:0,absorbed:0,kind:'damage'};
  if(target.hp<=0)return result;
  if(target.immunity>0&&!pierce){result.kind='immune';events.push('피해 면역');return result;}
  // Penetration bypasses immunity, not hit-count nullification.
  if(target.nullify>0){target.nullify--;result.kind='nullify';events.push('피해 무효화');return result;}
  let pending=Math.max(0,Math.round(amount));
  if(target.blessing>0)pending=Math.min(pending,Math.floor(target.maxHp*target.blessing/100));
  result.absorbed=Math.min(target.barrier||0,pending);target.barrier=(target.barrier||0)-result.absorbed;pending-=result.absorbed;
  const before=target.hp;target.hp=Math.max(0,before-pending);
  if(target.immortal>0)target.hp=1;
  if(target.hp===0&&target.guts&&!target.gutsUsed){
    target.hp=1;target.gutsUsed=true;events.push('권능');
    target.barrier=Math.max(target.barrier,calculateShield({base:target.attack*(target.gutsShieldPercent||0)/100,regeneration:target.regeneration||0}));
  }
  if(target.hp===0&&!target.annihilation&&!target.revived){
    if(target.reviveImmortalTurns){target.hp=1;target.immortal=target.reviveImmortalTurns;target.controlImmune=target.reviveImmortalTurns;target.revived=true;events.push('불사 부활');}
    else if(target.revivePercent){target.hp=Math.max(1,Math.round(target.maxHp*target.revivePercent/100));target.revived=true;events.push('부활');}
  }
  result.damage=Math.min(before,pending);return result;
}
export function tickPersonalTurn(unit,before){
  const next={...unit},events=[];
  // Only durations that existed before this basic-attack turn are ticked.
  for(const key of ['sleep','defTurns','immunity','controlImmune','annihilation','barrierTurns','damageBuffTurns']){
    if(before[key]>0&&next[key]>0&&next[key]<=before[key])next[key]--;
  }
  if(!next.defTurns)next.defDown=0;
  if(before.barrierTurns>0&&!next.barrierTurns)next.barrier=0;
  if(before.immortal>0&&next.immortal>0&&next.immortal<=before.immortal){
    next.immortal--;
    if(!next.immortal){next.hp=0;next.barrier=0;events.push('불사 만료 · 사망');}
  }
  return {target:next,events};
}
