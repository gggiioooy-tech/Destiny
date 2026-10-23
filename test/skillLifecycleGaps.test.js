import {test}from 'node:test';import assert from 'node:assert/strict';
import {skillFor}from '../src/lib/simulationSkills.js';
import {combatSkill}from '../src/lib/heroTransformations.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle}from '../src/lib/experimentalBattle.js';
test('Karin full enhancement revives two allies at 70% and invokes revival passives',()=>{
 let h=prepareHeroes();for(const [id,name]of [[0,'카린'],[1,'선란'],[2,'여포']])h=changeHero(h,id,name);let b=createBattle(h,{plans:{attacker:[{id:0,code:3}],defender:[]}});b.skillSide='attacker';for(const u of b.units.slice(1,3)){u.hp=0;u.healBlock=2;u.control=2;u.controlName='기절';u.dots=[{name:'화상',remaining:2}];u.superiority=0;}b=advanceBattle(b);for(const u of b.units.slice(1,3)){assert.equal(u.hp,Math.round(u.maxHp*.7));assert.equal(u.revivalCount,1);assert.equal(u.control,0);assert.equal(u.healBlock,0);assert.equal(u.dots.length,0);}assert.equal(b.units[1].superiority,2);
});
test('Rudy awakening gauge decrease uses fully enhanced amount',()=>{const e=skillFor('루디',7).effects.find(e=>e.type==='gaugeDown');assert.equal(e.value,20);assert.equal(e.group,'enemy');});
test('cooldown effects distinguish self reset, party reset and party reduction',()=>{assert.equal(combatSkill({name:'실베스타'},7).effects.find(e=>e.type==='cooldownReset').group,'self');assert.equal(skillFor('헬레니아',7).effects.find(e=>e.type==='cooldownReset').group,'team');const n=skillFor('녹스',7).effects.find(e=>e.type==='cooldownDown');assert.equal(n.group,'team');assert.equal(n.value,16);});
test('killing multi-target recast attacks every remaining target and stops at published limit',()=>{
 let h=prepareHeroes();for(const [id,name]of [[0,'발리스타'],[3,'메이'],[4,'벨라'],[5,'아리엘']])h=changeHero(h,id,name);let b=createBattle(h,{plans:{attacker:[{id:0,code:3}],defender:[]}});b.skillSide='attacker';for(const u of b.units){u.hp=u.maxHp=100000;u.attack=1;u.defense=0;u.nullify=0;u.immunity=0;u.barrier=0;u.stealth=0;u.superiority=0;u.linkTurns=0;u.guts=false;u.revivePercent=0;u.ring='none';}b.units[0].attack=100000000;b.units[3].hp=1;b.units[4].nullify=b.units[5].nullify=50;const n=advanceBattle(b);assert.equal(n.units[4].nullify,46);assert.equal(n.units[5].nullify,46);assert.equal((n.log.at(-1).text.match(/처치 후 연속 발동/g)||[]).length,1);assert.ok(n.elapsedMs>n.lastTiming.endMs);
});
import {receiveDamage,tickPersonalTurn}from '../src/lib/battleSurvival.js';
import {reduceBuffDurations,dispelBuffs}from '../src/lib/buffEffects.js';
import {setTimedDecrease}from '../src/lib/timedEffects.js';
test('typed immunity filters matching damage only and penetration bypasses it',()=>{
 const u={hp:1000,maxHp:1000,physicalImmunity:2,magicImmunity:0,barrier:0,nullify:0};assert.equal(receiveDamage(u,100,{damageType:'physical'}).kind,'immune');assert.equal(receiveDamage(u,100,{damageType:'magic'}).target.hp,900);assert.equal(receiveDamage(u,100,{damageType:'physical',pierce:true}).target.hp,900);assert.equal(receiveDamage(u,100,{fixed:true}).target.hp,900);assert.equal(dispelBuffs(u,9).removed,0);reduceBuffDurations(u,1);assert.equal(u.physicalImmunity,1);assert.equal(tickPersonalTurn(u,{...u}).target.physicalImmunity,0);assert.equal(skillFor('헬레니아',3).effects.find(e=>e.type==='magicImmunity').duration,3);
});
test('ring revival restores timed stat debuffs and removes old-life unremovable DOT without release damage',()=>{
 const u={hp:100,maxHp:1000,attack:1000,ring:'daebul',nullify:0,barrier:0,control:2,controlName:'석화',controlSource:{id:1,attack:1000},buffBlock:2,dots:[{name:'극독',remaining:2,unremovable:true}]};setTimedDecrease(u,'attack',30,3,{ratio:true});const n=receiveDamage(u,1000).target;assert.equal(n.hp,1000);assert.equal(n.attack,1000);assert.equal(n.buffBlock,0);assert.equal(n.dots.length,0);assert.equal(n.pendingControlBursts.length,0);assert.equal(u.attack,700);assert.equal(u.dots.length,1);assert.equal(n.revivalCount,1);
});
test('skills requiring removable ally ailments cannot be cast on a clean team',()=>{
 let h=changeHero(prepareHeroes(),0,'관우'),b=createBattle(h,{plans:{attacker:[{id:0,code:3}],defender:[]}});b.skillSide='attacker';for(const u of b.units){u.control=0;u.sleep=0;u.healBlock=0;u.dots=[];u.panelTimedBuffs=[];}assert.equal(advanceBattle(b).action,null);b.units[1].healBlock=2;const n=advanceBattle(b);assert.equal(n.action.code,3);assert.equal(n.units[1].healBlock,0);
});
test('Skuld conditional healing reduction and cooldown upgrade retain vulnerability gate',()=>{
 const heal=skillFor('스쿨드',2).effects.find(e=>e.type==='statTimed'&&e.stat==='healingReduction');assert.equal(heal.value,48);assert.equal(heal.targetCondition.stat,'magicVulnerability');const cd=skillFor('스쿨드',3).effects.find(e=>e.type==='cooldownUp');assert.equal(cd.chance,70);assert.equal(cd.value,23);assert.equal(cd.targetCondition.stat,'magicVulnerability');const hp=skillFor('스쿨드',7).effects.find(e=>e.type==='healthConvert');assert.equal(hp.before,true);assert.equal(hp.value,39);assert.equal(hp.targetCondition.stat,'magicVulnerability');
});
test('a missed attack cannot become blocked solely because its critical probability is high',()=>{
 const h=changeHero(prepareHeroes(),0,'아일린');let b=createBattle(h,{plans:{attacker:[{id:0,code:2}],defender:[]}});b.skillSide='attacker';b.units[0].missChance=100;b.units[0].weakPoint=0;b.units[0].crit=100;for(const u of b.units.slice(3)){u.block=0;u.blockBuff=0;u.blockDebuff=0;u.superiority=0;u.nullify=0;u.immunity=0;}b=advanceBattle(b);const misses=b.impacts.filter(i=>i.missed&&typeof i.blocked==='boolean');assert.ok(misses.length);assert.ok(misses.every(i=>!i.blocked&&!i.critical));
});
test('group conditional HP conversion completes before Hayeon rescue and following heal block',()=>{
 let h=changeHero(changeHero(prepareHeroes(),0,'스쿨드'),3,'하연'),b=createBattle(h,{plans:{attacker:[],defender:[]}});b.skillSide='attacker';for(const u of b.units){u.hp=u.maxHp=10000;u.attack=1;u.defense=0;u.nullify=0;u.immunity=0;u.barrier=0;u.linkTurns=0;u.superiority=0;u.stealth=0;u.controlImmune=99;u.resist=0;u.accuracy=100;}b.units[0].awakenGauge=b.units[0].awakenMax;for(const u of b.units.slice(3))u.magicVulnerability=20;b=advanceBattle(b);assert.equal(b.action.code,7);for(const u of b.units.slice(3)){assert.equal(u.hp,6100);assert.equal(u.healBlock,3);assert.ok(u.barrier>2400);}
});
test('secondary shock death does not satisfy a direct skill kill recast condition',()=>{
 let h=prepareHeroes();for(const [id,name]of [[0,'발리스타'],[3,'메이'],[4,'벨라'],[5,'아리엘']])h=changeHero(h,id,name);let b=createBattle(h,{plans:{attacker:[{id:0,code:3}],defender:[]}});b.skillSide='attacker';for(const u of b.units){u.hp=u.maxHp=100000;u.attack=1;u.defense=0;u.nullify=0;u.immunity=0;u.barrier=0;u.stealth=0;u.superiority=0;u.linkTurns=0;u.guts=false;u.revivePercent=0;u.ring='none';}b.units[3].control=2;b.units[3].controlName='감전';b.units[3].shockSource={id:1,attack:100000000};b.units[4].nullify=b.units[5].nullify=50;const n=advanceBattle(b);assert.equal(n.units[3].hp,0);assert.equal(n.units[4].nullify,48);assert.equal(n.units[5].nullify,48);assert.ok(!n.log.at(-1).text.includes('처치 후 연속 발동'));
});
test('Vanessa skill-triggered vulnerability applies before her own damage',()=>{
 let h=prepareHeroes();for(const [id,name]of [[0,'바네사'],[1,'린'],[2,'카린'],[3,'메이'],[4,'벨라'],[5,'아리엘']])h=changeHero(h,id,name);let b=createBattle(h,{plans:{attacker:[{id:0,code:2}],defender:[]}});b.skillSide='attacker';for(const u of b.units){u.hp=u.maxHp=1000000;u.attack=1000;u.defense=0;u.crit=0;u.weakPoint=0;u.block=0;u.blockBuff=0;u.blockDebuff=0;u.damageIncrease=0;u.damageReduction=0;u.magicReduction=0;u.magicVulnerability=0;u.vulnerability=0;u.amplification=0;u.nullify=0;u.immunity=0;u.barrier=0;u.linkTurns=0;u.superiority=0;u.stealth=0;u.resist=0;u.accuracy=100;}const n=advanceBattle(b),s=skillFor('바네사',2),hits=n.impacts.filter(i=>i.target===3&&i.kind==='damage');assert.equal(hits.length,s.hits);assert.ok(hits.every(i=>i.damage===Math.round(1000*s.coefficient*1.24)));
});
import {followupTiming}from '../src/lib/battleTiming.js';
test('observed Yoon triggered sequences have distinct spacing and opposite-skill durations',()=>{
 const first=followupTiming('윤건',2,3),second=followupTiming('윤건',3,2);assert.equal(first.estimated,false);assert.equal(first.spacingMs,1071);assert.equal(first.medianMs,3397);assert.equal(second.medianMs,2142);assert.equal(followupTiming('not-a-hero',2).estimated,true);
});
test('Yeonhee skill shield respects buff block instead of bypassing it in the dedicated branch',()=>{
 let h=changeHero(prepareHeroes(),0,'연희'),b=createBattle(h,{plans:{attacker:[{id:0,code:2}],defender:[]}});b.skillSide='attacker';b.units[0].barrier=0;b.units[0].buffBlock=2;const n=advanceBattle(b);assert.equal(n.units[0].barrier,0);
});
