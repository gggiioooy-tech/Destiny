import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionTiming,resolveTimeout,BATTLE_LIMIT_MS,TIMING_CATALOG} from '../src/lib/battleTiming.js';
import {prepareHeroes,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';

test('timing preserves hero-specific observations and labels unknown actions as estimates',()=>{
  const keys=Object.keys(TIMING_CATALOG.entries),key=keys.find(k=>k.includes('|skill|2')), [name,kind,code]=key.split('|');
  const t=actionTiming(name,Number(code),kind);assert.equal(t.medianMs,TIMING_CATALOG.entries[key].medianMs);assert.equal(t.estimated,false);assert.ok(t.count>0);
  assert.equal(actionTiming('미확보 영웅',3).estimated,true);
  assert.ok(new Set(Object.values(TIMING_CATALOG.entries).map(t=>t.medianMs)).size>3);
});
test('remaining HP percentage wins rather than raw HP sum or defender default',()=>{
  const units=[{side:'attacker',maxHp:1000,hp:500},{side:'defender',maxHp:100,hp:90}];
  assert.equal(resolveTimeout(units).winner,'defender');
  units[0].hp=1000;assert.equal(resolveTimeout(units).winner,'attacker');
});
test('dead heroes remain in the team maximum HP denominator',()=>{
  const units=[{side:'attacker',maxHp:100,hp:100},{side:'attacker',maxHp:100,hp:0},{side:'defender',maxHp:100,hp:70}];
  assert.equal(resolveTimeout(units).winner,'defender');
});
test('timeout compares immortality duration and immortality beats indomitable',()=>{
  const units=[{side:'attacker',maxHp:100,hp:1,immortal:2},{side:'defender',maxHp:100,hp:1,immortal:3}];
  assert.equal(resolveTimeout(units).winner,'defender');
  units[1].immortal=0;units[1].indomitableHits=8;assert.equal(resolveTimeout(units).winner,'attacker');
  units[0].immortal=0;units[0].indomitableHits=2;assert.equal(resolveTimeout(units).winner,null);
});
test('no attack damage is applied after the 210 second boundary',()=>{
  const b=createBattle(prepareHeroes());b.elapsedMs=BATTLE_LIMIT_MS-1;
  const next=advanceBattle(b);assert.equal(next.elapsedMs,BATTLE_LIMIT_MS);assert.equal(next.endReason,'timeout');assert.ok(next.done);
  assert.deepEqual(next.units.map(u=>u.hp),b.units.map(u=>u.hp));assert.equal(next.action,null);
});
test('skill cooldown keeps a waiting reservation rather than spending it',()=>{
  const b=createBattle(prepareHeroes());b.units[0].readyAt[3]=100000;
  const next=advanceBattle(b);assert.equal(next.action,null);assert.equal(next.plans.attacker[0].id,0);assert.equal(next.plans.attacker.length,3);
});
