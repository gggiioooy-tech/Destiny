import {roleCount} from './passiveRules.js';
import {rollEffect} from './combatDamage.js';

// Full-skill, six-transcendence rules. Simultaneous trigger/cleanse order is
// experimental; these secondary hits never recursively count as direct hits.
const succeeds=(source,target,chance,rng)=>rollEffect({baseChance:chance,accuracy:source.accuracy,resistance:target.resist},rng);
export function addReflux(source,target,turns,chance,rng){
  if(target.hp<=0||!succeeds(source,target,chance,rng))return false;
  target.reflux??=[];if(target.reflux.length>=7)return false;
  target.debuffSerial=(target.debuffSerial||0)+1;
  target.reflux.push({id:target.debuffSerial,source:source.id,attack:source.attack,remaining:turns,duration:turns});return true;
}
export function spreadReflux(host,entries,units,rng,events){
  for(const entry of entries){
    const source=units[entry.source];if(!source)continue;
    // A dead caster's existing effect continues; keep the attack snapshot.
    const snapshot={...source,attack:entry.attack};
    for(const target of units.filter(u=>u.side===host.side&&u.id!==host.id&&u.hp>0).slice(0,4))addReflux(snapshot,target,entry.duration,100,rng);
  }
  if(entries.length)events.push(host.name+' · 마력 역류 전이');
}
export function specialHitEffects(source,target,code,units,rng,{each=false}={}){
  if(target.hp<=0)return;
  if(source.name==='멜키르'&&roleCount(units,source.side,2)>=3&&((code===1&&!each)||(code===3&&each)))addReflux(source,target,2,50,rng);
  if(source.name==='밀리아'&&roleCount(units,source.side,2)>=3&&((code===3&&each)||([1,2].includes(code)&&!each))){
    if(succeeds(source,target,code===1?35:code===2?65:45,rng)){
      target.crystals??=[];target.debuffSerial=(target.debuffSerial||0)+1;
      target.crystals.push({id:target.debuffSerial,source:source.id,hits:code===3?4:5});
    }
  }
}
export function directDebuffHits(target,snapshot,units,rng,deal,events,elapsedMs){
  for(const entry of snapshot.reflux||[]){
    if(target.hp<=0)break;
    const source=units[entry.source];
    if(source){const amount=Math.min(target.maxHp*.15,entry.attack*.9)*Math.max(0,1+(source.damageIncrease||0)/100);deal(target,amount,source.id,'reflux');}
  }
  const ids=new Set((snapshot.crystals||[]).map(c=>c.id));
  for(const crystal of target.crystals||[])if(ids.has(crystal.id))crystal.hits--;
  detonateCrystals(target,units,rng,deal,events,elapsedMs);
}
export function detonateCrystals(target,units,rng,deal,events,elapsedMs){
  const burst=(target.crystals||[]).filter(c=>c.hits<=0);target.crystals=(target.crystals||[]).filter(c=>c.hits>0);
  for(const crystal of burst){
    if(target.hp<=0)break;deal(target,2435,crystal.source,'crystal');
    const source=units[crystal.source];
    if(target.hp>0&&source&&!target.cooldownImmune&&succeeds(source,target,100,rng))for(const key of [2,3])target.readyAt[key]=Math.max(target.readyAt[key]||0,elapsedMs)+14000;
    events.push(target.name+' · 수정 결정 폭발');
  }
}
export function crystalResonance(source,target,units,rng,deal,events,elapsedMs){
  if(!succeeds(source,target,100,rng))return;
  for(const crystal of target.crystals||[])crystal.hits-=4;
  detonateCrystals(target,units,rng,deal,events,elapsedMs);
}
export function tickReflux(unit,before,units,rng,events){
  const ids=new Set((before.reflux||[]).map(e=>e.id)),expired=[];
  unit.reflux=(unit.reflux||[]).filter(e=>{if(ids.has(e.id))e.remaining--;if(e.remaining<=0){expired.push(e);return false;}return true;});
  spreadReflux(unit,expired,units,rng,events);
}
export function applyLubuMark(source,target,rng,deal,events){
  if(target.hp<=0||!succeeds(source,target,100,rng))return;
  target.lubuMarks??={};target.lubuMarks[source.id]=(target.lubuMarks[source.id]||0)+1;
  if(target.lubuMarks[source.id]<2)return;
  target.lubuMarks[source.id]=0;deal(target,Math.min(target.maxHp*.16,source.attack*3.5),source.id,'lubu_mark');
  if(!source.buffBlock){const existing=source.panelTimedBuffs?.find(b=>b.source==='방천화극의 분노');if(existing)existing.remaining=5;else{source.weakBonus=(source.weakBonus||0)+28;source.panelTimedBuffs=[...(source.panelTimedBuffs||[]),{stat:'weakBonus',delta:28,remaining:5,source:'방천화극의 분노'}];}}
  events.push(target.name+' · 방천화극의 분노 2중첩');
}
