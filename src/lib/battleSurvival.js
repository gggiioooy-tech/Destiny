import {applyShield} from './shieldEffects.js';
import {grantNullification} from './nullificationEffects.js';
import {resetRevivalDebuffs} from './statusEffects.js';
import {releaseControl} from './controlEffects.js';

// Explicit experimental ordering: immunity → nullification → blessing → shield → HP
// → immortality/guts → revival. Complex simultaneous trigger order remains unverified.
export function damageImmune(unit,{pierce=false,execute=false,deferred=false,damageType}={}){return !pierce&&!execute&&!deferred&&(unit.immunity>0||damageType==='physical'&&unit.physicalImmunity>0||damageType==='magic'&&unit.magicImmunity>0);}
export function receiveDamage(unit,amount,{pierce=false,execute=false,deferred=false,fixed=false,damageType}={}){
  const target={...unit},events=[];
  const result={target,events,damage:0,absorbed:0,kind:'damage'};
  if(target.hp<=0)return result;
  if(damageImmune(target,{pierce,execute,deferred,damageType})){result.kind='immune';events.push('피해 면역');return result;}
  // Penetration bypasses immunity, not hit-count nullification.
  if(!execute&&!deferred&&target.nullify>0){target.nullify--;result.kind='nullify';events.push('피해 무효화');return result;}
  if(!execute&&target.indomitableHits>0){
    target.indomitableHits--;target.hp=target.indomitableHits>0?1:0;
    result.kind='indomitable';result.damage=target.hp===0?1:0;events.push(target.hp?'불굴 · 남은 피격 '+target.indomitableHits+'회':'불굴 만료 · 사망');return result;
  }
  let pending=Math.max(0,Math.round(amount));
  if(!execute&&!deferred&&target.reductionHits>0){pending=Math.round(pending*(1-(target.hitReduction||0)/100));target.reductionHits--;}
  if(!execute&&!deferred&&!fixed&&target.blessing>0)pending=Math.min(pending,Math.floor(target.maxHp*target.blessing/100));
  result.absorbed=execute||deferred?0:Math.min(target.barrier||0,pending);target.barrier=(target.barrier||0)-result.absorbed;pending-=result.absorbed;
  const before=target.hp;target.hp=execute?0:Math.max(0,before-pending);
  if(!execute&&target.immortal>0)target.hp=Math.max(1,target.hp);
  const ringGuts=['daegwon','gwonbul'].includes(target.ring);
  if(!execute&&target.hp===0&&(target.guts||ringGuts)&&!target.gutsUsed){
    target.hp=1;target.gutsUsed=true;events.push('권능');
    if(target.name==='델론즈'){grantNullification(target,4);target.awakenGauge=Math.min(target.awakenMax||85,(target.awakenGauge||0)+25);}
    const shieldPercent=Math.max(ringGuts?150:0,target.gutsShieldPercent||0),ringShield=ringGuts&&150>=(target.gutsShieldPercent||0);
    if(shieldPercent)applyShield(target,target.attack*shieldPercent/100,ringShield?4:3,{unremovable:ringShield});
  }
  if(execute){if(target.guts||ringGuts)target.gutsUsed=true;target.immortal=0;target.indomitableHits=0;target.barrier=0;events.push('처형');}
  if(target.revivePercent&&target.revived)target.ringReviveUsed=true;
  if(target.reviveImmortalTurns&&target.revived)target.ringImmortalUsed=true;
  if(target.hp===0&&!target.annihilation){
    if(['daebul','daegwon'].includes(target.ring)&&!target.ringReviveUsed){target.hp=target.maxHp;target.ringReviveUsed=true;if(target.revivePercent)target.revived=true;events.push('반지 · 생명력 100% 부활');}
    else if(['daebul','gwonbul'].includes(target.ring)&&!target.ringImmortalUsed){target.hp=1;target.immortal=Math.max(3,target.reviveImmortalTurns||0);target.controlImmune=Math.max(target.controlImmune||0,target.immortal);target.ringImmortalUsed=true;if(target.reviveImmortalTurns)target.revived=true;events.push('반지 · 불사 '+target.immortal+'턴 부활');}
    if(events.some(e=>e.startsWith('반지 · '))){target.revivalCount=(target.revivalCount||0)+1;resetRevivalDebuffs(target);}
  }
  if(target.hp===0&&!target.annihilation&&!target.revived){
    if(target.reviveIndomitableHits){target.hp=1;target.indomitableHits=target.reviveIndomitableHits;target.revived=true;events.push('불굴 부활');}
    else if(target.reviveImmortalTurns){target.hp=1;target.immortal=target.reviveImmortalTurns;target.controlImmune=target.reviveImmortalTurns;target.revived=true;events.push('불사 부활');}
    else if(target.revivePercent){target.hp=Math.max(1,Math.round(target.maxHp*target.revivePercent/100));target.revived=true;events.push('부활');}
    if(target.revived){
      target.revivalCount=(target.revivalCount||0)+1;
      resetRevivalDebuffs(target);
      if(target.reviveImmunity)target.immunity=target.reviveImmunity;
      target.dots=[];
    }
  }
  // Revival HP is a separate recovery; immortality and guts cannot lose the
  // final point of HP. Do not count blocked lethal damage as life steal input.
  result.damage=Math.min(before,pending);
  if(target.immortal>0&&!events.includes('불사 부활')&&!events.some(e=>e.startsWith('반지 · '))||events.includes('권능'))result.damage=Math.min(result.damage,Math.max(0,before-1));
  return result;
}
export function tickPersonalTurn(unit,before){
  const next={...unit},events=[];
  // A buff acquired during this action must not lose a turn just because an
  // unrelated timed buff already existed at action start.
  if(unit.panelTimedBuffs){
    const previous=before.panelTimedBuffs||[];next.panelTimedBuffs=[];
    for(const buff of unit.panelTimedBuffs){const old=previous.find(b=>b.source===buff.source&&b.stat===buff.stat&&b.delta===buff.delta);const extended=(buff.extensionTotal||0)-(old?.extensionTotal||0);const remaining=old&&(buff.refreshEpoch||0)===(old.refreshEpoch||0)&&buff.remaining-extended<=old.remaining?buff.remaining-1:buff.remaining;if(remaining>0)next.panelTimedBuffs.push({...buff,remaining});else next[buff.stat]-=buff.delta;}
  }
  if(before.statusImmunities){next.statusImmunities={...next.statusImmunities};for(const [key,turns]of Object.entries(before.statusImmunities)){const extended=(next.statusImmunityExtensionTotals?.[key]||0)-(before.statusImmunityExtensionTotals?.[key]||0);if((next.statusImmunityEpochs?.[key]||0)===(before.statusImmunityEpochs?.[key]||0)&&next.statusImmunities[key]-extended<=turns)next.statusImmunities[key]=Math.max(0,next.statusImmunities[key]-1);}}
  if(before.fateThreadDurations?.length){next.fateThreadDurations=(next.fateThreadDurations||[]).map((v,i)=>i<before.fateThreadDurations.length?v-1:v).filter(v=>v>0);next.fateThreads=next.fateThreadDurations.length;}
  // Only durations that existed before this basic-attack turn are ticked.
  for(const key of ['sleep','control','silence','blind','healBlock','defTurns','immunity','physicalImmunity','magicImmunity','controlImmune','annihilation','barrierTurns','damageBuffTurns','superiority','superiorityMissTurns','blockDownTurns','stealth','judgment','buffBlock','cooldownImmune','linkTurns','cloneTurns','taunt']){
    const extended=(next.buffExtensionTotals?.[key]||0)-(before.buffExtensionTotals?.[key]||0);
    if(before[key]>0&&next[key]>0&&next[key]-extended<=before[key]&&(key!=='barrierTurns'||(next.barrierEpoch||0)===(before.barrierEpoch||0)))next[key]--;
  }
  if(!next.defTurns)next.defDown=0;
  if(before.control>0&&!next.control)releaseControl(next);
  if(!next.superiorityMissTurns)next.superiorityMiss=0;
  if(before.blockDownTurns>0&&!next.blockDownTurns)next.blockDebuff=0;
  if(before.barrierTurns>0&&!next.barrierTurns){next.barrier=0;next.barrierProtected=false;}
  const extendedImmortal=(next.buffExtensionTotals?.immortal||0)-(before.buffExtensionTotals?.immortal||0);
  if(before.immortal>0&&next.immortal>0&&next.immortal-extendedImmortal<=before.immortal){
    next.immortal--;
    if(!next.immortal){next.hp=0;next.barrier=0;events.push('불사 만료 · 사망');}
  }
  return {target:next,events};
}
