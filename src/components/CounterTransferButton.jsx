import React, { useRef, useState } from 'react';
const targets = {
 seori: {name:'서리사이트',url:'https://mdzgblgujeztjgssodla.supabase.co',key:'sb_publishable_UoJzZgbSWKUA03Vd_Q8FLg_RKH16VoW'},
 destiny: {name:'15월사이트',url:'https://kqygrszkbuzxmmfndhye.supabase.co',key:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxeWdyc3prYnV6eG1tZm5kaHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MjI2OTUsImV4cCI6MjA5NzQ5ODY5NX0.SDIjG-rrBt4apIxTYT-qg9vyJuVgzN9uxiwpQ_QkOLs'},
};
export default function CounterTransferButton({ supabase, target, teamId, deck }) {
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [failed,setFailed]=useState(false); const lock=useRef(false);
 async function send() {
  if(lock.current) return;
  lock.current=true;setBusy(true);setMessage('');setFailed(false);
  try {
   const {data,error}=await supabase.auth.getSession();
   if(error||!data.session?.access_token) throw new Error('로그인 후 다시 시도해 주세요.');
   const response=await fetch(targets[target].url+'/functions/v1/receive-counter',{
    method:'POST',headers:{'Content-Type':'application/json',apikey:targets[target].key,Authorization:'Bearer '+data.session.access_token},
    body:JSON.stringify({team_id:teamId,deck}),signal:AbortSignal.timeout(40000)});
   const result=await response.json();
   if(!response.ok) throw new Error(result.error||'전송에 실패했습니다.');
   setMessage(result.duplicate?'이미 보낸 카운터입니다. 중복 추가하지 않았어요.':'보냈습니다.');
  } catch(error) {setFailed(true);setMessage(error.name==='TimeoutError'?'응답이 지연됐어요. 다시 눌러도 중복 등록되지 않습니다.':error.message||'전송에 실패했습니다.');}
  finally {lock.current=false;setBusy(false);}
 }
 return <div className="mt-3 min-w-0">
  <button type="button" disabled={busy} onClick={send} className="site-button max-w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-50">
   {busy?'보내는 중…':targets[target].name+'로 보내기'}
  </button>
  {message&&<p role={failed?'alert':'status'} className={'mt-2 text-xs '+(failed?'text-red-600':'text-zinc-600')}>{message}</p>}
 </div>;
}
