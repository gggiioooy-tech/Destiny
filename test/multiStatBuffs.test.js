import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimedBuff} from '../src/lib/timedEffects.js';
import {dispelBuffs} from '../src/lib/buffEffects.js';
import {tickPersonalTurn} from '../src/lib/battleSurvival.js';
import {onAttackStacks} from '../src/lib/passiveRules.js';
import {prepareHeroes,changeHero,createBattle} from '../src/lib/experimentalBattle.js';

test('one source grants independent damage and critical-damage buffs',()=>{
  const u={damageIncrease:0,critDamage:150};
  setTimedBuff(u,'damageIncrease',20,3,{source:'관우'});
  setTimedBuff(u,'critDamage',40,3,{source:'관우'});
  assert.equal(u.damageIncrease,20);assert.equal(u.critDamage,190);
  assert.equal(u.panelTimedBuffs.length,2);
  assert.deepEqual(u.panelTimedBuffs.map(b=>[b.stat,b.delta]),[['damageIncrease',20],['critDamage',40]]);
  dispelBuffs(u,1);
  assert.equal(u.damageIncrease,0);assert.equal(u.critDamage,190);
  dispelBuffs(u,1);
  assert.equal(u.critDamage,150);
});

test('refreshing one stat leaves the other stat duration and strength intact',()=>{
  let u={attack:1000,critDamage:150};
  setTimedBuff(u,'attack',30,2,{ratio:true,source:'shared passive'});
  setTimedBuff(u,'critDamage',40,2,{source:'shared passive'});
  const before=structuredClone(u);
  setTimedBuff(u,'attack',35,2,{ratio:true,source:'shared passive'});
  u=tickPersonalTurn(u,before).target;
  assert.equal(u.attack,1350);assert.equal(u.critDamage,190);
  assert.equal(u.panelTimedBuffs.find(b=>b.stat==='attack').remaining,2);
  assert.equal(u.panelTimedBuffs.find(b=>b.stat==='critDamage').remaining,1);
  u=tickPersonalTurn(u,structuredClone(u)).target;
  assert.equal(u.attack,1350);assert.equal(u.critDamage,150);
  u=tickPersonalTurn(u,structuredClone(u)).target;
  assert.equal(u.attack,1000);assert.equal(u.panelTimedBuffs.length,0);
});

test('Gwanwoo grants both rear buffs after initial effects have expired',()=>{
  const h=changeHero(changeHero(prepareHeroes(),0,'관우'),1,'여포');
  const b=createBattle(h),caster=b.units[0],ally=b.units[1];
  ally.battleRow='back';ally.panelTimedBuffs=[];ally.buffOrder=[];
  ally.damageIncrease=0;ally.critDamage=150;
  caster.lastAttackBasic=true;
  onAttackStacks(caster,b.units,[]);onAttackStacks(caster,b.units,[]);
  assert.equal(ally.damageIncrease,20);assert.equal(ally.critDamage,190);
  assert.equal(ally.panelTimedBuffs.filter(b=>b.source==='관우').length,2);
  let expired=ally;
  for(let i=0;i<3;i++)expired=tickPersonalTurn(expired,structuredClone(expired)).target;
  assert.equal(expired.damageIncrease,0);assert.equal(expired.critDamage,150);
});
