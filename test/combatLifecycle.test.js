import {test} from 'node:test';
import assert from 'node:assert/strict';
import {effectProbability,calculateHit,casterEffect} from '../src/lib/combatDamage.js';
import {rememberDebuff,syncDebuffs,cleanseDebuffs} from '../src/lib/statusEffects.js';
import {controlBurst,releaseControl} from '../src/lib/controlEffects.js';
import {applyEquipment,EQUIPMENT_SETS} from '../src/lib/equipmentEffects.js';
import {compileSkill,skillFor} from '../src/lib/simulationSkills.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
import {afterOwnSkill,conditionalDamage,beforeOwnSkill,afterOwnHit} from '../src/lib/skillRules.js';
import {onDeathRules} from '../src/lib/passiveRules.js';
import {setTimedDecrease} from '../src/lib/timedEffects.js';
import {setupDocument,readSetupFile} from '../src/lib/simulationWorkspace.js';
import {addDot,dotBase} from '../src/lib/damageOverTime.js';

test('DOT instances retain independent identity and cleanse one application at a time',()=>{
  const target={hp:1000,maxHp:1000,dots:[]};
  for(let i=0;i<2;i++)addDot(target,{name:'화상',source:1,attack:100,remaining:2,value:.8,scale:'attack'});
  assert.equal(target.dots.length,2);assert.notEqual(target.dots[0].effectId,target.dots[1].effectId);
  assert.equal(dotBase(target,target.dots[0]),80);cleanseDebuffs(target,1);assert.equal(target.dots.length,1);
  target.statusImmunities={중독:true};addDot(target,{name:'극독',remaining:2});assert.equal(target.dots.length,1);
});

test('effect chance bonuses multiply the skill probability separately from resistance',()=>{
  assert.equal(effectProbability({baseChance:30,chanceBonus:30}).skillChance,.39);
  assert.equal(effectProbability({baseChance:50,chanceBonus:-26,accuracy:20,resistance:40}).applied,.37*.8);
  const settings=casterEffect({accuracy:50,shockChanceBonus:30,effectChanceBonus:10},{resist:0},35,'감전');assert.ok(Math.abs(effectProbability(settings).applied-.49)<1e-12);
});
test('cleansing removes the oldest applied effect across scalar and stack families',()=>{
  const u={healBlock:2};syncDebuffs(u);u.control=2;rememberDebuff(u,'control');u.reflux=[{id:1}];syncDebuffs(u);
  assert.equal(cleanseDebuffs(u,1),1);assert.equal(u.healBlock,0);assert.equal(u.control,2);assert.equal(u.reflux.length,1);
  cleanseDebuffs(u,1);assert.equal(u.control,0);assert.equal(u.reflux.length,1);
});
test('expired effects lose their old order and unremovable poison survives cleanse',()=>{
  const u={healBlock:2};syncDebuffs(u);u.healBlock=0;syncDebuffs(u);u.control=1;syncDebuffs(u);u.healBlock=2;syncDebuffs(u);u.dots=[{unremovable:true},{unremovable:false}];
  cleanseDebuffs(u,1);assert.equal(u.control,0);assert.equal(u.healBlock,2);cleanseDebuffs(u);assert.equal(u.dots.length,1);assert.equal(u.dots[0].unremovable,true);
});
test('control-only cleanse leaves recovery blocks and stat debuffs in place',()=>{
  const u={healBlock:2,control:2,resist:30};setTimedDecrease(u,'resist',20,3);cleanseDebuffs(u,Infinity,{controlOnly:true});assert.equal(u.control,0);assert.equal(u.healBlock,2);assert.equal(u.resist,10);cleanseDebuffs(u);assert.equal(u.resist,30);
});
test('freeze and petrification releases queue one bounded burst using the caster snapshot',()=>{
  const target={maxHp:10000,control:2,controlName:'빙결',controlSource:{id:2,attack:1000}};
  assert.equal(controlBurst(target,'빙결',target.controlSource).base,3000);releaseControl(target);releaseControl(target);assert.equal(target.pendingControlBursts.length,1);assert.equal(target.control,0);
  assert.equal(controlBurst(target,'빙극',{id:2,attack:1}).base,6000);assert.equal(controlBurst(target,'석화',{id:2,attack:1000}).base,1200);
});
test('four-set equipment adds hidden effects without double-counting panel stats',()=>{
  for(const set of EQUIPMENT_SETS){const u={attack:1000,defense:500,maxHp:5000,crit:40,accuracy:30,resist:20,blockReduction:50,equipmentSet:set.id};applyEquipment(u);assert.equal(u.attack,1000);assert.equal(u.defense,500);assert.equal(u.maxHp,5000);assert.equal(u.crit,40);assert.equal(u.accuracy,30);assert.equal(u.resist,20);}
  const assassin={equipmentSet:'assassin'};applyEquipment(assassin);assert.equal(assassin.defenseIgnore,.15);
  const tracker={equipmentSet:'tracker'};applyEquipment(tracker);assert.equal(tracker.weakBonus,35);
  assert.throws(()=>applyEquipment({equipmentSet:'unknown'}));
});
test('equipment selection survives preset save, reload and team swap state',()=>{
  const draft=prepareHeroes();draft[0].equipmentSet='tracker';const doc=setupDocument({draft,plans:{attacker:[],defender:[]},seed:1});assert.equal(readSetupFile(JSON.stringify(doc)).draft[0].equipmentSet,'tracker');doc.draft[0].equipmentSet='not-a-set';assert.throws(()=>readSetupFile(JSON.stringify(doc)));
});
test('full enhancement effect prefixes, cleanse counts and defense heals are compiled',()=>{
  const s=compileSkill({code:2,text:'모든 아군\n- 디버프 해제 1개\n자신\n- 시전자 방어력의 65% 만큼 생명력 회복\n2초월 효과\n- 효과 추가: 모든 피해 면역 [2턴 지속]'});
  assert.equal(s.effects.find(e=>e.type==='cleanse').value,1);assert.equal(s.effects.find(e=>e.type==='heal').scale,'defense');assert.equal(s.effects.find(e=>e.type==='immunity').duration,2);
  assert.equal(skillFor('기유',1).weakBonus,100);assert.equal(skillFor('시노부',7).raw.gauge,120);
});
test('HP-only damage is executable and uses a published attack cap',()=>{
  const s=compileSkill({code:2,text:'단일 적군\n- 대상 최대 생명력의 20%만큼 1회 피해 (생명력 비례 피해는 시전자 공격력의 350% 제한)'});assert.equal(s.hits,1);assert.equal(s.hpRatio,.2);assert.equal(s.hpCap,3.5);assert.equal(s.coefficient,0);
});
test('typed team effects retain the target role rather than affect all allies',()=>{
  const s=skillFor('기유',3),nullify=s.effects.find(e=>e.type==='nullify');assert.deepEqual(nullify.roles,[5]);assert.equal(s.effects.find(e=>e.type==='drain').value,.31);
});
test('Rudy stance caps, spends the existing four stacks before replenishing, and clears on death',()=>{
  const unit={id:0,name:'루디',side:'attacker',defense:1000,attack:100,hp:100,maxHp:10000,barrier:0,immunity:0},ally={id:1,name:'연희',side:'attacker',hp:100,maxHp:10000};
  for(let i=0;i<5;i++)afterOwnSkill(unit,1,[unit,ally],[]);assert.equal(unit.rudyStance,4);assert.equal(unit.defense,1600);
  afterOwnSkill(unit,3,[unit,ally],[]);assert.equal(ally.hp,1940);assert.equal(unit.rudyStance,2);assert.equal(unit.defense,1300);assert.equal(ally.linkTurns,3);onDeathRules(unit,[unit,ally],[]);assert.equal(unit.defense,1000);assert.equal(unit.rudyStance,0);
});
test('Tanjiro conditional damage counts visible effects and Seonran scales by three stacks',()=>{
  const s={name:'탄지로',attack:1000},target={immunity:1,barrier:100,control:1,dots:[{}]};assert.equal(conditionalDamage(s,target,2),180);assert.equal(conditionalDamage(s,target,3),80);
  assert.equal(conditionalDamage({name:'선란',attack:1000,seonStacks:6},target,2),380);
});
test('Giyu mark applies before damage and reverts after ten direct hit counts',()=>{
  const u={name:'기유',defense:1000,damageIncrease:5};beforeOwnSkill(u,7);assert.equal(u.defense,1500);assert.equal(u.damageIncrease,35);for(let i=0;i<10;i++)afterOwnHit(u);assert.equal(u.defense,1000);assert.equal(u.damageIncrease,5);
});
test('all direct combat values remain finite through a status-heavy battle',()=>{
  let draft=prepareHeroes();for(const [i,name]of ['기유','시노부','하연','겔리두스','루디','클레미스'].entries())draft=changeHero(draft,i,name);let battle=createBattle(draft,{plans:{attacker:[],defender:[]},seed:17});for(let i=0;i<180&&!battle.done;i++)battle=advanceBattle(battle);assert.equal(battle.done,true);for(const u of battle.units)for(const key of ['hp','maxHp','attack','defense','damageDealt'])assert.ok(Number.isFinite(u[key]),u.name+' '+key);
});
