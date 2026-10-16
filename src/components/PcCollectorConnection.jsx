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
  useEffect(()=>{
    let active=true;
    async function upload(c,rows){
      if(c.uploading||c.failed||Date.now()<(c.retryAt||0))return;
      const guilds=memoGuilds(currentUser?.memo);
      if(guilds.length!==1){setError('회원 메모의 길드가 하나로 지정되어야 저장할 수 있습니다.');return;}
      c.uploading=true;
      try{
        for(const row of rows){
          if(!active||connection.current!==c||c.popup.closed)break;
          if(c.done.has(row?.sourceKey))continue;
          const args=collectorRecord(row,guilds[0]);
          const {data,error}=await supabase.rpc('submit_guild_war_observation',args);
          if(error)throw error;
          if(!data||!['recorded','duplicate','held'].includes(data.status))throw new Error('서버 저장 응답을 확인하지 못했습니다.');
          if(data.status==='held')throw new Error('길드 탭이 등록되지 않아 서버에서 보류됐습니다.');
          c.done.add(row.sourceKey);
          if(active&&connection.current===c){setSaved(c.done.size);setError('');}
        }
      }catch(e){if(active&&connection.current===c){setError(e.message||'저장 실패. 연결 상태를 확인한 뒤 다시 시도합니다.');c.retryAt=Date.now()+15000;}}
      finally{c.uploading=false;}
    }
    function receive(event){
      const c=connection.current;
      if(!c||event.origin!==LOCAL_ORIGIN||event.source!==c.popup||event.data?.nonce!==c.nonce||event.data.type!=='15month-collector-status')return;
      const d=event.data.data;
      if(!d||!['attack','defense','held'].every(k=>Number.isSafeInteger(d[k])&&d[k]>=0&&d[k]<=100000))return;
      c.lastSeen=Date.now();setWaiting(false);
      setState({attack:d.attack,defense:d.defense,held:d.held,reason:typeof d.reason==='string'?d.reason.slice(0,200):'',updatedAt:typeof d.updatedAt==='string'?d.updatedAt:null});
      c.popup.postMessage({type:'15month-collector-ack',nonce:c.nonce,saved:c.done.size},LOCAL_ORIGIN);
      if(Array.isArray(d.records)&&d.records.length<=1000)void upload(c,d.records);
    }
    window.addEventListener('message',receive);
    const timer=setInterval(()=>{
      const c=connection.current;if(!c)return;
      if(c.popup.closed||Date.now()-c.lastSeen>15000){setState(null);setWaiting(false);setError('PC 수집기를 실행하고 다시 연결해 주세요.');connection.current=null;}
    },2000);
    return()=>{active=false;window.removeEventListener('message',receive);clearInterval(timer);connection.current=null;};
  },[currentUser?.id,currentUser?.memo]);
  function connect(){
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
    const popup=window.open(`${LOCAL_ORIGIN}/connect#${new URLSearchParams({nonce,origin:location.origin})}`,'15month-pc-collector','width=640,height=720');
    if(!popup){setError('팝업을 허용한 뒤 다시 연결해 주세요.');return;}
    connection.current={popup,nonce,lastSeen:Date.now(),done:new Set()};setError('');setWaiting(true);setState(null);setSaved(0);
  }
  return <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">PC 수집기 <span className="text-sm font-normal text-zinc-500">연결 시험</span></h2><button type="button" className="site-button rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm" onClick={connect}>{state?'PC 수집기 다시 연결':'PC 수집기 연결'}</button></div>
    <p className="mt-2 text-sm text-zinc-500">PC 수집기를 실행한 뒤 연결하세요. 연결 창과 이 사이트를 열어 두세요.</p>
    {waiting&&<p role="status" className="mt-2 text-sm">PC 연결 확인 중…</p>}
    {error&&<p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    {state&&<div role="status" className="mt-3 space-y-1 text-sm"><p className="font-semibold">PC 연결됨 · 공격 {state.attack}건 · 방어 {state.defense}건 수신</p><p>저장 확인 {saved}건 (기존 기록 포함) · 확인 대기 {state.held}건</p><p>{state.reason}</p>{state.updatedAt&&<p className="text-zinc-500">마지막 수신: {new Date(state.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p>}</div>}
  </div>;
}
