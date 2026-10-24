// A hit-count ailment is consumed per logical hit, not per result component or
// recipient. Its presence is latched for the cast (July 24 rollback behavior).
export function beginConfusionAttack(unit){
 const active=(unit.confusionHits||0)>0,seen=new Set();
 return {active,hit(index){if(!active||seen.has(index))return;seen.add(index);unit.confusionHits=Math.max(0,(unit.confusionHits||0)-1);}};
}
