// Community model supplied by the user; not an independently verified game engine.
// Percent inputs are percentage points: 150 means 150%, not 1.5.
export const DEFENSE_COEFFICIENT=0.00214;
export const HERO_GROWTH=Object.freeze({transcendence:6,enhancement:5,skills:'full',label:'6초월 · 5강 · 풀스킬 강화'});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function effectProbability({baseChance,accuracy=0,resistance=0,chanceBonus=0}){
  const remainingResistance=clamp(resistance-accuracy,0,100)/100;
  const skillChance=clamp(baseChance*Math.max(0,1+chanceBonus/100),0,100)/100;
  return {remainingResistance,skillChance,applied:skillChance*(1-remainingResistance)};
}
export function casterEffect(source,target,baseChance,status){return {baseChance,accuracy:source.accuracy||0,resistance:target.control>0&&target.controlName==='공포'?0:target.resist||0,chanceBonus:(source.effectChanceBonus||0)+(status==='감전'?source.shockChanceBonus||0:0)};}
export function rollEffect(settings,random){
  const {remainingResistance,skillChance}=effectProbability(settings);
  if(random()<remainingResistance)return false;
  return random()<skillChance;
}
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
// Ordinary hits and separate reactions must apply the same target control
// rules before computing mutually exclusive critical/block/normal outcomes.
export function hitProbabilitiesFor(source,target,{critBonus=0}={}){
  const paralyzed=target.control>0&&target.controlName==='마비';
  return hitProbabilities({crit:(source.crit||0)+critBonus,block:paralyzed?0:target.block,blockBuff:paralyzed?0:target.blockBuff,
    blockDebuff:Math.max(target.blockDebuff||0,target.awakeningBlockDebuff||0),shred:source.shred});
}
export function defenseDenominator(defense,{increase=0,decrease=0,ignore=0}={}){
  return 1+Math.max(0,defense*(1+increase-decrease))*(1-clamp(ignore,0,1))*DEFENSE_COEFFICIENT;
}
export function calculateHit({base,defense,defenseDecrease=0,ignore=0,critDamage=150,elasticity=0,critical=false,blocked=false,blockReduction=50,weak=false,weakBonus=0,damageIncrease=0,vulnerability=0,damageReduction=0,amplification=0,missed=false}){
  const crit=criticalMultiplier(critDamage,elasticity,critical&&!missed);
  const block=blocked?1-clamp(blockReduction,0,100)/100:1;
  // The user-provided PvE calculator subtracts reduction in the vulnerability bucket.
  const factors=(weak&&!missed?Math.max(0,1.3+weakBonus/100):1)*Math.max(0,1+damageIncrease/100)*Math.max(0,1+(vulnerability-clamp(damageReduction,0,90))/100)*Math.max(0,1+amplification/100)*(missed?.8:1);
  return Math.max(0,Math.round(base/defenseDenominator(defense,{decrease:defenseDecrease,ignore})*crit*block*factors));
}
export function calculateRecovery({base,regeneration=0,increase=0,decrease=0,blocked=false,model='additive'}){
  if(blocked)return 0;
  // Combination is selectable because positive-regeneration replay evidence is missing.
  const factor=model==='separate'?(1+regeneration/100)*Math.max(0,1+(increase-decrease)/100):Math.max(0,1+(regeneration+increase-decrease)/100);
  return Math.max(0,Math.round(base*factor));
}
export function calculateShield({base,regeneration=0}){
  return Math.max(0,Math.round(base*(1+Math.max(0,regeneration)/100)));
}
export function convertedHealth({hp,maxHp,percent,immortal=false}){
  return Math.min(hp,Math.max(immortal&&hp>0?1:0,Math.round(maxHp*clamp(percent,0,100)/100)));
}
