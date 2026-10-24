import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle} from '../src/lib/experimentalBattle.js';
import {onAttackStacks,beforeSkillRules,onSkillRules} from '../src/lib/passiveRules.js';
import {afterControl} from '../src/lib/conditionalPassives.js';
import {grantNullification} from '../src/lib/nullificationEffects.js';
import {transformDellons} from '../src/lib/heroTransformations.js';
function fixture(names){let h=prepareHeroes();names.forEach((n,i)=>h=changeHero(h,i,n));return createBattle(h).units;}
test('buff-blocked Yoongeon cannot acquire passive nullification from basic or skill',()=>{
 for(const blocked of [0,2]){
  const units=fixture(['윤건','동영','연희']),u=units[0];u.nullify=0;u.buffBlock=blocked;u.lastAttackBasic=true;
  onAttackStacks(u,units,[]);assert.equal(u.nullify,blocked?0:1);
  beforeSkillRules(u,units,[]);assert.equal(u.nullify,blocked?0:3);
 }
});
test('buff block also covers Lin skill-triggered nullification',()=>{
 for(const blocked of [0,2]){
  const units=fixture(['린','메이','루디']),u=units[0];u.nullify=0;u.buffBlock=blocked;
  beforeSkillRules(u,units,[]);assert.equal(u.nullify,blocked?0:2);
 }
});
test('buff block covers generic Taka skill-triggered nullification',()=>{
 for(const blocked of [0,2]){
  const units=fixture(['타카','메이','루디']),u=units[0];u.nullify=0;u.buffBlock=blocked;u.skillActions=1;
  onSkillRules(u,units,[],()=>0,{includeBefore:false});assert.equal(u.nullify,blocked?0:1);
 }
});
test('control-only cleanse under buff block still cleanses and reduces cooldown but cannot grant immunity or shield',()=>{
 const units=fixture(['젠이츠','아일린','탄지로']),u=units[0];
 Object.assign(u,{control:2,controlName:'기절',controlImmune:0,buffBlock:2,barrier:0,barrierTurns:0,readyAt:{2:30000},awakenGauge:0});
 afterControl(u,[],units);
 assert.equal(u.control,0);assert.equal(u.buffBlock,2);assert.equal(u.controlImmune,0);assert.equal(u.barrier,0);
 assert.equal(u.awakenGauge,25);assert.equal(u.readyAt[2],4000);
});
test('blocked grants retain existing pools, caps never strip hits, and dead units cannot gain hits',()=>{
 const u={hp:100,nullify:3,buffBlock:2};assert.equal(grantNullification(u,4),0);assert.equal(u.nullify,3);
 u.buffBlock=0;assert.equal(grantNullification(u,2,{add:true,cap:6}),2);assert.equal(u.nullify,5);
 grantNullification(u,4,{add:true,cap:6});assert.equal(u.nullify,6);
 u.nullify=8;grantNullification(u,1,{add:true,cap:6});assert.equal(u.nullify,8);
 u.hp=0;assert.equal(grantNullification(u,20),0);assert.equal(u.nullify,8);
});
test('transformation grants respect each recipients buff block independently',()=>{
 const units=fixture(['델론즈','여포','탄지로']),u=units[0];
 for(const ally of units.slice(0,3)){ally.nullify=0;ally.buffBlock=2;}
 units[2].buffBlock=0;transformDellons(u,units);
 assert.equal(u.nullify,0);assert.equal(units[1].nullify,0);assert.equal(units[2].nullify,2);
 assert.equal(u.transformed,true);
});
