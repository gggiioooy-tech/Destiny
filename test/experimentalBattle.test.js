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
  assert.equal(advanceBattle(createBattle(input)).active,5);
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
