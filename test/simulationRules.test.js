import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle,advanceBattle,defaultSkillPlans} from '../src/lib/experimentalBattle.js';
import {heroSkills,compileSkill} from '../src/lib/simulationSkills.js';

function fixture(name='아일린'){
  const h=changeHero(prepareHeroes(),0,name);for(const u of h){u.maxHp=1000000;u.attack=1;u.crit=0;u.resist=100;u.accuracy=0;u.weakPoint=0;}
  return createBattle(h);
}
test('nested transformed wiki sections never replace normal skills or duplicate skill codes',()=>{
  const skills=heroSkills('델론즈');assert.deepEqual(skills.map(s=>s.code),[1,2,3,4,7]);assert.equal(skills.find(s=>s.code===2).name,'사신 강림');assert.equal(skills.find(s=>s.code===7).raw.gauge,85);
  assert.equal(heroSkills('기유').find(s=>s.code===7).raw.gauge,0);assert.equal(heroSkills('시노부').find(s=>s.code===7).raw.gauge,0);
});
test('heroes without a first active skill receive valid default reservations',()=>{
  const heroes=changeHero(prepareHeroes(),0,'발리스타');
  const plans=defaultSkillPlans(heroes);assert.equal(plans.attacker[0].code,3);
});
test('awakening charges by actual personal turn and ordinary skill rather than animation speed',()=>{
  let b=fixture();b=advanceBattle(b);assert.equal(b.units[0].awakenGauge,45);assert.equal(b.turn,0);
  b=advanceBattle(b);assert.equal(b.units[0].awakenGauge,60);assert.equal(b.turn,1);
});
test('reserved skill takes precedence over a ready awakening and unavailable hero reservations are cancelled',()=>{
  let b=fixture();b.units[0].awakenGauge=120;b.units[2].sleep=2;b.plans.attacker=[{id:2,code:2},{id:0,code:2},{id:1,code:2}];
  b=advanceBattle(b);assert.equal(b.active,0);assert.equal(b.action.code,2);assert.ok(!b.plans.attacker.some(p=>p.id===2));
});
test('awakening can be used once and locks the next two own-team skill turns',()=>{
  let b=fixture();b.plans.attacker=[];b.units[0].awakenGauge=120;b.units[2].awakenGauge=120;
  b=advanceBattle(b);assert.equal(b.action.code,7);assert.ok(b.units[0].awakenUsed);assert.equal(b.awakenLocks.attacker,2);
  const own=[];
  for(let i=0;i<30&&own.length<3;i++){b=advanceBattle(b);if(b.action?.kind==='skill'&&b.action.side==='attacker')own.push(b.action.code);}
  assert.notEqual(own[0],7);assert.notEqual(own[1],7);assert.equal(own[2],7);
});
test('hybrid maximum HP coefficients and definition-only defence debuffs retain published values',()=>{
  const s=compileSkill({code:2,name:'fixture',text:'모든 적군\n- 물리 공격력의 80%, 시전자 최대 생명력의 19%만큼 1회 피해\n- 방어력 감소 [100% 확률] [3턴 지속]',definitions:{'방어력 감소':['방어력이 29% 감소합니다.']}});
  assert.equal(s.selfHpCoefficient,.19);assert.equal(s.effects.find(e=>e.type==='defDown').value,.29);
});
test('all-miss multi hits cannot apply per-hit control or stacking defence debuffs',()=>{
  let b=fixture();b.units[0].attack=100;b.units[0].missChance=100;b.units[0].accuracy=100;b.plans.attacker=[{id:0,code:2},{id:0,code:2},{id:0,code:2}];
  b=advanceBattle(b);for(const u of b.units.slice(3)){assert.equal(u.control,0);assert.equal(u.defDown,0);}assert.ok(b.impacts.every(e=>e.missed));
});
test('single-target multi-hit skills share the skill-level weak-point roll',()=>{
  for(let seed=1;seed<15;seed++){
    let b=fixture('젠이츠');b.seed=seed;b.units[0].weakPoint=50;b.plans.attacker=[{id:0,code:2},{id:0,code:2},{id:0,code:2}];b=advanceBattle(b);
    assert.equal(new Set(b.impacts.map(e=>e.weak)).size,1);
  }
});
