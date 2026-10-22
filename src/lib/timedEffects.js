// Same ordinary debuff family uses the strongest value, not an additive stack.
// Mixed-source duration refresh is conservative until its overwrite order is verified.
export function setTimedDebuff(target,stat,value,remaining){
  const source='일반 디버프 · '+stat;
  target.panelTimedBuffs??=[];
  const existing=target.panelTimedBuffs.find(b=>b.source===source);
  const base=(target[stat]||0)-(existing?.delta||0),desired=Math.max(base,value,existing?.value||0);
  target[stat]=desired;
  if(existing){existing.delta=desired-base;existing.value=Math.max(existing.value,value);existing.remaining=Math.max(existing.remaining,remaining);}
  else target.panelTimedBuffs.push({stat,delta:desired-base,value,remaining,source,debuff:true});
}
