import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle} from '../src/lib/experimentalBattle.js';
import {damageShares} from '../src/lib/passiveDamage.js';
function fixture(){let h=prepareHeroes();['루디','헬레니아','손오공'].forEach((n,i)=>h=changeHero(h,i,n));return createBattle(h).units;}
test('Helena-protected allies are excluded from a link pool when Helena receives a direct hit',()=>{
 const units=fixture();assert.deepEqual(damageShares(units[1],units,1000),[{id:1,amount:1000}]);
 assert.deepEqual(damageShares(units[0],units,1000),[{id:0,amount:650},{id:1,amount:175}]);
});
test('guard death restores surviving link eligibility without deleting the original buff',()=>{
 const units=fixture();units[1].hp=0;
 assert.deepEqual(damageShares(units[0],units,1000),[{id:0,amount:400},{id:2,amount:400}]);
 assert.equal(units[0].linkTurns,2);assert.equal(units[2].linkTurns,2);
});
