import HeroBattleStats from './HeroBattleStats.jsx';
import {canViewHeroStats} from '../lib/heroBattleStats.js';
import DetailDialog from "./DetailDialog.jsx";
import HistoryCounterSearch from './HistoryCounterSearch.jsx';
import {loadBattleHeroSpeeds} from '../lib/battleHeroSpeeds.js';
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { defenseCopyText, groupDefenses, heroKey, heroNames, memoGuilds } from '../lib/guildWar.js';
import { sortByRecommendation } from '../lib/recommendationSort.js';
import { CounterOrderDisplay } from './CounterOrderFields.jsx';
import PcCollectorConnection from './PcCollectorConnection.jsx';
import { resolveGameSide } from '../lib/gameNames.js';

const box = 'min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5';
const button = 'site-button rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm disabled:opacity-50';
const date = value => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
const plain = value => typeof value === 'string' ? value : '';
// Skill codes confirmed by the site owner; apply to historical records too.
const skillLabel = skill => ({2:'1스',3:'2스',7:'각성기'}[skill?.skillType] || plain(skill?.skill) || '스킬 미확인');

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
  const [open, setOpen] = useState(false);
  const heroes = heroNames(deck.heroes);
  let rings = [];
  try { const parsed=JSON.parse(deck.rings); if(Array.isArray(parsed)) rings=parsed; } catch { rings=heroNames(deck.rings); }
  const title = plain(deck.title) || heroes.join(' · ') || '추천 카운터';
  return <>
    <button type="button" aria-haspopup="dialog" className="site-button site-button-secondary w-full rounded-xl border border-zinc-200 p-3 text-left text-sm font-semibold" onClick={()=>setOpen(true)}>{title}{deck.power ? ` · 추천도 ${deck.power}` : ''}<span className="ml-2 text-xs font-normal">상세보기 ↗</span></button>
    {open&&<DetailDialog title={title+' · 추천 카운터'} onClose={()=>setOpen(false)}>
    <div className="space-y-4 text-sm">
      <p>{heroes.join(' · ')}</p><p>펫: {plain(deck.pet)||'미입력'} · 진형: {plain(deck.formation)||'미입력'}</p>
      <div className="grid gap-2 sm:grid-cols-3">{heroes.map((hero,i)=><div key={i} className="min-w-0 rounded-lg bg-zinc-50 p-2"><b>{hero}</b><p className="whitespace-pre-wrap">반지: {plain(rings[i])||'미입력'}</p><p className="whitespace-pre-wrap">장비: {plain(deck[`gear_${i+1}`])||'미입력'}</p></div>)}</div>
      <p>팀속공: {plain(deck.team_speed)||'미입력'}</p>
      <CounterOrderDisplay heroes={heroes} value={deck.speed_order} kind="speed" />
      <CounterOrderDisplay heroes={heroes} value={deck.skill_order} kind="skill" />
      {deck.note && <p className="whitespace-pre-wrap">{plain(deck.note)}</p>}
    </div>
    </DetailDialog>}
  </>;
}

export function BattleSide({ title, side, result, speed, heroSpeeds, heroHealth, heroStats, showHeroSpeeds = false, hideIdentity = false, hideSpeed = false }) {
  side = resolveGameSide(side);
  const heroes = heroNames(side?.heroes);
  const skills = Array.isArray(side?.skills) ? side.skills : [];
  return <section className={`battle-side min-w-0 space-y-3 rounded-xl p-3 ${result ? `battle-side-${result}` : 'bg-zinc-50'}`}>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
      <span>{title}</span>
      {!hideSpeed && <span className="whitespace-nowrap font-semibold" style={{color:speed===true?'#15803d':speed===false?'#dc2626':undefined}}>{speed===true?'속공땀':speed===false?'속공따임':'속공 미확인'}</span>}
    </div>
    <div className="space-y-1">
      {!hideIdentity && <p className="font-semibold">{plain(side?.nickname)||'닉네임 미확인'}</p>}
      <p className="text-sm leading-6">{heroes.join(' · ')||'영웅 미확인'}</p>
      <p className="text-xs text-zinc-500">펫: {plain(side?.pet)||'미확인'}</p>
    </div>
    {side?.namesResolved === false && <p className="text-xs text-amber-700">영웅·펫 이름 확인 중 · 원본 번호 보존</p>}
    <div className="border-t border-current/10 pt-2">
      <p className="mb-2 text-xs font-semibold text-zinc-500">시작 예약 스킬</p>
      {skills.length ? <ol className="space-y-1.5 text-sm">{skills.map((skill,index)=><li key={index} className="flex items-start gap-2"><span className="shrink-0 text-xs leading-6 text-zinc-500">{index+1}.</span><span className="min-w-0 leading-6">{plain(skill?.hero)||'영웅 미확인'} <b className="whitespace-nowrap">{skillLabel(skill)}</b></span></li>)}</ol> : <p className="text-sm text-zinc-500">미수집</p>}
    </div>
    {showHeroSpeeds && !hideSpeed && <HeroBattleStats side={side} stats={heroStats} speeds={heroSpeeds} health={heroHealth} />}
  </section>;
}

const castles = ['외성1','외성2','외성3','외성4','외성5','내성1','내성2','내성3','본성'];
const warTitle = (value, opponent='') => { const [y,m,d] = value.split('-'); return `${y}년 ${Number(m)}월 ${Number(d)}일${opponent ? ` ${opponent}` : ''} 길드전 이력`; };

function DefenseCounterTabs({group,decks,currentUser}){
  const [tab,setTab]=useState('saved');
  return <div className="min-w-0 space-y-2"><div className="flex flex-wrap gap-2" aria-label="카운터 종류">{[['saved','추천 카운터'],['history','길드전 이력 카운터']].map(([value,label])=><button type="button" key={value} aria-pressed={tab===value} className={`${button} ${tab===value?'ring-2 ring-blue-500 font-bold':''}`} aria-expanded={tab===value} onClick={()=>setTab(current=>current===value?null:value)}>{label}</button>)}</div>
    {tab!==null&&(tab==='saved'?<><p className="text-xs text-zinc-500">상대 영웅 조합 기준 · 펫별 적합성은 확인해 주세요.</p>{decks.length?decks.map((deck,i)=><CounterDetails key={i} deck={deck}/>):<p className="text-sm text-zinc-500">저장된 카운터 없음</p>}</>:<HistoryCounterSearch currentUser={currentUser} defenseHeroes={group.heroes}/>)}
  </div>;
}
function DefenseGroups({ snapshot, counterTeams, castle, search, currentUser }) {
  const [overview,setOverview]=useState(false);
  const [copyStatus,setCopyStatus]=useState('');
  const [manualCopy,setManualCopy]=useState('');
  const copyText=defenseCopyText((snapshot?.payload?.defenses||[]).map(resolveGameSide));
  async function copyDefenses(){
    if(!copyText)return;
    try{await navigator.clipboard.writeText(copyText);setCopyStatus('복사했습니다. 카톡에 붙여넣기 하세요.');setManualCopy('');}
    catch{setCopyStatus('자동 복사가 차단됐습니다. 아래 내용을 선택해 복사해 주세요.');setManualCopy(copyText);}
  }

  const keyword=search.replace(/\s/g,'').toLowerCase();
  const groups=groupDefenses(snapshot?.payload?.defenses).filter(g=>(!castle||g.castle===castle)&&(!keyword||[...g.heroes,g.pet,...g.members].join(' ').replace(/\s/g,'').toLowerCase().includes(keyword)));
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">{[[false,'상세보기'],[true,'몰아보기']].map(([value,label])=><button type="button" key={label} aria-pressed={overview===value} className={`${button} ${overview===value?'ring-2 ring-blue-500 font-bold':''}`} onClick={()=>setOverview(value)}>{label}</button>)}<button type="button" className={button} disabled={!copyText} onClick={copyDefenses}>상대 방어팀 복사하기</button></div>
    {copyStatus&&<p role="status" className="text-sm">{copyStatus}</p>}
    {manualCopy&&<textarea aria-label="상대 방어팀 복사 내용" readOnly value={manualCopy} onFocus={e=>e.target.select()} className="w-full rounded-xl border border-zinc-200 bg-white p-3" rows={12}/>}
    {snapshot&&<p className="text-xs text-zinc-500">수집 시각: {date(snapshot.occurred_at)} · 수집 {Array.isArray(snapshot.payload.defenses)?snapshot.payload.defenses.length:0}개 / 전체 {Number.isInteger(snapshot.payload.total)?snapshot.payload.total:'미확인'}개</p>}
    {!groups.length&&<div className={box}><p>{snapshot?'조건에 맞는 상대 방어팀이 없습니다.':'아직 수집된 상대 방어팀이 없습니다.'}</p>{!snapshot&&<p className="mt-2 text-sm text-zinc-500">PC 수집기 연결 후 전장 정보를 수신하면 표시됩니다.</p>}</div>}
    {overview&&<div className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">{castles.filter(name=>!castle||castle===name).map(name=>{
      const rows=groups.filter(group=>group.castle===name);
      return <section key={name} className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4"><h3 className="mb-3 flex items-center justify-between gap-2 font-bold"><span>{name}</span><span className="text-sm font-normal text-zinc-500">{rows.reduce((sum,row)=>sum+row.count,0)}팀 · {rows.length}조합</span></h3><div className="space-y-3">{rows.map(group=>{
        const decks=sortByRecommendation(counterTeams.filter(t=>heroKey(t.heroes)===heroKey(group.heroes)).flatMap(t=>t.decks||[]));
        return <div key={group.key} className="min-w-0 rounded-xl border border-zinc-200 p-3"><div className="flex items-start justify-between gap-2"><p className="min-w-0 break-words text-sm font-semibold">{group.heroes.join(' · ')}</p><strong className="shrink-0 text-blue-600">×{group.count}</strong></div><p className="mt-1 break-words text-xs text-zinc-500">펫: {group.pet||'미확인'}</p><details className="mt-2 text-xs"><summary className="cursor-pointer">상대 목록</summary><p className="my-2 break-words">{group.members.join(' · ')}</p></details><div className="mt-3">{['member','admin'].includes(currentUser?.role)&&<DefenseCounterTabs group={group} decks={decks} currentUser={currentUser}/>}</div></div>;
      })}{!rows.length&&<p className="text-sm text-zinc-500">{search?'검색 결과 없음':'수집된 방어팀 없음'}</p>}</div></section>;
    })}</div>}
    {!overview&&groups.map(group=>{
      const decks=sortByRecommendation(counterTeams.filter(t=>heroKey(t.heroes)===heroKey(group.heroes)).flatMap(t=>t.decks||[]));
      return <article key={group.key} className={`${box} grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]`}>
        <div><p className="text-xs text-zinc-500">{group.castle}</p><h3 className="mt-1 font-semibold">{group.heroes.join(' · ')} <span>×{group.count}</span></h3><p className="mt-2 text-sm">펫: {group.pet||'미확인'}</p><details className="mt-3 text-sm"><summary className="cursor-pointer">상대 목록</summary><p>{group.members.join(' · ')}</p></details></div>
        {['member','admin'].includes(currentUser?.role)&&<DefenseCounterTabs group={group} decks={decks} currentUser={currentUser}/>}
      </article>;
    })}
  </div>;
}

export default function GuildWarPage({ guild, counterTeams, currentUser }) {
  const [dateNames,setDateNames]=useState({});
  const [mode,setMode]=useState('current');const [historyDate,setHistoryDate]=useState('');const [dates,setDates]=useState([]);
  const [section,setSection]=useState('teams');const [castle,setCastle]=useState('');const [search,setSearch]=useState('');const [query,setQuery]=useState('');
  const [battleOffset,setBattleOffset]=useState(0);const [hasMore,setHasMore]=useState(false);
  const [snapshot,setSnapshot]=useState(null);const [battles,setBattles]=useState([]);const [error,setError]=useState('');const [datesError,setDatesError]=useState('');
  const [loading,setLoading]=useState(false);const [datesLoading,setDatesLoading]=useState(true);const [revision,setRevision]=useState(0);
  const period=mode==='current'?(dates[0]||''):historyDate;
  const requestKey=JSON.stringify([guild,period,section,castle,query,revision,currentUser?.isOwner,currentUser?.id]);
  const [loadedKey,setLoadedKey]=useState('');
  const [heroSpeeds,setHeroSpeeds]=useState({});
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(search.trim());setBattleOffset(0);},300);return()=>clearTimeout(timer);},[search]);
  useEffect(()=>{
    let active=true;let running=false;
    async function loadDates(){
      if(running)return;running=true;
      try{const {data,error}=await supabase.rpc('guild_war_history_labels',{p_guild:guild});if(error)throw error;if(active){setDates((data||[]).map(row=>row.war_date));setDateNames(Object.fromEntries((data||[]).map(row=>[row.war_date,plain(row.opponent)])));setDatesError('');}}
      catch(e){if(active)setDatesError(e.message||'길드전 날짜를 불러오지 못했습니다.');}finally{running=false;if(active)setDatesLoading(false);}
    }
    loadDates();const timer=mode==='current'?setInterval(()=>{if(!document.hidden)loadDates();},60000):null;return()=>{active=false;clearInterval(timer);};
  },[guild,revision,mode]);
  useEffect(()=>{
    let active=true,running=false;const controller=new AbortController();
    async function load(){
      if(running||!period)return;running=true;
      try{
        if(section==='teams'){
          const {data,error}=await supabase.from('guild_war_observations').select('id,payload,occurred_at').eq('guild_name',guild).eq('war_date',period).eq('kind','defense_snapshot').order('occurred_at',{ascending:false}).limit(1).abortSignal(controller.signal);
          if(error)throw error;if(active)setSnapshot(data?.[0]||null);
        }else{
          const {data,error}=await supabase.rpc('guild_war_battle_page',{p_guild:guild,p_war_date:period,p_direction:section,p_castle:castle,p_search:query,p_offset:battleOffset}).abortSignal(controller.signal);
          if(error)throw error;if(active){setBattles(previous=>battleOffset?[...previous,...(data.records||[]).filter(row=>!previous.some(old=>old.id===row.id))]:data.records||[]);setHasMore(data.hasMore);}
        }
        if(active)setError('');
      }catch(e){if(active)setError(e.message||'기록을 불러오지 못했습니다.');}finally{running=false;if(active){setLoading(false);setLoadedKey(requestKey);}}
    }
    if(!battleOffset){setSnapshot(null);setBattles([]);setHeroSpeeds({});setHasMore(false);}
    setError('');setLoading(!!period);load();
    const timer=mode==='current'&&!battleOffset?setInterval(()=>{if(!document.hidden)load();},60000):null;
    return()=>{active=false;controller.abort();clearInterval(timer);};
  },[guild,period,section,castle,query,revision,currentUser?.isOwner,currentUser?.id,battleOffset,mode]);
  useEffect(()=>{let active=true;loadBattleHeroSpeeds(battles,currentUser).then(data=>{if(active)setHeroSpeeds(data);}).catch(()=>{});return()=>{active=false;};},[battles,currentUser?.id,currentUser?.isOwner]);
  function chooseSection(next){setSection(next);setCastle('');setSearch('');setQuery('');setBattleOffset(0);}
  const defenseTitle=`${dateNames[period]||snapshot?.payload?.opponentGuild||'상대'} 방어팀`;
  const title=section==='teams'?defenseTitle:section==='attack'?'공격 기록':'방어 기록';
  return <section className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{guild} 길드전</h1><button className={button} onClick={()=>{setBattleOffset(0);setRevision(v=>v+1);}}>새로고침</button></header>
    <PcCollectorConnection currentUser={currentUser} />
    <div className="guild-war-toolbar space-y-3 rounded-2xl border border-zinc-200 p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2" aria-label="길드전 분류">{[['current','현재 길드전'],['history','지난 길드전 이력']].map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} className={`${button} ${mode===value?'font-bold':''}`} onClick={()=>{setMode(value);chooseSection('teams');}}>{label}</button>)}</div>
        {mode==='history'&&<select aria-label="길드전 날짜" className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm" value={historyDate} disabled={datesLoading} onChange={event=>{setHistoryDate(event.target.value);chooseSection('teams');}}><option value="">길드전 날짜 선택</option>{dates.map(value=><option key={value} value={value}>{warTitle(value,dateNames[value])}</option>)}</select>}
      </div>
      {(period||mode==='current')&&<>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="기록 종류">{[['teams',defenseTitle],['attack','공격 기록'],['defense','방어 기록']].map(([value,label])=><button key={value} type="button" aria-pressed={section===value} className={`${button} whitespace-nowrap ${section===value?'font-bold':''}`} onClick={()=>chooseSection(value)}>{label}</button>)}</div>
        <div className="grid grid-cols-[minmax(100px,0.6fr)_minmax(0,1.4fr)] gap-2">
          <label className="text-xs text-zinc-500">성 위치<select aria-label="성별 분류" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-950" value={castle} onChange={event=>{setBattleOffset(0);setCastle(event.target.value);}}><option value="">전체</option>{castles.map(value=><option key={value} value={value}>{value}{section==='attack'?' 공격':section==='defense'?' 방어':''}</option>)}</select></label>
          <label className="text-xs text-zinc-500">검색<input aria-label="길드전 기록 검색" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-950" value={search} onChange={event=>setSearch(event.target.value)} placeholder="닉네임 · 영웅 · 펫" /></label>
        </div>
      </>}
    </div>
    {datesError&&<p role="alert" className="text-red-600">{datesError}</p>}
    {datesLoading?<p role="status">길드전 목록 불러오는 중…</p>:<>
      {mode==='history'&&!dates.length&&<p className="text-sm text-zinc-500">저장된 길드전 이력이 없습니다.</p>}
      {mode==='current'&&!period&&<div className={box}>아직 수집된 현재 길드전 정보가 없습니다.</div>}
      {mode==='history'&&dates.length>0&&!period&&<p className="text-sm text-zinc-500">확인할 길드전 날짜를 선택해 주세요.</p>}
      {(period||mode==='current')&&<>
        {period&&<p className="text-sm text-zinc-500">{warTitle(period,dateNames[period])}{mode==='current'?' · 가장 최근 수집된 길드전':''}</p>}
        <h2 className="text-lg font-semibold">{mode==='current'?'현재 길드전 ':''}{title}{section!=='teams'&&<span className="ml-2 text-sm font-normal text-zinc-500">{battles.length}건 표시 · 30건씩 최대 150건</span>}</h2>
        {error&&<p role="alert" className="text-red-600">{error}</p>}
        {(loading&&!battles.length)||(!!period&&loadedKey!==requestKey)?<p role="status">기록 불러오는 중…</p>:section==='teams'?<DefenseGroups currentUser={currentUser} snapshot={snapshot} counterTeams={counterTeams} castle={castle} search={query}/>:<div className="space-y-3">
          {!battles.length&&<div className={box}>{castle||query?'조건에 맞는 기록이 없습니다.':`아직 등록된 ${title}이 없습니다.`}</div>}
          {battles.map(row=><article key={row.id} className={box}><div className="mb-3 flex flex-wrap justify-between gap-2 text-sm"><span>{plain(row.payload.opponentGuild) && <>{plain(row.payload.opponentGuild)} · </>}{plain(row.payload.castle)||'위치 미확인'} · {date(row.occurred_at)}</span><span style={{color:typeof row.payload.attackerWon!=='boolean'?'#71717a':row.payload.attackerWon===(section==='attack')?'#15803d':'#dc2626',fontWeight:700}}>{typeof row.payload.attackerWon==='boolean'?(row.payload.attackerWon===(section==='attack')?'우리 길드 승리':'우리 길드 패배'):'결과 미확인'}</span></div><div className="grid gap-3 md:grid-cols-2"><BattleSide result={typeof row.payload.attackerWon==='boolean'?(row.payload.attackerWon===(section==='attack')?'win':'loss'):null} title={section==='attack'?'공격자 · 우리 길드':'공격자 · 상대 길드'} showHeroSpeeds={canViewHeroStats(currentUser)} heroStats={heroSpeeds[row.id]?.stats?.attacker} heroHealth={heroSpeeds[row.id]?.health?.attacker} heroSpeeds={heroSpeeds[row.id]?.attacker} side={row.payload.attacker} speed={row.payload.firstSkillSide?row.payload.firstSkillSide==='attacker':undefined}/><BattleSide result={typeof row.payload.attackerWon==='boolean'?(row.payload.attackerWon===(section==='attack')?'win':'loss'):null} title={section==='defense'?'방어자 · 우리 길드':'방어자 · 상대 길드'} showHeroSpeeds={canViewHeroStats(currentUser)} heroStats={heroSpeeds[row.id]?.stats?.defender} heroHealth={heroSpeeds[row.id]?.health?.defender} heroSpeeds={heroSpeeds[row.id]?.defender} side={row.payload.defender} speed={row.payload.firstSkillSide?row.payload.firstSkillSide==='defender':undefined}/></div></article>)}
          {loading&&battles.length>0&&<p role="status">추가 기록 불러오는 중…</p>}
          {hasMore&&!loading&&<button type="button" className={button} onClick={()=>setBattleOffset(battles.length)}>기록 30건 더 보기</button>}
        </div>}
      </>}
    </>}
  </section>;
}
