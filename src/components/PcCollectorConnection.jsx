import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { memoGuilds } from '../lib/guildWar.js';
import { collectorRecord } from '../lib/collectorRecords.js';
const LOCAL_ORIGIN='http://127.0.0.1:15150';
export default function PcCollectorConnection({ currentUser }) {
  const connection=useRef(null);
  const [state,setState]=useState(null);
  const [error,setError]=useState('');
  const [waiting,setWaiting]=useState(false);
  const [saved,setSaved]=useState(0);
  const [lastSavedAt,setLastSavedAt]=useState(null);
  const [duplicates,setDuplicates]=useState(0);
  const [uploading,setUploading]=useState(false);
  useEffect(()=>{
    let active=true;
    async function upload(c,rows){
      if(c.uploading||c.failed||Date.now()<(c.retryAt||0))return;
      const guilds=memoGuilds(currentUser?.memo);
      if(guilds.length!==1){setError('회원 메모의 길드가 하나로 지정되어야 저장할 수 있습니다.');return;}
      c.uploading=true;setUploading(true);
      try{
        for(const row of rows){
          if(!active||connection.current!==c||c.popup.closed)break;
          const revision=JSON.stringify([row?.payload?.attacker?.skills,row?.payload?.defender?.skills,row?.payload?.firstSkillSide,row?.payload?.heroSpeeds]);
          if(c.done.get(row?.sourceKey)===revision)continue;
          const args=collectorRecord(row,guilds[0]);
          const {data,error}=await supabase.rpc('submit_guild_war_observation',args);
          if(error)throw error;
          if(!data||!['recorded','duplicate','held'].includes(data.status))throw new Error('서버 저장 응답을 확인하지 못했습니다.');
          if(data.status==='held')throw new Error('길드 탭이 등록되지 않아 서버에서 보류됐습니다.');
          c.done.set(row.sourceKey,revision);
          if(active&&connection.current===c){setSaved(c.done.size);setLastSavedAt(new Date().toISOString());if(data.status==='duplicate')setDuplicates(n=>n+1);setError('');}
        }
      }catch(e){if(active&&connection.current===c){setError(e.message||'저장 실패. 연결 상태를 확인한 뒤 다시 시도합니다.');c.retryAt=Date.now()+15000;}}
      finally{c.uploading=false;if(active&&connection.current===c)setUploading(false);}
    }
    function receive(event){
      const c=connection.current;
      if(!c||event.origin!==LOCAL_ORIGIN||event.source!==c.popup||event.data?.nonce!==c.nonce||event.data.type!=='15month-collector-status')return;
      const d=event.data.data;
      if(!d||!['attack','defense','held'].every(k=>Number.isSafeInteger(d[k])&&d[k]>=0&&d[k]<=100000))return;
      c.lastSeen=Date.now();setWaiting(false);
      if(!c.setupRequested){c.setupRequested=true;supabase.rpc('collector_setup_profile').then(({data,error})=>{if(!active||connection.current!==c)return;if(error){setError(error.message);c.setupRequested=false;return;}c.popup.postMessage({type:'15month-collector-setup',nonce:c.nonce,profile:data},LOCAL_ORIGIN);});}
      if(!d.needsSetup&&d.supportsPeriods&&!c.syncing&&Date.now()>(c.nextSync||0)){
        c.syncing=true;c.nextSync=Date.now()+30000;
        supabase.rpc('collector_sync_periods',{p_periods:Array.isArray(d.periods)?d.periods.slice(0,60):[]}).then(({data,error})=>{
          if(!active||connection.current!==c)return;if(error){setError(error.message);return;}
          c.popup.postMessage({type:'15month-collector-periods',nonce:c.nonce,periods:data},LOCAL_ORIGIN);
        }).finally(()=>{c.syncing=false;});
      }
      if(!d.needsSetup&&!d.supportsPeriods)setError('지난 길드전 자동 분류를 위해 최신 연결 프로그램을 다시 설치해 주세요.');
      if(!d.needsSetup&&!c.started){c.started=true;c.popup.postMessage({type:'15month-collector-start',nonce:c.nonce},LOCAL_ORIGIN);}
      setState({captureActive:d.captureActive===true,needsSetup:d.needsSetup===true,lastReceivedAt:typeof d.lastReceivedAt==='string'?d.lastReceivedAt:null,attack:d.attack,defense:d.defense,held:d.held,reason:[typeof d.periodSyncStatus==='string'?d.periodSyncStatus:'',typeof d.captureStatus==='string'?d.captureStatus:'',typeof d.reason==='string'?d.reason.slice(0,200):'',...Object.entries(d.heldReasons||{}).slice(0,8).map(([reason,count])=>`${reason}: ${count}건`)].filter(Boolean).join(' · '),updatedAt:typeof d.updatedAt==='string'?d.updatedAt:null});
      c.popup.postMessage({type:'15month-collector-ack',nonce:c.nonce,saved:c.done.size},LOCAL_ORIGIN);
      if(Array.isArray(d.records)&&d.records.length<=1000)void upload(c,d.records);
    }
    window.addEventListener('message',receive);
    const timer=setInterval(()=>{
      const c=connection.current;if(!c)return;
      if(c.popup.closed||Date.now()-c.lastSeen>45000){setState(null);setWaiting(false);setError('연결되지 않았습니다. 처음 쓰는 PC라면 아래 설치 안내를 확인하세요. 설치했다면 프로그램 열기를 허용하고 다시 연결하세요.');connection.current=null;}
    },2000);
    return()=>{active=false;window.removeEventListener('message',receive);clearInterval(timer);connection.current=null;};
  },[currentUser?.id,currentUser?.memo]);
  function connect(launch=true){
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
    const url=launch?`/pc-connect.html#${new URLSearchParams({nonce})}`:`${LOCAL_ORIGIN}/connect#${new URLSearchParams({nonce,origin:location.origin})}`;
    const popup=window.open(url,'15month-pc-collector','width=640,height=720');
    if(!popup){setError('팝업을 허용한 뒤 다시 연결해 주세요.');return;}
    connection.current={popup,nonce,lastSeen:Date.now(),done:new Map()};setError('');setWaiting(true);setState(null);setSaved(0);setLastSavedAt(null);setDuplicates(0);setUploading(false);
    if(launch)window.location.href='month15-collector://start';
  }
  return <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">PC 수집기 <span className="text-sm font-normal text-zinc-500">수동 실행</span></h2><button type="button" className="site-button rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm" onClick={()=>connect()}>{state?'PC 수집기 다시 연결':'PC 수집기 연결'}</button></div>
    <p className="mt-2 text-sm text-zinc-500">PC 시작 시 자동 실행하지 않습니다. 설치한 PC에서는 버튼으로 프로그램을 실행합니다. 브라우저에서 물으면 ‘열기’를 선택하고 연결 창과 사이트를 열어 두세요.</p>
    <details className="mt-3 text-sm"><summary className="cursor-pointer">처음 쓰는 PC / 연결이 안 될 때</summary><div className="mt-2 space-y-2"><p>Windows 10·11에서 아래 파일을 내려받고 압축을 푼 뒤 이거누르면설치됨.cmd를 실행하세요. PC마다 최초 1회 설치합니다.</p><a className="inline-block underline" href="/downloads/15month-pc-connect.zip?v=20261020-1" download>Windows 연결 프로그램 설치</a><p>설치 후 게임을 켜고 사이트에서 연결하면 이 PC의 수집 설정을 자동으로 준비합니다. 게임 버전이 지원되지 않으면 오류를 표시합니다.</p><button type="button" className="underline" onClick={()=>connect(false)}>프로그램이 이미 켜져 있어요 — 바로 연결</button></div></details>
    {state&&<button type="button" className="site-button mt-3 rounded-xl border px-4 py-2" onClick={()=>{const c=connection.current;if(c)c.popup.postMessage({type:'15month-collector-start',nonce:c.nonce},LOCAL_ORIGIN);}}>수집 시작</button>}
    {waiting&&<p role="status" className="mt-2 text-sm">PC 연결 확인 중…</p>}
    {error&&<p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    {state&&<div role="status" className="mt-3 space-y-1 text-sm"><p className="font-semibold">PC 연결됨 · 공격 {state.attack}건 · 방어 {state.defense}건 수신</p><p className="font-medium">{uploading?'사이트 저장 중':state.needsSetup?'게임 수집 설정 대기':state.held?'매칭 확인 대기':state.captureActive?'수집 중 · 게임에서 기록 화면을 열어 주세요':'수집 대기 · 수집 시작을 눌러 주세요'}</p><p>사이트 저장 확인 {saved}건 · 기존 중복 {duplicates}건 · 매칭 확인 대기 {state.held}건</p><p className="text-zinc-500">마지막 게임 데이터 수신: {state.lastReceivedAt?new Date(state.lastReceivedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'아직 수신 없음'}</p><p className="text-zinc-500">마지막 사이트 저장 확인: {lastSavedAt?new Date(lastSavedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'아직 저장 확인 없음'}</p><p>{state.reason}</p>{state.updatedAt&&<p className="text-zinc-500">마지막 기록 갱신: {new Date(state.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p>}</div>}
  </div>;
}
