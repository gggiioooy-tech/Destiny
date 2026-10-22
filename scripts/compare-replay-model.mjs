// Offline comparison only. No replay downloads or site uploads.
import fs from 'node:fs';
import {calculateHit} from '../src/lib/combatDamage.js';
const input=process.argv[2]||'tmp/replay-analysis-20261019-224354/timeline.json';
const report=JSON.parse(fs.readFileSync(input,'utf8'));
const source=report.heroes.find(h=>h.side==='attacker'&&h.name==='연희');
if(!source)throw Error('연희 공격 기록이 필요합니다.');
const action=report.timeline.find(a=>a.source===source.objectId&&a.skillCode===3);
if(!action)throw Error('연희 2스킬 기록이 필요합니다.');
const weakBonus=Number(process.argv[3]||0);
if(!Number.isFinite(weakBonus)||weakBonus<0||weakBonus>1000)throw Error('약점 피해 증가 가정값이 올바르지 않습니다.');
const rows=action.results.filter(r=>r.damage>0).map(r=>{
  const target=report.heroes.find(h=>h.objectId===r.target),ss=source.stats,ts=target.stats;
  const beforeSurvival=calculateHit({base:(ss['3']||0)*.55,defense:ts['5']||0,ignore:.4,critDamage:(ss['11']||1500)/10,elasticity:(ts['23']||0)/10,critical:r.critical,blocked:r.block,weak:r.weakPoint,weakBonus,missed:r.slip,damageIncrease:35,amplification:(ss['21']||0)/10,damageReduction:(ts['18']||0)/10});
  const predicted=target.name==='윤건'?Math.min(beforeSurvival,Math.floor(target.maxHp*.25)):beforeSurvival;
  return {target:target.name,observed:r.damage,predicted,difference:predicted-r.damage};
});
const result={mode:'offline_incomplete_model_comparison',status:rows.every(r=>Math.abs(r.difference)<=2)?'sample_near_match':'not_validated',assumptions:{weakBonus,slipTreatedAsMiss:true,yoongeonBlessingPercent:25},reason:'선택한 약점 피해 증가 가정은 장비 종류를 독립 확인한 값이 아닙니다. 전체 전투 검증이 필요합니다.',rows};
fs.writeFileSync('tmp/replay-model-comparison.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,compared:rows.length,matchedWithinTwo:rows.filter(r=>Math.abs(r.difference)<=2).length,maxAbsoluteDifference:Math.max(...rows.map(r=>Math.abs(r.difference))),report:'tmp/replay-model-comparison.json'}));
