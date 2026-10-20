import { matchesMemberSearch } from "../lib/memberSearch.js";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import {
  XCircle,
  Shield,
  Swords,
  ScrollText,
  Users,
  BarChart3,
  Lock,
  LogOut,
  Menu,
  ChevronRight,
  X,
  UserPlus,
  CheckCircle2,
  Ban,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  Save,
  Settings,
  Snowflake,
} from "lucide-react";
import { cx, splitList, counterRingSlots, parseCounterDecks, parseAttackGuideItems, stringifyAttackGuideItems, stringifyCounterDecks, normalizeMultilineText, renderRichText, mapProfile, statusLabel, formatUpdatedAt, formatLastSeen, isVisibleItem, isGuest, GuestLockedContent, roleLabel, isSuperAdminId, isHiddenUserId, upsertSetting, PageShell, PageHeader, Button, DeleteButton, Input, TextArea, Select, splitFormation, normalizedFormation, FormationField, InfoChip, Modal, StatusBadge, RoleBadge, EmptyState, PlaceholderPage, emptyDefense, emptyTotalWar, emptyArena, emptyAttackTeam, emptyEnemyDefense, emptyCounterDeck, emptyNotice } from "./siteUi.jsx";
import CounterTransferButton from "./CounterTransferButton.jsx";
import { CounterOrderFields, CounterOrderDisplay } from "./CounterOrderFields.jsx";
import { parseCounterOrder, describeCounterOrder } from "../lib/counterOrders.js";
import { matchesHeroSearch, matchesEnemyTeamSearch, searchTokens } from "../lib/heroSearch.js";
import { sortByRecommendation } from "../lib/recommendationSort.js";

function MemberManagementPage({ users, setUsers, currentUser, setCurrentUser, reloadData }) {
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [openLevels, setOpenLevels] = useState({});
  const canEditMemo = currentUser.isOwner === true;
  const [weeklyCounts, setWeeklyCounts] = useState(null);
  const [statsError, setStatsError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data, error } = await supabase.rpc('weekly_counter_counts');
      if (!active) return;
      if (error) { setStatsError('작성 횟수를 불러오지 못했습니다.'); setWeeklyCounts(null); return; }
      setStatsError('');
      setWeeklyCounts(Object.fromEntries((data || []).map(row => [row.auth_user_id, Number(row.counter_count)])));
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  const searchTerms = searchTokens(memberSearch);
  const matchesMember = user => matchesMemberSearch(user, memberSearch);
  const pending = users.filter((u) => u.status === "pending" && !isHiddenUserId(u.id) && matchesMember(u));
  const members = users.filter((u) => u.status !== "pending" && !isHiddenUserId(u.id));

  const getUserGuilds = (user) =>
    String(user.memo || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

  const memoCounts = members.reduce((acc, user) => {
    getUserGuilds(user).forEach((guild) => {
      acc[guild] = (acc[guild] || 0) + 1;
    });
    return acc;
  }, {});

  const memoCountList = Object.entries(memoCounts).sort((a, b) => b[1] - a[1]);
  const selectedGuildMembers = selectedGuild
    ? members.filter((user) => getUserGuilds(user).includes(selectedGuild))
    : [];

  const updateUser = async (user, patch) => {
    if (!user) return;
    if (patch.role === 'super_admin') {
      if (!canEditMemo) return alert('권한등급 4등급만 임명할 수 있습니다.');
      const { error } = await supabase.rpc('appoint_highest_administrator', { p_user_id: user.id });
      if (error) return alert(`권한등급 4등급 임명 실패: ${error.message}`);
      await reloadData();
      return;
    }
    if (user.isOwner && patch.role && patch.role !== 'super_admin') {
      if (!currentUser.isOwner || !isSuperAdminId(currentUser.id) || isSuperAdminId(user.id)) return alert('원래 사이트 소유자만 다른 4등급 회원을 강등할 수 있습니다.');
      const { error } = await supabase.rpc('demote_highest_administrator', { p_user_id: user.id, p_role: patch.role });
      if (error) return alert(`권한등급 4등급 강등 실패: ${error.message}`);
      await reloadData();
      return;
    }
    if (!canEditMemo && Object.prototype.hasOwnProperty.call(patch, 'memo')) return alert('관리자 메모는 사이트 소유자만 수정할 수 있습니다.');
    if (!canEditMemo && user.role === 'admin' && ((patch.role && patch.role !== user.role) || (patch.status && patch.status !== user.status))) return alert('관리자 권한은 사이트 소유자만 변경할 수 있습니다.');

    const isOwner = isSuperAdminId(user.id);

    if (isOwner && (patch.status === "blocked" || patch.status === "rejected")) {
      return alert("최고 관리자 계정은 차단하거나 거절할 수 없습니다.");
    }

    const dbPatch = {};
    if (patch.status) dbPatch.status = patch.status;
    if (patch.role) dbPatch.role = patch.role;
    if (Object.prototype.hasOwnProperty.call(patch, "animeThemeAllowed")) dbPatch.anime_theme_allowed = patch.animeThemeAllowed === true;
    if (Object.prototype.hasOwnProperty.call(patch, "memo")) dbPatch.memo = patch.memo;

    if (isOwner && patch.status === "approved") {
      dbPatch.role = "admin";
    }

    const { error } = await supabase.from("profiles").update(dbPatch).eq("user_id", user.id);
    if (error) return alert(`회원 정보 수정 실패: ${error.message}`);

    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, ...patch, ...(isOwner && patch.status === "approved" ? { role: "admin" } : {}) } : u
      )
    );

    if (currentUser?.id === user.id) {
      setCurrentUser((prev) => ({
        ...prev,
        ...patch,
        ...(isOwner && patch.status === "approved" ? { role: "admin" } : {}),
      }));
    }

    await reloadData();
  };

  const deleteUser = async (user) => {
    if (!user) return;
    if (!canEditMemo && user.role === 'admin') return alert('관리자는 사이트 소유자만 삭제할 수 있습니다.');
    if (isSuperAdminId(user.id)) return alert("최고 관리자 계정은 삭제할 수 없습니다.");

    setUsers((prev) => prev.filter((u) => u.id !== user.id));

    const { error } = user.dbId
      ? await supabase.from("profiles").delete().eq("id", user.dbId)
      : await supabase.from("profiles").delete().eq("user_id", user.id);

    if (error) {
      alert(`회원 삭제 실패: ${error.message}`);
      await reloadData();
      return;
    }

    await reloadData();
  };

  return (
    <PageShell>
      <PageHeader eyebrow="Admin" title="회원 관리" desc="게임 닉네임을 확인한 뒤 승인하세요." />
      <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-3">
        <Input label="회원 검색" value={memberSearch} onChange={setMemberSearch} placeholder="닉네임 · 아이디 · 길드 (초성 검색 가능)" />
        {memberSearch && <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500"><span>검색 결과 {users.filter(u => !isHiddenUserId(u.id) && matchesMember(u)).length}명</span><button type="button" onClick={() => setMemberSearch('')}>검색 지우기</button></div>}
      </div>
      <p className="mb-4 text-xs text-zinc-500">이번주 카운터 작성 횟수: 한국시간 월요일 00:00부터 새로 등록한 덱 수입니다. 기능 적용 이후부터 집계하며, 수정·재저장은 제외합니다.</p>
      {statsError && <p role="alert" className="mb-4 text-sm text-red-600">{statsError}</p>}

      <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-950">그룹별 인원</h2>
          <span className="text-xs font-semibold text-zinc-400">관리자 메모 기준</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {memoCountList.length === 0 ? (
            <span className="text-sm text-zinc-400">입력된 메모가 없습니다.</span>
          ) : (
            memoCountList.map(([memo, count]) => (
              <button
                key={memo}
                onClick={() => setSelectedGuild((prev) => (prev === memo ? null : memo))}
                className={cx(
                  "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                  selectedGuild === memo ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                )}
              >
                {memo} {count}명
              </button>
            ))
          )}
        </div>

        {selectedGuild && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-950">{selectedGuild} 회원 목록</div>
              <button
                onClick={() => setSelectedGuild(null)}
                className="text-xs font-semibold text-zinc-400 hover:text-zinc-700"
              >
                닫기
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedGuildMembers.map((user) => (
                <span key={user.id} className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200">
                  {user.gameNickname}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-950">가입 승인 대기</h2>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-700">{pending.length}건</span>
        </div>
        <MemberTable currentUser={currentUser} weeklyCounts={weeklyCounts} list={pending} pending updateUser={updateUser} deleteUser={deleteUser} />
      </section>

      <div className="mt-3 space-y-2">
        {[1, 2, 3, 4].map(level => {
          const levelMembers = members.filter(user => (user.isOwner ? 4 : { guest: 1, member: 2, admin: 3 }[user.role]) === level);
          const visibleMembers = levelMembers.filter(matchesMember);
          const open = searchTerms.length > 0 ? visibleMembers.length > 0 && openLevels[`search:${memberSearch}:${level}`] !== false : Boolean(openLevels[level]);
          return <section key={level} className="rounded-xl border border-zinc-200 bg-white p-3">
            <button type="button" aria-expanded={open} aria-controls={`member-level-${level}`} onClick={() => setOpenLevels(prev => ({ ...prev, [searchTerms.length ? `search:${memberSearch}:${level}` : level]: !open }))} className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-2 text-left text-sm font-semibold text-zinc-950">
              <span>권한등급 {level}등급 <span className="ml-2 text-xs text-zinc-500">{searchTerms.length ? `${visibleMembers.length} / ${levelMembers.length}` : levelMembers.length}명</span></span>
              <span aria-hidden="true" className="text-zinc-500">{open ? '▴' : '▾'}</span>
            </button>
            <div id={`member-level-${level}`} hidden={!open}>
              {open && <MemberTable currentUser={currentUser} weeklyCounts={weeklyCounts} list={visibleMembers} updateUser={updateUser} deleteUser={deleteUser} />}
            </div>
          </section>;
        })}
      </div>
    </PageShell>
  );
}

function MemberTable({ list, pending, updateUser, deleteUser, currentUser, weeklyCounts }) {
  return (
    <div className="member-table-region member-table-compact mt-2">
      <table className="member-table w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs font-semibold uppercase text-zinc-400">
            <th className="px-2 py-2">게임 닉네임</th>
            <th className="px-2 py-2">아이디</th>
            <th className="px-2 py-2">상태</th>
            <th className="px-2 py-2">등급</th>
            <th className="px-2 py-2">마지막 접속</th>
            <th className="px-2 py-2">이번주 카운터 작성 횟수</th>
            <th className="px-2 py-2">관리자 메모</th>
            <th className="px-2 py-2 text-right">관리</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-zinc-400">
                표시할 회원이 없습니다.
              </td>
            </tr>
          ) : (
            list.map((u) => (
              <MemberRow currentUser={currentUser} weeklyCount={weeklyCounts === null ? null : (weeklyCounts[u.authUserId] || 0)} key={u.id} user={u} pending={pending} updateUser={updateUser} deleteUser={deleteUser} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function MemberRow({ user: u, pending, updateUser, deleteUser, currentUser, weeklyCount }) {
  const canEditMemo = currentUser.isOwner === true;
  const protectedAdmin = (u.isOwner && !isSuperAdminId(currentUser.id)) || isSuperAdminId(u.id) || (!canEditMemo && u.role === "admin");
  const [themeSaving, setThemeSaving] = useState(false);
  const [memo, setMemo] = useState(u.memo || "");
  useEffect(() => setMemo(u.memo || ""), [u.memo]);

  const saveMemo = () => {
    updateUser(u, { memo });
  };
  const toggleAnimeAccess = async () => {
    setThemeSaving(true);
    try { await updateUser(u, { animeThemeAllowed: !u.animeThemeAllowed }); }
    finally { setThemeSaving(false); }
  };

  return (
    <tr className="border-b border-zinc-100 align-top">
      <td data-label="게임 닉네임" className="px-2 py-2 font-semibold text-zinc-950">{u.gameNickname}</td>
      <td data-label="아이디" className="px-2 py-2 text-zinc-600">{u.id}</td>
      <td data-label="상태" className="px-2 py-2"><StatusBadge status={u.status} /></td>
      <td data-label="등급" className="px-2 py-2"><RoleBadge role={u.role} isOwner={u.isOwner} /></td>
      <td data-label="마지막 접속" className="px-2 py-2 text-xs text-zinc-500">{formatLastSeen(u.lastSeenAt)}</td>
      <td data-label="이번주 카운터 작성 횟수" className="px-2 py-2 font-semibold text-zinc-950">{weeklyCount === null ? "—" : `${weeklyCount}회`}</td>
      <td data-label="관리자 메모" className="px-2 py-2">
        <div className="member-memo flex min-w-0 gap-2">
          <input
            readOnly={!canEditMemo}
            aria-label="관리자 메모"
            title={canEditMemo ? "관리자 메모" : "사이트 소유자만 수정할 수 있습니다"}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onKeyDown={(e) => canEditMemo && e.key === "Enter" && saveMemo()}
            placeholder="예: 15월 , Guest"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-950 outline-none focus:ring-4 focus:ring-zinc-200/70"
          />
          {canEditMemo && <Button onClick={saveMemo} variant="secondary" className="shrink-0 px-3 py-2 text-xs">저장</Button>}
        </div>
      </td>
      <td data-label="관리" className="px-2 py-2">
        <div className="flex flex-wrap justify-end gap-2">
          {pending ? (
            <>
              <Button onClick={() => updateUser(u, { status: "approved", role: isSuperAdminId(u.id) ? "admin" : "member" })}>
                <CheckCircle2 size={15} /> 승인
              </Button>
              <Button onClick={() => updateUser(u, { status: "rejected" })} variant="subtle">
                <Ban size={15} /> 거절
              </Button>
            </>
          ) : (
            <>
              <select
                disabled={protectedAdmin}
                value={u.isOwner ? 'super_admin' : u.role}
                onChange={(e) => updateUser(u, { role: e.target.value, status: "approved" })}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 outline-none focus:ring-4 focus:ring-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="guest">권한등급 1등급</option>
                <option value="member">권한등급 2등급</option>
                <option value="admin">권한등급 3등급</option>
                {(u.isOwner || (canEditMemo && u.status === 'approved')) && <option value="super_admin">권한등급 4등급</option>}
              </select>
              <Button variant="secondary" disabled={themeSaving} aria-pressed={u.animeThemeAllowed} onClick={toggleAnimeAccess}>
                {themeSaving ? '저장 중…' : u.animeThemeAllowed ? '씹덕모드 해제' : '씹덕모드 허용'}
              </Button>
              {!protectedAdmin && !u.isOwner && <DeleteButton onConfirm={() => deleteUser(u)}>삭제</DeleteButton>}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}


export default MemberManagementPage;
