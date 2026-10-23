import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refreshPassiveAwakenings,consumePassiveAwakeningTurn,awakeningIgnore,queueAwakeningBlock} from '../src/lib/passiveAwakening.js';
import {afterHitPassive} from '../src/lib/conditionalPassives.js';
import {onRevivalRules,restoreHp} from '../src/lib/passiveRules.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
const aris=()=>({id:0,name:'아리스',side:'attacker',hp:500,maxHp:1000,attack:100,damageIncrease:0,awakenMax:75,awakenGauge:75,awakenUsed:false});

test('full-strength Aris rage raises attack and damage by six points per stack',()=>{
 const u=aris();u.awakenGauge=0;afterHitPassive(u,[u],[]);assert.equal(u.attack,106);assert.equal(u.damageIncrease,6);assert.equal(u.awakenGauge,3);
 onRevivalRules(u,[u],[]);assert.equal(u.arisStacks,11);assert.equal(u.attack,166);assert.equal(u.damageIncrease,66);
 for(let i=0;i<50;i++)afterHitPassive(u,[u],[]);assert.equal(u.attack,280);assert.equal(u.damageIncrease,180);assert.equal(u.arisStacks,30);
});
test('activation heals then cleanses once without an ordinary skill action',()=>{
 const u=aris(),ally={id:1,side:'attacker',hp:100,maxHp:1000,healBlock:2},enemy={id:3,side:'defender',hp:1000};const units=[u,ally,enemy],events=[];
 refreshPassiveAwakenings(units,events);assert.equal(u.hp,595);assert.equal(ally.hp,100);assert.equal(ally.healBlock,0);assert.equal(u.passiveAwakenActive,true);assert.equal(u.awakenUsed,true);
 assert.equal(enemy.awakeningHealingReduction,52);assert.equal(enemy.awakeningBlockDebuff,23);assert.equal(u.actions,undefined);
 refreshPassiveAwakenings(units,events);assert.equal(u.hp,595);assert.equal(events.length,1);
});
test('active gauge drains 25 per completed personal basic and never activates twice',()=>{
 const u=aris(),enemy={side:'defender',hp:100};refreshPassiveAwakenings([u,enemy]);
 for(const expected of [50,25,0]){consumePassiveAwakeningTurn(u);assert.equal(u.awakenGauge,expected);}
 refreshPassiveAwakenings([u,enemy]);assert.equal(u.passiveAwakenActive,false);assert.equal(enemy.awakeningHealingReduction,0);assert.equal(enemy.awakeningBlockDebuff,0);
 u.awakenGauge=75;refreshPassiveAwakenings([u,enemy]);assert.equal(u.passiveAwakenActive,false);
});
test('awakening ignore replaces weaker skill ignore rather than adding forty twice',()=>{
 const u=aris();u.passiveAwakenActive=true;assert.equal(awakeningIgnore(u,0),.4);assert.equal(awakeningIgnore(u,.4),.4);assert.equal(awakeningIgnore(u,.65),.65);
});
test('temporary aura does not add to a stronger same-family recovery reduction',()=>{
 const u=aris(),enemy={side:'defender',hp:1,maxHp:1000,healingReduction:70};refreshPassiveAwakenings([u,enemy]);assert.equal(restoreHp(enemy,100),30);
 u.awakenGauge=0;refreshPassiveAwakenings([u,enemy]);assert.equal(enemy.healingReduction,70);assert.equal(restoreHp(enemy,100),30);
});
test('expired awakening does not enqueue further block reactions',()=>{
 const u=aris(),queue=[];queueAwakeningBlock(u,queue);assert.equal(queue.length,0);refreshPassiveAwakenings([u]);queueAwakeningBlock(u,queue);assert.equal(queue[0].code,7);assert.equal(queue[0].spec.targetDefense,1.78);u.awakenGauge=0;refreshPassiveAwakenings([u]);queueAwakeningBlock(u,queue);assert.equal(queue.length,1);
});
function fixture(){
 let h=prepareHeroes();for(const [id,name]of [[0,'메이'],[1,'벨라'],[2,'아리엘'],[3,'아리스'],[4,'메이'],[5,'벨라']])h=changeHero(h,id,name);
 const b=createBattle(h,{plans:{attacker:[],defender:[]}});
 for(const u of b.units){u.hp=u.maxHp=1000000;u.attack=1;u.defense=1000;u.crit=0;u.weakPoint=0;u.block=0;u.blockBuff=0;u.blockDebuff=0;u.shred=0;u.barrier=0;u.nullify=0;u.immunity=0;u.linkTurns=0;u.stealth=0;u.superiority=0;u.healBlock=0;u.resist=0;u.accuracy=100;u.panelTimedBuffs=[];}
 return b;
}
test('full gauge activates automatically while the normal reserved skill still executes',()=>{
 const b=fixture();b.units[3].awakenGauge=75;b.plans.defender=[{id:3,code:2}];b.skillSide='defender';const n=advanceBattle(b);
 assert.equal(n.action.code,2);assert.equal(n.active,3);assert.equal(n.units[3].actions,1);assert.equal(n.units[3].skillActions,1);assert.equal(n.units[3].passiveAwakenActive,true);
});
test('blocked incoming basic queues three-target defense damage and observed reaction duration',()=>{
 const b=fixture();b.phase=1;b.queue=[0];b.units[0].weakPoint=100;b.units[3].hp=900000;b.units[3].block=100;b.units[3].awakenGauge=75;
 for(const u of b.units.slice(0,3))u.controlImmune=3;
 const n=advanceBattle(b),r=n.reactions.find(r=>r.name.includes('위태로운 공존'));
 assert.ok(r);assert.equal(r.endMs-r.startMs,767);assert.equal(r.estimated,false);assert.deepEqual([...new Set(r.targets)].sort(),[0,1,2]);
 for(const u of n.units.slice(0,3))assert.ok(u.controlImmune<=1);
 assert.equal(n.units[3].actions,0);assert.ok(n.impacts.some(i=>i.source===3&&i.damage>0));
});
test('native revival preserves active awakening gauge and starts ten rage stacks in the new life',()=>{
 const b=fixture();b.phase=1;b.queue=[0];b.units[0].attack=10000000;b.units[0].weakPoint=100;b.units[3].hp=1;b.units[3].passiveAwakenActive=true;b.units[3].awakenUsed=true;b.units[3].awakenGauge=41;
 for(let i=0;i<4;i++)afterHitPassive(b.units[3],b.units,[]);b.units[3].awakenGauge=41;
 const n=advanceBattle(b),u=n.units[3];assert.equal(u.revivalCount,1);assert.equal(u.awakenGauge,41);assert.equal(u.passiveAwakenActive,true);assert.equal(u.arisStacks,10);assert.ok(Math.abs(u.attack-1.6)<1e-8);
});
test('a skipped personal basic neither drains the passive nor grants ordinary gauge',()=>{
 for(const active of [false,true]){const b=fixture(),u=b.units[3];u.awakenGauge=active?50:20;u.passiveAwakenActive=active;u.awakenUsed=active;u.control=2;b.phase=1;b.queue=[3];const n=advanceBattle(b);assert.equal(n.units[3].awakenGauge,active?50:20);}
});
test('multiple blocked hits in one cast produce one response, and a later action can respond again',()=>{
 const u=aris(),queue=[];refreshPassiveAwakenings([u]);for(let i=0;i<4;i++)queueAwakeningBlock(u,queue,10);assert.equal(queue.length,1);queueAwakeningBlock(u,queue,11);assert.equal(queue.length,2);
 const b=fixture();b.units[0].name='아일린';b.plans.attacker=[{id:0,code:2}];b.skillSide='attacker';b.units[3].block=100;b.units[3].awakenGauge=75;
 const n=advanceBattle(b);assert.equal(n.reactions.filter(r=>r.name.includes('위태로운 공존')).length,1);assert.equal(n.units[3].arisStacks,1);
});
test('Aris rage and hit gauge increase once across the main attack and its follow-up packet',()=>{
 const u=aris();u.awakenGauge=0;
 for(let i=0;i<5;i++)afterHitPassive(u,[u],[],{attackToken:10});
 assert.equal(u.arisStacks,1);assert.equal(u.awakenGauge,3);
 afterHitPassive(u,[u],[],{attackToken:11});assert.equal(u.arisStacks,2);assert.equal(u.awakenGauge,6);
});
