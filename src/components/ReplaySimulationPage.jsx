import React,{useEffect,useState} from 'react';
import {canViewHeroStats} from '../lib/heroBattleStats.js';
import {loadReplayExamples,loadReplayReport,validateReplayReport} from '../lib/replaySimulation.js';
import {replayDocument} from '../lib/replayTimelineTemplate.js';

export default function ReplaySimulationPage({currentUser}){
  const permitted=canViewHeroStats(currentUser);
  const identity=currentUser?.authUserId||currentUser?.id||'';
  const [items,setItems]=useState([]),[selected,setSelected]=useState(''),[report,setReport]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!permitted)return;
    const controller=new AbortController();let active=true;
    setItems([]);setSelected('');setReport(null);setError('');setLoading(true);
    loadReplayExamples(currentUser,controller.signal).then(rows=>{if(active){setItems(rows);setSelected(rows[0]?.id||'');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[identity,permitted]);
  useEffect(()=>{
    if(!permitted||!selected)return;
    const controller=new AbortController();let active=true;setReport(null);setError('');setLoading(true);
    loadReplayReport(selected,currentUser,controller.signal).then(data=>{if(active)setReport({identity,data});}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[identity,permitted,selected]);
  if(!permitted)return null;
  const visible=report?.identity===identity?report.data:null;
  async function openLocal(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{if(file.size>2097152)throw new Error('2MB 이하의 분석 JSON 파일만 열 수 있습니다.');const data=validateReplayReport(JSON.parse(await file.text()));setSelected('');setReport({identity,data});setError('');setLoading(false);}catch(e){setError(e.message||'파일을 읽지 못했습니다.');}
  }
  return <section className="min-w-0 space-y-4 p-4 sm:p-6">
    <header><p className="text-xs font-semibold text-zinc-500">권한등급 4등급 전용</p><h1 className="mt-1 text-2xl font-bold">시뮬레이션</h1><p className="mt-2 text-sm text-zinc-600">실제 전투 기록을 재생하는 테스트 버전입니다. 스탯·장비를 변경한 가상 승패 예측은 준비 중입니다.</p></header>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <label className="min-w-0 flex-1 text-sm font-semibold">저장된 테스트 전투<select className="mt-2 block w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm font-normal" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">전투 선택</option>{items.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="cursor-pointer rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold">분석 JSON 열기<input aria-label="분석 JSON 파일 선택" className="sr-only" type="file" accept=".json,application/json" onChange={openLocal}/></label>
    </div>
    <p className="text-xs text-zinc-500">파일은 이 화면에서만 열며 자동 업로드하지 않습니다. 저장된 전투 재생 시 게임·리플레이 서버에 추가 요청하지 않습니다.</p>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loading&&<p role="status" className="text-sm">전투 분석 불러오는 중…</p>}
    {visible&&<iframe key={visible.replaySha256||selected||'local'} title="길드전 전투 타임라인 시뮬레이션" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={replayDocument(visible)} className="h-[1250px] w-full min-w-0 rounded-2xl border border-zinc-200 bg-white"/>}
    {!loading&&!visible&&!error&&<p className="text-sm text-zinc-500">저장된 테스트 전투를 선택하거나 분석 JSON 파일을 열어 주세요.</p>}
  </section>;
}
