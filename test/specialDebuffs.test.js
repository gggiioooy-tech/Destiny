import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addReflux,spreadReflux,specialHitEffects,directDebuffHits,crystalResonance,tickReflux,applyLubuMark} from '../src/lib/specialDebuffs.js';
import {afterHpChange} from '../src/lib/conditionalPassives.js';
import {afterHitPassive,cleanseOne} from '../src/lib/conditionalPassives.js';
import {onAttackStacks,onRevivalRules,onDeathRules,onSkillRules} from '../src/lib/passiveRules.js';
import {receiveDamage,tickPersonalTurn} from '../src/lib/battleSurvival.js';
import {setTimedDebuff} from '../src/lib/timedEffects.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
const always=()=>0;
const unit=(id,name,side='attacker')=>({id,name,side,hp:10000,maxHp:10000,attack:2000,defense:1000,accuracy:100,resist:0,damageIncrease:0,readyAt:{2:0,3:0},barrier:0,barrierTurns:0});
test('reflux respects resistance and a seven-instance cap',()=>{
  const source=unit(0,'멜키르'),target=unit(1,'루디','defender');target.resist=200;
  assert.equal(addReflux(source,target,2,100,always),false);target.resist=0;
  for(let i=0;i<10;i++)addReflux(source,target,2,100,always);assert.equal(target.reflux.length,7);
});
test('reflux damage uses full-transcendence HP ratio and caster attack cap once per direct hit',()=>{
  const source=unit(0,'멜키르'),target=unit(1,'루디','defender'),hits=[];source.refluxDamageIncrease=20;
  addReflux(source,target,2,100,always);directDebuffHits(target,structuredClone(target),[source,target],always,(...args)=>hits.push(args),[],0);
  assert.equal(hits.length,1);assert.equal(hits[0][1],Math.round(1800/(1+1000*.00214)));
});
test('reflux expiration spreads without ticking newly received effects',()=>{
  const source=unit(0,'멜키르'),host=unit(1,'루디','defender'),ally=unit(2,'하연','defender');
  addReflux(source,host,1,100,always);const before=structuredClone(host);addReflux(source,host,2,100,always);
  tickReflux(host,before,[source,host,ally],always,[]);assert.equal(host.reflux.length,1);assert.equal(host.reflux[0].remaining,2);assert.equal(ally.reflux[0].remaining,1);
});
test('a dead caster can transfer existing reflux with its original attack snapshot',()=>{
  const source=unit(0,'멜키르'),host=unit(1,'루디','defender'),ally=unit(2,'하연','defender');addReflux(source,host,2,100,always);source.hp=0;source.attack=1;
  spreadReflux(host,host.reflux,[source,host,ally],always,[]);assert.equal(ally.reflux[0].attack,2000);
});
test('Milia crystals require three mages and distinguish single application from per-hit skills',()=>{
  const source=unit(0,'밀리아'),target=unit(3,'루디','defender'),units=[source,unit(1,'멜키르'),unit(2,'연희'),target];
  specialHitEffects(source,target,1,units,always,{each:true});assert.equal(target.crystals,undefined);
  specialHitEffects(source,target,1,units,always);assert.equal(target.crystals[0].hits,5);
  specialHitEffects(source,target,3,units,always,{each:true});assert.equal(target.crystals[1].hits,4);
});
test('crystal detonation adds 2435 damage and starts cooldown from the present time',()=>{
  const source=unit(0,'밀리아'),target=unit(1,'루디','defender');target.crystals=[{id:1,source:0,hits:1}];const hits=[];
  directDebuffHits(target,structuredClone(target),[source,target],always,(...args)=>hits.push(args),[],5000);
  assert.equal(hits[0][1],2435);assert.equal(target.readyAt[2],19000);assert.equal(target.crystals.length,0);
});
test('resonance subtracts four hits and cooldown immunity blocks the cooldown debuff',()=>{
  const source=unit(0,'밀리아'),target=unit(1,'루디','defender');target.cooldownImmune=1;target.crystals=[{id:1,source:0,hits:4},{id:2,source:0,hits:5}];const hits=[];
  crystalResonance(source,target,[source,target],always,(...args)=>hits.push(args),[],5000);
  assert.equal(hits.length,1);assert.equal(target.crystals[0].hits,1);assert.equal(target.readyAt[2],0);
});
test('Lubu marks detonate at two stacks, cap HP damage, and refresh rather than stack weak damage',()=>{
  const source=unit(0,'여포'),target=unit(1,'루디','defender'),hits=[];source.attack=100;
  for(let i=0;i<4;i++)applyLubuMark(source,target,always,(...args)=>hits.push(args),[]);
  assert.equal(hits.length,2);assert.equal(hits[0][1],350);assert.equal(source.weakBonus,28);assert.equal(source.panelTimedBuffs.length,1);assert.equal(source.panelTimedBuffs[0].remaining,5);
});
test('Wukong threshold heals the party once only when Wukong crosses half HP',()=>{
  const source=unit(0,'손오공'),ally=unit(1,'루디');ally.hp=1;afterHpChange(ally,[source,ally],[]);assert.equal(ally.hp,1);
  source.hp=5000;afterHpChange(source,[source,ally],[]);assert.equal(ally.hp,1901);afterHpChange(source,[source,ally],[]);assert.equal(ally.hp,1901);
});
test('three-hit passive attacks produce three separate damage events per living target',()=>{
  let heroes=prepareHeroes();heroes=changeHero(heroes,0,'선란');let battle=createBattle(heroes);battle.units[0].seonStacks=6;battle.units[0].hp=battle.units[0].maxHp=100000;
  battle.units[0].seonStrikeQueued=false;battle.units[0].speed=1;
  for(let i=0;i<30&&!battle.done;i++){battle=advanceBattle(battle);if(battle.reactions?.some(r=>r.name==='선란 · 무영비검')){const impacts=battle.impacts.filter(x=>x.source===0&&x.kind==='hero_passive');assert.ok(impacts.length>=3);return;}}
  assert.fail('passive attack did not trigger');
});
test('Jinwoo levels cap at forty and survive death and revival',()=>{
  const u=unit(0,'성진우'),enemy=unit(1,'루디','defender');u.lastAttackBasic=false;u.nullify=0;
  for(let i=0;i<50;i++)onAttackStacks(u,[u,enemy],[]);assert.equal(u.jinwooLevels,40);assert.equal(u.attack,4400);
  onDeathRules(enemy,[u,enemy],[]);onRevivalRules(u,[u,enemy],[]);assert.equal(u.attack,4400);assert.equal(u.jinwooLevels,40);assert.equal(u.nullify,3);
});
test('Skuld receives one fate thread for an attack including its chained hits',()=>{
  const u=unit(0,'스쿨드'),units=[u,unit(1,'연희'),unit(2,'멜키르')];u.nullify=0;
  for(let i=0;i<8;i++)afterHitPassive(u,units,[],{attackToken:1});assert.equal(u.fateThreads,1);
  afterHitPassive(u,units,[],{attackToken:2});afterHitPassive(u,units,[],{attackToken:3});assert.equal(u.fateThreads,0);assert.equal(u.nullify,4);
});
test('Giyu grants each ally a separate four-hit cleanse and gauge trigger',()=>{
  const u=unit(0,'기유'),ally=unit(1,'루디');for(const a of [u,ally]){a.control=2;a.sleep=2;a.awakenMax=120;a.awakenGauge=5;}
  for(let i=0;i<4;i++)afterHitPassive(u,[u,ally],[]);assert.equal(u.control,0);assert.equal(u.sleep,2);assert.equal(u.awakenGauge,15);assert.equal(ally.control,2);assert.equal(ally.awakenGauge,5);
  for(let i=0;i<4;i++)afterHitPassive(ally,[u,ally],[]);assert.equal(ally.control,0);assert.equal(ally.sleep,2);assert.equal(ally.awakenGauge,15);
});
test('hit-count reduction expires and damage nullification does not consume it',()=>{
  const u={...unit(0,'루디'),reductionHits:2,hitReduction:23,nullify:1};let out=receiveDamage(u,1000);assert.equal(out.target.reductionHits,2);
  out=receiveDamage(out.target,1000);assert.equal(out.damage,770);assert.equal(out.target.reductionHits,1);
  out=receiveDamage(out.target,1000);assert.equal(out.target.reductionHits,0);assert.equal(receiveDamage(out.target,1000).damage,1000);
});
test('timed vulnerability uses strongest value and cleanses back to its original aura',()=>{
  const u=unit(0,'루디');u.magicVulnerability=20;setTimedDebuff(u,'magicVulnerability',24,2);setTimedDebuff(u,'magicVulnerability',20,3);
  assert.equal(u.magicVulnerability,24);assert.equal(u.panelTimedBuffs.length,1);assert.equal(cleanseOne(u),true);assert.equal(u.magicVulnerability,20);
});
test('Skuld shield reduction expires and affects a power ring shield',()=>{
  const u=unit(0,'스쿨드'),target={...unit(1,'루디','defender'),ring:'daegwon',attack:2000};onSkillRules(u,[u,target],[],always);assert.equal(target.shieldReduction,60);
  const out=receiveDamage(target,99999);assert.equal(out.target.hp,1);assert.equal(out.target.barrier,1200);
  let next=target;for(let i=0;i<3;i++)next=tickPersonalTurn(next,structuredClone(next)).target;assert.equal(next.shieldReduction,0);
});
