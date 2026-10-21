import {supabase} from './supabase.js';
import {canViewHeroStats} from './heroBattleStats.js';
export async function loadReplayExamples(user,signal){
  if(!canViewHeroStats(user))return [];
  const {data,error}=await supabase.from('guild_war_replay_analyses').select('id,title,occurred_at').order('occurred_at',{ascending:false}).limit(50).abortSignal(signal);
  if(error)throw error;return data||[];
}
export async function loadReplayReport(id,user,signal){
  if(!canViewHeroStats(user))return null;
  const {data,error}=await supabase.from('guild_war_replay_analyses').select('report').eq('id',id).abortSignal(signal).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('재생 데이터가 없거나 조회 권한이 없습니다.');
  return validateReplayReport(data.report);
}
export function validateReplayReport(report){
  if(!report||report.mode!=='observed_replay'||report.prediction!==false||!Array.isArray(report.heroes)||report.heroes.length!==6||!Array.isArray(report.timeline)||!report.timeline.length||report.timeline.length>2000)throw new Error('지원하는 전투 분석 파일이 아닙니다.');
  const ids=new Set(report.heroes.map(h=>h?.objectId));
  if(ids.size!==6||report.heroes.some(h=>!Number.isSafeInteger(h.objectId)||!['attacker','defender'].includes(h.side)||typeof h.name!=='string'||h.name.length>80||!h.stats||typeof h.stats!=='object'||Array.isArray(h.stats)||Object.values(h.stats).some(v=>!Number.isFinite(v)||Math.abs(v)>2147483647))||report.heroes.filter(h=>h.side==='attacker').length!==3)throw new Error('영웅 정보가 올바르지 않습니다.');
  let results=0;
  const validHp=s=>s&&['hp','maxHp','barrier'].every(k=>s[k]===null||s[k]===undefined||(Number.isFinite(s[k])&&s[k]>=0&&s[k]<=2147483647));
  if(report.heroes.some(h=>!validHp(h)))throw new Error('초기 체력 정보가 올바르지 않습니다.');
  for(const [index,a]of report.timeline.entries()){
    if(a?.index!==index+1||!Array.isArray(a.results)||!Array.isArray(a.statuses)||a.statuses.some(s=>!Array.isArray(s?.effects)||s.effects.length>1000)||!a.state||[...ids].some(id=>!validHp(a.state[id]))||a.results.some(r=>!ids.has(r?.target)||!validHp(r.before)||!validHp(r.after)||['damage','heal'].some(k=>r[k]!==null&&r[k]!==undefined&&(!Number.isFinite(r[k])||Math.abs(r[k])>2147483647))))throw new Error('전투 타임라인이 올바르지 않습니다.');
    results+=a.results.length;if(results>20000)throw new Error('전투 데이터가 너무 큽니다.');
  }
  return report;
}
