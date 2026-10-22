// Offline, private input only. Never uploads records or downloads a replay.
import fs from 'node:fs';
import {setupFromRecord,predictBattle,wilsonInterval,ENGINE_VERSION} from '../src/lib/battlePrediction.js';
const input=process.argv[2],output=process.argv[3]||'tmp/battle-validation.json';
if(!input)throw Error('Usage: node scripts/evaluate-battle-predictions.mjs PRIVATE_STATUS_JSON [PRIVATE_OUTPUT_JSON]');
const data=JSON.parse(fs.readFileSync(input,'utf8')),seen=new Set(),rows=[],skipReasons={};let duplicates=0,skipped=0;
for(const record of data.records||[]){
  if(typeof record.sourceKey!=='string'||typeof record.payload?.attackerWon!=='boolean'){skipped++;continue;}
  if(seen.has(record.sourceKey)){duplicates++;continue;}seen.add(record.sourceKey);
  try{
    const {draft,plans}=setupFromRecord(record);
    const result=predictBattle(draft,plans,{samples:32,seed:27});
    const actual=record.payload.attackerWon?'attacker':'defender';
    rows.push({key:record.sourceKey,occurredAt:record.occurredAt,result,actual,correct:result.winner===actual});
  }catch(e){skipped++;skipReasons[e.message]=(skipReasons[e.message]||0)+1;}
}
const decided=rows.filter(r=>r.result.winner),correct=decided.filter(r=>r.correct).length;
const summary={engineVersion:ENGINE_VERSION,mode:'retrospective_baseline_not_independent_holdout',samplesPerBattle:32,
  uniqueRecords:seen.size,evaluated:rows.length,decided:decided.length,abstained:rows.length-decided.length,skipped,skipReasons,duplicates,
  correct,accuracy:decided.length?correct/decided.length:null,coverage:rows.length?decided.length/rows.length:0,
  accuracyInterval95:wilsonInterval(correct,decided.length),attackerWins:rows.filter(r=>r.actual==='attacker').length,
  majorityBaseline:rows.length?Math.max(rows.filter(r=>r.actual==='attacker').length,rows.filter(r=>r.actual==='defender').length)/rows.length:null,
  target90Validated:false,limitations:['같은 날·같은 길드 전투의 상관관계가 있어 독립 표본으로 볼 수 없습니다.','미구현 효과와 장비·펫 정보 부족이 있으며 독립 홀드아웃 검증은 아닙니다.']};
fs.writeFileSync(output,JSON.stringify({summary,rows},null,2));console.log(JSON.stringify(summary,null,2));
