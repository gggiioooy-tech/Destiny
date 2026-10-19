import {loadBattleHeroSpeeds} from '../lib/battleHeroSpeeds.js';
import React, {useEffect,useMemo,useState} from 'react';
import {supabase} from '../lib/supabase.js';
import {matchesEnemyTeamSearch} from '../lib/heroSearch.js';
import {heroKey} from '../lib/guildWar.js';
import {resolveGameSide} from '../lib/gameNames.js';
import {BattleSide} from './GuildWarPage.jsx';

export default function HistoryCounterSearch({currentUser}){
  const [heroSpeeds,setHeroSpeeds]=useState({});
  const [rows,setRows]=useState([]),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;
    async function load(){
      setLoading(true);setError('');setHeroSpeeds({});
      try{
        const all=[];const size=500;
        for(let offset=0;;offset+=size){
          const {data,error}=await supabase.from('guild_war_observations').select('id,source_key,guild_name,war_date,occurred_at,payload').eq('kind','battle').order('occurred_at',{ascending:false}).order('id').range(offset,offset+size-1);
          if(error)throw error;if(!active)return;all.push(...(data||[]));if(!data||data.length<size)break;
        }
        const unique=new Map();
        for(const row of all){if(unique.has(row.source_key))continue;unique.set(row.source_key,{...row,payload:{...row.payload,attacker:resolveGameSide(row.payload.attacker),defender:resolveGameSide(row.payload.defender)}});}
        const speeds=await loadBattleHeroSpeeds([...unique.values()],currentUser);if(active){setRows([...unique.values()]);setHeroSpeeds(speeds);}
      }catch(e){if(active){setRows([]);setError(e.message||'길드전 이력을 불러오지 못했습니다.');}}
      finally{if(active)setLoading(false);}
    }
    load();return()=>{active=false;};
  },[revision,currentUser?.id,currentUser?.isOwner]);
  const groups=useMemo(()=>{
    if(!query.trim())return [];
    const map=new Map();
    for(const row of rows){
      const p=row.payload;if(!matchesEnemyTeamSearch({heroes:p.defender?.heroes||[]},query))continue;
      const heroes=p.attacker?.heroes||[];if(!heroes.length)continue;
      const key=heroKey(heroes);const group=map.get(key)||{key,heroes,records:[]};group.records.push(row);map.set(key,group);
    }
    return [...map.values()].sort((a,b)=>b.records.length-a.records.length||a.key.localeCompare(b.key,'ko'));
  },[rows,query]);
  return <section className="site-page mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">공격팀 (길드전 이력으로 검색)</h1><button type="button" className="site-button rounded-xl border bg-white px-4 py-2" disabled={loading} onClick={()=>setRevision(v=>v+1)}>새로고침</button></header>
    <div className="rounded-2xl border border-zinc-200 bg-white p-4"><label htmlFor="history-counter-query" className="font-semibold">상대 방어 영웅 검색</label><input id="history-counter-query" value={query} onChange={e=>setQuery(e.target.value)} placeholder="예: 아일린 젠이츠 델론즈 또는 ㅇㅇㄹ, ㅈㅇㅊ, ㄷㄹㅈ" className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3"/><p className="mt-2 text-sm text-zinc-500">영웅명·초성을 띄어쓰기나 쉼표로 구분하세요. 순서와 관계없이 입력한 영웅을 모두 포함한 방어팀을 검색합니다.</p><p className="mt-1 text-sm text-zinc-500">우리·상대 길드의 실제 공격 이력 · 공격 영웅 조합 사용 횟수순 · 펫과 스킬 차이는 각 기록에서 확인</p></div>
    {error&&<p role="alert" className="text-red-600">{error}</p>}
    {loading?<p role="status">길드전 이력을 불러오는 중…</p>:!query.trim()?<p>방어 영웅을 입력해 주세요.</p>:<>
      <p role="status">공격 덱 {groups.length}개 · 공격 이력 {groups.reduce((n,g)=>n+g.records.length,0)}건</p>
      {!groups.length&&<p>조건에 맞는 길드전 이력이 없습니다.</p>}
      {groups.map(group=><article key={group.key} className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-bold">{group.heroes.join(' · ')} <span className="text-blue-600">{group.records.length}회 공격</span></h2>
        <p className="text-sm">승리 {group.records.filter(r=>r.payload.attackerWon===true).length}회 · 패배 {group.records.filter(r=>r.payload.attackerWon===false).length}회</p>
        <details open={groups.length===1}><summary className="cursor-pointer font-semibold">날짜·공격자·펫·스킬 기록 보기 ({group.records.length}건)</summary><div className="mt-3 space-y-3">{group.records.map(row=>{
          const p=row.payload;const attackGuild=p.direction==='attack'?row.guild_name:p.opponentGuild;const defendGuild=p.direction==='attack'?p.opponentGuild:row.guild_name;
          const result=typeof p.attackerWon==='boolean'?(p.attackerWon?'win':'loss'):null;
          return <div key={row.source_key} className="space-y-2 rounded-xl border border-zinc-200 p-3">
            <p className="text-sm font-semibold">{new Date(row.war_date+'T12:00:00+09:00').toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Seoul'})} 길드전 · {attackGuild||'길드 미확인'} · {p.attacker?.nickname||'닉네임 미확인'}</p>
            <p className="text-xs text-zinc-500">전투 시각: {new Date(row.occurred_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · 공격자 {result==='win'?'승리':result==='loss'?'패배':'결과 미확인'}</p>
            <div className="grid gap-3 md:grid-cols-2"><BattleSide title={`공격 · ${attackGuild||'길드 미확인'}`} showHeroSpeeds={currentUser?.isOwner===true} heroSpeeds={heroSpeeds[row.id]?.attacker} side={p.attacker} speed={p.firstSkillSide?p.firstSkillSide==='attacker':undefined} result={result}/><BattleSide title={`방어 · ${defendGuild||'길드 미확인'}`} showHeroSpeeds={currentUser?.isOwner===true} heroSpeeds={heroSpeeds[row.id]?.defender} side={p.defender} speed={p.firstSkillSide?p.firstSkillSide==='defender':undefined} result={result}/></div>
          </div>;
        })}</div></details>
      </article>)}
    </>}
  </section>;
}
