import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
import {actionTiming} from '../src/lib/battleTiming.js';

function fixture(name,slot=3,seed=1){
  const h=changeHero(prepareHeroes(),slot,name);
  for(const u of h){u.maxHp=1000000;u.attack=10;u.defense=0;u.crit=0;u.resist=100;u.accuracy=0;u.weakPoint=0;}
  const b=createBattle(h,{seed});for(const u of b.units)u.nullify=0;return b;
}
test('Rad party hit counter triggers a separate fixed 1485 piercing attack with observed duration',()=>{
  const b=fixture('라드그리드');for(const u of b.units.filter(u=>u.side==='attacker'))u.immunity=3;
  const next=advanceBattle(b),rows=next.impacts.filter(r=>r.kind==='rad_fixed');
  assert.equal(rows.length,3);assert.ok(rows.every(r=>r.damage+r.absorbed===1485));
  assert.equal(next.reactions.length,1);assert.equal(next.units[3].alliedHits,4);
  assert.equal(next.reactions[0].endMs-next.reactions[0].startMs,744);
  assert.equal(next.units[3].actions,0);assert.equal(next.turn,0);
});
test('Rudy counter is at most once per main action and consumes time without a personal turn',()=>{
  let result;
  for(let seed=1;seed<40&&!result;seed++){const b=advanceBattle(fixture('루디',3,seed));if(b.reactions.some(r=>r.kind==='counter'))result=b;}
  assert.ok(result);assert.equal(result.reactions.filter(r=>r.kind==='counter').length,1);
  const reaction=result.reactions.find(r=>r.kind==='counter');assert.equal(reaction.endMs-reaction.startMs,actionTiming('루디',4,'counter').medianMs);
  assert.equal(result.units[3].actions,0);assert.equal(result.turn,0);
});
test('Hayeon cover calls an ally basic attack and does not add another personal turn',()=>{
  let result;
  for(let seed=1;seed<40&&!result;seed++){
    const b=fixture('하연',0,seed);b.phase=1;b.queue=[0,1,2,3,4,5];
    const next=advanceBattle(b);if(next.reactions.some(r=>r.kind==='assist'))result=next;
  }
  assert.ok(result);const reaction=result.reactions.find(r=>r.kind==='assist');assert.notEqual(reaction.source,0);
  assert.equal(result.units[reaction.source].side,'attacker');assert.equal(result.units[reaction.source].actions,0);
  assert.equal(result.turn,1);assert.ok(reaction.endMs>reaction.startMs);
});
