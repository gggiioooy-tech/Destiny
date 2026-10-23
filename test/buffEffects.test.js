import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncBuffs,dispelBuffs,reduceBuffDurations} from '../src/lib/buffEffects.js';
import {setTimedBuff} from '../src/lib/timedEffects.js';
import {receiveDamage} from '../src/lib/battleSurvival.js';
import {restoreHp} from '../src/lib/passiveRules.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';

test('dispel follows application order, reverses stats, and preserves protected effects',()=>{
  const u={hp:100,maxHp:100,attack:100,immunity:2,nullify:3,guts:true};
  setTimedBuff(u,'attack',30,2);u.barrier=50;u.barrierTurns=3;syncBuffs(u);
  assert.equal(dispelBuffs(u,1).removed,1);assert.equal(u.attack,100);assert.equal(u.barrier,50);
  assert.equal(dispelBuffs(u,1).removed,1);assert.equal(u.barrier,0);
  assert.equal(u.immunity,2);assert.equal(u.nullify,3);assert.equal(u.guts,true);
});
test('expired entries do not hide a later immortality and dispelling it kills immediately',()=>{
  const u={hp:1,stealth:1};syncBuffs(u);u.stealth=0;syncBuffs(u);u.immortal=3;syncBuffs(u);
  assert.deepEqual(dispelBuffs(u,1),{removed:1,died:true});assert.equal(u.hp,0);
});
test('buff duration reduction preserves debuffs, expires healing and reverses only buffs',()=>{
  const u={hp:100,attack:120,resist:-20,barrier:10,barrierTurns:1,immunity:1,regenBuff:{remaining:1,base:10},panelTimedBuffs:[{stat:'attack',delta:20,remaining:1},{stat:'resist',delta:-20,remaining:2,debuff:true}]};
  reduceBuffDurations(u,1);assert.equal(u.attack,100);assert.equal(u.resist,-20);assert.equal(u.panelTimedBuffs[0].remaining,2);assert.equal(u.immunity,0);assert.equal(u.barrier,0);assert.equal(u.regenBuff,undefined);
});
test('fixed damage bypasses blessing while immortality cannot be healed',()=>{
  const u={hp:1000,maxHp:1000,attack:100,blessing:25,barrier:0};
  assert.equal(receiveDamage(u,600).damage,250);assert.equal(receiveDamage(u,600,{fixed:true}).damage,600);
  const immortal={...u,hp:1,immortal:3};assert.equal(restoreHp(immortal,500),0);assert.equal(immortal.hp,1);
});
test('Hayeon assist uses transformed Wukong multi-hit basic without consuming his turn',()=>{
  let result;
  for(let seed=1;seed<50&&!result;seed++){
    let h=changeHero(changeHero(prepareHeroes(),0,'하연'),1,'손오공');
    for(const u of h){u.maxHp=1000000;u.attack=1;u.crit=0;u.accuracy=0;u.resist=100;}
    const b=createBattle(h,{seed});b.units[1].cloneTurns=3;b.phase=1;b.queue=[0,1,2,3,4,5];
    const next=advanceBattle(b);if(next.reactions.some(r=>r.kind==='assist'&&r.source===1))result=next;
  }
  assert.ok(result);assert.ok(result.impacts.filter(e=>e.kind==='assist'&&e.source===1).length>=2);
  assert.equal(result.units[1].cloneTurns,3);assert.equal(result.units[1].actions,0);
});
