import {test} from 'node:test';
import assert from 'node:assert/strict';
import {passiveShieldRules,startingShieldRules} from '../src/lib/passiveShields.js';
import {SIM_HEROES,prepareHeroes,changeHero,createBattle} from '../src/lib/experimentalBattle.js';
import {onSkillRules} from '../src/lib/passiveRules.js';
import {afterSkillPassive} from '../src/lib/conditionalPassives.js';
import {receiveDamage} from '../src/lib/battleSurvival.js';
function battle(name){return createBattle(changeHero(prepareHeroes(),0,name));}
test('all supported heroes initialize shields only from unconditional starting grants',()=>{
  const expectedRules={'녹스':['maxHp',.45],'니아':['attack',1.85],'메이':['attack',1.6],'벨리카':['attack',1.85],'엘리시아':['attack',1.6],'오를리':['maxHp',.45],'윤건':['attack',1.85],'젠이츠':['attack',1.6],'초선':['maxHp',.45],'크리스':['attack',1.6]};
  for(const name of SIM_HEROES){const u=battle(name).units[0],rule=expectedRules[name],expected=rule?Math.round(u[rule[0]]*rule[1]*(1+u.regeneration/100)):0;assert.equal(u.barrier,expected,name);}
});
test('full enhancement changes matching own shield values without turning guts into initial shields',()=>{
  for(const name of ['니아','벨리카'])assert.equal(startingShieldRules(name)[0].value,1.85);
  assert.equal(startingShieldRules('오를리')[0].value,.45);
  assert.equal(startingShieldRules('초선')[0].value,.45);
  assert.equal(startingShieldRules('실베스타').length,0);assert.equal(passiveShieldRules('실베스타')[0].trigger,'guts');
});
test('skill shields never heal and repeated-skill triggers respect their count',()=>{
  const b=battle('아리스'),u=b.units[0];u.hp=1;u.skillActions=1;onSkillRules(u,b.units,[],()=>0);afterSkillPassive(u,[]);assert.equal(u.hp,1);assert.equal(u.barrier,Math.round(u.attack*.52));
  const d=battle('데이지'),v=d.units[0];v.skillActions=1;onSkillRules(v,d.units,[],()=>0);assert.equal(v.barrier,0);v.skillActions=2;onSkillRules(v,d.units,[],()=>0);assert.equal(v.barrier,Math.round(v.attack*.55));
});
test('native guts shield and ring share a trigger but keep the stronger shield',()=>{
  const u={hp:100,maxHp:100,attack:1000,barrier:0,guts:true,gutsShieldPercent:155,ring:'daegwon'};
  assert.equal(receiveDamage(u,1000).target.barrier,1550);
});
