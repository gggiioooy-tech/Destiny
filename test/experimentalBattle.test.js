import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
const finish=b=>{for(let i=0;i<200&&!b.done;i++)b=advanceBattle(b);return b;};
test('new calculations are deterministic, bounded and leave input unchanged',()=>{
  const input=prepareHeroes(),start=createBattle(input,{seed:42});
  const before=JSON.stringify(start),a=finish(start),b=finish(createBattle(input,{seed:42}));
  assert.equal(JSON.stringify(start),before);assert.deepEqual(a,b);assert.ok(a.done);assert.ok(a.step<=180);
  for(const u of a.units){assert.ok(u.hp>=0&&u.hp<=u.maxHp);assert.ok(u.barrier>=0);}
});
test('speed controls first action and modifying stats changes calculation',()=>{
  const input=prepareHeroes();input[5].speed=999;
  const first=advanceBattle(createBattle(input));assert.equal(first.active,3);assert.equal(first.log[0].kind,'skill');
  const basic=advanceBattle(first);assert.equal(basic.active,5);assert.equal(basic.log[0].kind,'basic');
  const weak=finish(createBattle(input));input[5].attack=999999;
  const strong=finish(createBattle(input));assert.notDeepEqual(weak.log,strong.log);
});
test('simulation only imports starting stats and never consumes recorded damage',()=>{
  const report={heroes:[{side:'attacker',name:'연희',stats:{3:1234,7:4567}}],timeline:[{damage:99999999}]};
  const h=prepareHeroes(report);assert.equal(h[0].attack,1234);assert.equal(h[0].maxHp,4567);
  assert.equal(h[3].origin,'테스트 기본값');assert.equal(h.length,6);
});
test('invalid input rejected and finished battle stays stopped',()=>{
  const h=prepareHeroes();h[0].maxHp=0;assert.throws(()=>createBattle(h));
  h[0].maxHp=100;h[0].attack=NaN;assert.throws(()=>createBattle(h));
  const end=finish(createBattle(prepareHeroes()));assert.equal(advanceBattle(end),end);
});
test('skill turns alternate teams after two global basic attack turns',()=>{
  const h=prepareHeroes();for(const u of h){u.maxHp=100000;u.attack=1;u.resist=100;u.accuracy=0;}
  let b=createBattle(h),sources=[];
  for(let i=0;i<7;i++){b=advanceBattle(b);sources.push([b.log[0].kind,b.units[b.active].side,b.turn]);}
  assert.deepEqual(sources.map(v=>v[0]),['skill','basic','basic','skill','basic','basic','skill']);
  assert.equal(sources[0][1],'attacker');assert.equal(sources[3][1],'defender');assert.equal(sources[6][1],'attacker');
  assert.deepEqual(sources.map(v=>v[2]),[0,1,2,2,3,4,4]);
});
test('skill action does not tick personal buffs and expired immortality kills',()=>{
  const h=prepareHeroes();for(const u of h){u.maxHp=100000;u.attack=1;u.resist=100;}
  let b=createBattle(h);b.units[0].immortal=1;b.units[0].hp=1;b.units[0].immunity=2;
  b=advanceBattle(b);assert.equal(b.units[0].immortal,1);assert.equal(b.units[0].immunity,2);
  b=advanceBattle(b);assert.equal(b.units[0].immortal,0);assert.equal(b.units[0].hp,0);
});
test('custom reserve plan is honored and validated',()=>{
  const plans={attacker:[{id:1,code:2},{id:0,code:3},{id:2,code:2}],defender:[{id:3,code:2},{id:4,code:2},{id:5,code:3}]};
  const b=advanceBattle(createBattle(prepareHeroes(),{plans}));assert.equal(b.active,1);assert.equal(b.log[0].code,2);
  plans.attacker[0].id=4;assert.throws(()=>createBattle(prepareHeroes(),{plans}));
});
test('previously ignored collected modifiers are imported with percent scaling',()=>{
  const h=prepareHeroes({heroes:[{name:'연희',side:'attacker',stats:{12:980,18:320,21:96,24:125}}]})[0];
  assert.equal(h.weakPoint,98);assert.equal(h.damageReduction,32);assert.equal(h.amplification,9.6);assert.equal(h.regeneration,12.5);
});

test('equal speed basics follow seat order and higher speed still takes precedence',()=>{
 const h=prepareHeroes();for(const u of h){u.attack=1;u.maxHp=100000;u.speed=50;u.battleSeat=[5,4,1][u.id%3];}
 const basic=advanceBattle(advanceBattle(createBattle(h,{seed:42})));assert.ok([2,5].includes(basic.active));
 h[0].speed=51;assert.equal(advanceBattle(advanceBattle(createBattle(h,{seed:42}))).active,0);
 h[1].battleSeat=5;assert.throws(()=>createBattle(h),/자리번호/);
});
