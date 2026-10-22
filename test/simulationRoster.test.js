import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SIM_ROSTER,heroSkills,compileSkill,canonicalHero} from '../src/lib/simulationSkills.js';
import {SIM_HEROES,prepareHeroes,changeHero,createBattle,advanceBattle,defaultSkillPlans} from '../src/lib/experimentalBattle.js';

test('all published playable roster entries can be selected, with explicit skill provenance',()=>{
  assert.ok(SIM_HEROES.length>=170);assert.equal(new Set(SIM_HEROES).size,SIM_HEROES.length);
  for(const h of SIM_ROSTER){assert.ok(h.source.startsWith('https://'));assert.ok(heroSkills(h.name).length>=2);}
  assert.equal(canonicalHero('카마도 탄지로'),'탄지로');
});
test('loading a report preserves actual team members and canonical aliases',()=>{
  const h=prepareHeroes({heroes:[{name:'아일린',side:'attacker',stats:{1:8108,7:11388}},{name:'아가츠마 젠이츠',side:'attacker',stats:{1:10204}},{name:'카마도 탄지로',side:'attacker',stats:{1:11075}},{name:'하연',side:'defender',stats:{3:1651,7:16397}}]});
  assert.deepEqual(h.slice(0,3).map(v=>v.name),['아일린','젠이츠','탄지로']);
  assert.equal(h[0].attack,8108);assert.equal(h[3].name,'하연');assert.equal(h[3].maxHp,16397);
});
test('initial plans import observed skill choices but not recorded damage or HP outcomes',()=>{
  const h=prepareHeroes(),report={heroes:[{name:'쥬리',side:'attacker',objectId:7}],timeline:[{source:7,skillCode:2,damage:999999},{source:7,skillCode:1},{source:7,skillCode:3},{source:7,skillCode:2}]};
  assert.deepEqual(defaultSkillPlans(h,report).attacker,[{id:1,code:2},{id:1,code:3},{id:1,code:2}]);
});
test('switching a hero resets previous stats or imports matching side stats, never opponent stats',()=>{
  const old=prepareHeroes();old[0].attack=99999;
  const h=changeHero(old,0,'아일린',{heroes:[{side:'defender',name:'아일린',stats:{1:1234}}]});
  assert.equal(h[0].attack,8000);assert.equal(old[0].attack,99999);
  const own=changeHero(old,0,'아일린',{heroes:[{side:'attacker',name:'아일린',stats:{1:8108}}]});assert.equal(own[0].attack,8108);
});
test('awakened Aileen screenshot data and hybrid defence coefficients retain actual values',()=>{
  const aileen=heroSkills('아일린').find(s=>s.code===2);assert.equal(aileen.coefficient,.61);assert.equal(aileen.hits,3);assert.ok(aileen.pierce);
  const gelidus=heroSkills('겔리두스').find(s=>s.code===2);assert.equal(gelidus.coefficient,.75);assert.equal(gelidus.defenseCoefficient,.85);
});
test('friendly heals bypass enemy resistance and do not heal enemies',()=>{
  const input=changeHero(prepareHeroes(),0,'리나');for(const u of input){u.resist=100;u.accuracy=0;u.maxHp=10000;}
  const plans={attacker:[{id:0,code:2},{id:0,code:2},{id:0,code:2}],defender:[{id:3,code:2},{id:3,code:2},{id:3,code:2}]};
  let b=createBattle(input,{plans});b.units[0].hp=1000;b.units[1].hp=2000;b.units[2].hp=3000;b.units[3].hp=1000;
  b=advanceBattle(b);assert.ok(b.units[0].hp>1000);assert.ok(b.units[1].hp>2000);assert.equal(b.units[3].hp,1000);
});
test('unknown/conditional damage never falls through to Yun-geon skill logic',()=>{
  const spec=compileSkill({code:2,name:'unknown',text:'- 고유 표식 1개 부여',targets:3});assert.equal(spec.hits,0);assert.equal(spec.coefficient,0);
  const input=changeHero(prepareHeroes(),0,'리나');
  const plans={attacker:[{id:0,code:3},{id:0,code:3},{id:0,code:3}],defender:[{id:3,code:3},{id:3,code:3},{id:3,code:3}]};
  const start=createBattle(input,{plans}),next=advanceBattle(start);
  assert.deepEqual(next.units.slice(3).map(u=>u.hp),start.units.slice(3).map(u=>u.hp));assert.equal(next.units[0].nullify,0);
});
test('every hero completes bounded deterministic calculations with finite health and impact events',()=>{
  for(const name of SIM_HEROES){
    const h=changeHero(prepareHeroes(),0,name);let b=createBattle(h,{seed:123});
    for(let i=0;i<30&&!b.done;i++)b=advanceBattle(b);
    for(const u of b.units){assert.ok(Number.isFinite(u.hp),name);assert.ok(u.hp>=0&&u.hp<=u.maxHp,name);assert.ok(Number.isFinite(u.damageDealt),name);}
    for(const e of b.impacts)assert.ok(Number.isFinite(e.damage||e.heal||e.absorbed||0),name);
  }
});
