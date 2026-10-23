import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
import {SIM_ROSTER} from '../src/lib/simulationSkills.js';
import {queuePassiveAttacks} from '../src/lib/passiveAttacks.js';
function battle(seed=1){let h=changeHero(prepareHeroes(),0,'하연');const b=createBattle(h,{seed,plans:{attacker:[],defender:[]}});for(const u of b.units){u.maxHp=100000;u.hp=100000;u.attack=1;u.defense=0;u.nullify=0;u.immunity=0;u.barrier=0;u.crit=0;u.weakPoint=0;u.missChance=0;u.resist=100;}b.phase=1;b.queue=[0];return b;}
test('shock lethal secondary damage survives death cleanup and credits its caster',()=>{
 const b=battle(),target=b.units[3];for(const u of b.units.slice(3)){u.control=2;u.controlName='감전';u.shockSource={id:1,attack:10000000};u.reviveAvailable=false;u.ring='none';}
 const next=advanceBattle(b);assert.ok(next.impacts.some(i=>i.kind==='shock'&&i.source===1));assert.ok(next.units[1].damageDealt>0);
});
test('Hayeon assist applies shock through shared damage without consuming a personal turn',()=>{
 let result;for(let seed=1;seed<40&&!result;seed++){const b=battle(seed);for(const u of b.units.slice(3)){u.control=2;u.controlName='감전';u.shockSource={id:1,attack:10};}const n=advanceBattle(b);if(n.reactions.some(r=>r.kind==='assist'))result=n;}
 assert.ok(result);const assist=result.reactions.find(r=>r.kind==='assist');assert.equal(result.units[assist.source].actions,0);assert.ok(result.impacts.filter(i=>i.kind==='shock').length>1);
});
test('periodic attacks cannot fire at zero completed attacks',()=>{
 for(const name of ['윤건','겔리두스','카일']){const u={id:0,name,hp:100,side:'a',passiveAttackCount:0},q=[];queuePassiveAttacks('attack',u,[u],q);assert.equal(q.length,0);u.passiveAttackCount=2;queuePassiveAttacks('attack',u,[u],q);assert.equal(q.length,1);}
});
for(const [index,hero]of SIM_ROSTER.entries())test('interaction smoke: '+hero.name,()=>{
 let heroes=prepareHeroes();for(const [slot,name]of [[0,hero.name],[1,'하연'],[2,'윤건'],[3,'루디'],[4,'라드그리드'],[5,'선란']])heroes=changeHero(heroes,slot,name);
 let b=createBattle(heroes,{seed:index+1,plans:{attacker:[],defender:[]}});
 for(let step=0;step<300&&!b.done;step++){const before=b.elapsedMs||0;b=advanceBattle(b);assert.ok(b.elapsedMs>=before,hero.name+' clock');assert.ok(b.elapsedMs<=b.timeLimitMs);for(const u of b.units)for(const key of ['hp','maxHp','attack','defense','damageDealt','barrier']){assert.ok(Number.isFinite(u[key]),hero.name+' '+key);assert.ok(u[key]>=0,hero.name+' '+key);}}
 assert.equal(b.done,true,hero.name+' battle must terminate');
});
test('Skuld gains one fate thread across multihits and an assist in the same action packet',()=>{
 let result;for(let seed=1;seed<40&&!result;seed++){let h=prepareHeroes();for(const [slot,name]of [[0,'하연'],[1,'메이'],[2,'루디'],[3,'스쿨드'],[4,'연희'],[5,'하연']])h=changeHero(h,slot,name);let b=createBattle(h,{seed,plans:{attacker:[],defender:[]}});for(const u of b.units){u.maxHp=100000;u.hp=100000;u.attack=1;u.defense=0;u.nullify=0;u.immunity=0;u.barrier=0;u.missChance=0;u.weakPoint=100;}b.units[3].hp=90000;b.phase=1;b.queue=[0];const n=advanceBattle(b);if(n.reactions.some(r=>r.kind==='assist'&&r.targets.includes(3)))result=n;}
 assert.ok(result);assert.equal(result.units[3].fateThreads,1);
});
