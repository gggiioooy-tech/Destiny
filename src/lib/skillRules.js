import {addStack,restoreHp,roleCount} from './passiveRules.js';
import {rollEffect,casterEffect} from './combatDamage.js';
import {rememberDebuff} from './statusEffects.js';

export function buffCount(unit){
  const keys=new Set(unit.auraBuffs||[]);
  for(const key of ['immunity','nullify','controlImmune','immortal','indomitableHits','barrier','superiority','stealth','linkTurns','cloneTurns','cooldownImmune','reductionHits','blessing'])if(unit[key]>0)keys.add(key);
  if(unit.guts&&!unit.gutsUsed)keys.add('guts');
  for(const buff of unit.panelTimedBuffs||[])if(!buff.debuff)keys.add(buff.stat+'|'+buff.source);
  if(unit.seonStacks)keys.add('귀면');if(unit.poisonStacks)keys.add('독 축적');if(unit.rudyStance)keys.add('방어자세');
  return keys.size;
}
export function debuffCount(unit){
  const count=['control','sleep','silence','blind','healBlock','buffBlock','defTurns','annihilation','instantDeathTurns','blockDownTurns','superiorityMissTurns'].filter(k=>unit[k]>0).length;
  return count+(unit.dots||[]).length+(unit.reflux||[]).length+(unit.crystals||[]).length+(unit.panelTimedBuffs||[]).filter(b=>b.debuff).length;
}
export function conditionalDamage(source,target,code){
  if(source.name==='선란'&&code===2)return source.attack*.19*Math.floor(Math.min(6,source.seonStacks??3)/3);
  if(source.name==='탄지로'&&code===2)return source.attack*.09*Math.min(8,buffCount(target));
  if(source.name==='탄지로'&&code===3)return source.attack*.04*Math.min(8,debuffCount(target));
  if(source.name==='파이'&&target.dots?.some(d=>d.name==='화상'))return source.attack*.7;
  if(source.name==='스파이크'&&target.controlName==='빙결')return source.maxHp*.15;
  return 0;
}
export function extraCondition(condition,source,target,{critical,weak}){
  switch(condition.type){case 'always':return true;case 'critical':return critical;case 'weak':return weak;case 'slower':return target.speed<source.speed;case 'weaker':return target.attack<source.attack;case 'hpAbove':return target.hp/target.maxHp>=condition.value;case 'hpBelow':return target.hp/target.maxHp<=condition.value;case 'status':return condition.status==='방어력 증가'?target.rudyStance>0||target.auraBuffs?.some(k=>k.startsWith('defense|')):target.controlName===condition.status||target.dots?.some(d=>d.name===condition.status||condition.status==='중독'&&d.name==='극독');default:return false;}
}
export function beforeOwnSkill(source,code){
  if(source.name==='기유'&&code===7&&!source.buffBlock){source.markHits=10;source.markDefense=(source.panelStackBase?.defense||source.defense)*.5;source.defense+=source.markDefense;source.damageIncrease=(source.damageIncrease||0)+30;}
}
export function afterOwnHit(source){
  if(source.markHits>0&&--source.markHits===0){source.defense-=source.markDefense;source.markDefense=0;source.damageIncrease-=30;}
}
export function palanusMark(source,target,code,units,rng,reduceBuffs){
  if(source.name!=='팔라누스'||target.hp<=0||roleCount(units,source.side,3)<1||roleCount(units,source.side,4)<1)return;
  if(!rollEffect(casterEffect(source,target,code===1?50:100),rng))return;
  target.palMarks??={};const previous=target.palMarks[source.id]||0;target.palMarks[source.id]=Math.min(2,previous+1);rememberDebuff(target,'palMarks',source.id);
  if(previous<2&&target.palMarks[source.id]===2){reduceBuffs(target,1);if(!source.buffBlock){const old=source.palDamageStacks||0;source.palDamageStacks=Math.min(5,old+1);source.damageIncrease=(source.damageIncrease||0)+(source.palDamageStacks-old)*10;}}
}
export function afterOwnSkill(source,code,units,events){
  if(source.name!=='루디')return;
  if(code===3){
    for(const ally of units.filter(u=>u.side===source.side&&u.hp>0&&!u.buffBlock))ally.linkTurns=Math.max(ally.linkTurns||0,3);
    if(source.rudyStance>=4){const before=source.defense;for(const ally of units.filter(u=>u.side===source.side&&u.hp>0))restoreHp(ally,before*1.15);source.defense-=source.stackBases?.rudyStance*.15*source.rudyStance||0;source.rudyStance=0;events.push('루디 · 방어자세 4개 소모 · 아군 회복');}
  }
  if([2,3].includes(code))for(let i=0;i<2;i++)addStack(source,'rudyStance','defense',15,4);
  if(code===1)addStack(source,'rudyStance','defense',15,4);
  if(code===7)for(const ally of units.filter(u=>u.side===source.side&&u.hp>0&&!u.buffBlock))ally.linkTurns=Math.max(ally.linkTurns||0,3);
}
