import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero} from '../src/lib/experimentalBattle.js';
import {calculatePrebattle,defaultPrebattleSettings} from '../src/lib/prebattleStats.js';
import {casterEffect,effectProbability} from '../src/lib/combatDamage.js';
function fixture(name){let h=prepareHeroes();[name,'로지','크리스','루디','메이','아리엘'].forEach((n,i)=>h=changeHero(h,i,n));return h;}
test('Nox and Aquila grant instant-death-only chance bonus to allies in either input basis',()=>{
 for(const name of ['녹스','아킬라'])for(const basis of ['panel','battle']){
  const r=calculatePrebattle(fixture(name),defaultPrebattleSettings(),{basis});
  for(const h of r.heroes.slice(0,3))assert.equal(h.instantDeathChanceBonus,25);
  for(const h of r.heroes.slice(3))assert.equal(h.instantDeathChanceBonus||0,0);
  assert.equal(r.heroes[0].effectChanceBonus,26);
  assert.equal(r.heroes[2].effectChanceBonus,26); // Scoped 25 is not added to the ordinary bonus.
 }
});
test('scoped bonus adds to ordinary proc bonus only for instant death, then resistance applies',()=>{
 const source={accuracy:20,effectChanceBonus:10,instantDeathChanceBonus:25},target={resist:40};
 const instant=casterEffect(source,target,50,'즉사');assert.equal(instant.chanceBonus,35);
 assert.ok(Math.abs(effectProbability(instant).applied-.54)<1e-12);
 for(const status of ['감전','중독','즉사 턴 감소',undefined])assert.equal(casterEffect(source,target,50,status).chanceBonus,10);
});
