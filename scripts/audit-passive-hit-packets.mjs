// Offline aggregate evidence only. Never reads winners or outputs record IDs.
import fs from 'node:fs';
import path from 'node:path';
const [root,output]=process.argv.slice(2);
if(!root||!output)throw Error('Usage: node audit-passive-hit-packets.mjs PRIVATE_REPLAY_FOLDER OUTPUT');
const histogram=new Map();let owners=0,adds=0,maxAdds=0;
for(const folder of fs.readdirSync(root)){
 const file=path.join(root,folder,'timeline.json');if(!fs.existsSync(file))continue;
 const report=JSON.parse(fs.readFileSync(file,'utf8')),packets=new Map();
 for(const action of report.timeline){if(!packets.has(action.packet))packets.set(action.packet,[]);packets.get(action.packet).push(action);}
 for(const hero of report.heroes.filter(h=>h.name==='스쿨드')){
  owners++;
  for(const actions of packets.values()){
   const newThreads=actions.flatMap(a=>a.statuses.filter(s=>s.target===hero.objectId).flatMap(s=>s.effects)).filter(e=>e.moduleId===4016891402&&e.state===1).length;
   if(!newThreads)continue;
   const incoming=actions.filter(a=>report.heroes.find(h=>h.objectId===a.source)?.side!==hero.side&&a.results.some(r=>r.target===hero.objectId&&r.damage!==null));
   const key=JSON.stringify([newThreads,incoming.length]);histogram.set(key,(histogram.get(key)||0)+1);adds+=newThreads;maxAdds=Math.max(maxAdds,newThreads);
  }
 }
}
const result={hero:'스쿨드',owners,newThreadRows:adds,maxNewThreadsPerOwnerPacket:maxAdds,
 cases:[...histogram].map(([key,count])=>{const [newThreads,otherSideDamageActions]=JSON.parse(key);return {newThreads,otherSideDamageActions,count};}),
 limitation:'Packet grouping and status add rows are observational evidence; zero-damage result rows can include status applications. This does not prove every same-frame interruption or every hit counter.'};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
