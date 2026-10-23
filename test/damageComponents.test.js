import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
function fixture(){const b=createBattle(changeHero(prepareHeroes(),0,'기유'),{plans:{attacker:[{id:0,code:2}],defender:[]}});b.skillSide='attacker';for(const u of b.units){u.attack=100;u.defense=100;u.crit=0;u.block=0;u.maxHp=10000;u.hp=10000;u.barrier=0;u.nullify=0;u.immunity=0;u.damageIncrease=0;u.stealth=0;}return b;}
test('observed Giyu mixed-scaling components consume nullification separately',()=>{
  const b=fixture();b.units[3].defense=0;b.units[3].nullify=1;
  const next=advanceBattle(b);assert.equal(next.units[3].hp,9857);assert.equal(next.units[3].nullify,0);
  assert.equal(next.units[3].passiveHits,1);assert.ok(next.impacts.some(i=>i.target===3&&i.kind==='damage_component'&&i.damage===143));
});
test('blessing caps each observed component without double-counting a logical hit',()=>{
  const b=fixture();b.units[0].attack=10000;b.units[0].defense=10000;b.units[3].maxHp=1000;b.units[3].hp=1000;b.units[3].defense=0;b.units[3].blessing=25;
  const next=advanceBattle(b);assert.equal(next.units[3].hp,500);assert.equal(next.units[3].passiveHits,1);
});
