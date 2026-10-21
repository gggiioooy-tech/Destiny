// Community model supplied by the user; not an independently verified game engine.
// Percent inputs are percentage points: 150 means 150%, not 1.5.
export const DEFENSE_COEFFICIENT=0.00214;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function criticalMultiplier(critDamage,elasticity,critical=true){
  return critical?Math.max(1,(critDamage-elasticity)/100):1;
}
export function hitProbabilities({crit,block=0,blockBuff=0,blockDebuff=0,shred=0}){
  // Cap positive block sources BEFORE subtracting debuffs and shred.
  const cappedBlock=clamp(block+blockBuff,0,100);
  const effectiveBlock=clamp(cappedBlock-blockDebuff-shred,0,100);
  const critical=clamp(crit-effectiveBlock,0,100)/100;
  const blocked=clamp(effectiveBlock-crit,0,100)/100;
  return {cappedBlock,effectiveBlock,critical,blocked,normal:1-critical-blocked};
}
export function defenseDenominator(defense,{increase=0,decrease=0,ignore=0}={}){
  return 1+Math.max(0,defense*(1+increase-decrease))*(1-clamp(ignore,0,1))*DEFENSE_COEFFICIENT;
}
export function calculateHit({base,defense,defenseDecrease=0,ignore=0,critDamage=150,elasticity=0,critical=false,blocked=false,blockReduction=50}){
  const crit=criticalMultiplier(critDamage,elasticity,critical);
  const block=blocked?1-clamp(blockReduction,0,100)/100:1;
  return Math.max(0,Math.round(base/defenseDenominator(defense,{decrease:defenseDecrease,ignore})*crit*block));
}
