import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupFromRecord} from '../src/lib/battlePrediction.js';
function record(pet){
 const payload={heroStats:{}};
 for(const side of ['attacker','defender']){
  payload[side]={pet:side==='attacker'?pet:'없음',heroIds:[1,2,3],heroes:['연희','쥬리','윤건'],skills:[]};
  payload.heroStats[side]=[1,2,3].map(heroId=>({heroId,stats:{magicalAttack:8000,defence:1800,hp:10000,attackSpeed:90}}));
 }return {payload};
}
test('replay Melpero spelling retains full-skill proc bonus without adding panel accuracy twice',()=>{
 const canonical=setupFromRecord(record('멜페로')),alias=setupFromRecord(record('멜패로'));
 assert.deepEqual(alias,canonical);assert.equal(alias.draft[0].effectChanceBonus,12);assert.equal(alias.draft[0].accuracy,0);
});
test('replay Nezuko display name matches the supported pet alias',()=>{
 const a=record('카마도 네즈코'),b=record('네즈코');
 a.payload.attacker.heroes=b.payload.attacker.heroes=['탄지로','젠이츠','시노부'];
 const expected=setupFromRecord(b);assert.ok(expected.draft[0].auraBuffs.some(v=>v.endsWith('|네즈코')));
 assert.deepEqual(setupFromRecord(a),expected);
});
