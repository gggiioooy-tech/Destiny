import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { battleStatLabels } from '../lib/memberBattleStats.js';

export function useMemberBattleStats() {
  const [stats, setStats] = useState(null), [resetAt, setResetAt] = useState(null), [error, setError] = useState(''), [resetting, setResetting] = useState(false);
  const request = useRef(0), controller = useRef(null), mounted = useRef(false), resetLock = useRef(false);
  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    controller.current?.abort();
    const next = new AbortController(); controller.current = next;
    const version = ++request.current;
    try {
      const { data, error } = await supabase.rpc('member_guild_battle_statistics').abortSignal(next.signal);
      if (next.signal.aborted || version !== request.current || !mounted.current) return;
      if (error) throw error;
      setStats(Object.fromEntries((data?.members || []).map(row => [row.auth_user_id, row])));
      setResetAt(data?.resetAt || null); setError('');
    } catch {
      if (!next.signal.aborted && version === request.current && mounted.current) setError('길드전 통계를 불러오지 못했습니다.');
    }
  }, []);
  useEffect(() => {
    mounted.current = true; refresh();
    const timer = setInterval(() => { if (!resetLock.current) refresh(); }, 60000);
    return () => { mounted.current = false; ++request.current; controller.current?.abort(); clearInterval(timer); };
  }, [refresh]);
  const reset = useCallback(async () => {
    if (resetLock.current) return false;
    resetLock.current = true; setResetting(true); setError('');
    ++request.current; controller.current?.abort();
    try {
      const { data, error } = await supabase.rpc('reset_member_guild_battle_statistics');
      if (error) throw error;
      if (mounted.current) { setStats({}); setResetAt(data?.resetAt || null); await refresh(); }
      return true;
    } catch (error) {
      if (mounted.current) setError(error.message || '통계를 초기화하지 못했습니다.');
      return false;
    } finally {
      resetLock.current = false;
      if (mounted.current) setResetting(false);
    }
  }, [refresh]);
  return { stats, resetAt, error, resetting, refresh, reset };
}

export function MemberBattleStats({ stats }) {
  if (!stats) return <span className="text-xs text-zinc-400">—</span>;
  const labels = battleStatLabels(stats);
  return <div className="flex w-full min-w-0 flex-wrap gap-x-4 gap-y-2 text-xs">
    <div className="min-w-0"><div className="text-zinc-500">공격 횟수</div><div className="mt-1 font-semibold text-zinc-950">{labels.attackCount}</div><div className="mt-1 text-zinc-500">{labels.attackResults}</div></div>
    <div className="min-w-0"><div className="text-zinc-500">공격 승률</div><div className="mt-1 font-semibold text-zinc-950">{labels.attackRate}</div></div>
    <div className="min-w-0"><div className="text-zinc-500">방어 승률</div><div className="mt-1 font-semibold text-zinc-950">{labels.defenseRate}</div><div className="mt-1 text-zinc-500">{labels.defenseResults}</div></div>
    {labels.unknown && <p className="w-full text-[10px] text-zinc-500">{labels.unknown}</p>}
  </div>;
}

export function ResetMemberBattleStats({ onReset, busy }) {
  const [armed, setArmed] = useState(false), [message, setMessage] = useState('');
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);
  const click = async () => {
    if (busy) return;
    setMessage('');
    if (!armed) { setArmed(true); return; }
    setArmed(false);
    if (await onReset()) setMessage('전체 회원의 길드전 통계를 초기화했습니다.');
  };
  return <div className="text-xs">
    <button type="button" disabled={busy} onClick={click} className="site-button rounded-lg bg-red-50 px-3 py-2 font-semibold text-red-700 disabled:opacity-50">
      {busy ? '초기화 중…' : armed ? '한 번 더 누르면 전체 초기화' : '전체 회원 길드전 통계 초기화'}
    </button>
    {armed && <p role="status" className="mt-2 text-red-600">5초 안에 다시 누르면 공격·방어 통계 집계를 새로 시작합니다.</p>}
    {message && <p role="status" className="mt-2 text-zinc-600">{message}</p>}
  </div>;
}
