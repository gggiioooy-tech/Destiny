import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { battleStatLabels } from '../lib/memberBattleStats.js';
export default function AccountBattleSummary({ currentUser }) {
  const [stats, setStats] = useState(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true, controller, lastStarted = 0;
    setStats(null); setFailed(false);
    const refresh = async (force = false) => {
      if (!currentUser.authUserId || (!force && Date.now() - lastStarted < 15000)) return;
      lastStarted = Date.now(); controller?.abort();
      const next = new AbortController(); controller = next;
      try {
        const { data, error } = await supabase.rpc('my_guild_battle_statistics').abortSignal(next.signal);
        if (!active || next.signal.aborted) return;
        if (error) throw error;
        setStats(data?.stats || {}); setFailed(false);
      } catch { if (active && !next.signal.aborted) setFailed(true); }
    };
    const focus = () => refresh(), reset = () => refresh(true);
    refresh(true);
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', focus);
    window.addEventListener('member-battle-stats-reset', reset);
    return () => { active = false; controller?.abort(); clearInterval(timer); window.removeEventListener('focus', focus); window.removeEventListener('member-battle-stats-reset', reset); };
  }, [currentUser.authUserId, currentUser.gameNickname, currentUser.memo]);
  if (failed) return <p role="status" className="text-[10px] text-zinc-500">통계 확인 실패</p>;
  if (!stats) return <p role="status" className="text-[10px] text-zinc-500">통계 불러오는 중…</p>;
  const labels = battleStatLabels(stats);
  return <div aria-label="내 길드전 통계" title={labels.unknown || '수집된 길드전 기록 기준'} className="min-w-0 space-y-1 break-words text-[10px] leading-4 text-zinc-600">
    <p>공격 횟수 <strong className="text-zinc-950">{labels.attackCount}</strong></p>
    <p>공격 {labels.attackResults} <strong className="text-zinc-950">{labels.attackRate}</strong></p>
    <p>방어 {Number(stats.defense_wins) || 0}승 {Number(stats.defense_losses) || 0}패 <strong className="text-zinc-950">{labels.defenseRate}</strong></p>
  </div>;
}
