import React,{useEffect,useRef,useState} from 'react';
import {canViewHeroStats} from '../lib/heroBattleStats.js';
import {loadReplayExamples,loadReplayReport,validateReplayReport} from '../lib/replaySimulation.js';
import {replayDocument} from '../lib/replayTimelineTemplate.js';
import ExperimentalBattle from './ExperimentalBattle.jsx';

export default function ReplaySimulationPage({currentUser}){
  const permitted=canViewHeroStats(currentUser);
  const identity=currentUser?.authUserId||currentUser?.id||'';
  const sourceGeneration=useRef(0);
  const [items,setItems]=useState([]),[selected,setSelected]=useState(''),[report,setReport]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!permitted)return;
    const controller=new AbortController();let active=true;const generation=++sourceGeneration.current;
    setItems([]);setSelected('');setReport(null);setError('');setLoading(true);
    loadReplayExamples(currentUser,controller.signal).then(rows=>{if(active){setItems(rows);if(generation===sourceGeneration.current)setSelected(rows[0]?.id||'');}}).catch(e=>{if(active&&generation===sourceGeneration.current)setError(e.message);}).finally(()=>{if(active&&generation===sourceGeneration.current)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[identity,permitted]);
  useEffect(()=>{
    if(!permitted||!selected)return;
    const controller=new AbortController();let active=true;const generation=++sourceGeneration.current;setReport(null);setError('');setLoading(true);
    loadReplayReport(selected,currentUser,controller.signal).then(data=>{if(active&&generation===sourceGeneration.current)setReport({identity,data});}).catch(e=>{if(active&&generation===sourceGeneration.current)setError(e.message);}).finally(()=>{if(active&&generation===sourceGeneration.current)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[identity,permitted,selected]);
  if(!permitted)return null;
  const visible=report?.identity===identity?report.data:null;
  async function openLocal(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    const generation=++sourceGeneration.current;
    try{if(file.size>2097152)throw new Error('2MB 이하의 분석 JSON 파일만 열 수 있습니다.');const data=validateReplayReport(JSON.parse(await file.text()));if(generation!==sourceGeneration.current)return;setSelected('');setReport({identity,data,revision:crypto.randomUUID()});setError('');setLoading(false);}catch(e){if(generation===sourceGeneration.current){setError(e.message||'파일을 읽지 못했습니다.');setLoading(false);}}
  }
  return <section className="min-w-0 space-y-4 p-4 sm:p-6">
    <header><p className="text-xs font-semibold text-zinc-500">권한등급 4등급 전용</p><h1 className="mt-1 text-2xl font-bold">길드전 시뮬레이션</h1><p className="mt-2 text-sm text-zinc-600">편성하고, 계산하고, 장면별로 비교해 보세요.</p></header>
    <details open={!visible} className="rounded-xl border border-zinc-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">{visible?'실전 기록 불러옴 · 다른 기록 선택':'실전 기록에서 조합·스탯 불러오기'}</summary><div className="mt-3 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-xs font-semibold">사이트에 저장된 전투<select className="mt-2 block w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm font-normal" value={selected} onChange={e=>{sourceGeneration.current++;setSelected(e.target.value);setReport(null);setLoading(Boolean(e.target.value));}}><option value="">직접 편성하기</option>{items.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold">분석 JSON 열기<input aria-label="분석 JSON 파일 선택" className="sr-only" type="file" accept=".json,application/json" onChange={openLocal}/></label>
    </div><p className="mt-3 text-[11px] leading-relaxed text-zinc-500">이미 저장한 분석 자료를 불러옵니다. 게임·리플레이 서버에 추가 요청하지 않으며, 선택한 파일을 자동 업로드하지 않습니다.</p></details>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading&&<p role="status" className="text-sm">전투 분석 불러오는 중…</p>}
    {!loading&&<ExperimentalBattle key={identity+':'+(report?.revision||visible?.replaySha256||selected||'default')} currentUser={currentUser} report={visible}/>}
    {visible&&<details className="rounded-2xl border p-4"><summary className="cursor-pointer font-semibold">비교용 · 실제 전투 기록 재생</summary><iframe key={visible.replaySha256||selected||'local'} title="길드전 실제 전투 기록" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={replayDocument(visible)} className="mt-3 h-[1500px] w-full min-w-0 rounded-2xl border border-zinc-200 bg-white"/></details>}
  </section>;
}
