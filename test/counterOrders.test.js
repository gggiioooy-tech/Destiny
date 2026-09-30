import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCounterOrder} from '../src/lib/counterOrders.js';
test('legacy arrows and whitespace map to the actual hero names',()=>{
  assert.deepEqual(parseCounterOrder('칼 헤론->선란->브란즈&브란셀',['선란','브란즈&브란셀','칼헤론'],'speed').steps,['칼헤론','선란','브란즈&브란셀']);
});
test('partial rank stays in the correct slot and ambiguous alternatives are preserved',()=>{
  assert.deepEqual(parseCounterOrder('선란 3등',['선란','오르카','하연'],'speed').steps,['','','선란']);
  assert.deepEqual(parseCounterOrder('루디 속 1등',['루디','아일린','클레미스'],'speed').steps,['루디','','']);
  const text='카일or선란->브란즈&브란셀 (3등)';
  assert.equal(parseCounterOrder(text,['선란','카일','브란즈&브란셀'],'speed').note,text);
});
test('abbreviated skill orders support repeat heroes and no separators',()=>{
  assert.deepEqual(parseCounterOrder('아2아1하1',['겔리두스','하연','아일린'],'skill').steps,[{hero:'아일린',skill:'2'},{hero:'아일린',skill:'1'},{hero:'하연',skill:'1'}]);
  assert.deepEqual(parseCounterOrder('연2 실1 연1',['연희','실베스타','동영'],'skill').steps.map(s=>s.hero),['연희','실베스타','연희']);
  assert.equal(parseCounterOrder('칼 헤론 각성기',['칼헤론','선란','카일'],'skill').steps[0].skill,'각성기');
});
test('unrecognized or ambiguous text is not discarded',()=>{
  const raw='연2 -> 모르는영웅1';
  assert.equal(parseCounterOrder(raw,['연희','연지','동영'],'skill').note,raw);
});
test('speed abbreviations and trailing instructions are both retained',()=>{
  const result=parseCounterOrder('하연>겔두>아일린\n(무조건 맞춰서 가기)',['겔리두스','하연','아일린'],'speed');
  assert.deepEqual(result.steps,['하연','겔리두스','아일린']);
  assert.equal(result.note,'(무조건 맞춰서 가기)');
});
test('structured partial selection and notes round trip without shifting',()=>{
  const order={steps:['','','선란'],note:'참고사항'};
  assert.deepEqual(parseCounterOrder(JSON.stringify(order),['선란'],'speed'),order);
});
