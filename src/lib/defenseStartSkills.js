import {supabase} from './supabase.js';
import {canViewHeroStats} from './heroBattleStats.js';
export async function loadDefenseStartSkills(snapshotId,user,signal){
 if(!canViewHeroStats(user)||!snapshotId)return [];
 const {data,error}=await supabase.from('guild_war_defense_skills').select('skills').eq('observation_id',snapshotId).abortSignal(signal).maybeSingle();
 if(error)throw error;
 return Array.isArray(data?.skills)?data.skills:[];
}
export const defenseSkillLabel=type=>({2:'1스',3:'2스',7:'각성기'}[type]||'미확인');
