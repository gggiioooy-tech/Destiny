// Offline aggregate verification. Spawn barrier is a comparison target only.
// No observed barrier, later HP, or outcome enters setupFromRecord.
import fs from 'node:fs';
import path from 'node:path';
import {setupFromRecord,ENGINE_VERSION} from '../src/lib/battlePrediction.js';
import {createBattle} from '../src/lib/experimentalBattle.js';
import {canonicalHero} from '../src/lib/simulationSkills.js';
const root=process.argv[2],output=process.argv[3];
if(!root||!output)throw Error('Usage: node scripts/audit-native-starting-shields.mjs PRIVATE_REPLAY_FOLDER AGGREGATE_OUTPUT');
const groups={},skipped={};let records=0,checked=0,withinRounding=0,maxAbsoluteError=0;
for(const directory of fs.readdirSync(root)){
 try{
  const folder=path.join(root,directory),record=JSON.parse(fs.readFileSync(path.join(folder,'record.json'))),report=JSON.parse(fs.readFileSync(path.join(folder,'timeline.json')));
  const {draft,plans}=setupFromRecord(record),state=createBattle(draft,{plans});records++;
  for(const u of state.units.filter(u=>['윤건','젠이츠'].includes(u.name))){
   const observed=report.heroes.find(h=>h.side===u.side&&canonicalHero(h.name)===u.name);
   if(!Number.isFinite(observed?.barrier))throw Error('Missing observed starting shield');
   const error=Math.abs(u.barrier-observed.barrier),enemyHayeon=state.units.some(v=>v.side!==u.side&&v.name==='하연');
   const key=[u.name,u.side,enemyHayeon?'enemy-Hayeon':'no-enemy-Hayeon'].join('|');
   const group=groups[key]||={checked:0,withinTwo:0,maxAbsoluteError:0};group.checked++;group.withinTwo+=error<=2;group.maxAbsoluteError=Math.max(group.maxAbsoluteError,error);
   checked++;withinRounding+=error<=2;maxAbsoluteError=Math.max(maxAbsoluteError,error);
  }
 }catch(e){skipped[e.message]=(skipped[e.message]||0)+1;}
}
const result={engineVersion:ENGINE_VERSION,scope:'Reused development archive; Yoongeon and Zenitsu native shields only. Two-point tolerance for rounded start attack. Not a new holdout or outcome-accuracy claim.',records,checked,withinRounding,maxAbsoluteError,groups,skipped};
fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
