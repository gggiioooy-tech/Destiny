import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,createBattle,advanceBattle,changeHero,defaultSkillPlans} from '../src/lib/experimentalBattle.js';
import {predictBattle,summarizePrediction,setupFromRecord,wilsonInterval} from '../src/lib/battlePrediction.js';
import {receiveDamage} from '../src/lib/battleSurvival.js';
import {compileSkill,skillFor} from '../src/lib/simulationSkills.js';

test('repeated predictions are reproducible and unresolved samples never become wins',()=>{
  const h=prepareHeroes(),plans=defaultSkillPlans(h),copy=structuredClone(h);
  assert.deepEqual(predictBattle(h,plans,{samples:8,seed:57}),predictBattle(h,plans,{samples:8,seed:57}));assert.deepEqual(h,copy);
  const result=summarizePrediction({attacker:40,defender:20,unresolved:40});assert.equal(result.winner,null);assert.deepEqual(result.attackerBounds,[.4,.8]);assert.equal(result.empiricallyValidated,false);
  assert.throws(()=>predictBattle(h,plans,{samples:1001}));
});
test('record conversion uses initial reservations and stats only, never labels or observed actions',()=>{
  const payload={heroStats:{}};
  for(const side of ['attacker','defender']){
    payload[side]={heroIds:[1,2,3],heroes:['연희','쥬리','윤건'],skills:[{heroId:1,skillType:3,order:0},{heroId:2,skillType:2,order:1},{heroId:3,skillType:3,order:2}]};
    payload.heroStats[side]=[1,2,3].map(heroId=>({heroId,stats:{magicalAttack:8000,defence:1800,hp:10000,attackSpeed:90}}));
  }
  const first=setupFromRecord({payload});payload.attackerWon=false;payload.timeline=[{damage:99999999}];payload.finalHp=0;
  assert.deepEqual(setupFromRecord({payload}),first);assert.equal(first.draft[0].attack,8000);
  delete payload.heroStats.attacker[0].stats.hp;assert.throws(()=>setupFromRecord({payload}),/스탯/);
});
test('accuracy intervals cannot certify a tiny perfect sample as ninety percent accuracy',()=>{
  assert.ok(wilsonInterval(10,10)[0]<.9);assert.deepEqual(wilsonInterval(0,0),[0,1]);
});
test('revival-only immunity is not active at spawn; full skill upgrade sets revival health',()=>{
  const h=changeHero(prepareHeroes(),0,'클레미스'),b=createBattle(h);
  assert.equal(b.units[0].immunity,0);assert.equal(b.units[0].revivePercent,100);
  const outcome=receiveDamage({...b.units[0],barrier:0},999999);assert.equal(outcome.target.hp,b.units[0].maxHp);assert.equal(outcome.target.immunity,2);
});
test('indomitable revival expires by actual unprotected hits and annihilation prevents it',()=>{
  const initial={hp:100,maxHp:100,barrier:0,reviveIndomitableHits:2};
  let r=receiveDamage(initial,1000);assert.equal(r.target.hp,1);assert.equal(r.target.indomitableHits,2);
  r=receiveDamage({...r.target,nullify:1},100);assert.equal(r.target.indomitableHits,2);
  r=receiveDamage(r.target,100);assert.equal(r.target.hp,1);r=receiveDamage(r.target,100);assert.equal(r.target.hp,0);
  assert.equal(receiveDamage({...initial,annihilation:2},1000).target.hp,0);
});
test('immortality does not reduce surviving health or count prevented lethal damage',()=>{
  const u={hp:100,maxHp:100,immortal:2,barrier:0};assert.equal(receiveDamage(u,10).target.hp,90);assert.equal(receiveDamage({...u,hp:1},1000).damage,0);
});
test('initial shields and blessing apply without multiplying the supplied attack stat',()=>{
  const b=createBattle(changeHero(prepareHeroes(),0,'젠이츠'));assert.equal(b.units[0].attack,8000);assert.equal(b.units[0].barrier,12800);assert.equal(b.units[0].blessing,25);
});
test('negative chance stats are accepted and probabilities clamp when used',()=>{
  const h=prepareHeroes();h[0].crit=-34;h[0].block=-5;h[0].weakPoint=-4;
  assert.doesNotThrow(()=>advanceBattle(createBattle(h)));h[0].attack=-1;assert.throws(()=>createBattle(h));
});
test('published effect definitions control DOT coefficients and awakening defense ignore',()=>{
  const s=compileSkill({code:2,text:'단일 적군\n- 물리 공격력의 100%만큼 1회 피해\n- 화상 [50% 확률] [2턴 지속]',definitions:{화상:['매 턴마다 시전자 공격력의 80% 피해를 입습니다.']}});
  assert.equal(s.effects[0].type,'dot');assert.equal(s.effects[0].value,.8);assert.equal(s.effects[0].chance,50);
  assert.equal(skillFor('젠이츠',7).ignore,.65);
});
