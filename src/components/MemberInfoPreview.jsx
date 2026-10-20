import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { roleLabel, statusLabel, formatLastSeen } from './siteUi.jsx';
import { MemberBattleStats } from './MemberBattleStats.jsx';
export default function MemberInfoPreview({ user, weeklyCount, battleStat }) {
  const [open, setOpen] = useState(false), [position, setPosition] = useState(null);
  const trigger = useRef(null), popup = useRef(null), id = useId();
  useLayoutEffect(() => {
    if (!open || !trigger.current || !popup.current) return;
    const target = trigger.current.getBoundingClientRect(), card = popup.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(target.left, window.innerWidth - card.width - 8));
    const top = target.bottom + card.height + 16 <= window.innerHeight ? target.bottom + 8 : Math.max(8, target.top - card.height - 8);
    setPosition({ left, top });
  }, [open, weeklyCount, battleStat]);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = event => { if (!trigger.current?.contains(event.target)) close(); };
    const escape = event => { if (event.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true); window.addEventListener('resize', close);
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const show = () => { if (!open) { setPosition(null); setOpen(true); } };
  return <span className="inline-flex">
    <button ref={trigger} type="button" aria-describedby={open ? id : undefined}
      onPointerEnter={event => { if (event.pointerType === 'mouse') show(); }} onPointerLeave={event => { if (event.pointerType === 'mouse') setOpen(false); }}
      onFocus={show} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
      className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      {user.gameNickname}
    </button>
    {open && <div ref={popup} id={id} role="tooltip" style={{ ...position, visibility: position ? 'visible' : 'hidden', width: 'min(320px, calc(100vw - 16px))' }}
      className="member-info-preview pointer-events-none fixed z-[70] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 text-left text-xs text-zinc-700 shadow-xl">
      <p className="break-words text-sm font-semibold text-zinc-950">{user.gameNickname}</p>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
        <dt className="text-zinc-500">아이디</dt><dd className="break-all">{user.id}</dd>
        <dt className="text-zinc-500">권한</dt><dd>{roleLabel(user.role, user.isOwner)}</dd>
        <dt className="text-zinc-500">상태</dt><dd>{statusLabel(user.status)}</dd>
        <dt className="text-zinc-500">마지막 접속</dt><dd>{formatLastSeen(user.lastSeenAt)}</dd>
        <dt className="text-zinc-500">관리자 메모</dt><dd className="break-words whitespace-pre-wrap">{user.memo || '없음'}</dd>
        <dt className="text-zinc-500">이번주 카운터</dt><dd>{weeklyCount == null ? '—' : `${weeklyCount}회`}</dd>
      </dl>
      <div className="mt-3 border-t border-zinc-200 pt-3"><MemberBattleStats stats={battleStat} /></div>
    </div>}
  </span>;
}
