// Extract aggregate timing only. Private replay identities, stats, results and
// accounts are never written to the public timing catalog.
import fs from 'node:fs';
import path from 'node:path';
import {canonicalHero} from '../src/lib/simulationSkills.js';
const root=process.argv[2]||'tmp/validation-replays',groups=new Map(),seen=new Set(),allGaps=[];
for(const dir of fs.readdirSync(root)){
  const file=path.join(root,dir,'timeline.json');if(!fs.existsSync(file))continue;
  const report=JSON.parse(fs.readFileSync(file,'utf8'));if(!report.replaySha256||seen.has(report.replaySha256))continue;seen.add(report.replaySha256);
  const primaries=[];
  for(const a of report.timeline){
    const hero=report.heroes.find(h=>h.objectId===a.source),duration=a.skillEndTime-a.stageTime;
    if(!hero||![1,2,3,4,7].includes(a.skillCode)||!Number.isFinite(duration)||duration<100||duration>30000)continue;
    const kind=a.actionType===3?'counter':a.actionType===4?'assist':a.actionKind==='normal_attack'&&a.skillCode===1&&a.actionType===0?'basic':a.actionKind==='active_skill'&&[2,3,7].includes(a.skillCode)?'skill':'reaction';
    const key=canonicalHero(hero.name)+'|'+kind+'|'+a.skillCode;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(duration);
    if(['basic','skill'].includes(kind))primaries.push(a);
  }
  // Observed inter-action spacing is not labelled as network latency. Reactions
  // can occupy these gaps, so only a short nonnegative spacing range is retained.
  primaries.sort((a,b)=>a.stageTime-b.stageTime);
  for(let i=1;i<primaries.length;i++){const gap=primaries[i].stageTime-primaries[i-1].skillEndTime;if(gap>=0&&gap<=1000)allGaps.push(gap);}
}
function distribution(values){const v=values.slice().sort((a,b)=>a-b),q=p=>v[Math.floor((v.length-1)*p)];return {count:v.length,medianMs:q(.5),p10Ms:q(.1),p90Ms:q(.9),minMs:v[0],maxMs:v.at(-1)};}
const entries=Object.fromEntries([...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,values])=>[key,distribution(values)]));
const output={version:1,checkedAt:'2026-10-22',replayCount:seen.size,timeUnit:'milliseconds',
  note:'StageTime/SkillEndTime observations; not isolated animation constants or network latency. ActionType 3/4 are classified as counter/assist from observed examples; passive triggers remain separate.',
  spacing:allGaps.length?distribution(allGaps):null,entries};
fs.writeFileSync('src/lib/battleTimingCatalog.json',JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({replays:seen.size,heroCount:new Set([...groups.keys()].map(k=>k.split('|')[0])).size,profiles:groups.size,spacing:output.spacing}));
