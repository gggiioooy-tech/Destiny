import {setTimedBuff} from './timedEffects.js';
// Instrumented applications retain order. Initial simultaneous passives have
// no server timestamp, so their tie order remains the initialization order.
const fields=['barrierTurns','damageBuffTurns','controlImmune','superiority','immortal','stealth','linkTurns','cloneTurns','taunt','cooldownImmune','judgment','delayedTan'];
const durationFields=[...fields,'immunity','physicalImmunity','magicImmunity'];
function active(u,e){return e.key==='timed'?u.panelTimedBuffs?.some(b=>b.buffId===e.id&&!b.debuff&&b.remaining>0):e.key==='regen'?u.regenBuff?.remaining>0:u[e.key]>0&&(e.key!=='barrierTurns'||u.barrier>0&&!u.barrierProtected)&&!(e.key==='controlImmune'&&u.transformed)&&!(e.key==='damageBuffTurns'&&u.panelComputed);}
export function syncBuffs(u){
  u.buffMaxTurns??={};
  for(const key of durationFields)if(Number.isFinite(u[key])&&u[key]>0)u.buffMaxTurns[key]=Math.max(u.buffMaxTurns[key]||0,u[key]);
  for(const b of u.panelTimedBuffs||[])if(!b.debuff&&b.remaining>0)b.maxTurns=Math.max(b.maxTurns||0,b.remaining);
  u.statusImmunityMaxTurns??={};
  for(const [name,turns]of Object.entries(u.statusImmunities||{}))if(Number.isFinite(turns)&&turns>0)u.statusImmunityMaxTurns[name]=Math.max(u.statusImmunityMaxTurns[name]||0,turns);
  if(u.regenBuff?.remaining>0)u.regenBuff.maxTurns=Math.max(u.regenBuff.maxTurns||0,u.regenBuff.remaining);
  u.buffOrder=(u.buffOrder||[]).filter(e=>active(u,e));
  const add=e=>{if(!u.buffOrder.some(v=>v.key===e.key&&v.id===e.id))u.buffOrder.push(e);};
  for(const key of fields)if(active(u,{key}))add({key});
  if(u.regenBuff?.remaining>0)add({key:'regen'});
  for(const b of u.panelTimedBuffs||[])if(!b.debuff&&b.remaining>0){b.buffId??=u.buffSerial=(u.buffSerial||0)+1;add({key:'timed',id:b.buffId});}
}
// Extension restores remaining duration up to the duration of the granted
// effect. It cannot resurrect an expired effect or shorten a four-turn shield.
export function extendBuffDurations(u,turns){
  if(!(turns>0))return;
  syncBuffs(u);u.buffExtensionTotals??={};
  for(const key of durationFields)if(Number.isFinite(u[key])&&u[key]>0){const added=Math.min(turns,Math.max(0,u.buffMaxTurns[key]-u[key]));u[key]+=added;u.buffExtensionTotals[key]=(u.buffExtensionTotals[key]||0)+added;}
  for(const b of u.panelTimedBuffs||[])if(!b.debuff&&b.remaining>0){const added=Math.min(turns,Math.max(0,b.maxTurns-b.remaining));b.remaining+=added;b.extensionTotal=(b.extensionTotal||0)+added;}
  u.statusImmunityExtensionTotals??={};
  for(const [name,left]of Object.entries(u.statusImmunities||{}))if(Number.isFinite(left)&&left>0){const added=Math.min(turns,Math.max(0,u.statusImmunityMaxTurns[name]-left));u.statusImmunities[name]+=added;u.statusImmunityExtensionTotals[name]=(u.statusImmunityExtensionTotals[name]||0)+added;}
  if(u.regenBuff?.remaining>0)u.regenBuff.remaining=Math.min(u.regenBuff.maxTurns,u.regenBuff.remaining+turns);
}
export function grantDelayedBuff(u,turns=2){
  if(u.hp<=0||u.buffBlock)return;
  u.delayedTan=Math.max(u.delayedTan||0,turns);u.buffMaxTurns={...u.buffMaxTurns,delayedTan:Math.max(u.buffMaxTurns?.delayedTan||0,turns)};
  u.delayedTanEpoch=(u.delayedTanEpoch||0)+1;syncBuffs(u);
}
export function expireDelayedBuff(u){
  if(u.hp<=0||u.buffBlock)return;
  u.nullify=Math.max(u.nullify||0,3);
  setTimedBuff(u,'attack',25,2,{ratio:true,source:'지연 버프'});
}
export function dispelBuffs(u,count){
  syncBuffs(u);let removed=0,died=false;
  for(const entry of [...u.buffOrder]){
    if(removed>=count)break;
    if(entry.key==='timed'){const i=u.panelTimedBuffs.findIndex(b=>b.buffId===entry.id);const [buff]=u.panelTimedBuffs.splice(i,1);u[buff.stat]-=buff.delta;}
    else if(entry.key==='regen')delete u.regenBuff;
    else {u[entry.key]=0;if(entry.key==='barrierTurns')u.barrier=0;if(entry.key==='immortal'){u.hp=0;u.barrier=0;died=true;}}
    u.buffOrder=u.buffOrder.filter(e=>e!==entry);removed++;
    if(died)break;
  }
  return {removed,died};
}
export function reduceBuffDurations(u,turns){
  const hadImmortal=u.immortal>0,hadDelayed=u.delayedTan>0;
  for(const key of [...fields,'immunity','physicalImmunity','magicImmunity'])if(Number.isFinite(u[key])&&u[key]>0&&!(key==='controlImmune'&&u.transformed))u[key]=Math.max(0,u[key]-turns);
  if(!u.barrierTurns)u.barrier=0;
  u.panelTimedBuffs=(u.panelTimedBuffs||[]).filter(b=>{if(b.debuff)return true;b.remaining=Math.max(0,b.remaining-turns);if(b.remaining)return true;u[b.stat]-=b.delta;return false;});
  if(u.regenBuff){u.regenBuff.remaining-=turns;if(u.regenBuff.remaining<=0)delete u.regenBuff;}
  const died=hadImmortal&&!u.immortal;if(died){u.hp=0;u.barrier=0;}
  if(hadDelayed&&!u.delayedTan)expireDelayedBuff(u);
  syncBuffs(u);return {died};
}
