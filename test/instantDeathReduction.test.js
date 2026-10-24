import {test} from 'node:test';
import assert from 'node:assert/strict';
import {skillFor} from '../src/lib/simulationSkills.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
function fixture(caster='아킬라'){
 let h=prepareHeroes();[caster,'메이','카린','메이','벨라','아리엘'].forEach((n,i)=>h=changeHero(h,i,n));
 const b=createBattle(h,{plans:{attacker:[{id:0,code:2}],defender:[]},seed:1});b.skillSide='attacker';
 for(const u of b.units)Object.assign(u,{hp:1000000,maxHp:1000000,attack:1,defense:0,crit:0,weakPoint:0,barrier:0,nullify:0,immunity:0,linkTurns:0,control:0,sleep:0,accuracy:100,resist:0,effectChanceBonus:100,guts:false,revivePercent:0,reviveImmortalTurns:0,reviveIndomitableHits:0});
 return b;
}
test('Aquila full skill upgrades include per-hit 70% reduction and 40% application',()=>{
 const down=skillFor('아킬라',2).effects.find(e=>e.type==='instantDeathDown');
 assert.equal(down.value,1);assert.equal(down.chance,70);assert.equal(down.each,true);assert.equal(down.status,'즉사 턴 감소');
 assert.equal(skillFor('아킬라',3).effects.find(e=>e.type==='instantDeath').chance,40);
 assert.ok(!skillFor('아킬라',2).unsupported.some(v=>v.includes('즉사 턴 감소')));
});
test('Kris primary instant-death upgrade does not overwrite the separate six-transcendence application',()=>{
 assert.deepEqual(skillFor('크리스',2).effects.filter(e=>e.type==='instantDeath').map(e=>e.chance),[60,30]);
 assert.deepEqual(skillFor('크리스',3).effects.filter(e=>e.type==='instantDeath').map(e=>e.chance),[30]);
});
test('per-hit reduction expires existing instant death and does not invent stacks on unaffected targets',()=>{
 const b=fixture();b.units[3].instantDeathTurns=1;b.units[3].instantDeathStacks=1;b.units[4].instantDeathTurns=3;b.units[4].instantDeathStacks=1;
 const next=advanceBattle(b);assert.equal(next.units[3].hp,0);assert.equal(next.units[3].instantDeathStacks,0);
 assert.equal(next.units[4].instantDeathTurns,1);assert.ok(next.units[4].hp>0);assert.ok(next.units[5].hp>0);assert.equal(next.units[5].instantDeathStacks||0,0);
});
test('instant-death expiry from reduction still permits an unused revival ring',()=>{
 const b=fixture();Object.assign(b.units[3],{instantDeathTurns:1,instantDeathStacks:1,ring:'daegwon'});
 const next=advanceBattle(b);assert.ok(next.units[3].hp>0);assert.equal(next.units[3].ringReviveUsed,true);assert.equal(next.units[3].revivalCount,1);
});
test('resistance prevents the reduction even when ordinary application chance is capped',()=>{
 const b=fixture();b.units[0].accuracy=0;Object.assign(b.units[3],{instantDeathTurns:3,instantDeathStacks:1,resist:200});
 assert.equal(advanceBattle(b).units[3].instantDeathTurns,3);
});
test('instant death is an execution through damage protection, while annihilation prevents revival',()=>{
 const b=fixture();Object.assign(b.units[3],{instantDeathTurns:1,instantDeathStacks:1,immunity:3,nullify:6,barrier:1000000,ring:'daegwon',annihilation:2});
 const next=advanceBattle(b);assert.equal(next.units[3].hp,0);assert.equal(next.units[3].barrier,0);assert.equal(next.units[3].ringReviveUsed||false,false);
});
test('two independent instant-death applications clear consumed stacks and timer after execution',()=>{
 const b=fixture('크리스');b.units[0].effectChanceBonus=1000;
 const next=advanceBattle(b),dead=next.units.filter(u=>u.side==='defender'&&u.hp===0);
 assert.equal(dead.length,1);assert.equal(dead[0].instantDeathStacks,0);assert.equal(dead[0].instantDeathTurns,0);
});
