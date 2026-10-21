import React,{useEffect,useState} from 'react';
import {canViewHeroStats} from '../lib/heroBattleStats.js';
import {loadDefenseStartSkills,defenseSkillLabel} from '../lib/defenseStartSkills.js';
import {resolveGameSide} from '../lib/gameNames.js';
export default function DefenseSkillView({snapshot,currentUser,castle,search}){
 const permitted=canViewHeroStats(currentUser);
 const [result,setResult]=useState(null),[error,setError]=useState('');
 const key=JSON.stringify([snapshot?.id,currentUser?.id,currentUser?.authUserId]);
 useEffect(()=>{
  if(!permitted)return;
  const controller=new AbortController();let active=true;setError('');setResult(null);
  loadDefenseStartSkills(snapshot?.id,currentUser,controller.signal).then(rows=>{if(active)setResult({key,rows});}).catch(e=>{if(active)setError(e.message||'스킬 정보를 불러오지 못했습니다.');});
  return()=>{active=false;controller.abort();};
 },[key,permitted]);
 if(!permitted)return null;
 if(error)return <p role="alert" className="text-sm text-red-600">{error}</p>;
 if(!result||result.key!==key)return <p role="status" className="text-sm">상대 시작 스킬 불러오는 중…</p>;
 const byIndex=new Map(result.rows.map(row=>[row.index,row.skills]));
 const keyword=String(search||'').replace(/\s/g,'').toLowerCase();
 const rows=(snapshot?.payload?.defenses||[]).map((row,index)=>({...resolveGameSide(row),index,skills:byIndex.get(index)||[]})).filter(row=>(!castle||row.castle===castle)&&(!keyword||[row.nickname,...(row.heroes||[]),row.pet].join(' ').replace(/\s/g,'').toLowerCase().includes(keyword))).sort((a,b)=>a.castle.localeCompare(b.castle,'ko',{numeric:true})||a.nickname.localeCompare(b.nickname,'ko'));
 return <div className="space-y-3">
  <p className="text-xs text-zinc-500">상대가 설정한 시작 예약 스킬입니다. 같은 조합도 상대마다 순서가 다를 수 있습니다.</p>
  <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map(row=><article key={row.index} className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4">
   <p className="text-xs text-zinc-500">{row.castle}</p><h3 className="mt-1 break-words font-semibold">{row.nickname||'닉네임 미확인'}</h3>
   <p className="mt-2 break-words text-sm">{row.heroes.join(' · ')}</p><p className="mt-1 text-xs text-zinc-500">펫: {row.pet||'미확인'}</p>
   {row.skills.length?<ol className="mt-3 space-y-2 border-t border-zinc-200 pt-3 text-sm">{[...row.skills].sort((a,b)=>a.order-b.order).map(skill=><li key={skill.order} className="flex gap-2"><span className="text-zinc-500">{skill.order}.</span><span className="min-w-0 break-words">{row.heroes[row.heroIds.indexOf(skill.heroId)]||`영웅 #${skill.heroId}`} <b className="whitespace-nowrap">{defenseSkillLabel(skill.skillType)}</b></span></li>)}</ol>:<p className="mt-3 text-sm text-zinc-500">시작 스킬 미수집</p>}
  </article>)}</div>
  {!rows.length&&<p className="text-sm text-zinc-500">조건에 맞는 상대 방어팀이 없습니다.</p>}
 </div>;
}
