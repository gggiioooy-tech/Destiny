// Match the model's existing strongest-value rule for ordinary healing-reduction
// debuffs, while retaining the independently cleansable stacked source.
export function reconcileHealingReduction(target){
 if(!target.healingReductionFamilyTracked)return;
 const entries=(target.panelTimedBuffs||[]).filter(e=>e.debuff&&e.stat==='healingReduction');
 const base=(target.healingReduction||0)-entries.reduce((n,e)=>n+(e.delta||0),0);
 let current=base;
 for(const entry of entries){const next=Math.max(current,entry.value||0);entry.delta=next-current;current=next;}
 target.healingReduction=current;
}
export function addHealingReductionStack(target,value=20,maxStacks=3){
 if(target.hp<=0)return;
 target.panelTimedBuffs??=[];target.healingReductionFamilyTracked=true;
 const source='황천의 동행자 · 회복량 감소';
 let entry=target.panelTimedBuffs.find(e=>e.source===source&&e.debuff);
 if(!entry){entry={source,stat:'healingReduction',delta:0,value:0,stacks:0,remaining:1,permanent:true,debuff:true};target.panelTimedBuffs.push(entry);}
 entry.stacks=Math.min(maxStacks,entry.stacks+1);entry.value=entry.stacks*value;
 reconcileHealingReduction(target);
}
