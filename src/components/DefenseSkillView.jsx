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
  const controller=new AbortController();let active=true,busy=false;setError('');setResult(null);
  async function refresh(){
   if(busy||document.hidden)return;busy=true;
   try{const rows=await loadDefenseStartSkills(snapshot?.id,currentUser,controller.signal);if(active){setResult({key,rows});setError('');}}
   catch(e){if(active)setError(e.message||'스킬 정보를 불러오지 못했습니다.');}finally{busy=false;}
  }
  void refresh();const timer=setInterval(refresh,15000);
  return()=>{active=false;controller.abort();clearInterval(timer);};
 },[key,permitted]);
 if(!permitted)return null;
 if(error)return <p role="alert" className="text-sm text-red-600">{error}</p>;
 if(!result||result.key!==key)return <p role="status" className="text-sm">상대 시작 스킬 불러오는 중…</p>;
 const byIndex=new Map(result.rows.map(row=>[row.index,row.skills]));
 const keyword=String(search||'').replace(/\s/g,'').toLowerCase();
 const rows=(snapshot?.payload?.defenses||[]).map((row,index)=>({...resolveGameSide(row),index,skills:byIndex.get(index)||[]})).filter(row=>(!castle||row.castle===castle)&&(!keyword||[row.nickname,...(row.heroes||[]),row.pet].join(' ').replace(/\s/g,'').toLowerCase().includes(keyword))).sort((a,b)=>a.castle.localeCompare(b.castle,'ko',{numeric:true})||a.nickname.localeCompare(b.nickname,'ko'));
 const locations=['외성1','외성2','외성3','외성4','외성5','내성1','내성2','내성3','본성'];
 return <div className="space-y-4">
  <p className="text-xs text-zinc-500">상대 시작 예약 스킬 · 15초마다 자동 갱신 · 같은 조합도 상대마다 순서가 다를 수 있습니다.</p>
  {locations.filter(name=>!castle||name===castle).map(name=>{
   const members=rows.filter(row=>row.castle===name);
   return <section key={name} className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4" aria-label={`${name} 상대 시작 스킬`}>
    <h3 className="mb-3 flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3 font-bold"><span>{name}</span><span className="text-xs font-normal text-zinc-500">{members.length}팀 · 스킬 수집 {members.filter(row=>row.skills.length).length}팀</span></h3>
    <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">{members.map(row=><article key={row.index} className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4">
     <h4 className="break-words font-semibold">{row.nickname||'닉네임 미확인'}</h4>
     <p className="mt-2 break-words text-sm">{row.heroes.join(' · ')}</p><p className="mt-1 text-xs text-zinc-500">펫: {row.pet||'미확인'}</p>
     {row.skills.length?<ol className="mt-3 space-y-2 border-t border-zinc-200 pt-3 text-sm">{[...row.skills].sort((a,b)=>a.order-b.order).map(skill=><li key={skill.order} className="flex gap-2"><span className="text-zinc-500">{skill.order}.</span><span className="min-w-0 break-words">{row.heroes[row.heroIds.indexOf(skill.heroId)]||`영웅 #${skill.heroId}`} <b className="whitespace-nowrap">{defenseSkillLabel(skill.skillType)}</b></span></li>)}</ol>:<p className="mt-3 text-sm text-zinc-500">시작 스킬 미수집 · 최신 수집기를 켜고 게임에서 {name} 목록을 열어 주세요.</p>}
    </article>)}</div>
    {!members.length&&<p className="text-sm text-zinc-500">{search?'검색 결과 없음':'수집된 방어팀 없음'}</p>}
   </section>;
  })}
 </div>;
}
