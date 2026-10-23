import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseAutoSkill} from '../src/lib/autoSkill.js';
import {prepareHeroes,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
import {skillFor} from '../src/lib/simulationSkills.js';
import {extendDebuffs,cleanseDebuffs} from '../src/lib/statusEffects.js';
const choice=(code,effects=[])=>({code,spec:{effects}});
test('ready awakening precedes healing and all ordinary skills',()=>{
  const awake=choice(7),heal=choice(2,[{type:'heal'}]);
  assert.equal(chooseAutoSkill([heal,awake],[{side:'attacker',hp:1,maxHp:100}],'attacker',()=>0),awake);
});
test('ordinary skills select across the entire ready pool and healing has a strict 60% threshold',()=>{
  const hit=choice(2),heal=choice(3,[{type:'heal'}]),units=[{side:'attacker',hp:59,maxHp:100}];
  assert.equal(chooseAutoSkill([hit,heal],units,'attacker',()=>0),heal);
  units[0].hp=60;assert.equal(chooseAutoSkill([hit,heal],units,'attacker',()=>0),hit);
  assert.equal(chooseAutoSkill([hit,heal],units,'attacker',()=>.999),heal);
  units[0].hp=1;units[0].healBlock=2;assert.equal(chooseAutoSkill([hit,heal],units,'attacker',()=>0),hit);
});
test('initial reservation is executed before a fully charged awakening',()=>{
  const heroes=prepareHeroes();let b=createBattle(heroes,{plans:{attacker:[{id:0,code:2}],defender:[]}});
  b.skillSide='attacker';b.units[0].awakenGauge=b.units[0].awakenMax;
  b=advanceBattle(b);assert.equal(b.action.code,2);assert.equal(b.active,0);
});
test('Hayeon conditional effects retain removed-count dependencies',()=>{
  const first=skillFor('하연',2),second=skillFor('하연',3);
  assert.ok(first.effects.some(e=>e.type==='dot'&&e.perDispel&&e.instanceChance===75));
  assert.ok(second.effects.some(e=>e.type==='regen'&&e.perCleanse&&e.value===.15));
  assert.ok(first.effects.some(e=>e.type==='extendDebuff'&&e.value===2));
});
test('debuff extension cannot exceed the original application duration',()=>{
  const u={control:1,debuffMaxTurns:{control:2},dots:[{remaining:1,maxTurns:3}],panelTimedBuffs:[{debuff:true,remaining:1,maxTurns:2},{remaining:1,maxTurns:3}]};
  extendDebuffs(u,2);assert.equal(u.control,2);assert.equal(u.dots[0].remaining,3);assert.equal(u.panelTimedBuffs[0].remaining,2);assert.equal(u.panelTimedBuffs[1].remaining,1);
});
test('cleansing numeric reductions keeps subsequent stacking finite',()=>{
  const u={defTurns:2,defDown:.24,blockDownTurns:2,blockDebuff:20};
  cleanseDebuffs(u);assert.equal(u.defDown,0);assert.equal(u.blockDebuff,0);
  assert.equal(Math.max(u.defDown,.08),.08);
});
