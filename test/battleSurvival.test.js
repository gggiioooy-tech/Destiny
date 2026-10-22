import {test} from 'node:test';
import assert from 'node:assert/strict';
import {receiveDamage,tickPersonalTurn} from '../src/lib/battleSurvival.js';
import {calculateHit,calculateRecovery,calculateShield,convertedHealth} from '../src/lib/combatDamage.js';
const unit=(extra={})=>({hp:1000,maxHp:1000,attack:1000,barrier:0,nullify:0,immunity:0,immortal:0,...extra});
test('penetration bypasses immunity but not nullification',()=>{
  const u=unit({immunity:2,nullify:2});
  assert.equal(receiveDamage(u,999).kind,'immune');
  const hit=receiveDamage(u,999,{pierce:true});assert.equal(hit.kind,'nullify');assert.equal(hit.target.nullify,1);assert.equal(hit.target.hp,1000);
  assert.equal(u.nullify,2);
});
test('shield absorption and blessing use the documented experimental order',()=>{
  const r=receiveDamage(unit({barrier:100,blessing:25}),1000);
  assert.equal(r.absorbed,100);assert.equal(r.damage,150);assert.equal(r.target.hp,850);
});
test('guts precedes revival and cannot repeatedly trigger',()=>{
  let r=receiveDamage(unit({guts:true,gutsShieldPercent:150,revivePercent:100}),2000);
  assert.equal(r.target.hp,1);assert.equal(r.target.barrier,1500);assert.ok(r.target.gutsUsed);assert.ok(!r.target.revived);
  r=receiveDamage(r.target,3000);assert.equal(r.target.hp,1000);assert.ok(r.target.revived);
  r=receiveDamage(r.target,3000);assert.equal(r.target.hp,0);
});
test('immortality fixes HP to one and expiry causes death',()=>{
  const u=unit({hp:1,immortal:2});assert.equal(receiveDamage(u,2000).target.hp,1);
  const tick=tickPersonalTurn(u,u);assert.equal(tick.target.immortal,1);
  assert.equal(tickPersonalTurn(tick.target,tick.target).target.hp,0);
});
test('annihilation prevents death-triggered revival, not guts',()=>{
  assert.equal(receiveDamage(unit({annihilation:2,revivePercent:100}),2000).target.hp,0);
  assert.equal(receiveDamage(unit({annihilation:2,guts:true}),2000).target.hp,1);
});
test('newly gained durations do not immediately tick on the same turn',()=>{
  const before=unit({immortal:0,barrierTurns:0}),after=unit({hp:1,immortal:3,barrierTurns:3,barrier:800});
  const tick=tickPersonalTurn(after,before).target;assert.equal(tick.immortal,3);assert.equal(tick.barrierTurns,3);
});
test('damage modifier buckets match the selected community model',()=>{
  assert.equal(calculateHit({base:1000,defense:0,weak:true,damageIncrease:20,amplification:10,vulnerability:30,damageReduction:20}),1888);
  assert.equal(calculateHit({base:1000,defense:0,damageReduction:99}),100);
  assert.equal(calculateHit({base:1000,defense:0,damageReduction:0,amplification:9.6}),1096);
});
test('experimental miss suppresses critical and weak bonuses and applies 80 percent',()=>{
  assert.equal(calculateHit({base:1000,defense:0,critical:true,critDamage:250,weak:true,weakBonus:35,missed:true}),800);
});
test('healing models differ explicitly, healing block wins, shields use regeneration',()=>{
  const input={base:1000,regeneration:20,increase:30,decrease:10};
  assert.equal(calculateRecovery(input),1400);assert.equal(calculateRecovery({...input,model:'separate'}),1440);
  assert.equal(calculateRecovery({...input,blocked:true}),0);assert.equal(calculateRecovery({...input,decrease:200}),0);
  assert.equal(calculateShield(input),1200);
});
test('conversion never heals, respects immortality and bypasses regular damage calculation',()=>{
  assert.equal(convertedHealth({hp:8000,maxHp:10000,percent:39}),3900);
  assert.equal(convertedHealth({hp:2000,maxHp:10000,percent:39}),2000);
  assert.equal(convertedHealth({hp:1,maxHp:10000,percent:0,immortal:true}),1);
});
