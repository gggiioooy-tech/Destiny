import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
import {roleCount,onHealthThreshold,onAttackStacks,onSkillRules,onRevivalRules,onGutsRules,onDeathRules,grantShield} from '../src/lib/passiveRules.js';
import {damageShares,deferPain} from '../src/lib/passiveDamage.js';
import {queuePassiveAttacks} from '../src/lib/passiveAttacks.js';
import {afterControl,afterHitPassive,afterHpChange} from '../src/lib/conditionalPassives.js';
import {combatSkill} from '../src/lib/heroTransformations.js';
import {tickPersonalTurn} from '../src/lib/battleSurvival.js';
import {calculatePrebattle,defaultPrebattleSettings} from '../src/lib/prebattleStats.js';
function battle(names){let h=prepareHeroes();names.forEach((n,i)=>h=changeHero(h,i,n));return createBattle(h);}

test('role support counts two matching heroes as three, not one as two',()=>{
  const b=battle(['선란','여포','하연']);assert.equal(roleCount(b.units,'attacker',1),3);
  const c=battle(['선란','윤건','하연']);assert.equal(roleCount(c.units,'attacker',1),1);
});
test('HP threshold immunity triggers once and belongs to the owner',()=>{
  const b=battle(['나타']);const u=b.units[0];u.hp=u.maxHp*.4;onHealthThreshold(u,b.units,[]);assert.equal(u.immunity,2);
  u.immunity=0;onHealthThreshold(u,b.units,[]);assert.equal(u.immunity,0);assert.equal(b.units[1].immunity,0);
});
test('Hayeon threshold heals the whole party only on her own threshold',()=>{
  const b=battle(['하연']);const owner=b.units[0],ally=b.units[1];ally.hp=1;afterHpChange(ally,b.units,[]);assert.equal(ally.hp,1);
  owner.hp=owner.maxHp*.4;afterHpChange(owner,b.units,[]);assert.ok(ally.hp>1);assert.ok(ally.barrier>0);
});
test('guts exchange chooses greatest absolute HP, clamps to maximum and applies both debuffs',()=>{
  const b=battle(['하연']);const u=b.units[0];u.hp=1;u.accuracy=1000;b.units[3].hp=100;b.units[4].hp=5000;b.units[5].hp=300;
  onGutsRules(u,b.units,[],()=>0);assert.equal(u.hp,5000);assert.equal(b.units[4].hp,1);assert.equal(b.units[4].healBlock,2);assert.equal(b.units[4].buffBlock,2);
});
test('link shares 80 percent evenly and guard replaces link for guarded back-row universal',()=>{
  const b=battle(['루디','손오공','라드그리드']);b.units[1].battleRow='back';b.units[0].battleRow='front';
  const guarded=damageShares(b.units[1],b.units,1000);assert.deepEqual(guarded,[{id:1,amount:650},{id:2,amount:175}]);
  b.units[2].hp=0;const linked=damageShares(b.units[1],b.units,1000);assert.equal(linked.length,2);assert.equal(linked.reduce((n,p)=>n+p.amount,0),800);
});
test('pain defers exactly 75 percent into five equal installments and ignores small hits',()=>{
  const u={endurePain:true,maxHp:10000};assert.equal(deferPain(u,999),999);assert.equal(u.deferredPain,undefined);
  assert.equal(deferPain(u,2000),500);assert.deepEqual(u.deferredPain,[{remaining:5,perTurn:300}]);
});
test('stack growth uses a fixed base, caps and does not keep adding damage at cap',()=>{
  const b=battle(['아리스','프레이야']);const a=b.units[0];for(let i=0;i<50;i++)afterHitPassive(a,b.units,[]);assert.equal(a.arisStacks,30);assert.equal(a.damageIncrease,60);
  const f=b.units[1],old=f.attack;for(let i=0;i<10;i++)onAttackStacks(f,b.units,[]);assert.equal(f.divinityStacks,6);assert.ok(Math.abs(f.attack-old-old/1.2*.1)<1e-8);
});
test('party skill counters do not grant Klemyth regeneration on another hero skill',()=>{
  const b=battle(['클레미스']);onSkillRules(b.units[1],b.units,[]);assert.equal(b.units[1].regenBuff,undefined);
  onSkillRules(b.units[0],b.units,[]);assert.ok(b.units[1].regenBuff.base>0);
});
test('once-only party control cleanse cannot repeat; innate repeatable cleanse can',()=>{
  const b=battle(['란드그리드','선란']);const u=b.units[1];u.control=2;afterControl(u,[],b.units);assert.equal(u.control,0);assert.equal(u.controlImmune,2);
  u.controlImmune=0;u.control=2;afterControl(u,[],b.units);assert.equal(u.control,2);
  const c=battle(['실베스타']);for(let i=0;i<6;i++){c.units[0].control=1;afterControl(c.units[0],[],c.units);}assert.equal(c.units[0].cleanseAttackStacks,4);
});
test('revival and enemy deaths replenish indomitable with the correct cap',()=>{
  const b=battle(['탄지로']);const u=b.units[0];u.indomitableHits=3;const old=u.critDamage;onRevivalRules(u,b.units,[]);assert.equal(u.critDamage,old+49);
  onDeathRules(b.units[3],b.units,[]);assert.equal(u.indomitableHits,5);u.indomitableHits=8;onDeathRules(b.units[4],b.units,[]);assert.equal(u.indomitableHits,8);
});
test('conditional passive attacks are separate events and do not consume reservations',()=>{
  const b=battle(['윤건']);const queue=[];b.units[0].passiveAttackCount=2;queuePassiveAttacks('attack',b.units[0],b.units,queue);
  assert.equal(queue.length,1);assert.equal(queue[0].kind,'hero_passive');assert.equal(queue[0].spec.hp,.22);assert.equal(b.plans.attacker.length,3);
});
test('clone skills are conditional and expire with personal turns',()=>{
  const b=battle(['손오공']),u=b.units[0];assert.equal(combatSkill(u,1).hits,1);u.cloneTurns=5;assert.equal(combatSkill(u,1).hits,2);assert.equal(combatSkill(u,2).hpRatio,.07);
  let next=u;for(let i=0;i<5;i++)next=tickPersonalTurn(next,structuredClone(next)).target;assert.equal(next.cloneTurns,0);assert.equal(combatSkill(next,1).hits,1);
});
test('newly granted timed stat buff does not tick alongside an older buff',()=>{
  const before={hp:100,attack:100,panelTimedBuffs:[{source:'old',stat:'attack',delta:10,remaining:1}]};
  const current={...before,attack:120,panelTimedBuffs:[...before.panelTimedBuffs,{source:'new',stat:'attack',delta:20,remaining:2}]};
  const next=tickPersonalTurn(current,before).target;assert.equal(next.attack,110);assert.equal(next.panelTimedBuffs[0].remaining,2);
});
test('buff block prevents future shields',()=>{const u={hp:100,barrier:0,buffBlock:2};grantShield(u,1000,3);assert.equal(u.barrier,0);});
test('flat derived stat caps use the full skill upgrade',()=>{
  let h=prepareHeroes();h=changeHero(h,0,'콜트');h[0].speed=999;const s=defaultPrebattleSettings();const r=calculatePrebattle(h,s);const rows=r.breakdown[0].rows.filter(r=>r.bonuses?.some(b=>b.source==='콜트 비례 패시브'));assert.equal(rows.at(-1).bonuses[0].value,1320);
});
test('basic passive attack really executes after the second Yun action',()=>{
  const b=battle(['윤건']);b.units[0].speed=999;b.units[0].maxHp=100000;b.units[0].hp=100000;b.units[0].passiveAttackCount=1;b.phase=1;
  const next=advanceBattle(b);assert.ok(next.reactions.some(r=>r.name==='윤건 · 2회 공격'));
});
