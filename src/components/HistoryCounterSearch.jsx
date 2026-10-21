import {canViewHeroStats} from '../lib/heroBattleStats.js';
import DetailDialog from "./DetailDialog.jsx";
import React,{useEffect,useState} from 'react';
import {historyCriteria,historyPage} from '../lib/historySearchApi.js';
import {loadBattleHeroSpeeds} from '../lib/battleHeroSpeeds.js';
import {BattleSide} from './GuildWarPage.jsx';
const button='site-button rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm disabled:opacity-50';

function HistoryRecords({criteria,currentUser,heroes}){
  const [rows,setRows]=useState([]),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[speeds,setSpeeds]=useState({});
  const anonymous=currentUser.role==='member';
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError('');
    historyPage(criteria,currentUser,{offset,attack:heroes,signal:controller.signal}).then(data=>{
      if(controller.signal.aborted)return;
      setRows(previous=>offset?[...previous,...data.records.filter(r=>!previous.some(p=>p.id===r.id))]:data.records);setMore(data.hasMore);
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message||'기록을 불러오지 못했습니다.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[offset,criteria,currentUser.id,currentUser.role,heroes]);
  useEffect(()=>{let active=true;loadBattleHeroSpeeds(rows,currentUser).then(data=>{if(active)setSpeeds(data);}).catch(()=>{});return()=>{active=false;};},[rows,currentUser.id,currentUser.isOwner]);
  return <div className="mt-3 space-y-3">
    {rows.map(row=>{const p=row.payload,attackGuild=p.direction==='attack'?row.guild_name:p.opponentGuild,defendGuild=p.direction==='attack'?p.opponentGuild:row.guild_name;const result=typeof p.attackerWon==='boolean'?(p.attackerWon?'win':'loss'):null;
      return <div key={row.id} className="history-battle-record min-w-0 space-y-3 rounded-xl border border-zinc-200 p-3">
        <p className="break-words text-sm font-semibold leading-6">{new Date(row.war_date+'T12:00:00+09:00').toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Seoul'})} 길드전{!anonymous&&<> · {attackGuild||'길드 미확인'} · {p.attacker?.nickname||'닉네임 미확인'}</>}</p>
        <p className="text-xs text-zinc-500">전투 시각: {new Date(row.occurred_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · 공격자 {result==='win'?'승리':result==='loss'?'패배':'결과 미확인'}</p>
        <div className="history-battle-sides grid min-w-0 grid-cols-1 gap-3">{['attacker','defender'].map(side=><BattleSide key={side} hideIdentity={anonymous} hideSpeed={anonymous||!canViewHeroStats(currentUser)} hideReplay={!canViewHeroStats(currentUser)} title={(side==='attacker'?'공격':'방어')+(anonymous?'':` · ${(side==='attacker'?attackGuild:defendGuild)||'길드 미확인'}`)} showHeroSpeeds={!anonymous&&canViewHeroStats(currentUser)} heroStats={speeds[row.id]?.stats?.[side]} heroHealth={speeds[row.id]?.health?.[side]} heroSpeeds={speeds[row.id]?.[side]} side={{...p[side],skills:speeds[row.id]?.replay?.[side+'Skills']||[]}} speed={speeds[row.id]?.replay?.firstSkillSide?speeds[row.id]?.replay?.firstSkillSide===side:undefined} result={result}/>)}</div>
      </div>;
    })}
    {error&&<p role="alert" className="text-red-600">{error}</p>}
    {loading&&<p role="status">전투 기록 불러오는 중…</p>}
    {!loading&&more&&<button className={button} onClick={()=>setOffset(rows.length)}>기록 20건 더 보기</button>}
  </div>;
}
function CounterGroup({group,criteria,currentUser,showRate}){
  const [open,setOpen]=useState(false);
  return <article className="history-counter-group min-w-0 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
    <h2 className="break-words text-base font-bold leading-6">{group.heroes.join(' · ')} <span className="text-blue-600">{group.count}회 공격</span></h2>
    <p className="text-sm">{showRate&&<b>승률 {group.rate===null?'미확인':`${(Number(group.rate)*100).toFixed(1)}%`} · </b>}승리 {group.wins}회 · 패배 {group.losses}회</p>
    <button type="button" aria-haspopup="dialog" className="site-button site-button-primary w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold" onClick={()=>setOpen(true)}>전투 기록 상세보기 · {group.count}건</button>
    {open&&<DetailDialog title={group.heroes.join(' · ')+' · 길드전 공격 이력'} onClose={()=>setOpen(false)}>
      <p className="mb-4 text-sm text-zinc-500">{group.count}회 공격 · {group.wins}승 {group.losses}패{group.rate!==null&&` · 승률 ${(Number(group.rate)*100).toFixed(1)}%`}</p>
      <HistoryRecords criteria={criteria} currentUser={currentUser} heroes={group.heroes}/>
    </DetailDialog>}
  </article>;
}
export default function HistoryCounterSearch({currentUser,defenseHeroes}){
  const embedded=Array.isArray(defenseHeroes),anonymous=currentUser.role==='member';
  const [input,setInput]=useState(''),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
  const [state,setState]=useState({key:'',groups:[],totalGroups:0,totalRecords:0,hasMore:false}),[loading,setLoading]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(input.trim());setOffset(0);},300);return()=>clearTimeout(timer);},[input]);
  const criteriaKey=JSON.stringify(historyCriteria(query,defenseHeroes));
  const key=JSON.stringify([criteriaKey,currentUser.id,currentUser.role,currentUser.isOwner,revision]);
  useEffect(()=>{
    if(!embedded&&!query){setLoading(false);return;}
    const controller=new AbortController();setLoading(true);setError('');
    historyPage(JSON.parse(criteriaKey),currentUser,{offset,signal:controller.signal,fresh:revision>0}).then(data=>{
      if(controller.signal.aborted)return;
      setState(previous=>({...data,key,groups:offset&&previous.key===key?[...previous.groups,...data.groups.filter(g=>!previous.groups.some(p=>JSON.stringify(p.heroes)===JSON.stringify(g.heroes)))]:data.groups}));
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message||'검색 결과를 불러오지 못했습니다.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[criteriaKey,key,offset,embedded,query,revision]);
  const visible=state.key===key?state:null;
  const criteria=React.useMemo(()=>JSON.parse(criteriaKey),[criteriaKey]);
  return <section className={embedded?'min-w-0 space-y-3':'site-page mx-auto max-w-7xl space-y-5 p-4 sm:p-8'}>
    {!embedded&&<><header className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">공격팀 (길드전 이력으로 검색)</h1><button type="button" className={button} disabled={loading} onClick={()=>{setOffset(0);setRevision(v=>v+1);}}>새로고침</button></header>
      <div className="rounded-2xl border border-zinc-200 bg-white p-4"><label htmlFor="history-counter-query" className="font-semibold">상대 방어 영웅 검색</label><input id="history-counter-query" value={input} onChange={e=>setInput(e.target.value)} placeholder="예: 아일린 젠이츠 델론즈 또는 ㅇㅇㄹ, ㅈㅇㅊ, ㄷㄹㅈ" className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3"/><p className="mt-2 text-sm text-zinc-500">영웅명·초성을 띄어쓰기나 쉼표로 구분하세요. 순서와 관계없이 입력한 영웅을 모두 포함한 방어팀을 검색합니다.</p><p className="mt-1 text-sm text-zinc-500">{anonymous?'전체 길드 익명 공격 이력':'우리·상대 길드의 실제 공격 이력'} · 공격 영웅 조합 사용 횟수순 · 펫과 스킬은 상세보기에서 확인하세요.</p></div></>}
    {embedded&&<p className="text-xs text-zinc-500">같은 방어 영웅 3명 기준 · 승률순 (동률이면 공격 횟수순) · 결과 미확인은 승률에서 제외</p>}
    {error&&<p role="alert" className="text-red-600">{error}</p>}
    {!embedded&&!query?<p>방어 영웅을 입력해 주세요.</p>:<>
      {visible&&<><p role="status">공격 덱 {visible.totalGroups}개 · 공격 이력 {visible.totalRecords}건</p>{!visible.groups.length&&<p>조건에 맞는 길드전 이력이 없습니다.</p>}{visible.groups.map(group=><CounterGroup key={key+JSON.stringify(group.heroes)} group={group} criteria={criteria} currentUser={currentUser} showRate={embedded}/>)}</>}
      {loading&&<p role="status">검색 결과 불러오는 중…</p>}
      {visible?.hasMore&&!loading&&<button className={button} onClick={()=>setOffset(visible.groups.length)}>공격 덱 20개 더 보기</button>}
    </>}
  </section>;
}
