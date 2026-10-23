import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncBuffs,extendBuffDurations,dispelBuffs} from '../src/lib/buffEffects.js';
import {setTimedBuff} from '../src/lib/timedEffects.js';
import {applyShield} from '../src/lib/shieldEffects.js';
import {tickPersonalTurn} from '../src/lib/battleSurvival.js';
import {onAttackStacks,onRevivalRules} from '../src/lib/passiveRules.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';

test('extension uses each granted duration, covers timed stats, and excludes debuffs',()=>{
 const u={hp:100,immortal:3,physicalImmunity:2,critDamage:150,statusImmunities:{'감전':2},regenBuff:{remaining:2,base:10}};
 applyShield(u,100,4,{unremovable:true});setTimedBuff(u,'critDamage',40,4);syncBuffs(u);
 u.immortal=1;u.physicalImmunity=1;u.barrierTurns=2;u.statusImmunities['감전']=1;u.regenBuff.remaining=1;u.panelTimedBuffs[0].remaining=2;
 u.panelTimedBuffs.push({stat:'resist',delta:-10,remaining:1,debuff:true});
 extendBuffDurations(u,5);
 assert.equal(u.immortal,3);assert.equal(u.physicalImmunity,2);assert.equal(u.barrierTurns,4);assert.equal(u.statusImmunities['감전'],2);assert.equal(u.regenBuff.remaining,2);
 assert.equal(u.panelTimedBuffs[0].remaining,4);assert.equal(u.panelTimedBuffs[1].remaining,1);
 u.immortal=0;extendBuffDurations(u,1);assert.equal(u.immortal,0);
});

test('new shield provenance resets extension ceiling from four turns to two',()=>{
 const u={hp:100};applyShield(u,50,4);u.barrierTurns=1;applyShield(u,100,2);u.barrierTurns=1;extendBuffDurations(u,10);assert.equal(u.barrierTurns,2);
});

test('Juri extends external buffs on every third attack without shortening four-turn buffs',()=>{
 const u={name:'쥬리',id:0,side:'attacker',hp:100,attack:100,critDamage:150,barrier:30,barrierTurns:4};
 setTimedBuff(u,'critDamage',40,4);u.panelTimedBuffs[0].remaining=2;
 for(let i=0;i<3;i++)onAttackStacks(u,[u],[]);
 assert.equal(u.barrierTurns,4);assert.equal(u.panelTimedBuffs[0].remaining,3);
});

test('extension during own basic still consumes the existing personal turn',()=>{
 const u={hp:1,immortal:3,critDamage:150,statusImmunities:{'감전':2}};setTimedBuff(u,'critDamage',40,3);syncBuffs(u);
 u.immortal=1;u.panelTimedBuffs[0].remaining=1;u.statusImmunities['감전']=1;
 const before=structuredClone(u);extendBuffDurations(u,1);
 const n=tickPersonalTurn(u,before).target;
 assert.equal(n.immortal,1);assert.equal(n.panelTimedBuffs[0].remaining,1);assert.equal(n.statusImmunities['감전'],1);assert.equal(n.hp,1);
});

test('Juri revival assist bonus is a distinct removable three-turn buff',()=>{
 const u={name:'쥬리',hp:1,immortal:3,nullify:0,side:'attacker'};onRevivalRules(u,[u],[]);
 assert.equal(u.assistChanceBonus,24);assert.equal(u.panelTimedBuffs[0].remaining,3);
 // Immortality is normally removed first, so isolate removal of the chance buff.
 u.immortal=0;dispelBuffs(u,1);assert.equal(u.assistChanceBonus,0);
});

test('Juri assist attacks all three enemies when the allied basic hits only one',()=>{
 let result;
 for(let seed=1;seed<50&&!result;seed++){
  let h=prepareHeroes();for(const [id,name]of [[0,'메이'],[1,'쥬리'],[2,'벨라'],[3,'메이'],[4,'벨라'],[5,'아리엘']])h=changeHero(h,id,name);
  const b=createBattle(h,{seed,plans:{attacker:[],defender:[]}});b.phase=1;b.queue=[0];
  for(const u of b.units){u.hp=u.maxHp=1000000;u.attack=1;u.defense=0;u.barrier=0;u.nullify=0;u.immunity=0;u.control=0;u.sleep=0;u.stealth=0;u.linkTurns=0;}
  const n=advanceBattle(b);if(n.reactions.some(r=>r.kind==='juri_assist'))result=n;
 }
 assert.ok(result);assert.equal(new Set(result.impacts.filter(i=>i.kind==='juri_assist').map(i=>i.target)).size,3);
 assert.equal(result.units[1].actions,0);
});
