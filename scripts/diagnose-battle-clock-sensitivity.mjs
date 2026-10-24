// Offline sensitivity analysis, deliberately separate from production accuracy.
// A fixed candidate clock applies to every record; no battle's end state or
// winner is available to the simulation. Private rows stay in the output path.
import fs from 'node:fs';
import {setupFromRecord,summarizePrediction,ENGINE_VERSION} from '../src/lib/battlePrediction.js';
import {createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
const [input,output,limitArgument]=process.argv.slice(2),limit=Number(limitArgument);
if(!input||!output||!Number.isFinite(limit)||limit<60000||limit>300000)throw Error('Usage: node diagnose-battle-clock-sensitivity.mjs PRIVATE_RECORDS PRIVATE_OUTPUT FIXED_LIMIT_MS');
function sample(draft,plans,index){
 let seed=(27+Math.imul(index+1,0x9e3779b9))>>>0;
 seed=Math.imul(seed^(seed>>>16),0x21f0aaad);seed=Math.imul(seed^(seed>>>15),0x735a2d97);seed=(seed^(seed>>>15))>>>0;
 let state=createBattle(draft,{plans,seed});state.timeLimitMs=limit;
 for(let n=0;n<180&&!state.done;n++)state=advanceBattle(state);
 return state.done?(state.winner||'unresolved'):'unresolved';
}
const seen=new Set(),rows=[];let skipped=0;
for(const record of JSON.parse(fs.readFileSync(input,'utf8')).records||[]){
 if(seen.has(record.sourceKey))continue;seen.add(record.sourceKey);
 try{
  const {draft,plans}=setupFromRecord(record),counts={attacker:0,defender:0,unresolved:0};
  for(let index=0;index<32;index++)counts[sample(draft,plans,index)]++;
  const result=summarizePrediction(counts),actual=record.payload.attackerWon?'attacker':'defender';
  rows.push({key:record.sourceKey,result,actual,correct:result.winner===actual});
 }catch{skipped++;}
}
const decided=rows.filter(r=>r.result.winner),correct=decided.filter(r=>r.correct).length;
const summary={mode:'fixed_clock_sensitivity_not_production_accuracy',engineVersion:ENGINE_VERSION,timeLimitMs:limit,evaluated:rows.length,decided:decided.length,abstained:rows.length-decided.length,correct,accuracy:decided.length?correct/decided.length:null,skipped,
 note:'Diagnostic only. Does not establish the mapping between replay stage time and the displayed 210-second timer; not an independent holdout.'};
fs.writeFileSync(output,JSON.stringify({summary,rows},null,2));console.log(JSON.stringify(summary,null,2));
