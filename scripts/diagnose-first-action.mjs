// Local forensic comparison only. Observed state is used as the comparison
// target, never as a prediction input. Outputs may contain private battle keys.
import fs from 'node:fs';
import path from 'node:path';
import {setupFromRecord,ENGINE_VERSION} from '../src/lib/battlePrediction.js';
import {createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
import {canonicalHero} from '../src/lib/simulationSkills.js';
const root=process.argv[2],output=process.argv[3];
if(!root||!output)throw Error('Usage: node scripts/diagnose-first-action.mjs PRIVATE_REPLAY_FOLDER PRIVATE_OUTPUT_JSON');
const observedBarriers=process.argv.includes('--observed-start-barriers');
const rows=[],skipped={};
for(const directory of fs.readdirSync(root)){
  try{
    const folder=path.join(root,directory),record=JSON.parse(fs.readFileSync(path.join(folder,'record.json'))),report=JSON.parse(fs.readFileSync(path.join(folder,'timeline.json')));
    const first=report.timeline.find(a=>a.actionKind==='active_skill'&&[2,3,7].includes(a.skillCode));if(!first)throw Error('No initial active skill');
    const boundary=report.timeline.filter(a=>a.packet===first.packet).at(-1);
    const {draft,plans}=setupFromRecord(record),source=report.heroes.find(h=>h.objectId===first.source);
    const mapping=report.heroes.map(h=>({observed:h.objectId,model:draft.find(u=>u.name===canonicalHero(h.name)&&u.side===h.side)?.id}));
    if(!source||mapping.some(m=>m.model===undefined))throw Error('Hero mapping unavailable');
    const starts=createBattle(draft,{plans,seed:1});
    const barriers=mapping.map(m=>({hero:starts.units[m.model].name,observed:report.heroes.find(h=>h.objectId===m.observed).barrier||0,model:starts.units[m.model].barrier||0})).filter(r=>Math.abs(r.model-r.observed)>1);
    const samples=[];let matching=0;
    for(let seed=1;seed<=32;seed++){
      const initial=createBattle(draft,{plans,seed});
      if(observedBarriers)for(const m of mapping){initial.units[m.model].barrier=report.heroes.find(h=>h.objectId===m.observed).barrier||0;initial.units[m.model].barrierTurns=initial.units[m.model].barrier>0?3:0;}
      const next=advanceBattle(initial);
      if(next.action?.code!==first.skillCode||next.units[next.active]?.name!==canonicalHero(source.name)||next.units[next.active]?.side!==source.side)continue;
      matching++;samples.push(next.units.map(u=>u.hp/u.maxHp));
    }
    const hp=mapping.map(m=>{const actual=boundary.state[String(m.observed)];if(!actual)return null;const values=samples.map(s=>s[m.model]);return {hero:starts.units[m.model].name,observed:actual.hp/actual.maxHp,min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null};}).filter(Boolean);
    rows.push({key:record.sourceKey,hero:canonicalHero(source.name),code:first.skillCode,matchingSeeds:matching,barrierMismatches:barriers,hp});
  }catch(e){skipped[e.message]=(skipped[e.message]||0)+1;}
}
const comparable=rows.filter(r=>r.matchingSeeds),outside=comparable.flatMap(r=>r.hp).filter(h=>h.min!==null&&(h.observed<h.min-.01||h.observed>h.max+.01));
const summary={engineVersion:ENGINE_VERSION,diagnosticObservedStartBarriers:observedBarriers,battles:rows.length,firstActionComparable:comparable.length,firstActionMismatch:rows.length-comparable.length,initialBarrierMismatchBattles:rows.filter(r=>r.barrierMismatches.length).length,hpOutsideSampleEnvelope:outside.length,skipped,boundary:'last action in initial active packet, including recorded reactions',note:'32 sampled paths are a diagnostic envelope, not an exhaustive probability bound. Replay packet boundaries and model action boundaries may differ.'};
fs.writeFileSync(output,JSON.stringify({summary,rows},null,2));console.log(JSON.stringify(summary,null,2));
