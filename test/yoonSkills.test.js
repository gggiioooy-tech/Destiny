import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
import {skillFor} from '../src/lib/simulationSkills.js';
import {syncBuffs} from '../src/lib/buffEffects.js';
import {afterControl} from '../src/lib/conditionalPassives.js';
import {onAttackStacks,onSkillRules} from '../src/lib/passiveRules.js';
function fixture(code=3,enemy='하연'){
  const heroes=changeHero(changeHero(prepareHeroes(),0,'윤건'),3,enemy),b=createBattle(heroes,{plans:{attacker:[{id:0,code}],defender:[]}});b.skillSide='attacker';
  for(const u of b.units){u.maxHp=10000;u.hp=10000;u.attack=1;u.defense=0;u.crit=0;u.weakPoint=0;u.resist=0;u.accuracy=100;u.immunity=0;u.nullify=0;u.stealth=0;u.controlImmune=99;u.barrier=0;u.barrierTurns=0;u.buffOrder=[];u.linkTurns=0;}
  return b;
}
test('group HP conversion triggers Hayeon rescue before subsequent damage',()=>{
  const next=advanceBattle(fixture());for(const u of next.units.slice(3)){assert.equal(u.hp,6100);assert.ok(u.barrier>2400);}assert.equal(next.units[3].hayeonRescueUsed,true);
});
test('Yoon first skill dispels removable buffs after attacking',()=>{
  const b=fixture(2,'루디'),u=b.units[3];u.barrier=100;u.barrierTurns=3;u.stealth=0;u.controlImmune=0;u.superiority=2;syncBuffs(u);
  const next=advanceBattle(b);assert.equal(next.units[3].barrier,0);assert.equal(next.units[3].superiority,0);
});
test('Yoon killing skill casts the opposite skill once and accounts for extra time',()=>{
  const b=fixture(2,'메이');b.units[0].attack=100000;b.units[0].speed=1000;
  b.units[3].hp=1;b.units[4].nullify=20;b.units[5].nullify=20;
  const next=advanceBattle(b),text=next.log.at(-1).text;
  assert.equal((text.match(/70% 위력 1회 연속 발동/g)||[]).length,1);assert.ok(next.elapsedMs>next.lastTiming.endMs);
});
test('awakening compiles aura control and preserves its pre-damage order',()=>{
  const aura=skillFor('윤건',7).effects.find(e=>e.type==='control'&&e.status==='오라');assert.ok(aura);assert.equal(aura.chance,50);assert.equal(aura.duration,2);assert.equal(aura.before,true);
});
test('Yoon basic reduces timed immunity even when its damage is immune',()=>{
  const b=fixture(2,'메이');b.phase=1;b.queue=[0];b.units[0].weakPoint=100;b.units[3].hp=5000;for(const u of b.units.slice(3))u.immunity=2;
  const next=advanceBattle(b);assert.equal(next.units[3].immunity,1);
});
test('Yoon cleanse and nullification require three effective magic members',()=>{
  for(const [ally,expected]of [['선란',false],['연희',true]]){
    const heroes=changeHero(changeHero(changeHero(prepareHeroes(),0,'윤건'),1,ally),2,'하연'),b=createBattle(heroes),u=b.units[0];u.nullify=0;u.control=2;u.controlName='기절';u.lastAttackBasic=true;
    afterControl(u,[],b.units);onAttackStacks(u,b.units,[]);assert.equal(u.control,expected?0:2);assert.equal(u.nullify,expected?1:0);onSkillRules(u,b.units,[]);assert.equal(u.nullify,expected?3:0);
  }
});
