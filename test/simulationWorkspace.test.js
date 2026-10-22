import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,createBattle,advanceBattle,defaultSkillPlans} from '../src/lib/experimentalBattle.js';
import {parseStatPaste,setupDocument,readSetupFile,swapTeams,loadPresets,savePresets,inspectSetup,advanceSession,finishSession} from '../src/lib/simulationWorkspace.js';

const snapshot=()=>({draft:prepareHeroes(),plans:defaultSkillPlans(),seed:42});
test('single hero paste parses separators, decimals and negative resistance without filling missing values',()=>{
  assert.deepEqual(parseStatPaste('물리 공격력\t8,108\n마법 공격력\t0\n방어력 2,042\n효과 저항 -34%\n파쇄 38.4%','아일린'),{attack:8108,defense:2042,resist:-34,shred:38.4});
  assert.throws(()=>parseStatPaste('공격력 -1','아일린'));assert.throws(()=>parseStatPaste('nothing','아일린'));
});
test('multi hero paste selects the named hero column and rejects ambiguous or mismatched tables',()=>{
  const text='능력치\t아일린\t젠이츠\t탄지로\n물리 공격력\t8,108\t10,204\t11,075\n속공\t105\t93\t93';
  assert.deepEqual(parseStatPaste(text,'젠이츠'),{attack:10204,speed:93});
  assert.throws(()=>parseStatPaste(text,'하연'));assert.throws(()=>parseStatPaste('공격력\t1\t2','아일린'));
});
test('setup files round trip only known settings and reject malformed, duplicate and out of range input',()=>{
  const data=snapshot(),doc=setupDocument(data,'테스트');doc.secret='must not persist';doc.draft[0].token='not allowed';
  const loaded=readSetupFile(JSON.stringify(doc));assert.equal(loaded.secret,undefined);assert.equal(loaded.draft[0].token,undefined);assert.equal(loaded.draft[0].attack,8000);
  const duplicate=structuredClone(doc);duplicate.draft[1].name=duplicate.draft[0].name;assert.throws(()=>readSetupFile(JSON.stringify(duplicate)));
  const invalid=structuredClone(doc);invalid.draft[0].attack=1000001;assert.throws(()=>readSetupFile(JSON.stringify(invalid)));
  assert.throws(()=>readSetupFile('x'.repeat(131073)));
});
test('saved settings are explicitly scoped to the logged in account',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
  savePresets(storage,'owner-a',[setupDocument(snapshot())]);assert.equal(loadPresets(storage,'owner-a').length,1);assert.equal(loadPresets(storage,'owner-b').length,0);assert.equal(loadPresets(storage,'').length,0);assert.throws(()=>savePresets(storage,'',[]));
});
test('swapping teams remaps slots and skill targets and is reversible',()=>{
  const {draft,plans}=snapshot(),a=swapTeams(draft,plans),b=swapTeams(a.draft,a.plans);assert.deepEqual(b,{draft,plans});assert.ok(a.plans.attacker.every(p=>p.id<3));assert.ok(a.plans.defender.every(p=>p.id>=3));
});
test('scene rewind reuses computed frames, while quick calculation produces the same final state',()=>{
  const h=prepareHeroes(),initial={frames:[createBattle(h,{seed:42})],cursor:0};
  const a=advanceSession(initial,advanceBattle),rewound={...a,cursor:0},again=advanceSession(rewound,()=>{throw Error('must not reroll');});assert.equal(again.frames,a.frames);assert.equal(again.cursor,1);
  const quick=finishSession(initial,advanceBattle);let slow=initial;while(!slow.frames.at(-1).done)slow=advanceSession(slow,advanceBattle);
  assert.deepEqual(quick.frames.at(-1),slow.frames.at(-1));assert.ok(quick.frames.length<=181);assert.equal(inspectSetup(h,defaultSkillPlans()).exampleCount,6);
});
