import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roleCount,onDeathRules,onAttackStacks} from '../src/lib/passiveRules.js';
import {afterHitPassive} from '../src/lib/conditionalPassives.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
import {heroProfile,SIM_ROSTER} from '../src/lib/simulationSkills.js';
function battle(names){let h=prepareHeroes();names.forEach((name,i)=>h=changeHero(h,i,name));return createBattle(h,{plans:{attacker:[],defender:[]}});}
test('every supported hero has a usable role and collaboration roles participate in composition',()=>{
  for(const h of SIM_ROSTER)assert.ok([1,2,3,4,5].includes(h.role),h.name);
  for(const [name,role]of Object.entries({기유:5,시노부:2,젠이츠:1,탄지로:1}))assert.equal(heroProfile(name).role,role);
  assert.equal(roleCount([{name:'시노부',side:'a'},{name:'윤건',side:'a'},{name:'하연',side:'a'}],'a',2),3);
});
test('role support uses actual starting team size and remains a starting composition condition after death',()=>{
  const three=[{name:'윤건',side:'a'},{name:'연희',side:'a'},{name:'하연',side:'a'}];assert.equal(roleCount(three,'a',2),3);
  const five=[...three,{name:'루디',side:'a'},{name:'기유',side:'a'}];assert.equal(roleCount(five,'a',2),2);
  five[3].name='시노부';assert.equal(roleCount(five,'a',2),4);five[0].hp=0;assert.equal(roleCount(five,'a',2),4);
});
test('three-person magic team does not receive Milia five-magic shield',()=>{
  const b=battle(['밀리아','윤건','연희']),u=b.units[1];u.barrier=0;u.lastAttackBasic=true;onAttackStacks(u,b.units,[]);assert.equal(u.barrier,0);
  assert.equal(b.units[0].controlImmune,0);
});
test('Giyu hit-condition counts each protected ally separately',()=>{
  const b=battle(['기유','윤건','루디']),u=b.units[1],other=b.units[2];u.passiveHits=3;u.blind=2;u.awakenGauge=0;other.blind=2;other.awakenGauge=0;
  afterHitPassive(u,b.units,[]);assert.equal(u.blind,0);assert.equal(u.awakenGauge,10);assert.equal(other.blind,2);assert.equal(other.awakenGauge,0);
});
test('Seonran death removes capped stacks and does not refill three starting stacks',()=>{
  const b=battle(['선란','여포','하연']),u=b.units[0];u.seonStacks=6;u.stackBases={seonStacks:1000};u.attack=1420;u.critDamage=210;u.hp=0;
  onDeathRules(u,b.units,[]);assert.equal(u.seonStacks,0);assert.equal(u.attack,1000);assert.equal(u.critDamage,150);
  onDeathRules(u,b.units,[]);assert.equal(u.attack,1000);
});
test('Clemis awakening revives roles differently, then heals only healable allies',()=>{
  let b=battle(['클레미스','선란','루디']);b.skillSide='attacker';b.units[0].awakenGauge=b.units[0].awakenMax;b.units[1].hp=0;b.units[2].hp=0;
  b=advanceBattle(b);assert.equal(b.action.code,7);assert.equal(b.units[1].hp,1);assert.equal(b.units[1].immortal,3);assert.equal(b.units[1].controlImmune,3);
  assert.equal(b.units[2].hp,9100);assert.equal(b.units[2].immortal,0);assert.equal(b.units[2].controlImmune,2);assert.equal(b.units[2].revived,false);
});
