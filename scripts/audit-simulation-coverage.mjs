import fs from 'node:fs';
import {SIM_ROSTER,heroSkills} from '../src/lib/simulationSkills.js';

// Parser gaps are review candidates: dedicated lifecycle handlers can already
// implement a rule. Never interpret a zero count as complete combat coverage.
const categories=[['marks',/표식/],['transformation',/변신|분신/],['conditionalDamage',/추가.*피해|생명력 전환|고정 피해/],['stacks',/중첩|레벨 증가/],['survival',/부활|불사|불굴|권능|축복/],['trigger',/발동 시|적중|사망 시|이하|이상/]];
const heroes=SIM_ROSTER.map(hero=>{
  const skills=heroSkills(hero.name),text=skills.flatMap(s=>s.unsupported).join('\n');
  return {name:hero.name,awakened:hero.awakened,source:hero.source,skills:skills.length,parserReviewCount:skills.reduce((n,s)=>n+s.unsupported.length,0),categories:categories.filter(([,re])=>re.test(text)).map(([key])=>key),complete:false};
});
const report={checkedAt:'2026-10-22',scope:'public roster parser review; not a combat correctness certificate',heroes:heroes.length,needsParserReview:heroes.filter(h=>h.parserReviewCount).length,entries:heroes};
const output=process.argv[2]||'tmp/simulation-coverage-audit.json';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({heroes:report.heroes,needsParserReview:report.needsParserReview,output}));
