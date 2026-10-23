// Exhaustive supported-hero pairs, model invariants only. No network or private data.
import fs from 'node:fs';
import {SIM_ROSTER} from '../src/lib/simulationSkills.js';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
const mixedRings=process.argv.includes('--rings');
const output=process.argv[2]||'tmp/pairwise-interaction-audit.json',limit=Number(process.argv[3]||Infinity),rows=[],start=Date.now();let completed=0,actions=0;
outer:for(let a=0;a<SIM_ROSTER.length;a++)for(let b=a+1;b<SIM_ROSTER.length;b++)for(const opposing of [false,true]){
 if(completed>=limit)break outer;
 const names=opposing?[SIM_ROSTER[a].name,'하연','윤건',SIM_ROSTER[b].name,'루디','라드그리드']:[SIM_ROSTER[a].name,SIM_ROSTER[b].name,'하연','루디','라드그리드','선란'];
 for(const sideStart of [0,3]){const pinned=new Set(opposing?[0,3]:[0,1]),used=new Set(names.filter((_,i)=>i>=sideStart&&i<sideStart+3&&pinned.has(i)));for(let i=sideStart;i<sideStart+3;i++){if(pinned.has(i))continue;if(used.has(names[i]))names[i]=['하연','윤건','루디','라드그리드','선란','연희','쥬리','메이'].find(n=>!used.has(n));used.add(names[i]);}}
 try{
  let heroes=prepareHeroes();names.forEach((name,i)=>heroes=changeHero(heroes,i,name));if(mixedRings)for(const h of heroes)h.ring=['none','daebul','daegwon','gwonbul'][(h.id+completed)%4];let state=createBattle(heroes,{seed:1+completed,plans:{attacker:[],defender:[]}});
  for(let step=0;step<300&&!state.done;step++){
   const before=state.elapsedMs||0;state=advanceBattle(state);actions++;
   if(!Number.isFinite(state.elapsedMs)||state.elapsedMs<before||state.elapsedMs>state.timeLimitMs)throw Error('clock invariant');
   for(const u of state.units)for(const key of ['hp','maxHp','attack','defense','damageDealt','barrier'])if(!Number.isFinite(u[key])||u[key]<0)throw Error(u.name+' invalid '+key+': '+u[key]);
   state.log=[];state.impacts=[];
  }
  if(!state.done)throw Error('nontermination');
 }catch(e){rows.push({names,opposing,seed:1+completed,error:e.message});}
 completed++;if(completed%2000===0)console.log(JSON.stringify({completed,failures:rows.length,elapsedSeconds:Math.round((Date.now()-start)/1000)}));
}
const result={mixedRings,exhaustivePairSweep:completed===SIM_ROSTER.length*(SIM_ROSTER.length-1),supportedHeroes:SIM_ROSTER.length,completed,actions,failures:rows.length,elapsedSeconds:Math.round((Date.now()-start)/1000),scope:'Distinct hero pairs in same-team/opposing-team placements with unique heroes per team; one seed and one optional ring arrangement per placement. Software invariants only, not exhaustive six-hero/ring state verification or replay equivalence.',rows};fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:rows.slice(0,8)},null,2));if(rows.length)process.exitCode=1;
