// Instrumented applications retain order. Initial simultaneous passives have
// no server timestamp, so their tie order remains the initialization order.
const fields=['barrierTurns','damageBuffTurns','controlImmune','superiority','immortal','stealth','linkTurns','cloneTurns','taunt','cooldownImmune','judgment'];
function active(u,e){return e.key==='timed'?u.panelTimedBuffs?.some(b=>b.buffId===e.id&&!b.debuff&&b.remaining>0):e.key==='regen'?u.regenBuff?.remaining>0:u[e.key]>0&&(e.key!=='barrierTurns'||u.barrier>0)&&!(e.key==='controlImmune'&&u.transformed)&&!(e.key==='damageBuffTurns'&&u.panelComputed);}
export function syncBuffs(u){
  u.buffOrder=(u.buffOrder||[]).filter(e=>active(u,e));
  const add=e=>{if(!u.buffOrder.some(v=>v.key===e.key&&v.id===e.id))u.buffOrder.push(e);};
  for(const key of fields)if(active(u,{key}))add({key});
  if(u.regenBuff?.remaining>0)add({key:'regen'});
  for(const b of u.panelTimedBuffs||[])if(!b.debuff&&b.remaining>0){b.buffId??=u.buffSerial=(u.buffSerial||0)+1;add({key:'timed',id:b.buffId});}
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
  const hadImmortal=u.immortal>0;
  for(const key of [...fields,'immunity'])if(Number.isFinite(u[key])&&u[key]>0&&!(key==='controlImmune'&&u.transformed))u[key]=Math.max(0,u[key]-turns);
  if(!u.barrierTurns)u.barrier=0;
  u.panelTimedBuffs=(u.panelTimedBuffs||[]).filter(b=>{if(b.debuff)return true;b.remaining=Math.max(0,b.remaining-turns);if(b.remaining)return true;u[b.stat]-=b.delta;return false;});
  if(u.regenBuff){u.regenBuff.remaining-=turns;if(u.regenBuff.remaining<=0)delete u.regenBuff;}
  const died=hadImmortal&&!u.immortal;if(died){u.hp=0;u.barrier=0;}syncBuffs(u);return {died};
}
