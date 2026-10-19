import {supabase} from './supabase.js';
import {heroKey} from './guildWar.js';
import {resolveGameSide} from './gameNames.js';

export async function readBattleHistory(){
  const all=[];const size=500;
  for(let offset=0;;offset+=size){
    const {data,error}=await supabase.from('guild_war_observations').select('id,source_key,guild_name,war_date,occurred_at,payload').eq('kind','battle').order('occurred_at',{ascending:false}).order('id').range(offset,offset+size-1);
    if(error)throw error;all.push(...(data||[]));if(!data||data.length<size)break;
  }
  const unique=new Map();
  for(const row of all){if(unique.has(row.source_key))continue;unique.set(row.source_key,{...row,payload:{...row.payload,attacker:resolveGameSide(row.payload.attacker),defender:resolveGameSide(row.payload.defender)}});}
  return [...unique.values()];
}
export function battleWinRate(group){
  const known=group.records.filter(r=>typeof r.payload.attackerWon==='boolean');
  return known.length?known.filter(r=>r.payload.attackerWon).length/known.length:null;
}
export function sortHistoryCounters(groups){
  return [...groups].sort((a,b)=>(battleWinRate(b)??-1)-(battleWinRate(a)??-1)||b.records.length-a.records.length||a.key.localeCompare(b.key,'ko'));
}
export function matchesDefense(row, key){return heroKey(row.payload.defender?.heroes)===key;}
