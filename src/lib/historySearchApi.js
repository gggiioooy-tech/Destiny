import {supabase} from './supabase.js';
import catalog from './gameCatalog.json';
import {matchesHeroSearch,searchTokens} from './heroSearch.js';
const names=[...new Set(Object.values(catalog.heroes))];
const cache=new Map();
export function historyCriteria(query,defenseHeroes,guild=''){
  const scope=guild?{p_guild:guild}:{};
  if(Array.isArray(defenseHeroes))return {...scope,p_tokens:[],p_defense:defenseHeroes,p_sort:'rate'};
  return {...scope,p_tokens:searchTokens(query).slice(0,12).map(token=>names.filter(name=>matchesHeroSearch(name,token))),p_defense:null,p_sort:'count'};
}
export async function historyGuilds(signal){
  const request=supabase.rpc('battle_history_guilds');
  const {data,error}=await (signal?request.abortSignal(signal):request);
  if(error)throw error;
  return [...new Set((data||[]).filter(name=>typeof name==='string'&&name.trim()))];
}
export async function historyPage(criteria,user,{offset=0,attack=null,signal,fresh=false}={}){
  const args={...criteria,p_attack:attack,p_offset:offset,p_limit:20};
  const key=JSON.stringify([user.id,user.role,user.isOwner,args]);const saved=cache.get(key);
  if(!fresh&&saved&&saved.until>Date.now())return saved.data;
  const request=supabase.rpc(criteria.p_guild?'search_battle_history_by_guild':'search_battle_history',args);
  const {data,error}=await (signal?request.abortSignal(signal):request);
  if(error)throw error;
  if(!signal?.aborted){if(cache.size>=60)cache.delete(cache.keys().next().value);cache.set(key,{data,until:Date.now()+30000});}
  return data;
}
