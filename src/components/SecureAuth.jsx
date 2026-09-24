import React, { useState } from 'react';
import { supabase, requestAuth, rememberId, readRememberedId } from '../lib/supabase.js';

const inputClass = 'mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-white/50';
function Field({ label, ...props }) {
  return <label className="block text-sm text-zinc-300">{label}<input required className={inputClass} {...props} /></label>;
}

export function SecureAuth({ settings }) {
  const [mode, setMode] = useState('login');
  const [userId, setUserId] = useState(readRememberedId);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [remember, setRemember] = useState(() => Boolean(readRememberedId()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    if (mode === 'signup' && password !== confirm) { setError('비밀번호 확인이 일치하지 않습니다.'); return; }
    setBusy(true);
    try {
      const result = await requestAuth({ action: mode, userId: userId.trim(), password, gameNickname: nickname.trim() });
      if (mode === 'signup') {
        setMode('login'); setPassword(''); setConfirm('');
        setMessage('가입 신청이 완료되었습니다. 관리자 승인 후 이용할 수 있습니다.');
      } else {
        rememberId(remember ? userId.trim() : '');
        const { error: sessionError } = await supabase.auth.setSession({ access_token: result.accessToken, refresh_token: result.refreshToken });
        if (sessionError) throw sessionError;
        setPassword('');
      }
    } catch (err) { setError(err.message || '인증 요청을 처리하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#0d0f12] px-5 py-10 text-white">
    <div className="mx-auto grid min-h-[85vh] max-w-6xl items-center gap-12 lg:grid-cols-[1fr_420px]">
      <section>
        <p className="text-sm font-semibold text-zinc-400">{settings.guild_name || '15월'}</p>
        <h1 className="mt-6 break-keep text-4xl font-semibold leading-tight tracking-tight md:text-6xl">{settings.site_title}</h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400">{settings.main_subtitle}</p>
      </section>
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div className="mb-7 grid grid-cols-2 gap-2 rounded-xl bg-black/30 p-1">
          {[['login','로그인'],['signup','회원가입']].map(([id,label]) => <button key={id} disabled={busy} type="button"
            onClick={() => { setMode(id); setError(''); setMessage(''); setPassword(''); setConfirm(''); }}
            className={`rounded-lg py-3 text-sm font-semibold ${mode === id ? 'bg-white text-zinc-950' : 'text-zinc-400'}`}>{label}</button>)}
        </div>
        <form className="space-y-5" onSubmit={submit}>
          {mode === 'signup' && <Field label="게임 닉네임" value={nickname} onChange={e=>setNickname(e.target.value)} maxLength={40} autoComplete="nickname" />}
          <Field label="아이디" name="username" value={userId} onChange={e=>setUserId(e.target.value)} minLength={4} maxLength={40} autoComplete="username" autoCapitalize="none" spellCheck={false} />
          <div>
            <Field label="비밀번호" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)}
              minLength={mode === 'signup' ? 8 : 4} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            <button type="button" onClick={()=>setShowPassword(v=>!v)} className="mt-2 text-xs text-zinc-400">{showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}</button>
          </div>
          {mode === 'signup' && <Field label="비밀번호 확인" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" />}
          {mode === 'login' && <label className="flex items-center gap-2 text-sm text-zinc-400"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />아이디 기억하기</label>}
          {mode === 'signup' && <p className="text-xs text-zinc-400">비밀번호는 8글자 이상으로 입력해 주세요.</p>}
          <button disabled={busy} className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-zinc-950 disabled:opacity-50">{busy ? '처리 중…' : mode === 'login' ? '로그인' : '가입 신청'}</button>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
        </form>
        <p className="mt-8 text-center text-xs text-zinc-500">{settings.footer_text}</p>
      </section>
    </div>
  </main>;
}

export function PasswordChange({ required = false, onDone, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (newPassword !== confirmation) { setError('새 비밀번호 확인이 일치하지 않습니다.'); return; }
    setBusy(true); setError('');
    try {
      await requestAuth({ action: 'change-password', currentPassword, newPassword });
      await supabase.auth.signOut({ scope: 'local' });
      alert('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.');
      onDone?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="grid min-h-screen place-items-center bg-[#0d0f12] p-5 text-white">
    <section className="w-full max-w-md rounded-3xl border border-white/10 p-7">
      <h1 className="text-2xl font-semibold">비밀번호 변경</h1>
      <p className="mb-6 mt-3 text-sm leading-6 text-zinc-400">{required ? '계정 보호를 위해 비밀번호를 한 번 변경해 주세요. 변경 후 사이트를 이용할 수 있습니다.' : '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.'}</p>
      <form onSubmit={submit} className="space-y-5">
        <Field label="현재 비밀번호" type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} />
        <Field label="새 비밀번호" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={newPassword} onChange={e=>setNewPassword(e.target.value)} />
        <Field label="새 비밀번호 확인" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmation} onChange={e=>setConfirmation(e.target.value)} />
        <button disabled={busy} className="w-full rounded-xl bg-white py-3 font-semibold text-zinc-950 disabled:opacity-50">{busy ? '변경 중…' : '비밀번호 변경'}</button>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </form>
      <button onClick={onLogout} className="mt-5 text-sm text-zinc-400">로그아웃</button>
    </section>
  </div>;
}
