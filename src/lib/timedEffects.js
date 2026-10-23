// Same ordinary debuff family uses the strongest value, not an additive stack.
// Mixed-source duration refresh is conservative until its overwrite order is verified.
import {syncDebuffs} from './statusEffects.js';
import {syncBuffs} from './buffEffects.js';
export function setTimedDebuff(target,stat,value,remaining){
  const source='일반 디버프 · '+stat;
  target.panelTimedBuffs??=[];
  const existing=target.panelTimedBuffs.find(b=>b.source===source);
  const base=(target[stat]||0)-(existing?.delta||0),desired=Math.max(base,value,existing?.value||0);
  target[stat]=desired;
  if(existing){existing.delta=desired-base;existing.value=Math.max(existing.value,value);existing.remaining=Math.max(existing.remaining,remaining);}
  else target.panelTimedBuffs.push({stat,delta:desired-base,value,remaining,source,debuff:true});
  syncDebuffs(target);
}
export function setTimedBuff(target,stat,value,remaining,{ratio=false}={}){
  if(target.buffBlock)return;
  syncBuffs(target);
  const source='일반 버프 · '+stat;target.panelTimedBuffs??=[];
  const existing=target.panelTimedBuffs.find(b=>b.source===source),base=target.panelStackBase?.[stat]??((target[stat]||0)-(existing?.delta||0));
  const delta=ratio?base*value/100:value;
  if(existing){if(delta>existing.delta){target[stat]+=delta-existing.delta;existing.delta=delta;}existing.remaining=Math.max(existing.remaining,remaining);}
  else{target[stat]=(target[stat]||0)+delta;target.panelTimedBuffs.push({stat,delta,remaining,source});}syncBuffs(target);
}
export function setTimedDecrease(target,stat,value,remaining,{ratio=false}={}){
  target.panelTimedBuffs??=[];const source='감소 디버프 · '+stat,old=target.panelTimedBuffs.find(b=>b.source===source),base=target.panelStackBase?.[stat]??((target[stat]||0)-(old?.delta||0)),delta=-(ratio?base*value/100:value);
  if(old){if(delta<old.delta){target[stat]+=delta-old.delta;old.delta=delta;}old.remaining=Math.max(old.remaining,remaining);}
  else{target[stat]=(target[stat]||0)+delta;target.panelTimedBuffs.push({stat,delta,remaining,source,debuff:true});}syncDebuffs(target);
}
