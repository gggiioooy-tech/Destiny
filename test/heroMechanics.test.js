import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
import {combatSkill,transformDellons,addDellonsStacks} from '../src/lib/heroTransformations.js';
import {afterControl,afterSkillPassive,afterHitPassive,afterHpChange} from '../src/lib/conditionalPassives.js';
import {setupDocument,readSetupFile} from '../src/lib/simulationWorkspace.js';
test('Dellons transformation changes all attack skills and caps critical damage stacks',()=>{
 let h=changeHero(prepareHeroes(),0,'델론즈'),b=createBattle(h),u=b.units[0];const old=u.critDamage;
 transformDellons(u,b.units);assert.equal(u.transformed,true);assert.equal(u.critDamage,old+48);assert.equal(u.controlImmune,Infinity);assert.equal(u.nullify,6);assert.equal(b.units[1].nullify,5);
 assert.equal(combatSkill(u,1).coefficient,.3);assert.equal(combatSkill(u,1).hits,2);assert.equal(combatSkill(u,1).cooldownReduction,19);assert.equal(combatSkill(u,2).coefficient,.97);assert.equal(combatSkill(u,3).executeRatio,.3);
 addDellonsStacks(u,100);assert.equal(u.critDamage,old+128);
});
test('Dellons awakening actually changes state during battle',()=>{
 const h=changeHero(prepareHeroes(),0,'델론즈');let b=createBattle(h,{plans:{attacker:[],defender:[]}});b.skillSide='attacker';b.units[0].awakenGauge=b.units[0].awakenMax;b=advanceBattle(b);assert.equal(b.action.code,7);assert.equal(b.units[0].transformed,true);
});
test('Sylvester blessing uses 25 percent and skill recovery uses his current attack',()=>{
 const b=createBattle(changeHero(prepareHeroes(),0,'실베스타'));const u=b.units[0];assert.equal(u.blessing,25);assert.equal(u.gutsShieldPercent,135);u.hp=1;afterSkillPassive(u,[]);assert.ok(u.hp>1);
 u.control=2;const old=u.attack;afterControl(u,[]);assert.equal(u.control,0);assert.equal(u.controlImmune,1);assert.equal(u.attack,old*1.1);
});
test('Hayeon own HP threshold rescues the party once and ring selections survive saved setups',()=>{
 const h=changeHero(prepareHeroes(),0,'하연'),b=createBattle(h);const u=b.units[0];b.units[1].hp=1;u.hp=1;afterHpChange(u,b.units,[]);assert.equal(u.hayeonRescueUsed,true);const before=u.hp;u.hp=1;afterHpChange(u,b.units,[]);assert.equal(u.hp,1);assert.ok(before>1);
 h[1].ring='daebul';const doc=setupDocument({draft:h,plans:{attacker:[],defender:[]},seed:1});assert.equal(readSetupFile(JSON.stringify(doc)).draft[1].ring,'daebul');
});

test('Dellons single-target kill can repeat once and pays additional battle time',()=>{
 const h=changeHero(prepareHeroes(),0,'델론즈');for(const u of h){u.attack=1;u.maxHp=10000;u.speed=50;u.resist=100;}h[0].attack=100000;h[0].weakPoint=100;
 let b=createBattle(h,{plans:{attacker:[{id:0,code:3}],defender:[]}});b.skillSide='attacker';for(const u of b.units.filter(u=>u.side==='defender')){u.nullify=0;u.revivePercent=0;u.reviveImmortalTurns=0;u.immunity=0;u.barrier=0;}
 b=advanceBattle(b);assert.ok(b.log[0].text.includes('연속 발동'));assert.ok(b.elapsedMs>b.lastTiming.durationMs);
});
