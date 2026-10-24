import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle} from '../src/lib/experimentalBattle.js';
import {calculatePrebattle,defaultPrebattleSettings} from '../src/lib/prebattleStats.js';
function fixture(){let h=prepareHeroes();['윤건','동영','초선','하연','탄지로','선란'].forEach((n,i)=>h=changeHero(h,i,n));return h;}
test('attacker native shield precedes Hayeon reduction while live attack stays reduced',()=>{
 const h=fixture(),s=defaultPrebattleSettings();s.attacker.pet='연지';
 h[0].attack=7270;h[0].regeneration=0;
 const r=calculatePrebattle(h,s,{basis:'battle'}),u=createBattle(r.heroes).units[0];
 assert.equal(u.attack,7270);assert.equal(u.barrier,16295);assert.equal(u.barrierTurns,3);
});
test('actual spawn pet level changes the reversal without changing manual full-skill defaults',()=>{
 const h=fixture(),s=defaultPrebattleSettings();s.attacker.pet='연지';h[0].attack=7044;h[0].regeneration=0;
 const observed=calculatePrebattle(h,s,{basis:'battle',observedPetSkillLevels:{attacker:1}});
 assert.equal(createBattle(observed.heroes).units[0].barrier,15898);
 const full=calculatePrebattle(h,s,{basis:'battle'});assert.equal(createBattle(full.heroes).units[0].barrier,15788);
 assert.equal(s.attacker.petSkillLevel,3);
 assert.throws(()=>calculatePrebattle(h,s,{observedPetSkillLevels:{attacker:7}}),/펫 스킬/);
});
test('defender native shield already includes opposing Hayeon and unprocessed stats are not guessed',()=>{
 let h=fixture();h=changeHero(h,0,'하연');h=changeHero(h,3,'윤건');h[3].attack=7270;h[3].regeneration=0;
 const r=calculatePrebattle(h,defaultPrebattleSettings(),{basis:'battle'});
 assert.equal(createBattle(r.heroes).units[3].barrier,13450);
 assert.equal(createBattle(fixture()).units[0].barrier,14800);
});
test('panel input computes shield from the pre-enemy subtotal rather than reversing rounded attack',()=>{
 const h=fixture(),s=defaultPrebattleSettings();s.attacker.pet='연지';h[0].regeneration=0;
 const r=calculatePrebattle(h,s),u=createBattle(r.heroes).units[0];
 assert.equal(u.barrier,Math.round(r.heroes[0].panelStackBase.attack*1.26*1.85));
 assert.equal(u.attack,Math.round(r.heroes[0].panelStackBase.attack*1.04));
});
