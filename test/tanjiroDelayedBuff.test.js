import {test} from 'node:test';
import assert from 'node:assert/strict';
import {grantDelayedBuff,expireDelayedBuff,dispelBuffs,reduceBuffDurations} from '../src/lib/buffEffects.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
import {skillFor} from '../src/lib/simulationSkills.js';
import {buffCount} from '../src/lib/skillRules.js';

test('ordinary removal cancels Tanjiro delay without granting follow-up effects',()=>{
 const u={hp:100,attack:1000,nullify:0};grantDelayedBuff(u);assert.equal(dispelBuffs(u,1).removed,1);
 assert.equal(u.delayedTan,0);assert.equal(u.nullify,0);assert.equal(u.attack,1000);
});
test('forced duration expiration grants a fresh two-turn buff after reduction finishes',()=>{
 const u={hp:100,attack:1000,nullify:0};grantDelayedBuff(u);
 reduceBuffDurations(u,2);assert.equal(u.delayedTan,0);assert.equal(u.nullify,3);assert.equal(u.attack,1250);
 assert.equal(u.panelTimedBuffs[0].remaining,2);
});
test('a partial reduction does not release delay and repeat grants do not stack attack',()=>{
 const u={hp:100,attack:1000,nullify:0};grantDelayedBuff(u);reduceBuffDurations(u,1);
 assert.equal(u.delayedTan,1);assert.equal(u.nullify,0);assert.equal(u.attack,1000);
 reduceBuffDurations(u,1);grantDelayedBuff(u);reduceBuffDurations(u,2);
 assert.equal(u.attack,1250);assert.equal(u.panelTimedBuffs.filter(b=>b.source==='지연 버프').length,1);
});
test('buff block and death prevent delayed rewards',()=>{
 for(const u of [{hp:100,attack:1000,nullify:0,buffBlock:2},{hp:0,attack:1000,nullify:0}]){
  grantDelayedBuff(u);assert.equal(u.delayedTan,undefined);expireDelayedBuff(u);assert.equal(u.attack,1000);assert.equal(u.nullify,0);
 }
});
test('buff-count damage sees active delay and regeneration, not expired timed entries',()=>{
 const u={delayedTan:2,regenBuff:{remaining:1},panelTimedBuffs:[{stat:'attack',source:'expired',remaining:0},{stat:'critDamage',source:'live',remaining:1}],statusImmunities:{'감전':1,'중독':0}};
 assert.equal(buffCount(u),4);u.delayedTan=0;u.regenBuff.remaining=0;assert.equal(buffCount(u),2);
});
test('Tanjiro awakening compiles offensive-ally delayed grants',()=>{
 const s=skillFor('탄지로',7),e=s.effects.find(e=>e.type==='delayedTan');assert.ok(e);assert.equal(e.group,'team');assert.deepEqual(e.roles,[1]);assert.equal(e.duration,2);
});
function fixture(){
 let h=prepareHeroes();for(const [id,name]of [[0,'탄지로'],[1,'여포'],[2,'루디'],[3,'메이'],[4,'벨라'],[5,'아리엘']])h=changeHero(h,id,name);
 const b=createBattle(h,{plans:{attacker:[],defender:[]}});
 for(const u of b.units){u.hp=u.maxHp=1000000;u.attack=100;u.defense=0;u.barrier=0;u.nullify=0;u.control=0;u.sleep=0;u.immunity=0;u.linkTurns=0;u.superiority=0;u.stealth=0;}
 return b;
}
test('natural expiration counts personal basics and retains the new attack buff for two turns',()=>{
 let b=fixture();assert.equal(b.units[0].delayedTan,2);assert.equal(b.units[1].delayedTan,2);assert.equal(b.units[2].delayedTan,undefined);
 for(let i=0;i<2;i++){b.phase=1;b.queue=[1];b=advanceBattle(b);}
 const u=b.units[1];assert.equal(u.delayedTan,0);assert.equal(u.nullify,3);assert.equal(u.attack,125);assert.equal(u.panelTimedBuffs.find(b=>b.source==='지연 버프').remaining,2);
});
test('awakening reapplies delay to offensive allies only without consuming a basic turn',()=>{
 let b=fixture();for(const u of b.units){u.delayedTan=0;u.buffOrder=[];}b.units[0].awakenGauge=b.units[0].awakenMax;b.phase=0;b.skillSide='attacker';
 b=advanceBattle(b);assert.equal(b.action.code,7);assert.equal(b.units[0].delayedTan,2);assert.equal(b.units[1].delayedTan,2);assert.equal(b.units[2].delayedTan,0);
});
