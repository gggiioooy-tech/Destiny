// Local observed replay aggregates only; no network, identifiers or winners.
import fs from 'node:fs';
import path from 'node:path';
const [root,output]=process.argv.slice(2);
if(!root||!output)throw Error('Usage: node audit-fixed-passive-flags.mjs PRIVATE_REPLAYS OUTPUT');
let replays=0,rows=0,blocked=0,critical=0,arisTargets=0;
for(const dir of fs.readdirSync(root)){
 const file=path.join(root,dir,'timeline.json');if(!fs.existsSync(file))continue;
 const data=JSON.parse(fs.readFileSync(file,'utf8'));let any=false;
 for(const action of data.timeline){
  const source=data.heroes.find(h=>h.objectId===action.source);
  if(source?.name!=='라드그리드'||action.skillCode!==4)continue;
  for(const row of action.results){
   if(row.damage!==1485)continue;
   rows++;any=true;blocked+=Number(row.block);critical+=Number(row.critical);
   arisTargets+=Number(data.heroes.find(h=>h.objectId===row.target)?.name==='아리스');
  }
 }
 replays+=Number(any);
}
const result={replays,positive1485PassiveDamageRows:rows,blockedRows:blocked,criticalRows:critical,arisTargetRows:arisTargets,
 limitation:'Only exact positive 1485 code-4 Rad rows; absorbed or nullified results are outside this count. No winners are read.'};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
