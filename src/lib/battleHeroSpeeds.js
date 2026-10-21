import {canViewHeroStats} from './heroBattleStats.js';
import {supabase} from './supabase.js';

// RLS independently enforces the protected owner tier, including direct API calls.
export async function loadBattleHeroSpeeds(rows, currentUser) {
  if(!canViewHeroStats(currentUser)||!rows.length)return {};
  const result={};
  for(let offset=0;offset<rows.length;offset+=150){
    const {data,error}=await supabase.from('guild_war_hero_speeds').select('observation_id,speeds,health,stats,replay').in('observation_id',rows.slice(offset,offset+150).map(r=>r.id));
    if(error)throw error;
    for(const row of data||[])result[row.observation_id]={...row.speeds,health:row.health,stats:row.stats,replay:row.replay};
  }
  return result;
}
