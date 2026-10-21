import AccountBattleSummary from "./components/AccountBattleSummary.jsx";
import { useTabNavigation } from "./lib/useTabNavigation.js";
import { pageTables, pageQuery } from "./lib/pageData.js";
import { guildTabId, memoGuilds } from "./lib/guildWar.js";
import AccountWatermark from "./components/AccountWatermark.jsx";
import CounterTransferButton from "./components/CounterTransferButton.jsx";
import { ThemeToggle, AnimeThemeMenu, TransparencyControl, useAnimeThemeAccess } from "./components/ThemeProvider.jsx";
import { CounterOrderFields, CounterOrderDisplay } from "./components/CounterOrderFields.jsx";
import { parseCounterOrder, describeCounterOrder } from "./lib/counterOrders.js";
import { matchesHeroSearch, matchesEnemyTeamSearch, searchTokens } from "./lib/heroSearch.js";
import { sortByRecommendation } from "./lib/recommendationSort.js";
import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { supabase } from "./lib/supabase.js";
import { SecureAuth, PasswordChange } from "./components/SecureAuth.jsx";
import {
  Download,
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

import { cx, splitList, counterRingSlots, parseCounterDecks, parseAttackGuideItems, stringifyAttackGuideItems, stringifyCounterDecks, normalizeMultilineText, renderRichText, mapProfile, statusLabel, formatUpdatedAt, formatLastSeen, isVisibleItem, isGuest, GuestLockedContent, roleLabel, isSuperAdminId, isHiddenUserId, upsertSetting, PageShell, PageHeader, Button, DeleteButton, Input, TextArea, Select, splitFormation, normalizedFormation, FormationField, InfoChip, Modal, StatusBadge, RoleBadge, EmptyState, PlaceholderPage, emptyDefense, emptyTotalWar, emptyArena, emptyAttackTeam, emptyEnemyDefense, emptyCounterDeck, emptyNotice } from "./components/siteUi.jsx";
const GuildBoardPage = lazy(() => import("./components/GuildBoardPage.jsx"));
const AttackPage = lazy(() => import("./components/AttackPage.jsx"));
const TotalWarPage = lazy(() => import("./components/TotalWarPage.jsx"));
const DeletedCounterManagement = lazy(() => import("./components/DeletedCounterManagement.jsx"));
const MemberManagementPage = lazy(() => import("./components/MemberManagementPage.jsx"));
const GuildWarPage = lazy(() => import("./components/GuildWarPage.jsx"));
const ReplaySimulationPage = lazy(() => import("./components/ReplaySimulationPage.jsx"));
const AddGuildWarTab = lazy(() => import("./components/GuildWarPage.jsx").then(module => ({ default: module.AddGuildWarTab })));
const HistoryCounterSearch = lazy(() => import("./components/HistoryCounterSearch.jsx"));

const SUPER_ADMIN_IDS = ["15month"];
const HIDDEN_USER_IDS = [];

const FALLBACK_SETTINGS = {
  guild_name: "15월",
  site_title: "세븐나이츠 리버스 15월 공략 사이트",
  main_subtitle: "방어팀 배치와 방어팀별 공격법을 정리한  전용 공략 센터입니다.",
  hero_notice: "승인된 회원만 열람할 수 있습니다.",
  footer_text: "made by 15월",
  quick_notice: "",
  attack_guide_title: "공격잘가는법 내용",
  attack_guide_text: "",
  attack_guide_items: "",
  dashboard_banner_title: "전투 준비 현황",
  dashboard_banner_body: "방어팀을 확인하고, 상대 조합에 맞는 공격법을 선택하세요.",
};

const navItems = [
  { id: "board", label: "자유게시판", icon: ScrollText, visibleTo: ["member", "admin"] },
  { id: "attack", label: "공격팀", icon: Swords, visibleTo: ["member", "admin"] },
  { id: "historyCounter", label: "공격팀 (길드전 이력으로 검색)", icon: Swords, visibleTo: ["member", "admin"] },
  { id: "total", label: "총력전", icon: ScrollText, visibleTo: ["member", "admin"] },
  { id: "simulation", label: "시뮬레이션", icon: Swords, visibleTo: ["admin"], ownerOnly: true },
  { id: "temporaryAttack", label: "휴지통", icon: Trash2, visibleTo: ["admin"] },
  { id: "members", label: "회원 관리", icon: Users, visibleTo: ["admin"] },
  { id: "deleted", label: "삭제정보관리", icon: Trash2, visibleTo: ["admin"], ownerOnly: true },
];

function guildNavigation(tabs, currentUser) {
  const result = currentUser?.role === 'guest' ? [] : [...navItems];
  result.splice(result.findIndex(item => item.id === "historyCounter") + 1, 0,
    ...tabs.filter(tab => currentUser?.role === 'admin' || memoGuilds(currentUser.memo).includes(tab.name)).map(tab => ({ id: guildTabId(tab.name), label: tab.name + " 길드전", icon: Shield, visibleTo: ["guest", "member", "admin"] })),
    { id: "guildWarAdd", label: "길드 추가하기", icon: Plus, visibleTo: ["admin"], ownerOnly: true });
  return result;
}

function PendingScreen({ user, logout, settings }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0d0f12] p-5 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-7 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-white text-zinc-950"><Lock size={22} /></div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">승인 대기 중</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400"><b className="text-white">{user.gameNickname}</b> 닉네임으로 가입 신청이 접수되었습니다. 관리자 승인 후 이용할 수 있습니다.</p>
        <p className="mt-3 text-xs text-zinc-600">{renderRichText(settings.hero_notice, "")}</p>
        <Button onClick={logout} variant="secondary" className="mt-7">로그아웃</Button>
      </div>
    </div>
  );
}

function Sidebar({ active, setActive, isOpen, setIsOpen, currentUser, logout, settings, guildTabs = [] }) {
  const availableNav = guildNavigation(guildTabs, currentUser).filter((item) => item.visibleTo.includes(currentUser.role) && (!item.ownerOnly || currentUser.isOwner));
  return (
    <aside className={cx("fixed inset-y-0 left-0 z-40 w-64 border-r border-zinc-200 bg-white transition-transform duration-300 lg:translate-x-0", isOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-200 p-5 lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-950 text-white">
              <Snowflake size={26} strokeWidth={2.4} className="snow-sway-icon" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-950">{renderRichText(settings.guild_name, "")}</div>
              
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 lg:hidden"><X size={18} /></button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {availableNav.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button key={item.id} onClick={() => { setActive(item.id); setIsOpen(false); }} className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", selected ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950")}>
                <Icon size={17} className="shrink-0" />{item.id === "historyCounter" ? <span className="min-w-0 text-left"><span className="block">공격팀</span><span className="block text-xs">(길드전 이력으로 검색)</span></span> : item.label}
              </button>
            );
          })}
          <a href="/downloads/15month.apk" download="15월.apk" className="mt-auto flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"><Download size={17} className="shrink-0" />Android APK 설치</a>
        </nav>
        <div className="border-t border-zinc-200 p-4">
          <div className="rounded-xl bg-zinc-50 p-3">
            <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-2">
              <div className="min-w-0 break-words">
                <div className="text-sm font-semibold text-zinc-950">{currentUser.gameNickname}</div>
                <div className="mt-1 text-[10px] text-zinc-500">{roleLabel(currentUser.role, currentUser.isOwner)}</div>
              </div>
              <AccountBattleSummary key={currentUser.authUserId} currentUser={currentUser} />
            </div>
            {currentUser.role === "admin" && <WeeklyCounterSummary currentUser={currentUser} />}
          </div>
          <Button onClick={logout} variant="secondary" className="mt-3 w-full"><LogOut size={16} /> 로그아웃</Button>
          <TransparencyControl className="mt-3" />
          <ThemeToggle className="mt-3 w-full" />
          <AnimeThemeMenu className="mt-2 w-full" />
        </div>
      </div>
    </aside>
  );
}

function MobileHeader({ setIsOpen, currentUser, settings }) {
  const header = useRef(null);
  useEffect(() => {
    const update = () => document.documentElement.style.setProperty('--mobile-header-height', `${header.current?.getBoundingClientRect().height || 0}px`);
    const observer = new ResizeObserver(update); observer.observe(header.current); update();
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--mobile-header-height'); };
  }, []);
  return (
    <header ref={header} className="sticky top-0 z-30 flex flex-wrap gap-2 items-center justify-between border-b border-zinc-200 bg-white/90 px-3 py-3 backdrop-blur sm:px-4 lg:hidden">
      <div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-950 text-white">
              <Snowflake size={24} strokeWidth={2.4} className="snow-sway-icon" />
            </div><div><div className="text-sm font-semibold">{renderRichText(settings.guild_name, "")}</div><div className="text-[11px] text-zinc-500">{currentUser.gameNickname}</div></div></div>
      <div className="ml-auto flex shrink-0 items-center gap-2"><ThemeToggle compact /><AnimeThemeMenu compact /><button aria-label="메뉴 열기" onClick={() => setIsOpen(true)} className="rounded-lg border border-zinc-200 bg-white p-2"><Menu size={20} /></button></div>
    </header>
  );
}

function Dashboard({ setActive, currentUser, users, settings, setSettings }) {
  const guestMode = isGuest(currentUser);
  const pendingCount = users.filter((u) => u.status === "pending").length;
 const approvedCount = Math.max(
  users.filter((u) => u.status === "approved").length - 1,
  0
);
  const [quickNotice, setQuickNotice] = useState(settings.quick_notice || "");
  useEffect(() => setQuickNotice(settings.quick_notice || ""), [settings.quick_notice]);

  const saveQuickNotice = async () => {
    const { error } = await upsertSetting("quick_notice", quickNotice);
    if (error) return alert(`중요 공지 저장 실패: ${error.message}`);
    setSettings((prev) => ({ ...prev, quick_notice: quickNotice }));
  };

  return (
    <div>
      <section className="border-b border-zinc-200 bg-white px-4 py-8 sm:px-5 sm:py-10 md:px-8 md:py-14">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <div className="max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{renderRichText(settings.footer_text, "")}</p>
          <h1 className="mt-4 max-w-5xl break-keep text-3xl font-semibold leading-tight tracking-[-0.04em] text-zinc-950 sm:text-4xl md:text-6xl">{renderRichText(settings.site_title, "")}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-500">어서오세요, <b className="font-semibold text-zinc-950">{currentUser.gameNickname}</b>님. 전투 방어팀 배치와 공격 족보를 확인하는 전투 공략 사이트 입니다.</p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            <Button onClick={() => setActive("attackTips")}>공격잘가는법 <ChevronRight size={16} /></Button>
            <Button onClick={() => setActive("defense")}>방어팀 보기 <ChevronRight size={16} /></Button>
            <Button onClick={() => setActive("attack")}>공격팀 보기 <ChevronRight size={16} /></Button>
            <Button onClick={() => setActive("notices")}>공지 보기 <ChevronRight size={16} /></Button>
            {currentUser.role === "admin" && <Button onClick={() => setActive("members")} variant="secondary">가입 승인 {pendingCount}건</Button>}
          </div>
          <div className="mt-3 w-fit rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-500 shadow-sm">
            문의사항은 인게임 채팅 또는 카카오톡으로 15월한테 전달해주세요.
          </div>
          </div>

          {!guestMode && (isSuperAdminId(currentUser.id) || settings.quick_notice) && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
              <div className="text-xs font-semibold text-zinc-400">중요 공지</div>
              {isSuperAdminId(currentUser.id) ? (
                <div className="mt-3 space-y-3">
                  <textarea
                    value={quickNotice}
                    onChange={(e) => setQuickNotice(e.target.value)}
                    placeholder="중요 공지를 입력하세요. 비워두면 일반 회원에게 보이지 않습니다."
                    rows={5}
                    className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm leading-6 text-zinc-950 outline-none placeholder:text-zinc-400 focus:ring-4 focus:ring-zinc-200/70"
                  />
                  <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm leading-6 text-zinc-700">
                    <div className="mb-1 text-[11px] font-semibold text-zinc-400">미리보기</div>
                    <div className="whitespace-pre-wrap">{renderRichText(quickNotice, "미리보기 내용이 없습니다.")}</div>
                  </div>
                  <Button onClick={saveQuickNotice} variant="secondary" className="w-full">저장</Button>
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700">{renderRichText(settings.quick_notice, "")}</p>
              )}
            </div>
          )}
        </div>
      </section>
      <PageShell>
        <div className="grid gap-4 md:grid-cols-3">
          {guestMode ? (
            <SummaryCard title="접속 권한" value="권한등급 1등급" desc="공략 내용 열람 제한" icon={Lock} />
          ) : (
            <SummaryCard title="승인 회원" value={`${approvedCount}명`} desc="현재 사이트 이용 가능" icon={Users} />
          )}
          {currentUser.role === "admin" && (
            <>
              <SummaryCard title="가입 대기" value={`${pendingCount}명`} desc="관리자 확인 필요" icon={Lock} />
              <SummaryCard title="접속 권한" value={roleLabel(currentUser.role, currentUser.isOwner)} desc="현재 로그인 권한" icon={Shield} />
            </>
          )}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FeatureCard title="공격잘가는법" desc="전투 공격 전 기본 운영법과 주의사항을 확인하세요." icon={ScrollText} onClick={() => setActive("attackTips")} />
          <FeatureCard title="방어팀" desc="공덱/방덱/마덱 추천 방어팀 구성을 확인하세요." icon={Shield} onClick={() => setActive("defense")} />
          <FeatureCard title="공격팀" desc="상대 유형별 족보와 주의사항을 확인하세요." icon={Swords} onClick={() => setActive("attack")} />
          <FeatureCard title="공지" desc="전투 관련 공지와 변경사항을 확인하세요." icon={ScrollText} onClick={() => setActive("notices")} />
        </div>
        
      </PageShell>
    </div>
  );
}

function SummaryCard({ title, value, desc, icon: Icon }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5"><Icon size={20} className="text-zinc-500" /><div className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">{value}</div><div className="mt-1 text-sm font-semibold text-zinc-800">{title}</div><div className="mt-1 text-sm text-zinc-500">{desc}</div></div>;
}

function FeatureCard({ title, desc, icon: Icon, onClick }) {
  return <button onClick={onClick} className="group rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm sm:p-6"><div className="flex items-start justify-between"><Icon size={22} className="text-zinc-500" /><ChevronRight size={18} className="text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-700" /></div><h3 className="mt-5 text-lg font-semibold text-zinc-950">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{desc}</p></button>;
}

function AttackTipsPage({ currentUser, settings, setSettings }) {
  if (isGuest(currentUser)) {
    return (
      <PageShell>
        <PageHeader eyebrow="Attack Guide" title="공격잘가는법" desc="전투 공격 전에 확인할 기본 운영법과 주의사항을 정리하는 페이지입니다." />
        <GuestLockedContent />
      </PageShell>
    );
  }

  const [items, setItems] = useState(() => parseAttackGuideItems(settings));
  const [saving, setSaving] = useState(false);

  useEffect(() => setItems(parseAttackGuideItems(settings)), [settings.attack_guide_items, settings.attack_guide_title, settings.attack_guide_text]);

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { title: `공격잘가는법 ${prev.length + 1}`, body: "" }]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    const cleanItems = items.map((item) => ({ title: item.title || "공격잘가는법", body: item.body || "" }));
    const itemsRes = await upsertSetting("attack_guide_items", stringifyAttackGuideItems(cleanItems));
    if (itemsRes.error) {
      setSaving(false);
      return alert(`공격잘가는법 저장 실패: ${itemsRes.error.message}`);
    }

    // 예전 단일 항목 데이터와도 호환되게 첫 번째 항목을 같이 저장
    const first = cleanItems[0] || { title: "공격잘가는법 내용", body: "" };
    await upsertSetting("attack_guide_title", first.title);
    await upsertSetting("attack_guide_text", first.body);

    setSaving(false);
    setSettings((prev) => ({
      ...prev,
      attack_guide_items: stringifyAttackGuideItems(cleanItems),
      attack_guide_title: first.title,
      attack_guide_text: first.body,
    }));
  };

  const visibleItems = currentUser.role === "admin" ? items : parseAttackGuideItems(settings).filter((item) => item.title || item.body);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Attack Guide"
        title="공격잘가는법"
        desc="전투 공격 전에 확인할 기본 운영법과 주의사항을 정리하는 페이지입니다."
        action={currentUser.role === "admin" && <div className="flex flex-wrap gap-2"><Button onClick={addItem} variant="secondary"><Plus size={16} /> 추가</Button><Button onClick={save}><Save size={16} /> {saving ? "저장 중" : "저장"}</Button></div>}
      />

      {currentUser.role === "admin" ? (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-950">{index + 1}</div>
                {items.length > 1 && <DeleteButton onConfirm={() => removeItem(index)} className="px-3 py-1.5 text-xs">삭제</DeleteButton>}
              </div>
              <div className="grid gap-4">
                <Input
                  label="상단 제목"
                  value={item.title}
                  onChange={(v) => updateItem(index, { title: v })}
                  placeholder="예: 공격잘가는법 내용"
                />
                <TextArea
                  label="내용"
                  value={item.body}
                  onChange={(v) => updateItem(index, { body: v })}
                  placeholder=""
                  rows={10}
                />
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-7 text-zinc-700">
                  <div className="mb-2 text-[11px] font-semibold text-zinc-400">미리보기</div>
                  <div className="mb-3 text-sm font-semibold text-zinc-950">
                    {renderRichText(item.title || `공격잘가는법 ${index + 1}`, "")}
                  </div>
                  <div className="whitespace-pre-wrap">{renderRichText(item.body, "미리보기 내용이 없습니다.")}</div>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <EmptyState text="등록된 공격잘가는법이 없습니다. 추가 버튼으로 작성해주세요." />}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleItems.length === 0 ? <EmptyState text="등록된 내용이 없습니다." /> : visibleItems.map((item, index) => (
            <div key={index} className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
              <div className="mb-3 text-sm font-semibold text-zinc-950">{renderRichText(item.title || `공격잘가는법 ${index + 1}`, "")}</div>
              <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-700">{renderRichText(item.body, "등록된 내용이 없습니다.")}</div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function DefensePage({ currentUser, defenseTeams, setDefenseTeams, reloadData }) {
  if (isGuest(currentUser)) {
    return (
      <PageShell>
        <PageHeader eyebrow="Defense Team" title="방어팀" desc="덱 타입별 추천 방어팀을 확인하세요." />
        <GuestLockedContent />
      </PageShell>
    );
  }

  const [tab, setTab] = useState("attack");
  const [editing, setEditing] = useState(null);

  const deleteDefenseTeam = async (team) => {
    if (!team?.id) {
      alert("삭제할 방어팀 ID를 찾지 못했습니다.");
      return;
    }

    setDefenseTeams((prev) => prev.filter((item) => item.id !== team.id));

    const { error } = await supabase
      .from("defense_teams")
      .delete()
      .eq("id", team.id);

    if (error) {
      alert(`삭제 실패: ${error.message}`);
      await reloadData();
      return;
    }

    await reloadData();
  };
  const tabs = [["attack", "공덱"], ["tank", "방덱"], ["magic", "마덱"]];
  const list = defenseTeams
    .filter((t) => t.category === tab)
    .filter((t) => isVisibleItem(t, currentUser))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <PageShell>
      <PageHeader eyebrow="Defense Team" title="방어팀" desc="덱 타입별 추천 방어팀을 확인하세요." action={currentUser.role === "admin" && <Button onClick={() => setEditing({ ...emptyDefense, category: tab, sort_order: list.length + 1 })}><Plus size={16} /> 추가</Button>} />
      <div className="mb-5 flex max-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1 sm:w-fit">
        {tabs.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={cx("shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition", tab === id ? "bg-zinc-950 text-white" : "text-zinc-500 hover:text-zinc-950")}>{label}</button>)}
      </div>
      <div className="space-y-3">
        {list.map((team, index) => (
          <div key={team.id} className="grid overflow-hidden rounded-2xl border border-zinc-200 bg-white xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="border-b border-zinc-200 bg-zinc-50 p-4 sm:p-5 xl:border-b-0 xl:border-r">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-400">#{team.sort_order || index + 1}</p>
                {currentUser.role === "admin" && team.is_public === false && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">비공개</span>}
              </div>
              <h3 className="mt-2 text-xl font-semibold text-zinc-950">{renderRichText(team.title, "")}</h3>
              {team.subtitle && <p className="mt-1 text-sm text-zinc-950">{renderRichText(team.subtitle, "")}</p>}
              {currentUser.role === "admin" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => setEditing(team)} variant="secondary"><Pencil size={14} /> 수정</Button>
                  <DeleteButton onConfirm={() => deleteDefenseTeam(team)}>삭제</DeleteButton>
                </div>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-zinc-950">
                <span>추천도 <b className="ml-1 text-zinc-800">{team.power || "0"}/10</b></span>
                <span>펫 <b className="ml-1 text-zinc-800">{team.pet || "미입력"}</b></span>
                <span>진형 <b className="ml-1 text-zinc-800">{team.formation || "미입력"}</b></span>
                <span>최근 수정 <b className="ml-1 text-zinc-700">{formatUpdatedAt(team.updated_at || team.created_at)}</b></span>
              </div>
            </div>
            <div className="grid gap-5 p-4 sm:p-5 2xl:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3"><span className="text-xs font-semibold text-zinc-950">영웅 구성</span></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {splitList(team.heroes).map((hero, heroIndex) => {
                    const ring = splitList(team.rings)[heroIndex];
                    const gear = splitList(team.gears)[heroIndex];
                    return (
                      <div key={`${hero}-${heroIndex}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                        <div className="text-xs font-semibold text-zinc-800">{renderRichText(hero, "")}</div>
                        <div className="mt-1 text-[11px] text-zinc-950">반지: {renderRichText(ring, "미입력")}</div>
                        <div className="mt-1 text-[11px] text-zinc-950">장비: {renderRichText(gear, "미입력")}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-950">
                    <div className="mb-1 text-xs font-semibold text-zinc-950">속공순서 추천</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.speed_order, "미입력")}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-950">
                    <div className="mb-1 text-xs font-semibold text-zinc-950">팀속공 추천</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.team_speed, "미입력")}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-950">
                    <div className="mb-1 text-xs font-semibold text-zinc-950">스킬순서</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.skill_order, "미입력")}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-950">{renderRichText(team.note, "메모 없음")}</div>
            </div>
          </div>
        ))}
        {list.length === 0 && <EmptyState text="등록된 방어팀이 없습니다." />}
      </div>
      {editing && <DefenseEditor item={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reloadData(); }} />}
    </PageShell>
  );
}

function DefenseEditor({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ ...emptyDefense, ...item });
  const [saving, setSaving] = useState(false);
  const isNew = !item.id;

  const save = async () => {
    setSaving(true);
    const payload = {
      category: form.category,
      title: form.title,
      subtitle: form.subtitle,
      power: form.power,
      heroes: form.heroes,
      rings: form.rings,
      gears: form.gears,
      pet: form.pet,
      formation: form.formation,
      speed_order: form.speed_order,
      team_speed: form.team_speed,
      skill_order: form.skill_order,
      note: form.note,
      sort_order: Number(form.sort_order) || 1,
      is_public: form.is_public !== false && form.is_public !== "false",
      updated_at: new Date().toISOString(),
    };

    const { error } = isNew
      ? await supabase.from("defense_teams").insert(payload)
      : await supabase.from("defense_teams").update(payload).eq("id", item.id);

    setSaving(false);
    if (error) return alert(error.message);
    onSaved();
  };

  const remove = async () => {
    if (!item?.id) return alert("삭제할 방어팀 ID를 찾지 못했습니다.");
    const { error } = await supabase.from("defense_teams").delete().eq("id", item.id);
    if (error) return alert(error.message);
    onSaved();
  };

  return (
    <Modal title={isNew ? "방어팀 추가" : "방어팀 수정"} onClose={onClose}>
      <div className="grid gap-4">
        <Select
          label="분류"
          value={form.category}
          onChange={(v) => setForm({ ...form, category: v })}
          options={[["attack", "공덱"], ["tank", "방덱"], ["magic", "마법"]]}
        />
        <Input label="제목" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <Input label="부제목" value={form.subtitle} onChange={(v) => setForm({ ...form, subtitle: v })} />
        <Input label="추천도 / 10점 만점" value={form.power} onChange={(v) => setForm({ ...form, power: v })} placeholder="예: 8.5" />
        <TextArea label="영웅명" value={form.heroes} onChange={(v) => setForm({ ...form, heroes: v })} placeholder="쉼표 또는 줄바꿈으로 구분" rows={3} />
        <TextArea label="영웅별 반지" value={form.rings} onChange={(v) => setForm({ ...form, rings: v })} placeholder="영웅 순서에 맞춰 쉼표 또는 줄바꿈으로 입력" rows={3} />
        <TextArea label="영웅별 장비세팅" value={form.gears} onChange={(v) => setForm({ ...form, gears: v })} placeholder="영웅 순서에 맞춰 쉼표 또는 줄바꿈으로 입력" rows={3} />
        <Input label="펫" value={form.pet} onChange={(v) => setForm({ ...form, pet: v })} placeholder="예: 연지" />
        <Input label="진형" value={form.formation} onChange={(v) => setForm({ ...form, formation: v })} placeholder="예: 공격진형 / 보호진형" />
        <TextArea label="속공순서 추천" value={form.speed_order} onChange={(v) => setForm({ ...form, speed_order: v })} placeholder="예: 여포 → 칼헤론 → 란드그리드" rows={3} />
        <TextArea label="팀속공 추천" value={form.team_speed} onChange={(v) => setForm({ ...form, team_speed: v })} placeholder="예: 팀속공 45 이상 권장" rows={3} />
        <TextArea label="스킬순서" value={form.skill_order} onChange={(v) => setForm({ ...form, skill_order: v })} placeholder="예: 여포1스 파이2스 여포2스" rows={3} />
        <TextArea label="특징/메모" value={form.note} onChange={(v) => setForm({ ...form, note: v })} rows={3} />
        <Input label="정렬 순서" value={form.sort_order} onChange={(v) => setForm({ ...form, sort_order: v })} />
        <Select
          label="공개 상태"
          value={String(form.is_public !== false)}
          onChange={(v) => setForm({ ...form, is_public: v === "true" })}
          options={[["true", "공개"], ["false", "비공개"]]}
        />
        <div className="flex flex-wrap justify-between gap-2">
          <Button onClick={save}><Save size={16} /> {saving ? "저장 중" : "저장"}</Button>
          {!isNew && <DeleteButton onConfirm={remove}>삭제</DeleteButton>}
        </div>
      </div>
    </Modal>
  );
}

function ArenaPage({ currentUser, arenaTeams, setArenaTeams, reloadData }) {
  if (isGuest(currentUser)) {
    return (
      <PageShell>
        <PageHeader eyebrow="Arena" title="결투장 공략" desc="결투장 추천 조합과 영웅별 반지, 장비세팅, 속공등을 정리해둔 페이지입니다." />
        <GuestLockedContent />
      </PageShell>
    );
  }

  const [editing, setEditing] = useState(null);
  const list = [...arenaTeams]
    .filter((team) => isVisibleItem(team, currentUser))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const deleteArenaTeam = async (team) => {
    if (!team?.id) return alert("삭제할 결투장 공략 ID를 찾지 못했습니다.");

    setArenaTeams((prev) => prev.filter((item) => item.id !== team.id));

    const { error } = await supabase
      .from("arena_teams")
      .delete()
      .eq("id", team.id);

    if (error) {
      alert(`삭제 실패: ${error.message}`);
      await reloadData();
      return;
    }

    await reloadData();
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Arena"
        title="결투장 공략"
        desc="결투장 추천 조합과 영웅별 반지, 장비세팅, 속공등을 정리해둔 페이지입니다."
        action={currentUser.role === "admin" && <Button onClick={() => setEditing({ ...emptyArena, sort_order: list.length + 1 })}><Plus size={16} /> 추가</Button>}
      />

      <div className="space-y-3">
        {list.map((team, index) => (
          <div key={team.id} className="grid overflow-hidden rounded-2xl border border-zinc-200 bg-white xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="border-b border-zinc-200 bg-zinc-50 p-4 sm:p-5 xl:border-b-0 xl:border-r">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-400">#{team.sort_order || index + 1}</p>
                {currentUser.role === "admin" && team.is_public === false && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">비공개</span>}
              </div>
              <h3 className="mt-2 text-xl font-semibold text-zinc-950">{renderRichText(team.title, "")}</h3>
              <p className="mt-2 text-sm text-zinc-500">펫: <span className="font-semibold text-zinc-800">{team.pet || "미입력"}</span></p>
              <p className="mt-1 text-sm text-zinc-500">진형: <span className="font-semibold text-zinc-800">{team.formation || "미입력"}</span></p>
              <p className="mt-2 text-xs text-zinc-950">최근 수정 {formatUpdatedAt(team.updated_at || team.created_at)}</p>
              {currentUser.role === "admin" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => setEditing(team)} variant="secondary"><Pencil size={14} /> 수정</Button>
                  <DeleteButton onConfirm={() => deleteArenaTeam(team)}>삭제</DeleteButton>
                </div>
              )}
            </div>

            <div className="grid gap-5 p-4 sm:p-5 2xl:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
              <div>
                <div className="text-xs font-semibold text-zinc-400">영웅 구성</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {splitList(team.heroes).map((hero, heroIndex) => {
                    const ring = splitList(team.rings)[heroIndex];
                    const gear = splitList(team.gears)[heroIndex];
                    return (
                      <div key={`${hero}-${heroIndex}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                        <div className="text-xs font-semibold text-zinc-800">{renderRichText(hero, "")}</div>
                        <div className="mt-1 text-[11px] text-zinc-950">반지: {renderRichText(ring, "미입력")}</div>
                        <div className="mt-1 text-[11px] text-zinc-950">장비: {renderRichText(gear, "미입력")}</div>
                      </div>
                    );
                  })}
                  {splitList(team.heroes).length === 0 && <div className="text-sm text-zinc-950">등록된 영웅이 없습니다.</div>}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-950">
                    <div className="mb-1 text-xs font-semibold text-zinc-950">속공순서 추천</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.speed_order, "미입력")}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-950">
                    <div className="mb-1 text-xs font-semibold text-zinc-950">팀속공 추천</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.team_speed, "미입력")}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-950">
                    <div className="mb-1 text-xs font-semibold text-zinc-950">스킬순서</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.skill_order, "미입력")}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-950 whitespace-pre-wrap">{renderRichText(team.note, "메모 없음")}</div>
            </div>
          </div>
        ))}
        {list.length === 0 && <EmptyState text="등록된 결투장 공략이 없습니다." />}
      </div>

      {editing && <ArenaEditor item={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reloadData(); }} />}
    </PageShell>
  );
}

function ArenaEditor({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ ...emptyArena, ...item });
  const [saving, setSaving] = useState(false);
  const isNew = !item.id;

  const save = async () => {
    setSaving(true);
    const payload = {
      title: form.title || "",
      heroes: form.heroes || "",
      rings: form.rings || "",
      gears: form.gears || "",
      pet: form.pet || "",
      formation: form.formation || "",
      speed_order: form.speed_order || "",
      team_speed: form.team_speed || "",
      skill_order: form.skill_order || "",
      note: form.note || "",
      sort_order: Number(form.sort_order) || 1,
      is_public: form.is_public !== false && form.is_public !== "false",
      updated_at: new Date().toISOString(),
    };

    const { error } = isNew
      ? await supabase.from("arena_teams").insert(payload)
      : await supabase.from("arena_teams").update(payload).eq("id", item.id);

    setSaving(false);
    if (error) return alert(`저장 실패: ${error.message}`);
    onSaved();
  };

  const remove = async () => {
    if (!item?.id) return alert("삭제할 결투장 공략 ID를 찾지 못했습니다.");
    const { error } = await supabase.from("arena_teams").delete().eq("id", item.id);
    if (error) return alert(`삭제 실패: ${error.message}`);
    onSaved();
  };

  return (
    <Modal title={isNew ? "결투장 공략 추가" : "결투장 공략 수정"} onClose={onClose}>
      <div className="grid gap-4">
        <Input label="제목" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
        <TextArea label="영웅명" value={form.heroes} onChange={(v) => setForm({ ...form, heroes: v })} placeholder="쉼표 또는 줄바꿈으로 구분" rows={3} />
        <TextArea label="영웅별 반지" value={form.rings} onChange={(v) => setForm({ ...form, rings: v })} placeholder="영웅 순서에 맞춰 쉼표 또는 줄바꿈으로 입력" rows={3} />
        <TextArea label="영웅별 장비세팅" value={form.gears} onChange={(v) => setForm({ ...form, gears: v })} placeholder="영웅 순서에 맞춰 쉼표 또는 줄바꿈으로 입력" rows={3} />
        <Input label="펫" value={form.pet} onChange={(v) => setForm({ ...form, pet: v })} placeholder="예: 연지" />
        <Input label="진형" value={form.formation} onChange={(v) => setForm({ ...form, formation: v })} placeholder="예: 공격진형 / 보호진형" />
        <TextArea label="속공순서 추천" value={form.speed_order} onChange={(v) => setForm({ ...form, speed_order: v })} rows={3} />
        <TextArea label="팀속공 추천" value={form.team_speed} onChange={(v) => setForm({ ...form, team_speed: v })} rows={3} />
        <TextArea label="스킬순서" value={form.skill_order} onChange={(v) => setForm({ ...form, skill_order: v })} placeholder="예: 여포1스 파이2스 여포2스" rows={3} />
        <TextArea label="특징/메모" value={form.note} onChange={(v) => setForm({ ...form, note: v })} rows={3} />
        <Input label="정렬 순서" value={form.sort_order} onChange={(v) => setForm({ ...form, sort_order: v })} />
        <Select label="공개 상태" value={String(form.is_public !== false)} onChange={(v) => setForm({ ...form, is_public: v === "true" })} options={[["true", "공개"], ["false", "비공개"]]} />
        <div className="flex flex-wrap justify-between gap-2">
          <Button onClick={save}><Save size={16} /> {saving ? "저장 중" : "저장"}</Button>
          {!isNew && <DeleteButton onConfirm={remove}>삭제</DeleteButton>}
        </div>
      </div>
    </Modal>
  );
}

function NoticesPage({ currentUser, notices, reloadData }) {
  if (isGuest(currentUser)) {
    return (
      <PageShell>
        <PageHeader eyebrow="Notice" title="공지" desc="전투 관련 공지를 확인하세요." />
        <GuestLockedContent />
      </PageShell>
    );
  }

  const [editing, setEditing] = useState(null);
  const visibleNotices = notices.filter((notice) => isVisibleItem(notice, currentUser));
  return <PageShell><PageHeader eyebrow="Notice" title="공지" desc="전투 관련 공지를 확인하세요." action={currentUser.role === "admin" && <Button onClick={() => setEditing(emptyNotice)}><Plus size={16} /> 작성</Button>} /><div className="space-y-3">{visibleNotices.map((notice) => <article key={notice.id} className="rounded-2xl border border-zinc-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-400"><span>최근 수정 {formatUpdatedAt(notice.updated_at || notice.created_at)}</span>{currentUser.role === "admin" && notice.is_public === false && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">비공개</span>}</div><h2 className="mt-2 text-xl font-semibold text-zinc-950">{renderRichText(notice.title, "")}</h2></div>{currentUser.role === "admin" && <Button onClick={() => setEditing(notice)} variant="secondary"><Pencil size={14} /> 수정</Button>}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600">{renderRichText(notice.body, "")}</p></article>)}{visibleNotices.length === 0 && <EmptyState text="등록된 공지가 없습니다." />}</div>{editing && <NoticeEditor item={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reloadData(); }} />}</PageShell>;
}

function NoticeEditor({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item);
  const isNew = !item.id;
  const save = async () => {
    const payload = {
      title: form.title,
      body: form.body,
      is_public: form.is_public !== false && form.is_public !== "false",
      updated_at: new Date().toISOString(),
    };
    const { error } = isNew ? await supabase.from("notices").insert(payload) : await supabase.from("notices").update(payload).eq("id", item.id);
    if (error) return alert(error.message);
    onSaved();
  };
  const remove = async () => {
    const { error } = await supabase.from("notices").delete().eq("id", item.id);
    if (error) return alert(error.message);
    onSaved();
  };
  return <Modal title={isNew ? "공지 작성" : "공지 수정"} onClose={onClose}><div className="grid gap-4"><Input label="제목" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /><TextArea label="내용" value={form.body} onChange={(v) => setForm({ ...form, body: v })} rows={8} /><Select label="공개 상태" value={String(form.is_public !== false)} onChange={(v) => setForm({ ...form, is_public: v === "true" })} options={[["true", "공개"], ["false", "비공개"]]} /><div className="flex flex-wrap justify-between gap-2"><Button onClick={save}><Save size={16} /> 저장</Button>{!isNew && <DeleteButton onConfirm={remove}>삭제</DeleteButton>}</div></div></Modal>;
}

function ContentManagementPage({ settings, setSettings, reloadData }) {
  const [form, setForm] = useState(settings);
  useEffect(() => setForm(settings), [settings]);
  const save = async () => {
    for (const [key, value] of Object.entries(form)) {
      const { error } = await upsertSetting(key, String(value ?? ""));
      if (error) return alert(`${key} 저장 실패: ${error.message}`);
    }
    setSettings(form);
    await reloadData();
    alert("저장 완료");
  };
  const fields = [["guild_name", "사이트명"], ["site_title", "사이트 메인 제목"], ["main_subtitle", "메인 설명"], ["hero_notice", "승인 대기 안내 문구"], ["footer_text", "제작자 문구"]];
  return <PageShell><PageHeader eyebrow="Admin" title="콘텐츠 문구 관리" desc="메인 화면에 나오는 문구를 수정합니다." /><div className="rounded-2xl border border-zinc-200 bg-white p-6"><div className="grid gap-4">{fields.map(([key, label]) => key.includes("subtitle") || key.includes("body") || key.includes("notice") ? <TextArea key={key} label={label} value={form[key]} onChange={(v) => setForm({ ...form, [key]: v })} rows={3} /> : <Input key={key} label={label} value={form[key]} onChange={(v) => setForm({ ...form, [key]: v })} />)}<Button onClick={save} className="w-fit"><Save size={16} /> 저장</Button></div></div></PageShell>;
}

function BackupPage() {
  const [backingUp, setBackingUp] = useState(false);
  const [backupJson, setBackupJson] = useState("");
  const [backupFileName, setBackupFileName] = useState("");

  const makeBackup = async () => {
    setBackingUp(true);
    const [profilesRes, settingsRes, defenseRes, enemyDefenseRes, attackTeamsRes, noticesRes, totalWarRes, arenaRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("site_settings").select("*"),
      supabase.from("defense_teams").select("*").order("sort_order", { ascending: true }),
      supabase.from("enemy_defense_teams").select("*").order("sort_order", { ascending: true }).range(0, 5000),
      supabase.from("attack_teams").select("*").order("sort_order", { ascending: true }),
      supabase.from("notices").select("*").order("created_at", { ascending: false }),
      supabase.from("total_war_teams").select("*").order("sort_order", { ascending: true }),
      supabase.from("arena_teams").select("*").order("sort_order", { ascending: true }),
    ]);

    setBackingUp(false);

    const results = [profilesRes, settingsRes, defenseRes, enemyDefenseRes, attackTeamsRes, noticesRes, totalWarRes, arenaRes];
    const failed = results.find((res) => res.error);
    if (failed) return alert(`백업 실패: ${failed.error.message}`);

    const backup = {
      exported_at: new Date().toISOString(),
      site: "15month-site",
      version: 1,
      tables: {
        profiles: profilesRes.data || [],
        site_settings: settingsRes.data || [],
        defense_teams: defenseRes.data || [],
        enemy_defense_teams: enemyDefenseRes.data || [],
        attack_teams: attackTeamsRes.data || [],
        notices: noticesRes.data || [],
        total_war_teams: totalWarRes.data || [],
        arena_teams: arenaRes.data || [],
      },
    };

    const today = new Date().toISOString().slice(0, 10);
    const json = JSON.stringify(backup, null, 2);
    const fileName = `15month-backup-${today}.json`;
    setBackupJson(json);
    setBackupFileName(fileName);

    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 500);
  };

  const copyBackup = async () => {
    if (!backupJson) return;
    try {
      await navigator.clipboard.writeText(backupJson);
      alert("백업 내용이 복사되었습니다. 메모장에 붙여넣고 .json 파일로 저장하세요.");
    } catch {
      alert("복사가 막혔습니다. 아래 백업 내용 박스에서 직접 전체 선택 후 복사해주세요.");
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="백업"
        desc="현재 Supabase에 저장된 사이트 데이터를 JSON 파일로 내려받습니다."
        action={<Button onClick={makeBackup}><Save size={16} /> {backingUp ? "백업 중" : "백업 만들기"}</Button>}
      />
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-950">백업에 포함되는 내용</h2>
        <div className="mt-4 grid gap-2 text-sm leading-7 text-zinc-600 sm:grid-cols-2">
          <div className="rounded-xl bg-zinc-50 p-4">회원 목록 / 관리자 메모 / 마지막 접속일</div>
          <div className="rounded-xl bg-zinc-50 p-4">사이트 문구 / 중요 공지 / 공격잘가는법</div>
          <div className="rounded-xl bg-zinc-50 p-4">방어팀 / 공격팀 / 상대 방어팀 / 카운터덱</div>
          <div className="rounded-xl bg-zinc-50 p-4">총력전 공략 / 결투장 공략 / 공지</div>
        </div>
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">
          백업 파일에는 회원 아이디와 비밀번호 정보도 포함되어있습니다. 다른 사람에게 공유하지 말고 안전한 곳에 보관하세요.
        </p>

        {backupJson && (
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-zinc-950">백업 파일 생성 완료</div>
                <div className="mt-1 text-xs text-zinc-500">{backupFileName}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`data:application/json;charset=utf-8,${encodeURIComponent(backupJson)}`}
                  download={backupFileName || "seori-guild-backup.json"}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  다운로드 다시 시도
                </a>
                <Button onClick={copyBackup} variant="secondary">내용 복사</Button>
              </div>
            </div>
            <textarea
              readOnly
              value={backupJson}
              rows={8}
              className="mt-4 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 font-mono text-xs text-zinc-700 outline-none"
            />
            <p className="mt-3 text-xs leading-5 text-zinc-500">
              다운로드가 안 뜨면 위의 ‘다운로드 다시 시도’를 누르거나, ‘내용 복사’ 후 메모장에 붙여넣고 파일명을 {backupFileName || "seori-guild-backup.json"} 으로 저장하면 됩니다.
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function WeeklyCounterSummary({ currentUser }) {
  const [count, setCount] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!currentUser.authUserId) return;
      const { data, error } = await supabase.rpc('my_weekly_counter_count');
      if (active) { setFailed(Boolean(error)); setCount(error ? null : Number(data || 0)); }
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [currentUser.authUserId]);
  return <div className="mt-3 border-t border-zinc-200 pt-2 text-xs text-zinc-600">
    <div>이번주 카운터 작성 횟수</div>
    <div className="mt-1 font-semibold text-zinc-950" aria-live="polite">{failed ? '조회 실패' : count === null ? '—' : `${count}회`}</div>
  </div>;
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [guildTabs, setGuildTabs] = useState([]);
  const [settings, setSettings] = useState(FALLBACK_SETTINGS);
  const [defenseTeams, setDefenseTeams] = useState([]);
  const [enemyDefenseTeams, setEnemyDefenseTeams] = useState([]);
  const [attackTeams, setAttackTeams] = useState([]);
  const [notices, setNotices] = useState([]);
  const [totalWarTeams, setTotalWarTeams] = useState([]);
  const [arenaTeams, setArenaTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  useAnimeThemeAccess(currentUser);
  const [active, setActive, replaceActive] = useTabNavigation();
  const [menuOpen, setMenuOpen] = useState(false);

  const [authUserId, setAuthUserId] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const loadVersion = useRef(0);
  const loadedTables = useRef(new Set());
  const [pageRequest, setPageRequest] = useState({ key: '', error: '' });
  const [pageRetry, setPageRetry] = useState(0);

  useEffect(() => {
    let mounted = true;
    let changed = false;
    let lastIdentity;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true;
      if (!mounted) return;
      const nextIdentity = session?.user?.id || null;
      if (lastIdentity === nextIdentity) return;
      lastIdentity = nextIdentity;
      loadVersion.current += 1;
      setCurrentUser(null);
      setAuthUserId(nextIdentity);
      setAuthReady(true);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (mounted && !changed) {
        lastIdentity = data.session?.user?.id || null;
        if (error) setLoadError('로그인 정보를 불러오지 못했습니다. 다시 로그인해 주세요.');
        setAuthUserId(data.session?.user?.id || null);
        setAuthReady(true);
      }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); loadVersion.current += 1; };
  }, []);

  const loadData = useCallback(async () => {
    if (!authReady) return;
    const version = ++loadVersion.current;
    setLoading(true); setLoadError('');
    try {
      const settingsRes = await supabase.from('site_settings').select('*');
      if (settingsRes.error) throw settingsRes.error;
      if (version !== loadVersion.current) return;
      const nextSettings = { ...FALLBACK_SETTINGS };
      for (const row of settingsRes.data || []) nextSettings[row.key] = row.value;
      setSettings(nextSettings);
      loadedTables.current.clear();
      setUsers([]); setCurrentUser(null); setGuildTabs([]);
      setDefenseTeams([]); setEnemyDefenseTeams([]); setAttackTeams([]); setNotices([]); setTotalWarTeams([]); setArenaTeams([]);
      if (!authUserId) return;
      const profileRes = await supabase.from('profiles').select('*').eq('auth_user_id', authUserId).maybeSingle();
      if (profileRes.error) throw profileRes.error;
      if (version !== loadVersion.current) return;
      if (!profileRes.data) {
        await supabase.auth.signOut({ scope: 'local' });
        return;
      }
      const profile = mapProfile(profileRes.data);
      setCurrentUser(profile); setUsers([profile]);
      if (profile.status !== 'approved' || profile.mustChangePassword) return;
      const { data: tabs, error: tabsError } = await supabase.from('guild_war_tabs').select('*').order('created_at').order('name');
      if (version !== loadVersion.current) return;
      if (tabsError) throw tabsError;
      setGuildTabs((tabs || []).sort((a,b) => ({"철폐":0,"서리":1}[a.name] ?? 2) - ({"철폐":0,"서리":1}[b.name] ?? 2)));

    } catch {
      if (version === loadVersion.current) setLoadError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally { if (version === loadVersion.current) setLoading(false); }
  }, [authReady, authUserId]);

  useEffect(() => { loadData(); }, [loadData]);
  const navigation = currentUser ? guildNavigation(guildTabs, currentUser).filter(item => item.visibleTo.includes(currentUser.role) && (!item.ownerOnly || currentUser.isOwner)) : [];
  const safeActive = navigation.some(item => item.id === active) ? active : (currentUser?.role === 'guest' ? navigation[0]?.id || 'noGuild' : 'attack');
  useEffect(() => {
    if (!loading && currentUser?.status === 'approved' && !currentUser.mustChangePassword && active !== safeActive) replaceActive(safeActive);
  }, [loading, currentUser?.status, currentUser?.mustChangePassword, active, safeActive, replaceActive]);
  const requiredTables = pageTables(safeActive, currentUser);
  const pageKey = `${currentUser?.authUserId || ''}:${currentUser?.role || ''}:${safeActive}`;
  const pageReady = requiredTables.every(table => loadedTables.current.has(table));
  useEffect(() => {
    if (loading || !currentUser || currentUser.status !== 'approved' || currentUser.mustChangePassword) return;
    const missing = requiredTables.filter(table => !loadedTables.current.has(table));
    if (!missing.length) return;
    const controller = new AbortController();
    const version = loadVersion.current;
    setPageRequest({ key: pageKey, error: '' });
    Promise.all(missing.map(table => pageQuery(supabase, table, controller.signal))).then(results => {
      if (controller.signal.aborted || version !== loadVersion.current) return;
      const failed = results.find(result => result.error);
      if (failed) throw failed.error;
      const setters = { profiles: rows => setUsers(rows.map(mapProfile)), enemy_defense_teams: setEnemyDefenseTeams, attack_teams: setAttackTeams, total_war_teams: setTotalWarTeams };
      results.forEach((result, index) => {
        const table = missing[index];
        setters[table](result.data || []);
        loadedTables.current.add(table);
      });
      setPageRequest({ key: pageKey, error: '' });
    }).catch(() => {
      if (!controller.signal.aborted && version === loadVersion.current) setPageRequest({ key: pageKey, error: '화면 데이터를 불러오지 못했습니다.' });
    });
    return () => controller.abort();
  }, [loading, pageKey, pageRetry]);
  const syncedCurrentUser = currentUser;
  const logout = async () => {
    loadVersion.current += 1;
    setCurrentUser(null); setUsers([]); replaceActive('attack');
    await supabase.auth.signOut({ scope: 'local' });
  };

  if (!authReady || loading) return <div className="grid min-h-screen place-items-center bg-[#0d0f12] text-zinc-400">데이터 불러오는 중…</div>;
  if (loadError) return <div className="grid min-h-screen place-items-center bg-[#0d0f12] p-5 text-white"><div><p role="alert">{loadError}</p><button onClick={loadData} className="mr-5 mt-5">다시 시도</button><button onClick={logout}>로그아웃</button></div></div>;
  if (!syncedCurrentUser) return <SecureAuth settings={settings} />;
  if (syncedCurrentUser.status === 'pending') return <PendingScreen user={syncedCurrentUser} logout={logout} settings={settings} />;
  if (syncedCurrentUser.status !== 'approved') return <div className="grid min-h-screen place-items-center"><div>이 계정은 이용할 수 없습니다.<button onClick={logout} className="ml-4">로그아웃</button></div></div>;
  if (syncedCurrentUser.mustChangePassword) return <PasswordChange required={syncedCurrentUser.mustChangePassword} onDone={logout} onLogout={logout} />;


  return (
    <div className="site-theme min-h-screen bg-[#f6f7f9] font-sans text-zinc-950">
      <AccountWatermark nickname={syncedCurrentUser.gameNickname} />
      <style>{"@keyframes snowSway{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}.snow-sway-icon{animation:snowSway 3.8s ease-in-out infinite;transform-origin:center}"}</style>
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      )}

      <Sidebar
        guildTabs={guildTabs}
        active={safeActive}
        setActive={setActive}
        isOpen={menuOpen}
        setIsOpen={setMenuOpen}
        currentUser={syncedCurrentUser}
        logout={logout}
        settings={settings}
      />

      <main className="lg:pl-64">
        <MobileHeader
          setIsOpen={setMenuOpen}
          currentUser={syncedCurrentUser}
          settings={settings}
        />

        <Suspense fallback={<div role="status" className="p-6 text-sm text-zinc-500">화면 불러오는 중…</div>}>
        {!pageReady ? <div role="status" className="p-6 text-sm text-zinc-500">
          {pageRequest.key === pageKey && pageRequest.error ? <><p role="alert">{pageRequest.error}</p><button type="button" className="mt-3 underline" onClick={() => setPageRetry(value => value + 1)}>다시 시도</button></> : '화면 데이터 불러오는 중…'}
        </div> : <>
        {safeActive === "noGuild" && <div className="p-8">관리자 메모에 등록된 길드전이 없습니다. 관리자에게 소속 길드 설정을 요청해 주세요.</div>}
        {safeActive === "board" && <GuildBoardPage key={syncedCurrentUser.id} currentUser={syncedCurrentUser} users={users} />}

        {safeActive === "historyCounter" && <HistoryCounterSearch key={syncedCurrentUser.id} currentUser={syncedCurrentUser} />}
        {safeActive === "simulation" && syncedCurrentUser.role === "admin" && syncedCurrentUser.isOwner && <ReplaySimulationPage key={syncedCurrentUser.id} currentUser={syncedCurrentUser} />}
        {safeActive === "guildWarAdd" && syncedCurrentUser.isOwner && <AddGuildWarTab users={users} tabs={guildTabs} onAdded={async name => { await loadData(); setActive(guildTabId(name)); }} />}
        {guildTabs.some(tab => guildTabId(tab.name) === safeActive) && <GuildWarPage currentUser={syncedCurrentUser} key={safeActive} guild={guildTabs.find(tab => guildTabId(tab.name) === safeActive).name} counterTeams={enemyDefenseTeams.filter(team => !team.is_temporary && isVisibleItem(team, syncedCurrentUser)).map(team => ({...team, decks: parseCounterDecks(team.counter_decks)}))} />}

        {(safeActive === "attack" || safeActive === "temporaryAttack") && (
          <AttackPage
            key={safeActive}
            temporary={safeActive === "temporaryAttack"}
            currentUser={syncedCurrentUser}
            attackTeams={attackTeams.filter((team) => (team.is_temporary === true) === (safeActive === "temporaryAttack"))}
            setAttackTeams={setAttackTeams}
            enemyDefenseTeams={enemyDefenseTeams.filter((team) => (team.is_temporary === true) === (safeActive === "temporaryAttack"))}
            setEnemyDefenseTeams={setEnemyDefenseTeams}
            reloadData={loadData}
          />
        )}

        {safeActive === "total" && (
          <TotalWarPage
            currentUser={syncedCurrentUser}
            totalWarTeams={totalWarTeams}
            setTotalWarTeams={setTotalWarTeams}
            reloadData={loadData}
          />
        )}

        {safeActive === "arena" && (
          <ArenaPage
            currentUser={syncedCurrentUser}
            arenaTeams={arenaTeams}
            setArenaTeams={setArenaTeams}
            reloadData={loadData}
          />
        )}

        {safeActive === "deleted" && syncedCurrentUser.isOwner && <DeletedCounterManagement reloadData={loadData} />}

        {safeActive === "members" && syncedCurrentUser.role === "admin" && (
          <MemberManagementPage
            users={users}
            setUsers={setUsers}
            currentUser={syncedCurrentUser}
            setCurrentUser={setCurrentUser}
            reloadData={loadData}
          />
        )}
        </>}
        </Suspense>
      </main>
    </div>
  );
}
