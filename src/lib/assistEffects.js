import {heroProfile} from './simulationSkills.js';
import {heroDamageType} from './prebattleStats.js';
import {restoreHp} from './passiveRules.js';
import {cleanseDebuffs} from './statusEffects.js';
import {setTimedBuff} from './timedEffects.js';

// Hayeon's cover uses the helper's basic attack, including its friendly effects.
// These run once per assist, outside the enemy-recipient/hit loops.
export function applyAssistSupportEffects(source,spec,units,{before=false,rng=Math.random,onHeal=()=>{},onCleanse=()=>{}}={}){
 if(source.hp<=0)return;
 for(const e of spec?.effects||[]){
  if(e.group==='enemy'||Boolean(e.before)!==before)continue;
  let pool=(e.group==='self'?[source]:units.filter(u=>u.side===source.side&&u.hp>0)).filter(t=>(!e.excludeSelf||t.id!==source.id)&&(!e.roles||e.roles.includes(heroProfile(t.name)?.role))&&(!e.row||t.battleRow===e.row));
  if(e.group==='team')pool=pool.sort((a,b)=>e.targetPreference==='lowestHp'?a.hp-b.hp||a.id-b.id:a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id).slice(0,Math.min(3,e.targetCount||spec.allyTargets||3));
  for(const target of pool){
   if(e.targetCondition&&!(target[e.targetCondition.stat]>e.targetCondition.above)||rng()>=e.chance/100)continue;
   if(e.type==='heal'){const amount=restoreHp(target,source[e.scale]*e.value);source.healingDone=(source.healingDone||0)+amount;if(amount)onHeal(target,amount);}
   else if(e.type==='cleanse'){if(cleanseDebuffs(target,e.value??Infinity,{controlOnly:e.controlOnly}))onCleanse(target);}
   else if(e.type==='cooldownDown')for(const key of Object.keys(target.readyAt||{}))target.readyAt[key]=Math.max(0,target.readyAt[key]-e.value*1000);
   else if(e.type==='statTimed'){
    const typed=['attack','damageIncrease'].includes(e.stat)&&e.family!=='all';
    if(!typed||heroDamageType(target.name)===e.family)setTimedBuff(target,e.stat,e.value,e.duration,{ratio:e.ratio});
   }
  }
 }
}
