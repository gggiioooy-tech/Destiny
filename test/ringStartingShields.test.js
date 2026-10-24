import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyEquipment} from '../src/lib/equipmentEffects.js';
import {prepareHeroes,changeHero,createBattle} from '../src/lib/experimentalBattle.js';
import {receiveDamage,tickPersonalTurn} from '../src/lib/battleSurvival.js';
import {setupDocument,readSetupFile} from '../src/lib/simulationWorkspace.js';

test('explicit six-star starting shield options use the selected stat and regeneration',()=>{
 for(const [ringShield,expected]of [['vigor',1080],['ironwall',600],['health',2160]]){
  const u={hp:10000,maxHp:10000,attack:1000,defense:500,regeneration:20,ringShield};
  applyEquipment(u);assert.equal(u.barrier,expected);assert.equal(u.barrierTurns,2);
 }
});

test('unspecified or none shield options never invent equipment or change native shield',()=>{
 for(const ringShield of [undefined,'none']){
  const u={hp:10000,maxHp:10000,attack:1000,defense:500,barrier:200,barrierTurns:3,ring:'daegwon',ringShield};
  applyEquipment(u);assert.equal(u.barrier,200);assert.equal(u.barrierTurns,3);
 }
});

test('native and equipment starting shields are one pool rather than summed grants',()=>{
 const draft=changeHero(prepareHeroes(),0,'윤건');draft[0].ringShield='vigor';draft[0].regeneration=0;
 const u=createBattle(draft).units[0];assert.equal(u.barrier,Math.round(u.attack*1.85));assert.equal(u.barrierTurns,3);
});

test('selected starting shield absorbs damage and expires on personal turns',()=>{
 const draft=changeHero(prepareHeroes(),0,'루디');draft[0].ringShield='ironwall';draft[0].regeneration=0;
 const u=createBattle(draft).units[0];assert.equal(u.barrier,u.defense);
 const damaged=receiveDamage(u,100);assert.equal(damaged.target.hp,u.hp);assert.equal(damaged.absorbed,100);
 let next=tickPersonalTurn(u,u).target;assert.equal(next.barrierTurns,1);
 next=tickPersonalTurn(next,next).target;assert.equal(next.barrierTurns,0);assert.equal(next.barrier,0);
});

test('saved setups retain explicit shield options and legacy setups default to unknown/none',()=>{
 const draft=prepareHeroes();draft[0].ring='daegwon';draft[0].ringShield='health';
 const document=setupDocument({draft,plans:{attacker:[],defender:[]},seed:1});
 const loaded=readSetupFile(JSON.stringify(document));assert.equal(loaded.draft[0].ringShield,'health');assert.equal(loaded.draft[0].ring,'daegwon');
 for(const u of document.draft)delete u.ringShield;
 assert.equal(readSetupFile(JSON.stringify(document)).draft[0].ringShield,'none');
});

test('changing a hero clears old shield equipment and malformed shield options are rejected',()=>{
 const draft=prepareHeroes();draft[0].ringShield='vigor';
 assert.equal(changeHero(draft,0,'루디')[0].ringShield,'none');
 draft[0].ringShield='invented';assert.throws(()=>createBattle(draft),/시작 보호막/);
 assert.throws(()=>setupDocument({draft,plans:{attacker:[],defender:[]},seed:1}),/시작 보호막/);
});
