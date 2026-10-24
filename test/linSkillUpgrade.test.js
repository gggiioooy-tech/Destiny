import {test} from 'node:test';
import assert from 'node:assert/strict';
import {skillFor} from '../src/lib/simulationSkills.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
function fixture(){
 let h=prepareHeroes();['린','메이','카린','메이','벨라','아리엘'].forEach((n,i)=>h=changeHero(h,i,n));
 const b=createBattle(h,{plans:{attacker:[{id:0,code:2}],defender:[]},seed:1});b.skillSide='attacker';
 for(const u of b.units)Object.assign(u,{hp:1000000,maxHp:1000000,attack:1000,defense:0,crit:0,weakPoint:100,block:0,barrier:0,nullify:0,immunity:0,linkTurns:0,superiority:0,stealth:0,control:0,sleep:0,guts:false,revivePercent:0,ring:'none',reviveImmortalTurns:0,reviveIndomitableHits:0});
 return b;
}
test('Lin full skill upgrade compiles weak extra damage and its own direct-kill reset',()=>{
 const s=skillFor('린',2);assert.equal(s.resetOwnCooldownOnDirectKill,true);assert.equal(s.extraDamage.length,1);assert.equal(s.extraDamage[0].condition.type,'weak');assert.equal(s.extraDamage[0].coefficient,.37);assert.equal(s.extraDamage[0].each,true);assert.equal(s.unsupported.length,0);
});
test('Lin weak extra damage applies to every landed hit, but not ordinary hits',()=>{
 const b=fixture(),n=advanceBattle(b);assert.equal(n.impacts.filter(i=>i.kind==='conditional_extra').length,6);
 b.units[0].weakPoint=0;const normal=advanceBattle(b);assert.equal(normal.impacts.filter(i=>i.kind==='conditional_extra').length,0);assert.ok(normal.units[0].readyAt[2]>normal.elapsedMs);
});
test('Lin direct kill resets only the skill used',()=>{
 const b=fixture();b.units[3].hp=1;b.units[0].readyAt[3]=999999;
 const n=advanceBattle(b);assert.equal(n.units[3].hp,0);assert.ok(n.units[0].readyAt[2]<=n.elapsedMs);assert.equal(n.units[0].readyAt[3],999999);
});
test('Lin kill from a secondary shock is not a direct skill kill',()=>{
 const b=fixture();b.units[0].attack=1;Object.assign(b.units[3],{control:2,controlName:'감전',shockSource:{id:1,attack:100000000}});
 const n=advanceBattle(b);assert.equal(n.units[3].hp,0);assert.ok(n.units[0].readyAt[2]>n.elapsedMs);
});

test('Lin weak conditional skill damage can itself complete the direct kill reset',()=>{
 const b=fixture();b.units[3].hp=1000;
 const n=advanceBattle(b);assert.equal(n.units[3].hp,0);assert.ok(n.impacts.some(i=>i.target===3&&i.kind==='conditional_extra'&&i.damage===194));assert.ok(n.units[0].readyAt[2]<=n.elapsedMs);
});
