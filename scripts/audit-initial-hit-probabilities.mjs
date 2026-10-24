// Offline diagnosis of initial positive-damage flags, not outcome validation.
import fs from 'node:fs';
import path from 'node:path';
import {setupFromRecord,ENGINE_VERSION} from '../src/lib/battlePrediction.js';
import {createBattle} from '../src/lib/experimentalBattle.js';
import {hitProbabilitiesFor} from '../src/lib/combatDamage.js';
import {combatSkill} from '../src/lib/heroTransformations.js';
import {canonicalHero} from '../src/lib/simulationSkills.js';
const root=process.argv[2],output=process.argv[3];
if(!root||!output)throw Error('Usage: node scripts/audit-initial-hit-probabilities.mjs PRIVATE_REPLAY_FOLDER AGGREGATE_OUTPUT');
const skipped={},contradictions={critical:0,blocked:0};let checked=0,currentImpossible=0;
for(const directory of fs.readdirSync(root)){
 try{
  const folder=path.join(root,directory),record=JSON.parse(fs.readFileSync(path.join(folder,'record.json'))),report=JSON.parse(fs.readFileSync(path.join(folder,'timeline.json')));
  const first=report.timeline.find(a=>a.actionKind==='active_skill'&&[2,3].includes(a.skillCode));if(!first)throw Error('No initial active skill');
  const {draft,plans}=setupFromRecord(record),state=createBattle(draft,{plans});
  const find=id=>{const h=report.heroes.find(h=>h.objectId===id);return h&&state.units.find(u=>u.side===h.side&&u.name===canonicalHero(h.name));};
  const source=find(first.source);if(!source)throw Error('Missing initial source');
  const seen=new Set(),spec=combatSkill(source,first.skillCode);
  for(const r of first.results){
   if(seen.has(r.target)||!(r.damage>0))continue;seen.add(r.target);
   const target=find(r.target);if(!target||target.side===source.side)continue;
   const p=hitProbabilitiesFor(source,target,{critBonus:spec?.critBonus||0}),crit=Math.max(0,Math.min(100,source.crit+(spec?.critBonus||0)));
   checked++;if(r.critical&&crit<=p.effectiveBlock)contradictions.critical++;
   if(r.block&&p.effectiveBlock<=crit)contradictions.blocked++;
   if(r.critical&&!p.critical||r.block&&!p.blocked)currentImpossible++;
  }
 }catch(e){skipped[e.message]=(skipped[e.message]||0)+1;}
}
const result={engineVersion:ENGINE_VERSION,checked,impossibleUnderPercentageDifference:contradictions,impossibleUnderCurrentModel:currentImpossible,skipped,scope:'First positive-damage result per target in the initial active skill; reused development records. Flags are comparison targets only. This conditional selection is not an unbiased proc-rate sample and does not establish the exact probability law by itself.'};
fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
