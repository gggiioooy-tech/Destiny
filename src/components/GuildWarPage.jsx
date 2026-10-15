import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { groupDefenses, heroKey, heroNames, memoGuilds, uniqueBattles } from '../lib/guildWar.js';
import { sortByRecommendation } from '../lib/recommendationSort.js';
import { CounterOrderDisplay } from './CounterOrderFields.jsx';

const box = 'min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5';
const button = 'site-button rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm disabled:opacity-50';
const date = value => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
const plain = value => typeof value === 'string' ? value : '';

export function AddGuildWarTab({ users, tabs, onAdded }) {
  const [busy,setBusy] = useState(''); const [error,setError] = useState('');
  const names = [...new Set(users.flatMap(u => memoGuilds(u.memo)))].filter(name => !tabs.some(t => t.name === name)).sort((a,b) => a.localeCompare(b,'ko'));
  async function add(name) {
    if (busy) return;
    setBusy(name);setError('');
    try { const {error} = await supabase.rpc('add_guild_war_tab',{p_name:name}); if(error) throw error; await onAdded(name); }
    catch(e){setError(e.message || '길드를 추가하지 못했습니다.');} finally{setBusy('');}
  }
  return <section className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
    <h1 className="text-2xl font-bold">길드 추가하기</h1>
    <p className="text-sm text-zinc-500">관리자 메모에 등록된 길드를 선택하세요. 추가하면 해당 길드의 보류된 기록도 표시됩니다.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <div className={box}><div className="flex flex-wrap gap-3">{names.map(name => <button key={name} className={button} disabled={!!busy} onClick={()=>add(name)}>{busy===name?'추가 중…':name}</button>)}</div>
      {!names.length && <p className="text-sm text-zinc-500">추가할 길드가 없습니다.</p>}
    </div>
  </section>;
}

function CounterDetails({ deck }) {
  const heroes = heroNames(deck.heroes);
  let rings = [];
  try { const parsed=JSON.parse(deck.rings); if(Array.isArray(parsed)) rings=parsed; } catch { rings=heroNames(deck.rings); }
  return <details className="rounded-xl border border-zinc-200 p-3">
    <summary className="cursor-pointer text-sm font-semibold">{plain(deck.title) || heroes.join(' · ') || '추천 카운터'}{deck.power ? ` · 추천도 ${deck.power}` : ''}</summary>
    <div className="mt-3 space-y-3 text-sm">
      <p>{heroes.join(' · ')}</p><p>펫: {plain(deck.pet)||'미입력'} · 진형: {plain(deck.formation)||'미입력'}</p>
      <div className="grid gap-2 sm:grid-cols-3">{heroes.map((hero,i)=><div key={i} className="min-w-0 rounded-lg bg-zinc-50 p-2"><b>{hero}</b><p className="whitespace-pre-wrap">반지: {plain(rings[i])||'미입력'}</p><p className="whitespace-pre-wrap">장비: {plain(deck[`gear_${i+1}`])||'미입력'}</p></div>)}</div>
      <p>팀속공: {plain(deck.team_speed)||'미입력'}</p>
      <CounterOrderDisplay heroes={heroes} value={deck.speed_order} kind="speed" />
      <CounterOrderDisplay heroes={heroes} value={deck.skill_order} kind="skill" />
      {deck.note && <p className="whitespace-pre-wrap">{plain(deck.note)}</p>}
    </div>
  </details>;
}

function BattleSide({ title, side }) {
  return <div className="min-w-0 rounded-xl bg-zinc-50 p-3"><p className="text-xs text-zinc-500">{title}</p><p className="mt-1 font-semibold">{plain(side?.nickname)||'닉네임 미확인'}</p><p className="text-sm">{heroNames(side?.heroes).join(' · ')||'영웅 미확인'}</p><p className="text-sm">펫: {plain(side?.pet)||'미확인'}</p>
    <p className="mt-2 text-xs text-zinc-500">시작 예약 스킬</p><p className="text-sm">{Array.isArray(side?.skills)&&side.skills.length ? side.skills.map(s=>`${plain(s?.hero)||'영웅 미확인'} ${plain(s?.skill)||'스킬 미확인'}`).join(' → ') : '미수집'}</p>
  </div>;
}

export default function GuildWarPage({ guild, counterTeams }) {
  const [snapshot,setSnapshot]=useState(null);const [battles,setBattles]=useState([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;let running=false;
    async function load(){
      if(running)return;running=true;
      try {
        const [s,b]=await Promise.all([
          supabase.from('guild_war_observations').select('id,payload,occurred_at').eq('guild_name',guild).eq('kind','defense_snapshot').order('occurred_at',{ascending:false}).limit(1),
          supabase.from('guild_war_observations').select('id,source_key,payload,occurred_at').eq('guild_name',guild).eq('kind','battle').order('occurred_at',{ascending:false}).limit(200),
        ]);
        if(s.error||b.error)throw s.error||b.error;
        if(active){setSnapshot(s.data?.[0]||null);setBattles(uniqueBattles(b.data||[]));setError('');}
      }catch(e){if(active)setError(e.message||'기록을 불러오지 못했습니다.');}finally{running=false;if(active)setLoading(false);}
    }
    setLoading(true);setSnapshot(null);setBattles([]);load();
    const timer=setInterval(()=>{if(!document.hidden)load();},15000);
    return()=>{active=false;clearInterval(timer);};
  },[guild,revision]);
  const groups=groupDefenses(snapshot?.payload?.defenses);
  return <section className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{guild} 길드전</h1><p className="mt-2 text-sm text-zinc-500">상대 방어 조합과 전투 기록을 확인하세요.</p></div><button className={button} onClick={()=>setRevision(v=>v+1)}>새로고침</button></header>
    {error&&<p role="alert" className="text-red-600">{error}</p>}
    {loading?<p role="status">기록 불러오는 중…</p>:<>
      <section className="space-y-3"><h2 className="text-lg font-semibold">상대 방어팀</h2>
        {snapshot&&<p className="text-xs text-zinc-500">수집 시각: {date(snapshot.occurred_at)} · 수집 {Array.isArray(snapshot.payload.defenses)?snapshot.payload.defenses.length:0}개 / 전체 {Number.isInteger(snapshot.payload.total)?snapshot.payload.total:'미확인'}개</p>}
        {!groups.length&&<div className={box}><p>아직 수집된 상대 방어팀이 없습니다.</p><p className="mt-2 text-sm text-zinc-500">PC 수집기 연결 후 전장 정보를 수신하면 표시됩니다.</p></div>}
        {groups.map(group=>{
          const matches=counterTeams.filter(t=>heroKey(t.heroes)===heroKey(group.heroes));
          const decks=sortByRecommendation(matches.flatMap(t=>t.decks||[]));
          return <article key={group.key} className={`${box} grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]`}>
            <div><p className="text-xs text-zinc-500">{group.castle}</p><h3 className="mt-1 font-semibold">{group.heroes.join(' · ')} <span>×{group.count}</span></h3><p className="mt-2 text-sm">펫: {group.pet||'미확인'}</p><details className="mt-3 text-sm"><summary className="cursor-pointer">상대 목록</summary><p>{group.members.join(' · ')}</p></details></div>
            <div className="min-w-0 space-y-2"><h4 className="text-sm font-semibold">추천 카운터</h4><p className="text-xs text-zinc-500">상대 영웅 조합 기준 · 펫별 적합성은 확인해 주세요.</p>{decks.length?decks.map((deck,i)=><CounterDetails key={i} deck={deck}/>):<p className="text-sm text-zinc-500">저장된 카운터 없음</p>}</div>
          </article>;
        })}
      </section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">전투 기록 <span className="text-sm font-normal text-zinc-500">최근 최대 200건</span></h2>
        {!battles.length&&<div className={box}>아직 등록된 전투 기록이 없습니다.</div>}
        {battles.map(row=><article key={row.id} className={box}><div className="mb-3 flex flex-wrap justify-between gap-2 text-sm"><span>{plain(row.payload.castle)||'위치 미확인'} · {date(row.occurred_at)}</span><span>{row.payload.attackerWon===true?'공격자 승리':row.payload.attackerWon===false?'방어자 승리':'결과 미확인'}</span></div><div className="grid gap-3 md:grid-cols-2"><BattleSide title="공격자" side={row.payload.attacker}/><BattleSide title="방어자" side={row.payload.defender}/></div></article>)}
      </section>
    </>}
  </section>;
}
