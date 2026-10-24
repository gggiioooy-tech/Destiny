import React,{useState} from 'react';
import DetailDialog from './DetailDialog.jsx';
import {supabase} from '../lib/supabase.js';
import {clearHistorySearchCache} from '../lib/historySearchCache.js';

export default function NicknameChangeButton({user,admin=false,className=''}){
 const [open,setOpen]=useState(false);
 return <><button type="button" className={`site-button rounded-xl border border-zinc-200 px-3 py-2 text-xs ${className}`} onClick={()=>setOpen(true)}>닉네임 변경</button>
 {open&&<NicknameChange user={user} admin={admin} onClose={()=>setOpen(false)}/>}</>;
}
export function NicknameChange({user,admin=false,onClose}){
 const [nickname,setNickname]=useState(user.gameNickname||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event){
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   const {error}=await supabase.rpc('change_member_nickname',{p_nickname:nickname.trim(),...(admin?{p_user_id:user.id}:{})});
   if(error)throw error;
   clearHistorySearchCache();onClose();
   window.dispatchEvent(new Event('member-nickname-changed'));
  }catch(e){setError(e.message||'닉네임을 변경하지 못했습니다.');}finally{setBusy(false);}
 }
 return <DetailDialog title={admin?`${user.gameNickname} · 닉네임 변경`:'내 닉네임 변경'} onClose={()=>{if(!busy)onClose();}}>
  <form onSubmit={submit} className="space-y-4">
   <p className="text-sm text-zinc-500">게임에서 변경한 닉네임을 입력해 주세요. 등록된 길드의 과거 길드전 기록과 공격·방어 통계도 새 닉네임으로 연결됩니다.</p>
   <label className="block text-sm font-semibold">새 게임 닉네임<input required maxLength={40} autoComplete="nickname" value={nickname} onChange={e=>setNickname(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3"/></label>
   {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
   <button type="submit" disabled={busy||!nickname.trim()||nickname.trim()===user.gameNickname} className="site-button site-button-primary rounded-xl px-4 py-2 disabled:opacity-50">{busy?'변경 중…':'닉네임 저장'}</button>
  </form>
 </DetailDialog>;
}
