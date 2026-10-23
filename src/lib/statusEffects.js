import {releaseControl} from './controlEffects.js';
const scalars=[['control',['controlName','shockSource','controlSource']],['sleep',[]],['silence',[]],['blind',[]],['healBlock',[]],['buffBlock',[]],['defTurns',['defDown']],['annihilation',[]],['instantDeathTurns',['instantDeathStacks']],['blockDownTurns',['blockDebuff']],['superiorityMissTurns',['superiorityMiss']]];
export function rememberDebuff(unit,key,ref=null){
  unit.debuffOrder??=[];
  if(!unit.debuffOrder.some(e=>e.key===key&&e.ref===ref))unit.debuffOrder.push({key,ref});
}
export function syncDebuffs(unit){
  unit.debuffOrder=(unit.debuffOrder||[]).filter(e=>active(unit,e));
  for(const [key]of scalars)if(unit[key]>0)rememberDebuff(unit,key);
  for(const key of ['reflux','crystals'])for(const e of unit[key]||[])rememberDebuff(unit,key,e.id);
  for(const [source,count]of Object.entries(unit.palMarks||{}))if(count>0)rememberDebuff(unit,'palMarks',Number(source));
  for(const d of unit.dots||[])if(!d.unremovable){if(!d.effectId)d.effectId=unit.effectSerial=(unit.effectSerial||0)+1;rememberDebuff(unit,'dots',d.effectId);}
  for(const b of unit.panelTimedBuffs||[])if(b.debuff){if(!b.effectId)b.effectId=unit.effectSerial=(unit.effectSerial||0)+1;rememberDebuff(unit,'panelTimedBuffs',b.effectId);}
}
function active(unit,entry){
  if(entry.key==='palMarks')return unit.palMarks?.[entry.ref]>0;
  if(['reflux','crystals'].includes(entry.key))return unit[entry.key]?.some(e=>e.id===entry.ref);
  if(['dots','panelTimedBuffs'].includes(entry.key))return unit[entry.key]?.some(e=>e.effectId===entry.ref&&!e.unremovable);
  return unit[entry.key]>0;
}
export function cleanseDebuffs(unit,count=Infinity,{controlOnly=false}={}){
  syncDebuffs(unit);let removed=0;
  unit.debuffOrder=unit.debuffOrder.filter(e=>active(unit,e));
  for(const entry of [...unit.debuffOrder]){
    if(removed>=count)break;
    if(controlOnly&&!['control','sleep','silence','blind'].includes(entry.key))continue;
    const scalar=scalars.find(([key])=>key===entry.key);
    if(scalar){if(entry.key==='control')releaseControl(unit);else{unit[entry.key]=0;for(const key of scalar[1]){if(typeof unit[key]==='number')unit[key]=0;else delete unit[key];}}}
    else if(entry.key==='palMarks')delete unit.palMarks[entry.ref];
    else {const key=entry.key,field=['reflux','crystals'].includes(key)?'id':'effectId',index=unit[key].findIndex(e=>e[field]===entry.ref),[effect]=unit[key].splice(index,1);if(key==='panelTimedBuffs')unit[effect.stat]-=effect.delta;}
    unit.debuffOrder=unit.debuffOrder.filter(e=>e!==entry);removed++;
  }
  return removed;
}
export function clearDebuffs(unit){return cleanseDebuffs(unit,Infinity);}
export function extendDebuffs(unit,turns){
  for(const [key]of scalars)if(unit[key]>0&&unit.debuffMaxTurns?.[key])unit[key]=Math.min(unit.debuffMaxTurns[key],unit[key]+turns);
  for(const key of ['dots','panelTimedBuffs'])for(const effect of unit[key]||[])if((key==='dots'||effect.debuff)&&effect.maxTurns)effect.remaining=Math.min(effect.maxTurns,effect.remaining+turns);
}
