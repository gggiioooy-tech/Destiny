import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beginConfusionAttack} from '../src/lib/confusionEffects.js';
import {skillFor} from '../src/lib/simulationSkills.js';
import {cleanseDebuffs,extendDebuffs,resetRevivalDebuffs} from '../src/lib/statusEffects.js';
import {debuffCount} from '../src/lib/skillRules.js';
import {tickPersonalTurn} from '../src/lib/battleSurvival.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
function fixture(caster='아일린',code=2){let h=prepareHeroes();[caster,'메이','카린','메이','벨라','아리엘'].forEach((n,i)=>h=changeHero(h,i,n));const b=createBattle(h,{plans:{attacker:[{id:0,code}],defender:[]},seed:1});b.skillSide='attacker';for(const u of b.units)Object.assign(u,{hp:1000000,maxHp:1000000,attack:1000,defense:0,crit:0,weakPoint:0,barrier:0,nullify:0,immunity:0,linkTurns:0,superiority:0,stealth:0,control:0,sleep:0,accuracy:100,resist:0,effectChanceBonus:100});return b;}
test('Lin full upgrades apply two-hit 50% basic confusion and three-hit active confusion',()=>{const a=skillFor('린',1).effects.find(e=>e.type==='confusion'),b=skillFor('린',3).effects.find(e=>e.type==='confusion');assert.deepEqual([a.value,a.chance,a.duration],[2,50,0]);assert.deepEqual([b.value,b.chance,b.duration],[3,100,0]);});
test('confusion counter consumes logical hit indices once across recipients and latches current cast',()=>{const u={confusionHits:1},scope=beginConfusionAttack(u);for(const target of [1,2,3])for(let i=0;i<3;i++)scope.hit(i);assert.equal(u.confusionHits,0);assert.equal(scope.active,true);assert.equal(beginConfusionAttack(u).active,false);});
test('a confused three-hit multi-target cast consumes three counts rather than nine',()=>{const b=fixture();b.units[0].confusionHits=4;const n=advanceBattle(b);assert.equal(n.units[0].confusionHits,1);const hits=n.impacts.filter(i=>i.kind==='damage');assert.equal(hits.length,9);assert.ok(hits.every(i=>i.missed&&!i.critical&&!i.blocked));});
test('last confusion count still affects all remaining hits of a started skill',()=>{const b=fixture();b.units[0].confusionHits=1;const n=advanceBattle(b);assert.equal(n.units[0].confusionHits,0);assert.ok(n.impacts.filter(i=>i.kind==='damage').every(i=>i.missed));assert.ok(n.units.slice(3).every(u=>!u.control));});
test('model weak-point bypass consumes confusion counts without forcing misses',()=>{const b=fixture();Object.assign(b.units[0],{confusionHits:3,weakPoint:100});const n=advanceBattle(b);assert.equal(n.units[0].confusionHits,0);assert.ok(n.impacts.filter(i=>i.kind==='damage').every(i=>!i.missed));});
test('confusion is cleansable but is not a control-only cleanse or turn-extension target',()=>{const u={confusionHits:3,debuffMaxTurns:{confusionHits:3}};assert.equal(debuffCount(u),1);assert.equal(cleanseDebuffs(u,Infinity,{controlOnly:true}),0);u.confusionHits=2;extendDebuffs(u,2);assert.equal(u.confusionHits,2);assert.equal(cleanseDebuffs(u),1);assert.equal(u.confusionHits,0);u.confusionHits=2;resetRevivalDebuffs(u);assert.equal(u.confusionHits,0);});
test('confusion is not consumed by simply ticking a personal turn',()=>{const b=fixture();b.units[0].confusionHits=3;const n=tickPersonalTurn(b.units[0],{...b.units[0]}).target;assert.equal(n.confusionHits,3);});
test('Lin active applies confusion without cancelling enemy reserved skills',()=>{const b=fixture('린',3);b.plans.defender=[{id:3,code:2}];const n=advanceBattle(b);assert.ok(n.units.slice(3).every(u=>u.confusionHits===3));assert.ok(n.plans.defender.some(p=>p.id===3));});
test('confusion respects effect resistance and dedicated immunity',()=>{const b=fixture('린',3);b.units[0].accuracy=0;b.units[3].resist=200;b.units[4].statusImmunities={'혼란':3};const n=advanceBattle(b);assert.equal(n.units[3].confusionHits||0,0);assert.equal(n.units[4].confusionHits||0,0);assert.equal(n.units[5].confusionHits,3);});

test('confused counter consumes one hit and forces a miss without weak-point bypass',()=>{
 let found=false;for(let seed=1;seed<=40&&!found;seed++){const b=fixture('윤건',2);b.seed=seed;Object.assign(b.units[3],{name:'루디',confusionHits:2,controlImmune:99});const n=advanceBattle(b);if(!n.reactions.some(r=>r.source===3&&r.kind==='counter'))continue;found=true;assert.equal(n.units[3].confusionHits,1);assert.ok(n.impacts.filter(i=>i.source===3&&i.kind==='counter').every(i=>i.missed));}assert.ok(found);
});
test('Rad fixed passive neither consumes confusion nor becomes a confusion miss',()=>{
 const b=fixture('윤건',2);Object.assign(b.units[3],{name:'라드그리드',confusionHits:4});const n=advanceBattle(b);assert.ok(n.reactions.some(r=>r.kind==='rad_passive'));assert.equal(n.units[3].confusionHits,4);assert.ok(n.impacts.filter(i=>i.kind==='rad_fixed').every(i=>!i.missed));
});
