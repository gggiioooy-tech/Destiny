import React, { useEffect, useRef, useState } from 'react';
const LOCAL_ORIGIN='http://127.0.0.1:15150';
// This first connection stage relays status only. Unverified game observations
// must never be submitted as completed guild-war records.
export default function PcCollectorConnection() {
  const connection=useRef(null);
  const [state,setState]=useState(null);
  const [error,setError]=useState('');
  const [waiting,setWaiting]=useState(false);
  useEffect(()=>{
    function receive(event){
      const c=connection.current;
      if(!c||event.origin!==LOCAL_ORIGIN||event.source!==c.popup||event.data?.nonce!==c.nonce||event.data.type!=='15month-collector-status')return;
      const d=event.data.data;
      if(!d||!['attack','defense','held'].every(k=>Number.isSafeInteger(d[k])&&d[k]>=0&&d[k]<=100000))return;
      c.lastSeen=Date.now();setWaiting(false);setError('');
      setState({attack:d.attack,defense:d.defense,held:d.held,reason:typeof d.reason==='string'?d.reason.slice(0,200):'',updatedAt:typeof d.updatedAt==='string'?d.updatedAt:null});
      c.popup.postMessage({type:'15month-collector-ack',nonce:c.nonce},LOCAL_ORIGIN);
    }
    window.addEventListener('message',receive);
    const timer=setInterval(()=>{
      const c=connection.current;if(!c)return;
      if(c.popup.closed||Date.now()-c.lastSeen>15000){setState(null);setWaiting(false);setError('PC 수집기를 실행하고 다시 연결해 주세요.');connection.current=null;}
    },2000);
    return()=>{window.removeEventListener('message',receive);clearInterval(timer);connection.current=null;};
  },[]);
  function connect(){
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
    const popup=window.open(`${LOCAL_ORIGIN}/connect#${new URLSearchParams({nonce,origin:location.origin})}`,'15month-pc-collector','width=640,height=720');
    if(!popup){setError('팝업을 허용한 뒤 다시 연결해 주세요.');return;}
    connection.current={popup,nonce,lastSeen:Date.now()};setError('');setWaiting(true);setState(null);
  }
  return <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">PC 수집기 <span className="text-sm font-normal text-zinc-500">연결 시험</span></h2><button type="button" className="site-button rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm" onClick={connect}>{state?'PC 수집기 다시 연결':'PC 수집기 연결'}</button></div>
    <p className="mt-2 text-sm text-zinc-500">PC 수집기를 실행한 뒤 연결하세요. 연결 창과 이 사이트를 열어 두세요.</p>
    {waiting&&<p role="status" className="mt-2 text-sm">PC 연결 확인 중…</p>}
    {error&&<p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    {state&&<div role="status" className="mt-3 space-y-1 text-sm"><p className="font-semibold">PC 연결됨 · 공격 {state.attack}건 · 방어 {state.defense}건 수신</p><p>사이트 등록 0건 · 확인 대기 {state.held}건</p><p>{state.reason}</p>{state.updatedAt&&<p className="text-zinc-500">마지막 수신: {new Date(state.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p>}</div>}
  </div>;
}
