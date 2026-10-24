import {test} from 'node:test';
import assert from 'node:assert/strict';
import {criticalMultiplier,hitProbabilities,hitProbabilitiesFor,defenseDenominator,calculateHit,effectProbability,rollEffect,casterEffect,HERO_GROWTH} from '../src/lib/combatDamage.js';
test('all hero effects use fixed 6-transcendence +5 full-skills baseline',()=>{
  assert.equal(HERO_GROWTH.transcendence,6);assert.equal(HERO_GROWTH.enhancement,5);assert.equal(HERO_GROWTH.skills,'full');assert.ok(Object.isFrozen(HERO_GROWTH));
});
test('accuracy cancels resistance and never increases the base proc chance',()=>{
  assert.equal(effectProbability({baseChance:50,accuracy:30,resistance:100}).applied, .5*(1-.7));
  assert.equal(effectProbability({baseChance:50,accuracy:100,resistance:100}).applied,.5);
  assert.equal(effectProbability({baseChance:40,accuracy:300,resistance:0}).applied,.4);
  assert.equal(effectProbability({baseChance:100,accuracy:0,resistance:100}).applied,0);
  assert.equal(effectProbability({baseChance:50,resistance:-34}).applied,.5);
});
test('separate resistance and skill rolls are both respected',()=>{
  const config={baseChance:50,resistance:100,accuracy:30};
  let rolls=[.5,.1];assert.equal(rollEffect(config,()=>rolls.shift()),false);
  rolls=[.9,.7];assert.equal(rollEffect(config,()=>rolls.shift()),false);
  rolls=[.9,.2];assert.equal(rollEffect(config,()=>rolls.shift()),true);
});

test('fear fixes resistance at zero for shared effect checks without altering the stored stat',()=>{
 const target={resist:200,control:2,controlName:'공포'},source={accuracy:0};
 assert.equal(casterEffect(source,target,100).resistance,0);
 assert.equal(rollEffect(casterEffect(source,target,100),()=>.5),true);
 assert.equal(target.resist,200);
 for(const inactive of [{...target,control:0},{...target,controlName:'기절'}])assert.equal(casterEffect(source,inactive,100).resistance,200);
});
test('elasticity subtracts percentage points from critical damage, with 100% floor',()=>{
  for(const [crit,elasticity,result] of [[200,50,1.5],[150,0,1.5],[150,39,1.11],[150,60,1],[200,999,1]])assert.equal(criticalMultiplier(crit,elasticity),result);
  assert.equal(criticalMultiplier(200,99,false),1);
});
test('user critical 100 block 80 shred 30 example gives 50% critical',()=>{
  const p=hitProbabilities({crit:100,block:80,shred:30});
  assert.equal(p.critical,.5);assert.equal(p.blocked,0);assert.equal(p.normal,.5);
});
test('block caps positive sources before debuffs and shred',()=>{
  const p=hitProbabilities({crit:100,block:90,blockBuff:40,blockDebuff:20,shred:30});
  assert.equal(p.cappedBlock,100);assert.equal(p.effectiveBlock,50);assert.equal(p.critical,.5);
});
test('probability outcomes stay mutually exclusive and within bounds',()=>{
  for(const crit of [0,30,100,150])for(const block of [0,80,150])for(const shred of [0,30,150]){
    const p=hitProbabilities({crit,block,shred});
    for(const k of ['critical','blocked','normal'])assert.ok(p[k]>=0&&p[k]<=1);
    assert.ok(Math.abs(p.critical+p.blocked+p.normal-1)<1e-10);
  }
  assert.ok(Math.abs(hitProbabilities({crit:20,block:80}).blocked-.64)<1e-12);
});

test('independent critical and block procs cancel only when both occur',()=>{
 assert.deepEqual(hitProbabilities({crit:50,block:50}),{cappedBlock:50,effectiveBlock:50,critical:.25,blocked:.25,normal:.5});
 // Initial replay flags contain criticals below the block rate and blocks
 // above it. A percentage-difference model assigns these zero probability.
 const low=hitProbabilities({crit:13,block:28});assert.ok(low.critical>0);assert.ok(low.blocked>0);
 const high=hitProbabilities({crit:80,block:100,shred:48});assert.ok(Math.abs(high.critical-.384)<1e-12);assert.ok(Math.abs(high.blocked-.104)<1e-12);
});

test('active paralysis suppresses both block sources and expires without changing stored stats',()=>{
 const source={crit:35,shred:10},target={block:80,blockBuff:40,blockDebuff:5,awakeningBlockDebuff:23,control:2,controlName:'마비'};
 assert.deepEqual(hitProbabilitiesFor(source,target,{critBonus:15}),hitProbabilities({crit:50,block:0,blockBuff:0,blockDebuff:23,shred:10}));
 target.control=0;
 assert.deepEqual(hitProbabilitiesFor(source,target,{critBonus:15}),hitProbabilities({crit:50,block:80,blockBuff:40,blockDebuff:23,shred:10}));
 assert.equal(target.block,80);assert.equal(target.blockBuff,40);
});
test('published community defense and damage example reproduce arithmetic',()=>{
  const divisor=defenseDenominator(1044,{decrease:.6,ignore:.4});
  assert.equal(divisor,1.5361984);
  const damage=8965.6/divisor*4.4*3.16*1.3*2.53*1.58*1.04*1.5;
  assert.ok(Math.abs(damage-657835.5938501077)<1e-6);
});
test('actual hit math distinguishes critical, normal and blocked',()=>{
  const hit={base:1000,defense:0,critDamage:200,elasticity:50};
  assert.equal(calculateHit({...hit,critical:true}),1500);
  assert.equal(calculateHit(hit),1000);
  assert.equal(calculateHit({...hit,blocked:true}),500);
  assert.equal(calculateHit({...hit,blocked:true,blockReduction:100}),0);
  assert.equal(defenseDenominator(1800,{ignore:1}),1);
});
