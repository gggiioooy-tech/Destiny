// Aggregate reused-development diagnostics. Never publishes record/player keys.
// Observed initial shields are used only in a first-action diagnostic comparison.
import fs from 'node:fs';
const [evaluationFile,firstFile,shieldFile,outputFile]=process.argv.slice(2);
if(!outputFile)throw Error('Usage: node audit-prediction-errors.mjs PRIVATE_EVALUATION PRIVATE_FIRST_ACTION PRIVATE_SHIELD_DIAGNOSTIC AGGREGATE_OUTPUT');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const evaluation=read(evaluationFile),first=read(firstFile),shield=read(shieldFile);
if([first,shield].some(v=>v.summary.engineVersion!==evaluation.summary.engineVersion))throw Error('Diagnostic engine versions must match');
if(first.summary.diagnosticObservedStartBarriers||!shield.summary.diagnosticObservedStartBarriers)throw Error('Expected baseline and observed-shield diagnostic in that order');
const normal=new Map(first.rows.map(r=>[r.key,r])),observed=new Map(shield.rows.map(r=>[r.key,r]));
const outside=row=>row?.hp.some(h=>h.min!==null&&(h.observed<h.min-.01||h.observed>h.max+.01))||false;
const groups={};
for(const row of evaluation.rows){
 const key=row.result.winner?(row.correct?'correct':'wrong'):'abstained';
 const g=groups[key]??={records:0,shieldMismatch:0,earlyHpMismatch:0,earlyHpMismatchWithObservedShields:0,highModelFrequency:0,actualAttackerWins:0,predictedAttackerWins:0};
 g.records++;g.actualAttackerWins+=row.actual==='attacker';g.predictedAttackerWins+=row.result.winner==='attacker';
 g.highModelFrequency+=Math.max(row.result.attacker,row.result.defender)/row.result.total>=.9;
 g.shieldMismatch+=Boolean(normal.get(row.key)?.barrierMismatches.length);
 g.earlyHpMismatch+=outside(normal.get(row.key));g.earlyHpMismatchWithObservedShields+=outside(observed.get(row.key));
}
const output={engineVersion:evaluation.summary.engineVersion,scope:'reused correlated development data; diagnostic associations, not causal attribution or an independent holdout',evaluation:{records:evaluation.summary.uniqueRecords,eligible:evaluation.summary.evaluated,decided:evaluation.summary.decided,correct:evaluation.summary.correct,excluded:evaluation.summary.skipped,accuracy:evaluation.summary.accuracy,majorityBaseline:evaluation.summary.majorityBaseline},groups,firstAction:first.summary,observedShieldDiagnostic:shield.summary,limitations:['Observed shields are comparison-only diagnostic inputs, never inferred rings or production prediction inputs.','A 32-path envelope is not a probability bound. First replay packet and model reaction boundaries can differ.','High model frequency is not calibrated real-game win probability. Wrong model assumptions can produce repeatable wrong forecasts.','Shield discrepancies also occur among correct forecasts; they do not establish equipment as the sole or dominant cause.']};
fs.writeFileSync(outputFile,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
