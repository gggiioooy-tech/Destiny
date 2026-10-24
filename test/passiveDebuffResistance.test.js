import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';

function fixture(resist,accuracy=0){
 let heroes=prepareHeroes();
 for(const [id,name]of [[0,'메이'],[1,'동영'],[2,'벨라'],[3,'메이'],[4,'벨라'],[5,'아리엘']])heroes=changeHero(heroes,id,name);
 const b=createBattle(heroes,{seed:1,plans:{attacker:[{id:0,code:2}],defender:[]}});
 for(const u of b.units){
  Object.assign(u,{hp:1000000,maxHp:1000000,attack:10,defense:0,nullify:0,barrier:0,immunity:0,immortal:0,linkTurns:0,accuracy:0,resist,control:0,sleep:0,stealth:0,superiority:0,crit:0,weakPoint:100,healingReduction:0,magicVulnerability:0,dots:[],panelTimedBuffs:[]});
 }
 b.units[1].accuracy=accuracy;b.units[1].partySkillCount=1;b.skillSide='attacker';
 return b;
}

test('Dongyoung passive damage lands while full effect resistance rejects all three debuffs',()=>{
 const n=advanceBattle(fixture(100));
 assert.ok(n.reactions.some(r=>r.name.includes('동영')));
 assert.ok(n.impacts.some(i=>i.source===1&&i.damage>0));
 for(const u of n.units.slice(3)){
  assert.equal(u.dots.length,0);assert.equal(u.healingReduction,0);assert.equal(u.magicVulnerability,0);
 }
});

test('sufficient caster accuracy lets the passive poison, recovery reduction and vulnerability land',()=>{
 const n=advanceBattle(fixture(100,100));
 for(const u of n.units.slice(3)){
  assert.equal(u.dots.length,1);assert.equal(u.dots[0].scale,'targetHp');
  assert.equal(u.healingReduction,20);assert.equal(u.magicVulnerability,20);
 }
});

test('poison immunity blocks the ailment but not the other independently applicable passive effects',()=>{
 const b=fixture(0);for(const u of b.units.slice(3))u.statusImmunities={'중독':2};
 const n=advanceBattle(b);
 for(const u of n.units.slice(3)){
  assert.equal(u.dots.length,0);assert.equal(u.healingReduction,20);assert.equal(u.magicVulnerability,20);
 }
});

test('active fear suppresses resistance to Dongyoung passive effects as it does ordinary skills',()=>{
 const b=fixture(200);for(const u of b.units.slice(3)){u.control=2;u.controlName='공포';}
 const n=advanceBattle(b);
 for(const u of n.units.slice(3)){
  assert.equal(u.dots.length,1);assert.equal(u.healingReduction,20);assert.equal(u.magicVulnerability,20);
  assert.equal(u.resist,200);
 }
});

test('blind does not turn Dongyoung passive spell damage into a missed basic attack',()=>{
 const b=fixture(0);b.units[1].blind=2;const n=advanceBattle(b);
 const hits=n.impacts.filter(i=>i.source===1&&i.kind==='hero_passive');
 assert.equal(hits.length,3);assert.ok(hits.every(i=>!i.missed&&i.damage>0));
 for(const u of n.units.slice(3)){assert.equal(u.dots.length,1);assert.equal(u.healingReduction,20);}
});
