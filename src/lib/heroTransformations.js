import {skillFor} from './simulationSkills.js';

// Numeric rules checked against the awakened Dellons skill tables, 2026-10-22.
export const TRANSFORMATION_SOURCE='https://www.namu.moe/w/델론즈(세븐나이츠%20리버스)/각성';
export function combatSkill(unit,code){
  const base=skillFor(unit.name,code);
  if(unit.name==='손오공'&&unit.cloneTurns>0&&base){
    const skill={...base,critBonus:100,unsupported:[],effects:[]};
    if(code===1)return {...skill,name:'기본 공격 · 분신',coefficient:.75,hits:2,effects:[{type:'control',group:'enemy',status:'석화',duration:1,chance:30}]};
    if(code===2)return {...skill,name:'환. 대봉승타격',coefficient:1.02,hits:3,hpRatio:.07,hpCap:1,ignore:.4,missingTargetMultiplier:.1};
    if(code===3)return {...skill,name:'환. 여의난참무',coefficient:.82,hits:3,ignore:.4,missingTargetMultiplier:.05,effects:[{type:'blockDown',group:'enemy',value:33,duration:3,chance:100,before:true}]};
  }
  if(unit.name!=='델론즈'||!base)return base;
  const skill={...base,unsupported:base.unsupported.filter(t=>!t.includes('변신 후')&&!t.includes('연속 발동'))};
  if(code===3)skill.repeatOnKill=true;
  if(!unit.transformed)return skill;
  if(code===1)return {...skill,name:'기본 공격 · 변신',coefficient:.3,hits:2,targets:3,effects:[],cooldownReduction:19,missingTargetCoefficient:.15};
  if(code===2)return {...skill,name:'사신의 심판',coefficient:.97,hits:2,targets:3,pierce:true,effects:[{type:'dispel',group:'enemy',value:2,chance:100}]};
  if(code===3)return {...skill,name:'사신난무',executeRatio:.3,executeCap:1.2};
  return skill;
}
export function addDellonsStacks(unit,count){
  const old=unit.dellonsStacks||0,next=Math.min(8,old+count);
  unit.critDamage+=(next-old)*16;unit.dellonsStacks=next;
}
export function transformDellons(actor,units){
  actor.transformed=true;actor.controlImmune=Infinity;
  for(const key of ['control','sleep','silence'])actor[key]=0;
  actor.nullify=Math.min(6,actor.nullify+4);
  for(const ally of units.filter(u=>u.side===actor.side&&u.id!==actor.id&&u.hp>0))ally.nullify=Math.min(6,ally.nullify+2);
  addDellonsStacks(actor,3);
}
