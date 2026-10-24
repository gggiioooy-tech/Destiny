import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileSkill,skillFor} from '../src/lib/simulationSkills.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
test('Pascal full upgrades include 40 second cooldown, two nullifications and named reset',()=>{
 const s=skillFor('파스칼',2);assert.equal(s.cooldown,40);assert.equal(s.effects.find(e=>e.type==='nullify').value,2);assert.equal(s.effects.find(e=>e.type==='cooldownReset').skillName,'파괴의 거인');assert.equal(s.unsupported.length,0);
});
test('named cooldown reset makes only Pascal attack ready and preserves support cooldown',()=>{
 let h=changeHero(prepareHeroes(),0,'파스칼');const b=createBattle(h,{plans:{attacker:[{id:0,code:2}],defender:[]}});b.skillSide='attacker';b.units[0].readyAt[3]=999999;b.units[0].nullify=0;
 const n=advanceBattle(b);assert.ok(n.units[0].readyAt[3]<=n.elapsedMs);assert.ok(n.units[0].readyAt[2]>n.elapsedMs);assert.equal(n.units[0].nullify,2);
});
test('named reset still executes under buff block while the nullification grant is rejected',()=>{
 let h=changeHero(prepareHeroes(),0,'파스칼');const b=createBattle(h,{plans:{attacker:[{id:0,code:2}],defender:[]}});b.skillSide='attacker';Object.assign(b.units[0],{nullify:0,buffBlock:3});b.units[0].readyAt[3]=999999;
 const n=advanceBattle(b);assert.ok(n.units[0].readyAt[3]<=n.elapsedMs);assert.equal(n.units[0].nullify,0);
});
test('named reset compiler preserves the target name without turning it into a full reset',()=>{
 const s=compileSkill({name:'지원',code:2,text:'자신\n- [없는 스킬] 쿨타임 초기화'});assert.equal(s.effects[0].skillName,'없는 스킬');
});

test('published full-upgrade cooldown reductions override base cooldowns consistently',()=>{
 for(const [name,code,seconds] of [['리',2,68],['리',3,68],['비담',2,55],['스니퍼',2,45],['이주희',3,75],['카론',3,91],['카린',2,61],['파스칼',2,40]])assert.equal(skillFor(name,code).cooldown,seconds,name+' '+code);
});
