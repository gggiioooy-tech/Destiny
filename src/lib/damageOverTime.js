import {syncDebuffs} from './statusEffects.js';
export function addDot(target,entry){
  const family=entry.name==='극독'?'중독':entry.name==='용염'?'화상':entry.name;
  if(target.hp<=0||target.statusImmunities?.[family])return;
  target.effectSerial=(target.effectSerial||0)+1;
  target.dots=[...(target.dots||[]),{...entry,maxTurns:entry.remaining,effectId:target.effectSerial}];syncDebuffs(target);
}
export function dotBase(target,dot){
  const base=dot.scale==='targetHp'?Math.min(target.maxHp*dot.value,dot.cap?dot.attack*dot.cap:Infinity):dot.attack*dot.value;
  return dot.name==='출혈'?base*Math.min(5,(target.dots||[]).filter(d=>d.name==='출혈').length):base;
}
