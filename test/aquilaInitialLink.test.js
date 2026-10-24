import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle} from '../src/lib/experimentalBattle.js';
import {damageShares} from '../src/lib/passiveDamage.js';
import {tickPersonalTurn} from '../src/lib/battleSurvival.js';
function battle(names){let h=prepareHeroes();names.forEach((n,i)=>h=changeHero(h,i,n));return createBattle(h);}
test('Aquila six-transcendence passive links her team for three personal turns at spawn',()=>{
 const b=battle(['아킬라','메이','카린','메이','벨라','아리엘']);
 assert.deepEqual(b.units.map(u=>u.linkTurns||0),[3,3,3,0,0,0]);
 const shares=damageShares(b.units[1],b.units,300);assert.equal(shares.length,3);assert.ok(shares.every(s=>s.amount===80));
 assert.equal(tickPersonalTurn(b.units[1],b.units[1]).target.linkTurns,2);assert.equal(b.units[0].linkTurns,3);
});
test('overlapping Rudy and Aquila starting links keep the longer duration',()=>{
 const b=battle(['루디','아킬라','메이','루디','벨라','아리엘']);
 assert.deepEqual(b.units.map(u=>u.linkTurns),[3,3,3,2,2,2]);
});
