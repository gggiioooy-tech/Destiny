import { ThemeToggle, AnimeThemeMenu, TransparencyControl } from "./components/ThemeProvider.jsx";
import GuildWarRecognition from "./components/GuildWarRecognition.jsx";
import { CounterOrderFields, CounterOrderDisplay } from "./components/CounterOrderFields.jsx";
import { parseCounterOrder, describeCounterOrder } from "./lib/counterOrders.js";
import { matchesHeroSearch, matchesEnemyTeamSearch, searchTokens } from "./lib/heroSearch.js";
import { sortByRecommendation } from "./lib/recommendationSort.js";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { SecureAuth, PasswordChange } from "./components/SecureAuth.jsx";
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
  { id: "attack", label: "공격팀", icon: Swords, visibleTo: ["guest", "member", "admin"] },
  { id: "temporaryAttack", label: "임시 공격팀", icon: Swords, visibleTo: ["guest", "member", "admin"] },
  { id: "members", label: "회원 관리", icon: Users, visibleTo: ["admin"] },
  { id: "deleted", label: "삭제정보관리", icon: Trash2, visibleTo: ["admin"], ownerOnly: true },
];

const emptyDefense = { category: "attack", title: "", subtitle: "", power: "", heroes: "", rings: "", gears: "", pet: "", formation: "", speed_order: "", team_speed: "", skill_order: "", note: "", sort_order: 1, is_public: true };
const emptyTotalWar = { title: "", heroes: "", rings: "", gears: "", pet: "", formation: "", speed_order: "", team_speed: "", skill_order: "", note: "", sort_order: 1, is_public: true };
const emptyArena = { title: "", heroes: "", rings: "", gears: "", pet: "", formation: "", speed_order: "", team_speed: "", skill_order: "", note: "", sort_order: 1, is_public: true };
const emptyAttackTeam = { enemy_type: "오공덱", title: "", power: "", heroes: "", rings: "", gears: "", pet: "", formation: "", speed_order: "", team_speed: "", skill_order: "", note: "", sort_order: 1, is_public: true };
const emptyEnemyDefense = { category: "enemy", title: "", heroes: "", note: "", counter_decks: "", sort_order: 1, is_public: true };
const emptyCounterDeck = { title: "", power: "", heroes: "", rings: "", pet: "", formation: "", speed_order: "", team_speed: "", skill_order: "", gear_1: "", gear_2: "", gear_3: "", note: "" };
const emptyNotice = { title: "", body: "", is_public: true };

function cx(...items) {
  return items.filter(Boolean).join(" ");
}

function splitList(value) {
  if (!value) return [];
  const normalized = String(value).replace(String.fromCharCode(13), "");
  return normalized
    .split(String.fromCharCode(10))
    .flatMap((line) => line.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

function counterRingSlots(value) {
  // New values keep blank slots and multiline notes; legacy comma/line lists still load.
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return Array.from({ length: 3 }, (_, i) => String(parsed[i] ?? ""));
  } catch { /* Legacy plain text. */ }
  const rings = splitList(value);
  return Array.from({ length: 3 }, (_, i) => rings[i] || "");
}

function parseCounterDecks(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseAttackGuideItems(settings) {
  try {
    const parsed = JSON.parse(settings.attack_guide_items || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return [{ title: settings.attack_guide_title || "공격잘가는법 내용", body: settings.attack_guide_text || "" }];
}

function stringifyAttackGuideItems(items) {
  return JSON.stringify(items || []);
}

function stringifyCounterDecks(decks) {
  return JSON.stringify(decks || []);
}

function normalizeMultilineText(value) {
  return String(value ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n");
}

function renderRichText(value, fallback = "미입력") {
  const text = normalizeMultilineText(
    value === undefined || value === null || value === "" ? fallback : String(value)
  );
  const regex = /\((노|굵|빨글)\)/g;
  const parts = [];
  const active = { 노: false, 굵: false, 빨글: false };
  let lastIndex = 0;
  let match;

  const pushText = (content) => {
    if (!content) return;
    parts.push({
      text: content,
      노: active.노,
      굵: active.굵,
      빨글: active.빨글,
    });
  };

  while ((match = regex.exec(text)) !== null) {
    pushText(text.slice(lastIndex, match.index));
    const key = match[1];
    active[key] = !active[key];
    lastIndex = regex.lastIndex;
  }

  pushText(text.slice(lastIndex));

  return parts.map((part, index) => {
    const className = cx(
      part.노 && "rounded bg-yellow-200 px-1",
      part.굵 && "font-bold",
      part.빨글 && "text-red-600"
    );

    const lines = String(part.text).split("\n");
    const content = lines.map((line, lineIndex) => (
      <React.Fragment key={lineIndex}>
        {line}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    ));

    if (!className) {
      return <React.Fragment key={index}>{content}</React.Fragment>;
    }

    return (
      <span key={index} className={className}>
        {content}
      </span>
    );
  });
}

function mapProfile(row) {
  return {
    dbId: row.id,
    id: row.user_id,
    authUserId: row.auth_user_id,
    isOwner: row.is_owner,
    mustChangePassword: row.must_change_password,
    gameNickname: row.game_nickname,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    memo: row.memo || "",
  };
}

function statusLabel(status) {
  return { pending: "승인 대기", approved: "승인 완료", rejected: "거절됨", blocked: "차단됨" }[status] || status;
}

function formatUpdatedAt(value) {
  if (!value) return "수정일 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "수정일 없음";
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatLastSeen(value) {
  if (!value) return "접속 기록 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "접속 기록 없음";
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function isVisibleItem(item, currentUser) {
  if (currentUser?.role === "guest") return false;
  return currentUser?.role === "admin" || item.is_public !== false;
}

function isGuest(currentUser) {
  return currentUser?.role === "guest";
}

function GuestLockedContent() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-zinc-100 text-zinc-500">
        <Lock size={22} />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-zinc-950">내용 열람 권한이 없습니다.</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">일반회원 이상부터 열람 가능합니다.</p>
    </div>
  );
}

function roleLabel(role) {
  return { guest: "게스트", member: "일반회원", admin: "관리자" }[role] || role;
}

function isSuperAdminId(id) {
  return SUPER_ADMIN_IDS.includes(id);
}

function isHiddenUserId(id) {
  return HIDDEN_USER_IDS.includes(id);
}

async function upsertSetting(key, value) {
  return supabase.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

function PageShell({ children }) {
  return <div className="site-page min-h-screen bg-[#f6f7f9] px-4 py-5 sm:px-5 sm:py-6 md:px-8 md:py-9">{children}</div>;
}

function PageHeader({ eyebrow, title, desc, action }) {
  return (
    <div className="site-page-header mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{eyebrow}</p>
        <h1 className="mt-2 break-keep text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl md:text-4xl">{title}</h1>
        {desc && <p className="mt-2 text-sm leading-6 text-zinc-500">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", className = "", disabled }) {
  const styles = {
    primary: "bg-zinc-950 text-white hover:bg-zinc-800",
    secondary: "bg-white text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50",
    subtle: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
    danger: "bg-red-50 text-red-700 hover:bg-red-100",
  };
  return (
    <button disabled={disabled} onClick={onClick} className={cx("site-button inline-flex max-w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", styles[variant], className)}>
      {children}
    </button>
  );
}

function DeleteButton({ children, onConfirm, className = "" }) {
  const [armed, setArmed] = useState(false);

  const click = () => {
    if (!armed) {
      setArmed(true);
      window.setTimeout(() => setArmed(false), 2500);
      return;
    }
    setArmed(false);
    onConfirm?.();
  };

  return (
    <Button onClick={click} variant="danger" className={className}>
      <Trash2 size={14} /> {armed ? "한번 더 누르면 삭제" : children}
    </Button>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", dark, onEnter }) {
  return (
    <div>
      <label className={cx("text-xs font-semibold", dark ? "text-zinc-300" : "text-zinc-500")}>{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(normalizeMultilineText(e.target.value))}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        className={cx(
          "mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:ring-4",
          dark
            ? "border border-white/10 bg-white/5 text-white placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-white/10"
            : "border border-zinc-200 bg-white text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-zinc-200/70"
        )}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 5 }) {
  return (
    <div>
      <label className="text-xs font-semibold text-zinc-500">{label}</label>
      <textarea
        rows={rows}
        value={value || ""}
        onChange={(e) => onChange(normalizeMultilineText(e.target.value))}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-4 focus:ring-zinc-200/70"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs font-semibold text-zinc-500">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none focus:ring-4 focus:ring-zinc-200/70">
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </div>
  );
}

const formationOptions = ["기본진형", "밸런스진형", "공격진형", "보호진형"];

function splitFormation(value = "") {
  const text = String(value || "").trimStart();
  const match = text.match(/^(기본|밸런스|공격|보호)\s*진[형헝]\s*/);
  return match ? { type: `${match[1]}진형`, detail: text.slice(match[0].length) } : { type: "", detail: text };
}

function normalizedFormation(value) {
  const { type, detail } = splitFormation(value);
  return [type, detail].filter(Boolean).join(" ").trim();
}

function FormationField({ label = "진형", value, onChange }) {
  const { type, detail } = splitFormation(value);
  return (
    <div className="grid gap-3">
      <Select label={label} value={type} onChange={(next) => onChange([next, detail].filter(Boolean).join(" "))}
        options={[["", "진형 선택"], ...formationOptions.map((name) => [name, name])]} />
      <Input label="진형 배치 메모 (선택)" value={detail}
        onChange={(next) => onChange(type ? `${type} ${next}` : next)} placeholder="예: 앞열 / 후열 선란, 브란즈&브란셀" />
    </div>
  );
}

function InfoChip({ title, desc }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm font-semibold text-white">{title}</p><p className="mt-1 text-xs text-zinc-500">{desc}</p></div>;
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

function Sidebar({ active, setActive, isOpen, setIsOpen, currentUser, logout, settings }) {
  const availableNav = navItems.filter((item) => item.visibleTo.includes(currentUser.role) && (!item.ownerOnly || currentUser.isOwner));
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
        <nav className="flex-1 space-y-1 p-3">
          {availableNav.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button key={item.id} onClick={() => { setActive(item.id); setIsOpen(false); }} className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", selected ? "bg-zinc-950 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950")}>
                <Icon size={17} />{item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-zinc-200 p-4">
          <div className="rounded-xl bg-zinc-50 p-3">
            <div className="text-sm font-semibold text-zinc-950">{currentUser.gameNickname}</div>
            <div className="mt-1 text-xs text-zinc-500">{roleLabel(currentUser.role)}</div>
            <WeeklyCounterSummary currentUser={currentUser} />
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
  return (
    <header className="sticky top-0 z-30 flex flex-wrap gap-2 items-center justify-between border-b border-zinc-200 bg-white/90 px-3 py-3 backdrop-blur sm:px-4 lg:hidden">
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
            <SummaryCard title="접속 권한" value="게스트" desc="공략 내용 열람 제한" icon={Lock} />
          ) : (
            <SummaryCard title="승인 회원" value={`${approvedCount}명`} desc="현재 사이트 이용 가능" icon={Users} />
          )}
          {currentUser.role === "admin" && (
            <>
              <SummaryCard title="가입 대기" value={`${pendingCount}명`} desc="관리자 확인 필요" icon={Lock} />
              <SummaryCard title="접속 권한" value={roleLabel(currentUser.role)} desc="현재 로그인 권한" icon={Shield} />
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

const GUILD_BOARD_IMAGE_BUCKET = "guild-board-images";
const GUILD_BOARD_MAX_IMAGES = 3;
const GUILD_BOARD_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const GUILD_BOARD_ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const GUILD_BOARD_PAGE_SIZE = 20;

function parseBoardImagePaths(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function boardImageExtension(file) {
  const rawExt = String(file?.name || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  if (rawExt && rawExt.length <= 8) return rawExt;
  return {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  }[file?.type] || "jpg";
}

function buildBoardImagePath(userId, scope, file) {
  const safeUserId = String(userId || "user").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "user";
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${safeUserId}/${scope}/${Date.now()}-${randomId}.${boardImageExtension(file)}`;
}

async function boardSignedImageUrls(paths) {
  const cleanPaths = [...new Set((paths || []).filter(Boolean))];
  if (!cleanPaths.length) return new Map();
  const { data, error } = await supabase.storage.from(GUILD_BOARD_IMAGE_BUCKET).createSignedUrls(cleanPaths, 60 * 60);
  if (error) {
    console.warn("board image signed url load failed:", error.message);
    return new Map();
  }
  return new Map((data || []).filter((item) => item?.path && item?.signedUrl).map((item) => [item.path, item.signedUrl]));
}

function BoardImagePicker({ files, setFiles, label = "사진 첨부" }) {
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);

  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);

  const chooseFiles = (event) => {
    const incoming = Array.from(event.target.files || []);
    event.target.value = "";
    if (!incoming.length) return;
    if (files.length + incoming.length > GUILD_BOARD_MAX_IMAGES) return alert(`사진은 최대 ${GUILD_BOARD_MAX_IMAGES}장까지 첨부할 수 있어.`);
    for (const file of incoming) {
      if (!GUILD_BOARD_ALLOWED_IMAGE_TYPES.has(file.type)) return alert("JPG, PNG, WEBP, GIF, HEIC 사진만 첨부할 수 있어.");
      if (file.size > GUILD_BOARD_MAX_IMAGE_BYTES) return alert("사진 한 장은 최대 10MB까지 업로드할 수 있습니다.");
    }
    setFiles((prev) => [...prev, ...incoming]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-200 transition hover:bg-zinc-50">
          <Plus size={15} /> {label}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" multiple className="hidden" onChange={chooseFiles} />
        </label>
        <span className="text-xs text-zinc-400">최대 3장 · 장당 10MB</span>
      </div>
      {previews.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {previews.map((item, index) => (
            <div key={`${item.file.name}-${item.file.lastModified}-${index}`} className="relative h-24 w-24 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
              <img src={item.url} alt="첨부 미리보기" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><XCircle size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardStoredImages({ paths }) {
  const cleanPaths = parseBoardImagePaths(paths);
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const map = await boardSignedImageUrls(cleanPaths);
      if (!cancelled) setUrls(cleanPaths.map((path) => ({ path, url: map.get(path) || "" })).filter((item) => item.url));
    };
    load();
    return () => { cancelled = true; };
  }, [JSON.stringify(cleanPaths)]);
  if (!urls.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {urls.map((item) => (
        <a key={item.path} href={item.url} target="_blank" rel="noreferrer" className="block h-28 w-28 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 sm:h-36 sm:w-36">
          <img src={item.url} alt="첨부 이미지" className="h-full w-full object-cover transition hover:scale-[1.03]" />
        </a>
      ))}
    </div>
  );
}

async function uploadBoardImages(userId, scope, files) {
  const uploaded = [];
  for (const file of files) {
    const path = buildBoardImagePath(userId, scope, file);
    const { error } = await supabase.storage.from(GUILD_BOARD_IMAGE_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
    if (error) {
      if (uploaded.length) await supabase.storage.from(GUILD_BOARD_IMAGE_BUCKET).remove(uploaded);
      throw error;
    }
    uploaded.push(path);
  }
  return uploaded;
}

async function removeBoardImages(paths) {
  const clean = parseBoardImagePaths(paths);
  if (!clean.length) return;
  const { error } = await supabase.storage.from(GUILD_BOARD_IMAGE_BUCKET).remove(clean);
  if (error) console.warn("board image delete failed:", error.message);
}


function GuildBoardPage({ currentUser, users }) {
  if (isGuest(currentUser)) {
    return (
      <PageShell>
        <PageHeader eyebrow="Guild Board" title="자유게시판" desc="길드원끼리 자유롭게 글과 댓글을 남기는 게시판입니다." />
        <GuestLockedContent />
      </PageShell>
    );
  }

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(GUILD_BOARD_PAGE_SIZE);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postFiles, setPostFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentFiles, setCommentFiles] = useState([]);
  const [commenting, setCommenting] = useState(false);

  const resolveNickname = (authorId, fallback) => users.find((user) => user.id === authorId)?.gameNickname || fallback || "알 수 없음";
  const canDelete = (authorId) => currentUser.role === "admin" || currentUser.id === authorId;

  const loadPosts = async () => {
    setLoading(true);
    const { data, error, count } = await supabase
      .from("guild_board_posts")
      .select("*, guild_board_comments(count)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(0, visibleCount - 1);
    setLoading(false);
    if (error) return alert(`게시글 불러오기 실패: ${error.message}`);
    setPosts(data || []);
    setHasMore((count || 0) > (data || []).length);
    if (selectedPost) {
      const refreshed = (data || []).find((item) => item.id === selectedPost.id);
      if (refreshed) setSelectedPost(refreshed);
    }
  };

  const loadComments = async (postId) => {
    if (!postId) return setComments([]);
    setCommentsLoading(true);
    const { data, error } = await supabase
      .from("guild_board_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setCommentsLoading(false);
    if (error) return alert(`댓글 불러오기 실패: ${error.message}`);
    setComments(data || []);
  };

  useEffect(() => { loadPosts(); }, [visibleCount]);
  useEffect(() => { if (selectedPost?.id) loadComments(selectedPost.id); }, [selectedPost?.id]);

  const createPost = async () => {
    const cleanTitle = postTitle.trim();
    const cleanBody = postBody.trim();
    if (posting) return;
    if (!cleanTitle) return alert("제목을 입력해 주세요.");
    if (!cleanBody && postFiles.length === 0) return alert("내용이나 사진을 하나 이상 입력해 주세요.");
    setPosting(true);
    let imagePaths = [];
    try {
      imagePaths = await uploadBoardImages(currentUser.authUserId, "posts", postFiles);
      const { error } = await supabase.from("guild_board_posts").insert({
        title: cleanTitle,
        body: cleanBody,
        author_id: currentUser.id,
        author_nickname: currentUser.gameNickname,
        image_paths: imagePaths,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setPostTitle("");
      setPostBody("");
      setPostFiles([]);
      setWriteOpen(false);
      setVisibleCount(GUILD_BOARD_PAGE_SIZE);
      await loadPosts();
    } catch (error) {
      if (imagePaths.length) await removeBoardImages(imagePaths);
      alert(`게시글 등록 실패: ${error.message}`);
    } finally {
      setPosting(false);
    }
  };

  const createComment = async () => {
    if (!selectedPost || commenting) return;
    const cleanBody = commentBody.trim();
    if (!cleanBody && commentFiles.length === 0) return alert("댓글 내용이나 사진을 하나 이상 입력해 주세요.");
    setCommenting(true);
    let imagePaths = [];
    try {
      imagePaths = await uploadBoardImages(currentUser.authUserId, `comments/${selectedPost.author_auth_id}`, commentFiles);
      const { error } = await supabase.from("guild_board_comments").insert({
        post_id: selectedPost.id,
        body: cleanBody,
        author_id: currentUser.id,
        author_nickname: currentUser.gameNickname,
        image_paths: imagePaths,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setCommentBody("");
      setCommentFiles([]);
      await loadComments(selectedPost.id);
      await loadPosts();
    } catch (error) {
      if (imagePaths.length) await removeBoardImages(imagePaths);
      alert(`댓글 등록 실패: ${error.message}`);
    } finally {
      setCommenting(false);
    }
  };

  const deleteComment = async (comment) => {
    if (!canDelete(comment.author_id)) return;
    const { error } = await supabase.from("guild_board_comments").delete().eq("id", comment.id);
    if (error) return alert(`댓글 삭제 실패: ${error.message}`);
    await removeBoardImages(comment.image_paths);
    await loadComments(selectedPost.id);
    await loadPosts();
  };

  const deletePost = async (post) => {
    if (!canDelete(post.author_id)) return;
    const { data: commentRows, error: commentsError } = await supabase.from("guild_board_comments").select("image_paths").eq("post_id", post.id);
    if (commentsError) return alert(`댓글 사진 확인 실패: ${commentsError.message}`);
    const commentImagePaths = (commentRows || []).flatMap((row) => parseBoardImagePaths(row.image_paths));
    const { error } = await supabase.from("guild_board_posts").delete().eq("id", post.id);
    if (error) return alert(`게시글 삭제 실패: ${error.message}`);
    await removeBoardImages([...parseBoardImagePaths(post.image_paths), ...commentImagePaths]);
    setSelectedPost(null);
    setComments([]);
    await loadPosts();
  };

  if (selectedPost) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Guild Board"
          title="자유게시판"
          desc="게시글과 댓글의 작성자는 게임 닉네임으로 표시됩니다."
          action={<Button onClick={() => { setSelectedPost(null); setComments([]); }} variant="secondary">목록으로</Button>}
        />
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="break-words text-2xl font-semibold tracking-tight text-zinc-950">{selectedPost.title}</h2>
              <div className="mt-2 text-xs text-zinc-500">
                <span className="font-semibold text-zinc-800">{resolveNickname(selectedPost.author_id, selectedPost.author_nickname)}</span>
                <span className="mx-2">·</span>{new Date(selectedPost.created_at).toLocaleString("ko-KR")}
              </div>
            </div>
            {canDelete(selectedPost.author_id) && <DeleteButton onConfirm={() => deletePost(selectedPost)}>글 삭제</DeleteButton>}
          </div>
          {selectedPost.body && <div className="mt-6 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-700">{selectedPost.body}</div>}
          <BoardStoredImages paths={selectedPost.image_paths} />
        </article>

        <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-zinc-950">댓글 {comments.length}</h3></div>
          <div className="mt-4 space-y-3">
            {commentsLoading ? <div className="rounded-xl bg-zinc-50 p-5 text-center text-sm text-zinc-400">댓글 불러오는 중...</div> : comments.length === 0 ? <div className="rounded-xl bg-zinc-50 p-5 text-sm text-zinc-400">첫 댓글을 작성해 주세요.</div> : comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-zinc-500"><span className="font-semibold text-zinc-900">{resolveNickname(comment.author_id, comment.author_nickname)}</span><span className="mx-2">·</span>{new Date(comment.created_at).toLocaleString("ko-KR")}</div>
                    {comment.body && <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-zinc-700">{comment.body}</div>}
                    <BoardStoredImages paths={comment.image_paths} />
                  </div>
                  {canDelete(comment.author_id) && <DeleteButton onConfirm={() => deleteComment(comment)} className="shrink-0 px-3 py-2 text-xs">삭제</DeleteButton>}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <TextArea label="댓글" value={commentBody} onChange={setCommentBody} placeholder="댓글을 입력해 주세요" rows={4} />
            <div className="mt-3"><BoardImagePicker files={commentFiles} setFiles={setCommentFiles} label="댓글 사진 첨부" /></div>
            <div className="mt-4 flex justify-end"><Button onClick={createComment} disabled={commenting}>{commenting ? "등록 중" : "댓글 등록"}</Button></div>
          </div>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Guild Board"
        title="자유게시판"
        desc="길드원끼리 자유롭게 글과 댓글을 남길 수 있습니다. 작성자는 모두 공개됩니다."
        action={<Button onClick={() => setWriteOpen(true)}><Plus size={16} /> 글쓰기</Button>}
      />
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {loading ? <div className="p-10 text-center text-sm text-zinc-400">게시글 불러오는 중...</div> : posts.length === 0 ? <div className="p-10 text-center text-sm text-zinc-400">아직 작성된 글이 없습니다.</div> : posts.map((post) => (
          <button key={post.id} type="button" onClick={() => setSelectedPost(post)} className="flex w-full items-center justify-between gap-4 border-b border-zinc-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-zinc-50 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-semibold text-zinc-950 sm:text-base">{post.title}</div>
                {parseBoardImagePaths(post.image_paths).length > 0 && <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">사진</span>}
              </div>
              <div className="mt-1 text-xs text-zinc-500"><span className="font-semibold text-zinc-700">{resolveNickname(post.author_id, post.author_nickname)}</span><span className="mx-2">·</span>{new Date(post.created_at).toLocaleString("ko-KR")}</div>
            </div>
            <div className="shrink-0 text-xs font-semibold text-zinc-500">댓글 {Number(post.guild_board_comments?.[0]?.count) || 0} <ChevronRight size={14} className="ml-1 inline" /></div>
          </button>
        ))}
      </div>
      {hasMore && <div className="mt-4"><Button onClick={() => setVisibleCount((prev) => prev + GUILD_BOARD_PAGE_SIZE)} variant="secondary">게시글 {GUILD_BOARD_PAGE_SIZE}개 더보기</Button></div>}

      {writeOpen && (
        <Modal title="자유게시판 글쓰기" onClose={() => setWriteOpen(false)}>
          <div className="grid gap-4">
            <Input label="제목" value={postTitle} onChange={setPostTitle} placeholder="제목을 입력해 주세요" />
            <TextArea label="내용" value={postBody} onChange={setPostBody} placeholder="내용을 입력해 주세요" rows={9} />
            <BoardImagePicker files={postFiles} setFiles={setPostFiles} label="게시글 사진 첨부" />
            <div className="flex justify-end"><Button onClick={createPost} disabled={posting}>{posting ? "등록 중" : "글 등록"}</Button></div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
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

function AttackPage({ currentUser, attackTeams, setAttackTeams, enemyDefenseTeams, setEnemyDefenseTeams, reloadData, temporary = false }) {
  const pageTitle = temporary ? "임시 공격팀" : "공격팀";
  const pageEyebrow = temporary ? "Temporary Attack Team" : "Attack Team";
  const pageDescription = temporary
    ? "상대 방어팀별 공격 조합을 임시로 기재하는 페이지입니다. 테스트 후 정식 공격팀으로 옮겨지거나 삭제될 수 있습니다."
    : "상대 방어팀별 공격 조합과 속공 기준을 정리하는 페이지입니다.";
  if (isGuest(currentUser)) {
    return (
      <PageShell>
        <PageHeader eyebrow={pageEyebrow} title={pageTitle} desc={pageDescription} />
        <GuestLockedContent />
      </PageShell>
    );
  }

  const [filter, setFilter] = useState("전체");
  const [editing, setEditing] = useState(null);
  const [enemyHeroSearch, setEnemyHeroSearch] = useState("");
  const [showAllEnemyDefense, setShowAllEnemyDefense] = useState(false);
  const [enemyDefenseEditing, setEnemyDefenseEditing] = useState(null);
  const [selectedEnemyDefense, setSelectedEnemyDefense] = useState(null);
  const [counterAuthors, setCounterAuthors] = useState(null);
  const [promoting, setPromoting] = useState(null);
  const [promotionMessage, setPromotionMessage] = useState("");
  const promoteTeam = async (team, kind = "enemy") => {
    if (promoting) return;
    setPromoting(team.id);
    setPromotionMessage("");
    try {
      const { data, error } = await supabase.rpc("promote_temporary_attack_team", { team_id: team.id, team_kind: kind });
      if (error) throw error;
      setSelectedEnemyDefense(null);
      await reloadData();
      setPromotionMessage(data?.merged
        ? `공격팀으로 승급했습니다. 기존 카운터덱은 유지하고 ${data.added_count}개의 카운터덱을 추가했습니다.`
        : "공격팀으로 승급했습니다.");
    } catch (error) {
      alert(`승급 실패: ${error.message}`);
    } finally {
      setPromoting(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setCounterAuthors(null);
    if (!selectedEnemyDefense?.id) return;
    supabase.rpc("counter_attribution", { team_id: selectedEnemyDefense.id })
      .then(({ data, error }) => {
        if (!cancelled) setCounterAuthors({
          teamId: selectedEnemyDefense.id,
          error: Boolean(error),
          names: Object.fromEntries((data || []).map((row) => [row.counter_id, row.nickname])),
          edits: Object.fromEntries((data || []).map((row) => [row.counter_id, row.edits || []])),
        });
      });
    return () => { cancelled = true; };
  }, [selectedEnemyDefense, currentUser.authUserId]);

  const enemyTypes = ["전체", ...Array.from(new Set(attackTeams.map((team) => team.enemy_type).filter(Boolean)))];
  const list = attackTeams
    .filter((team) => filter === "전체" || team.enemy_type === filter)
    .filter((team) => isVisibleItem(team, currentUser))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const selectedCounterDecks = selectedEnemyDefense
    ? (() => {
        const parsed = parseCounterDecks(selectedEnemyDefense.counter_decks);
        if (parsed.length > 0) return sortByRecommendation(parsed);
        return [];
      })()
    : [];

  const enemySearchKeyword = enemyHeroSearch.trim();
  const baseEnemyDefenseTeams = currentUser.role === "admin"
    ? enemyDefenseTeams
    : enemyDefenseTeams.filter((team) => isVisibleItem(team, currentUser));

  const searchedDefenseTeams = [...baseEnemyDefenseTeams]
    .filter((team) => {
      if (!enemySearchKeyword) return currentUser.role === "admin" && showAllEnemyDefense;
      return matchesEnemyTeamSearch(team, enemySearchKeyword);
    })
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const deleteEnemyDefenseTeam = async (team) => {
    if (!team?.id) return alert("삭제할 상대 방어팀 ID를 찾지 못했습니다.");

    setEnemyDefenseTeams((prev) => prev.filter((item) => item.id !== team.id));

    const { error } = await supabase.from("enemy_defense_teams").delete().eq("id", team.id);

    if (error) {
      alert(`삭제 실패: ${error.message}`);
      await reloadData();
      return;
    }

    await reloadData();
  };

  const deleteAttackTeam = async (team) => {
    if (!team?.id) return alert("삭제할 공격팀 ID를 찾지 못했습니다.");

    setAttackTeams((prev) => prev.filter((item) => item.id !== team.id));

    const { error } = await supabase.from("attack_teams").delete().eq("id", team.id);

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
        eyebrow={pageEyebrow}
        title={pageTitle}
        desc={pageDescription}
      />

      {temporary && <p className="mb-4 text-sm text-zinc-500">승급하면 공격팀으로 이동합니다. 같은 상대 영웅 구성의 방어팀이 있으면 기존 카운터덱을 유지하고 추가합니다.</p>}
      {promotionMessage && <div role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{promotionMessage}</div>}

      <div className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <div>
            <Input
              label="상대 영웅 검색"
              value={enemyHeroSearch}
              onChange={setEnemyHeroSearch}
              placeholder="예: 윤건 하연 오목 또는 ㅇㄱ ㅎㅇ ㅇㅁ"
            />
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              영웅명·초성을 띄어쓰기나 쉼표로 구분해 입력하세요. 순서와 관계없이 입력한 영웅이 모두 포함된 방어팀을 찾습니다.
            </p>
            <GuildWarRecognition onHeroesChange={(heroes) => { setEnemyHeroSearch(heroes.filter(Boolean).join(", ")); setSelectedEnemyDefense(null); setFilter("전체"); }} />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-zinc-400">
                {currentUser.role === "admin" && !enemyHeroSearch.trim() && showAllEnemyDefense ? "등록된 방어팀" : "검색된 방어팀"}
              </div>
              {currentUser.role === "admin" && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setShowAllEnemyDefense((v) => !v)} variant="secondary" className="px-3 py-1.5 text-xs">
                    {showAllEnemyDefense ? "상대방어팀 일괄보기 닫기" : "상대방어팀 일괄보기"}
                  </Button>
                  <Button
                    onClick={() => setEnemyDefenseEditing({ ...emptyEnemyDefense, sort_order: enemyDefenseTeams.length + 1 })}
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                  >
                    <Plus size={14} /> 상대 방어팀 추가
                  </Button>
                </div>
              )}
            </div>

            {!enemyHeroSearch.trim() && currentUser.role !== "admin" ? null : !enemyHeroSearch.trim() && currentUser.role === "admin" && !showAllEnemyDefense ? null : searchedDefenseTeams.length === 0 ? (
              <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-950">검색된 방어팀이 없습니다.</div>
            ) : (
              <div className="defense-results-grid grid gap-3">
                {searchedDefenseTeams.map((team) => (
                  <div
                    key={team.id}
                    className="defense-result-card min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-300 hover:bg-white"
                  >
                    <button
                      onClick={() => {
                        setSelectedEnemyDefense(team);
                        setFilter(team.title || "전체");
                      }}
                      className="w-full text-left"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-semibold text-zinc-950">{team.title}</div>
                        <div className="flex items-center gap-2">
                          {currentUser.role === "admin" && team.is_public === false && (
                            <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">비공개</span>
                          )}
                          {team.note && (
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-500 ring-1 ring-zinc-200">
                              속공 {team.note}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {splitList(team.heroes).map((hero) => (
                          <span
                            key={hero}
                            className={cx(
                              "rounded-md px-2 py-1 text-[11px] font-medium",
                              searchTokens(enemyHeroSearch).some(token => matchesHeroSearch(hero, token)) ? "bg-zinc-950 text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200"
                            )}
                          >
                            {hero}
                          </span>
                        ))}
                      </div>
                    </button>
                    {currentUser.role === "admin" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {temporary && <Button onClick={() => promoteTeam(team)} disabled={Boolean(promoting)} className="px-3 py-1.5 text-xs">{promoting === team.id ? "승급 중…" : "승급"}</Button>}
                        <Button onClick={() => setEnemyDefenseEditing(team)} variant="secondary" className="px-3 py-1.5 text-xs">
                          <Pencil size={13} /> 수정
                        </Button>
                        <DeleteButton onConfirm={() => deleteEnemyDefenseTeam(team)} className="px-3 py-1.5 text-xs">
                          삭제
                        </DeleteButton>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedEnemyDefense && (
        <div className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-950">Counter Guide</p>
              <h2 className="mt-2 break-keep text-xl font-semibold text-zinc-950 sm:text-2xl">
                {renderRichText(selectedEnemyDefense.title, "")} 카운터치는 법
              </h2>
              <p className="mt-2 text-xs text-zinc-950">
                최근 수정 {formatUpdatedAt(selectedEnemyDefense.updated_at || selectedEnemyDefense.created_at)}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {splitList(selectedEnemyDefense.heroes).map((hero) => (
                  <span key={hero} className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-950">
                    {hero}
                  </span>
                ))}
              </div>
              {selectedEnemyDefense.note && (
                <p className="mt-3 text-sm text-zinc-950">상대 속공: {renderRichText(selectedEnemyDefense.note, "")}</p>
              )}
            </div>
            <Button
              onClick={() => {
                setSelectedEnemyDefense(null);
                setFilter("전체");
              }}
              variant="secondary"
            >
              닫기
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {selectedCounterDecks.length === 0 ? (
              <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-950">등록된 카운터덱이 없습니다.</div>
            ) : (
              selectedCounterDecks.map((deck, deckIndex) => {
                const counterHeroes = splitList(deck.heroes);
                const counterRings = counterRingSlots(deck.rings);
                const counterGears = [deck.gear_1 || "", deck.gear_2 || "", deck.gear_3 || ""];

                return (
                  <div key={deckIndex} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-950">카운터덱 #{deckIndex + 1}</p>
                        <p className="mt-1 text-sm text-zinc-950">
                          작성자: {counterAuthors?.teamId !== selectedEnemyDefense.id ? "불러오는 중…" : counterAuthors.error ? "확인 실패" : counterAuthors.names[deck.counter_id] || "15월"}
                        </p>
                        {counterAuthors?.teamId === selectedEnemyDefense.id && (counterAuthors.edits[deck.counter_id] || []).map((edit, index) => (
                          <p key={edit.id} className="mt-1 text-xs text-zinc-950">수정{index + 1} ({edit.nickname})</p>
                        ))}
                        <h3 className="mt-1 text-lg font-semibold text-zinc-950">
                          {renderRichText(deck.title || `카운터덱 ${deckIndex + 1}`, "")}
                        </h3>
                        <p className="mt-1 text-xs font-semibold text-zinc-950">
                          추천도 <span className="text-zinc-800">{deck.power || "0"}/10</span>
                        </p>
                      </div>
                      <p className="ml-auto max-w-full break-keep text-right text-lg font-semibold leading-relaxed text-zinc-950 sm:max-w-[65%] sm:text-xl">
                        {splitList(selectedEnemyDefense.heroes).join(" ") || selectedEnemyDefense.title || "상대 방어팀"} 카운터치는 법
                      </p>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                      <div>
                        <div className="text-xs font-semibold text-zinc-950">추천 카운터 영웅</div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {counterHeroes.length === 0 ? (
                            <div className="text-sm text-zinc-950">등록된 카운터 영웅이 없습니다.</div>
                          ) : (
                            counterHeroes.map((hero, index) => (
                              <div key={`${hero}-${index}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                                <div className="text-xs font-semibold text-zinc-800">{renderRichText(hero, "")}</div>
                                <div className="mt-1 whitespace-pre-wrap text-[11px] text-zinc-950">반지: {counterRings[index] || "미입력"}</div>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          {counterHeroes.length === 0 ? null : counterHeroes.map((hero, index) => (
                            <div key={`gear-${hero}-${index}`} className="rounded-xl bg-white p-4 text-sm leading-6 text-zinc-950 ring-1 ring-zinc-200">
                              <div className="mb-1 text-xs font-semibold text-zinc-950">{hero} 장비</div>
                              <div className="whitespace-pre-wrap">{renderRichText(counterGears[index], "미입력")}</div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-zinc-950">
                          <span>펫 <b className="ml-1 text-sm font-semibold text-zinc-800">{deck.pet || "미입력"}</b></span>
                          <span>진형 <b className="ml-1 text-sm font-semibold text-zinc-800">{normalizedFormation(deck.formation) || "미입력"}</b></span>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <div className="sm:col-span-3 rounded-xl bg-white p-4 text-sm leading-6 text-zinc-950 ring-1 ring-zinc-200">
                            <div className="mb-1 text-xs font-semibold text-zinc-950">추천 속공순서</div>
                            <CounterOrderDisplay heroes={counterHeroes} value={deck.speed_order} kind="speed" />
                          </div>
                          <div className="rounded-xl bg-white p-4 text-sm leading-6 text-zinc-950 ring-1 ring-zinc-200">
                            <div className="mb-1 text-xs font-semibold text-zinc-950">추천 카운터 팀속공</div>
                            <div className="whitespace-pre-wrap">{renderRichText(deck.team_speed, "미입력")}</div>
                          </div>
                          <div className="sm:col-span-3 rounded-xl bg-white p-4 text-sm leading-6 text-zinc-950 ring-1 ring-zinc-200">
                            <div className="mb-1 text-xs font-semibold text-zinc-950">추천 카운터 스킬순서</div>
                            <CounterOrderDisplay heroes={counterHeroes} value={deck.skill_order} kind="skill" />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl bg-white p-4 text-sm leading-6 text-zinc-950 ring-1 ring-zinc-200 whitespace-pre-wrap">
                        <div className="mb-1 text-xs font-semibold text-zinc-950">그외 참고사항</div>
                        {renderRichText(deck.note, "메모 없음")}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="mb-5 flex max-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1 sm:w-fit">
        {enemyTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={cx(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition",
              filter === type ? "bg-zinc-950 text-white" : "text-zinc-500 hover:text-zinc-950"
            )}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.map((team, index) => (
          <div key={team.id} className="grid overflow-hidden rounded-2xl border border-zinc-200 bg-white xl:grid-cols-[220px_minmax(0,1fr)]">
            <div className="border-b border-zinc-200 bg-zinc-50 p-4 sm:p-5 xl:border-b-0 xl:border-r">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-400">#{team.sort_order || index + 1}</p>
                {currentUser.role === "admin" && team.is_public === false && (
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">비공개</span>
                )}
              </div>
              <h3 className="mt-2 text-xl font-semibold text-zinc-950">{renderRichText(team.title, "")}</h3>
              <p className="mt-1 text-sm text-zinc-500">상대 분류: {renderRichText(team.enemy_type, "")}</p>
              <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-zinc-950">
                <span>추천도 <b className="ml-1 text-zinc-800">{team.power || "0"}/10</b></span>
                <span>펫 <b className="ml-1 text-zinc-800">{team.pet || "미입력"}</b></span>
                <span>진형 <b className="ml-1 text-zinc-800">{team.formation || "미입력"}</b></span>
                <span>최근 수정 <b className="ml-1 text-zinc-700">{formatUpdatedAt(team.updated_at || team.created_at)}</b></span>
              </div>
              {currentUser.role === "admin" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {temporary && <Button onClick={() => promoteTeam(team, "attack")} disabled={Boolean(promoting)}>{promoting === team.id ? "승급 중…" : "승급"}</Button>}
                  <Button onClick={() => setEditing(team)} variant="secondary"><Pencil size={14} /> 수정</Button>
                  <DeleteButton onConfirm={() => deleteAttackTeam(team)}>삭제</DeleteButton>
                </div>
              )}
            </div>

            <div className="grid gap-5 p-4 sm:p-5 2xl:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
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

              <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-950 whitespace-pre-wrap">
                {renderRichText(team.note, "메모 없음")}
              </div>
            </div>
          </div>
        ))}

        {list.length === 0 && <EmptyState text="등록된 공격팀이 없습니다." />}
      </div>

      {editing && (
        <AttackTeamEditor
          item={editing}
          temporary={temporary}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reloadData();
          }}
        />
      )}
      {enemyDefenseEditing && (
        <EnemyDefenseEditor
          item={enemyDefenseEditing}
          temporary={temporary}
          onClose={() => setEnemyDefenseEditing(null)}
          onSaved={async () => {
            setEnemyDefenseEditing(null);
            setSelectedEnemyDefense(null);
            await reloadData();
          }}
        />
      )}
    </PageShell>
  );
}

function EnemyDefenseEditor({ item, onClose, onSaved, temporary = false }) {
  const [form, setForm] = useState({ ...emptyEnemyDefense, is_temporary: temporary, ...item });
  const [counterDecks, setCounterDecks] = useState(() => {
    const parsed = parseCounterDecks(item.counter_decks);
    if (parsed.length > 0) return parsed.map((deck) => ({ ...deck, heroes: splitList(deck.heroes).join("\n") }));

    // 예전 단일 카운터 방식으로 저장된 데이터가 있으면 1개 카운터덱으로 변환
    if (item.counter_heroes || item.counter_rings || item.counter_speed_order || item.counter_team_speed || item.counter_gear_1 || item.counter_note) {
      return [{
        title: "카운터덱 1",
        power: item.counter_power || "",
        heroes: item.counter_heroes || "",
        rings: item.counter_rings || "",
        pet: item.counter_pet || "",
        formation: item.counter_formation || "",
        speed_order: item.counter_speed_order || "",
        team_speed: item.counter_team_speed || "",
        skill_order: item.counter_skill_order || "",
        gear_1: item.counter_gear_1 || "",
        gear_2: item.counter_gear_2 || "",
        gear_3: item.counter_gear_3 || "",
        note: item.counter_note || "",
      }];
    }

    return [{ ...emptyCounterDeck, counter_id: crypto.randomUUID(), title: "카운터덱 1" }];
  });
  const [saving, setSaving] = useState(false);
  const isNew = !item.id;

  const updateDeck = (index, patch) => {
    setCounterDecks((prev) => prev.map((deck, i) => (i === index ? { ...deck, ...patch } : deck)));
  };

  const addDeck = () => {
    setCounterDecks((prev) => [...prev, { ...emptyCounterDeck, counter_id: crypto.randomUUID(), title: `카운터덱 ${prev.length + 1}` }]);
  };

  const removeDeck = (index) => {
    const target = counterDecks[index];
    setCounterDecks((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (counterDecks.some((deck) => splitList(deck.heroes).length > 3)) return alert("카운터 영웅은 한 덱에 최대 3명까지 입력해 주세요.");
    for (const deck of counterDecks) {
      const heroes = splitList(deck.heroes);
      const speed = parseCounterOrder(deck.speed_order, heroes, "speed").steps.filter(Boolean);
      const skills = parseCounterOrder(deck.skill_order, heroes, "skill").steps;
      if (speed.some(hero => !heroes.includes(hero)) || new Set(speed).size !== speed.length || skills.some(step => (step.hero && !heroes.includes(step.hero)) || Boolean(step.hero) !== Boolean(step.skill))) {
        return alert("입력한 카운터 영웅에 맞게 속공·스킬순서를 확인해 주세요. 스킬순서는 영웅과 스킬을 함께 선택해야 합니다.");
      }
    }
    setSaving(true);
    const payload = {
      category: "enemy",
      is_temporary: form.is_temporary === true,
      title: form.title || "",
      heroes: form.heroes || "",
      note: form.note || "",
      counter_decks: stringifyCounterDecks(counterDecks.map((deck) => {
        const original = parseCounterDecks(item.counter_decks).find((old) => old.counter_id === deck.counter_id);
        const heroes = original && JSON.stringify(splitList(original.heroes)) === JSON.stringify(splitList(deck.heroes)) ? original.heroes : deck.heroes;
        return { ...deck, heroes, formation: normalizedFormation(deck.formation) };
      })),
      sort_order: Number(form.sort_order) || 1,
      is_public: form.is_public !== false && form.is_public !== "false",
      updated_at: new Date().toISOString(),
    };

    const { error } = isNew
      ? await supabase.from("enemy_defense_teams").insert(payload)
      : await supabase.from("enemy_defense_teams").update(payload).eq("id", item.id);

    setSaving(false);
    if (error) return alert(`저장 실패: ${error.message}`);
    onSaved();
  };

  const remove = async () => {
    if (!item?.id) return alert("삭제할 상대 방어팀 ID를 찾지 못했습니다.");
    const { error } = await supabase.from("enemy_defense_teams").delete().eq("id", item.id);
    if (error) return alert(`삭제 실패: ${error.message}`);
    onSaved();
  };

  return (
    <Modal title={isNew ? "상대 방어팀 추가" : "상대 방어팀 수정"} onClose={onClose}>
      <div className="grid gap-4">
        <Input label="상대 방어팀" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="예: 여포 방어팀" />
        <TextArea label="상대 영웅" value={form.heroes} onChange={(v) => setForm({ ...form, heroes: v })} placeholder="쉼표 또는 줄바꿈으로 구분" rows={3} />
        <Input label="상대 속공" value={form.note} onChange={(v) => setForm({ ...form, note: v })} placeholder="예: 232" />
        <Select label="공개 상태" value={String(form.is_public !== false)} onChange={(v) => setForm({ ...form, is_public: v === "true" })} options={[["true", "공개"], ["false", "비공개"]]} />

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-950">추천 카운터덱</h3>
              <p className="mt-1 text-xs text-zinc-500">한 상대 방어팀에 카운터덱을 여러 개 등록할 수 있습니다.</p>
            </div>
            <Button onClick={addDeck} variant="secondary" className="px-3 py-2 text-xs"><Plus size={14} /> 카운터덱 추가</Button>
          </div>

          <div className="space-y-4">
            {counterDecks.map((deck, deckIndex) => {
              const counterHeroes = splitList(deck.heroes);
              return (
                <div key={deckIndex} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-zinc-950">카운터덱 #{deckIndex + 1}</h4>
                    {counterDecks.length > 1 && <DeleteButton onConfirm={() => removeDeck(deckIndex)} className="px-3 py-1.5 text-xs">삭제</DeleteButton>}
                  </div>

                  <div className="grid gap-4">
                    <Input label="카운터덱 이름" value={deck.title} onChange={(v) => updateDeck(deckIndex, { title: v })} />
                    <Input label="추천도 / 10점 만점" value={deck.power} onChange={(v) => updateDeck(deckIndex, { power: v })} placeholder="예: 9" />
                    <TextArea label="추천 카운터 영웅 (한 줄에 한 명, 최대 3명)" value={deck.heroes} onChange={(v) => updateDeck(deckIndex, { heroes: v })} placeholder={"카일\n란드그리드\n칼 헤론"} rows={3} />
                    {counterHeroes.length > 3 && <p role="alert" className="text-sm text-red-600">카운터 영웅은 최대 3명까지 입력해 주세요.</p>}
                    <div className="grid gap-4 md:grid-cols-3">
                      {[0, 1, 2].map((heroIndex) => {
                        const hero = counterHeroes[heroIndex] || `${heroIndex + 1}번 영웅`;
                        return <div key={heroIndex} className="min-w-0 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                          <h5 className="text-sm font-semibold text-zinc-950">{hero}</h5>
                          <TextArea label={`${hero} 반지`} value={counterRingSlots(deck.rings)[heroIndex]} onChange={(v) => {
                            const rings = counterRingSlots(deck.rings);
                            rings[heroIndex] = v;
                            updateDeck(deckIndex, { rings: JSON.stringify(rings) });
                          }} rows={2} />
                          <TextArea label={`${hero} 장비세팅`} value={deck[`gear_${heroIndex + 1}`]} onChange={(v) => updateDeck(deckIndex, { [`gear_${heroIndex + 1}`]: v })} rows={4} />
                        </div>;
                      })}
                    </div>
                    <Input label="추천 카운터 펫" value={deck.pet} onChange={(v) => updateDeck(deckIndex, { pet: v })} placeholder="예: 연지" />
                    <FormationField label="추천 카운터 진형" value={deck.formation} onChange={(v) => updateDeck(deckIndex, { formation: v })} />
                    <CounterOrderFields heroes={counterHeroes.slice(0, 3)} value={deck.speed_order} kind="speed" onChange={(v) => updateDeck(deckIndex, { speed_order: v })} />
                    <Input label="추천 카운터 팀속공" value={deck.team_speed} onChange={(v) => updateDeck(deckIndex, { team_speed: v })} />
                    <CounterOrderFields heroes={counterHeroes.slice(0, 3)} value={deck.skill_order} kind="skill" onChange={(v) => updateDeck(deckIndex, { skill_order: v })} />
                    <TextArea label="그외 참고사항" value={deck.note} onChange={(v) => updateDeck(deckIndex, { note: v })} rows={4} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <Button onClick={save}><Save size={16} /> {saving ? "저장 중" : "저장"}</Button>
          {!isNew && <DeleteButton onConfirm={remove}>삭제</DeleteButton>}
        </div>
      </div>
    </Modal>
  );
}

function AttackTeamEditor({ item, onClose, onSaved, temporary = false }) {
  const [form, setForm] = useState({ ...emptyAttackTeam, is_temporary: temporary, ...item, formation: normalizedFormation(item.formation) });
  const [saving, setSaving] = useState(false);
  const isNew = !item.id;

  const save = async () => {
    setSaving(true);
    const payload = {
      enemy_type: form.enemy_type || "",
      is_temporary: form.is_temporary === true,
      title: form.title || "",
      power: form.power || "",
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
      ? await supabase.from("attack_teams").insert(payload)
      : await supabase.from("attack_teams").update(payload).eq("id", item.id);

    setSaving(false);
    if (error) return alert(`저장 실패: ${error.message}`);
    onSaved();
  };

  const remove = async () => {
    if (!item?.id) return alert("삭제할 공격팀 ID를 찾지 못했습니다.");
    const { error } = await supabase.from("attack_teams").delete().eq("id", item.id);
    if (error) return alert(`삭제 실패: ${error.message}`);
    onSaved();
  };

  return (
    <Modal title={isNew ? "공격팀 추가" : "공격팀 수정"} onClose={onClose}>
      <div className="grid gap-4">
        <Input label="상대 방어팀" value={form.enemy_type} onChange={(v) => setForm({ ...form, enemy_type: v })} placeholder="예: 오공덱" />
        <Input label="제목" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="예: 오공덱 상대 공덱" />
        <Input label="추천도 / 10점 만점" value={form.power} onChange={(v) => setForm({ ...form, power: v })} placeholder="예: 9" />
        <TextArea label="공격 영웅명" value={form.heroes} onChange={(v) => setForm({ ...form, heroes: v })} placeholder="쉼표 또는 줄바꿈으로 구분" rows={3} />
        <TextArea label="영웅별 반지" value={form.rings} onChange={(v) => setForm({ ...form, rings: v })} placeholder="영웅 순서에 맞춰 쉼표 또는 줄바꿈으로 입력" rows={3} />
        <TextArea label="영웅별 장비세팅" value={form.gears} onChange={(v) => setForm({ ...form, gears: v })} placeholder="영웅 순서에 맞춰 쉼표 또는 줄바꿈으로 입력" rows={3} />
        <Input label="펫" value={form.pet} onChange={(v) => setForm({ ...form, pet: v })} placeholder="예: 연지" />
        <FormationField value={form.formation} onChange={(v) => setForm({ ...form, formation: v })} />
        <TextArea label="속공순서 추천" value={form.speed_order} onChange={(v) => setForm({ ...form, speed_order: v })} placeholder="예: 여포 → 칼헤론 → 란드그리드" rows={3} />
        <TextArea label="팀속공 추천" value={form.team_speed} onChange={(v) => setForm({ ...form, team_speed: v })} placeholder="예: 팀속공 232 이상" rows={3} />
        <TextArea label="스킬순서" value={form.skill_order} onChange={(v) => setForm({ ...form, skill_order: v })} placeholder="예: 여포1스 파이2스 여포2스" rows={3} />
        <TextArea label="공격 핵심 메모" value={form.note} onChange={(v) => setForm({ ...form, note: v })} rows={4} />
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

function TotalWarPage({ currentUser, totalWarTeams, setTotalWarTeams, reloadData }) {
  if (isGuest(currentUser)) {
    return (
      <PageShell>
        <PageHeader eyebrow="Total War" title="총력전 공략" desc="총력전 추천 조합과 영웅별 반지, 속공등을 정리해둔 페이지입니다." />
        <GuestLockedContent />
      </PageShell>
    );
  }

  const [editing, setEditing] = useState(null);
  const list = [...totalWarTeams]
    .filter((team) => isVisibleItem(team, currentUser))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const deleteTotalWarTeam = async (team) => {
    if (!team?.id) return alert("삭제할 총력전 공략 ID를 찾지 못했습니다.");

    setTotalWarTeams((prev) => prev.filter((item) => item.id !== team.id));

    const { error } = await supabase
      .from("total_war_teams")
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
        eyebrow="Total War"
        title="총력전 공략"
        desc="총력전 추천 조합과 영웅별 반지, 속공등을 정리해둔 페이지입니다."
        action={currentUser.role === "admin" && <Button onClick={() => setEditing({ ...emptyTotalWar, sort_order: list.length + 1 })}><Plus size={16} /> 추가</Button>}
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
                  <DeleteButton onConfirm={() => deleteTotalWarTeam(team)}>삭제</DeleteButton>
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
        {list.length === 0 && <EmptyState text="등록된 총력전 공략이 없습니다." />}
      </div>

      {editing && <TotalWarEditor item={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reloadData(); }} />}
    </PageShell>
  );
}

function TotalWarEditor({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ ...emptyTotalWar, ...item });
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
      ? await supabase.from("total_war_teams").insert(payload)
      : await supabase.from("total_war_teams").update(payload).eq("id", item.id);

    setSaving(false);
    if (error) return alert(`저장 실패: ${error.message}`);
    onSaved();
  };

  const remove = async () => {
    if (!item?.id) return alert("삭제할 총력전 공략 ID를 찾지 못했습니다.");
    const { error } = await supabase.from("total_war_teams").delete().eq("id", item.id);
    if (error) return alert(`삭제 실패: ${error.message}`);
    onSaved();
  };

  return (
    <Modal title={isNew ? "총력전 공략 추가" : "총력전 공략 수정"} onClose={onClose}>
      <div className="grid gap-4">
        <Input label="제목" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="예: 공덱임" />
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
        <Select label="공개 상태" value={String(form.is_public !== false)} onChange={(v) => setForm({ ...form, is_public: v === "true" })} options={[["true", "공개"], ["false", "비공개"]]} />
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

function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3 backdrop-blur-sm sm:p-4"><div className="site-modal max-h-[92dvh] w-full min-w-0 max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="min-w-0 text-xl font-semibold text-zinc-950">{title}</h2><button aria-label="닫기" onClick={onClose} className="shrink-0 rounded-lg bg-zinc-100 p-2 text-zinc-500 hover:text-zinc-950"><X size={18} /></button></div>{children}</div></div>;
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

function DeletedCounterManagement({ reloadData }) {
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(null);
  const [preview, setPreview] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    supabase.from('deleted_counter_records').select('*').is('restored_at', null)
      .order('deleted_at', { ascending: false }).order('id', { ascending: false }).range(page * 50, page * 50 + 49)
      .then(({ data, error: fetchError }) => {
        if (!active) return;
        if (fetchError) setError('삭제 기록을 불러오지 못했습니다.');
        else setRecords(data || []);
        setLoading(false);
      });
    return () => { active = false; };
  }, [page, revision]);
  const restore = async (record) => {
    if (restoring) return;
    setRestoring(record.id); setError('');
    try {
      const { error: restoreError } = await supabase.rpc('restore_deleted_counter', { record_id: record.id });
      if (restoreError) throw restoreError;
      setRecords(items => items.filter(item => item.id !== record.id));
      await reloadData();
    } catch { setError('복원하지 못했습니다. 새로고침 후 다시 시도해 주세요.'); }
    finally { setRestoring(null); }
  };
  return <PageShell>
    <PageHeader eyebrow="Owner" title="삭제정보관리" desc="삭제된 카운터와 팀을 확인하고 복원할 수 있습니다. 사이트 소유자만 이용할 수 있습니다."
      action={<Button variant="secondary" onClick={() => setRevision(value => value + 1)} disabled={loading || Boolean(restoring)}>새로고침</Button>} />
    <p className="mb-4 text-xs text-zinc-500">기능 적용 이후 삭제한 항목부터 보관됩니다. 복원은 기존 내용을 유지하며, 카운터 작성 횟수를 추가하지 않습니다.</p>
    {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
    {loading ? <p className="p-5 text-sm text-zinc-500">삭제 기록 불러오는 중…</p> : <div className="space-y-3">
      {records.map(record => {
        const team = record.payload?.team || {};
        const counter = record.payload?.counter;
        return <article key={record.id} className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-zinc-500">{record.kind === 'counter' ? '카운터 삭제' : record.kind === 'enemy_team' ? '상대 방어팀 삭제' : '공격팀 삭제'} · {record.deleted_by_name || '알 수 없음'} · {formatUpdatedAt(record.deleted_at)}</p>
              <h2 className="mt-2 text-lg font-semibold text-zinc-950">{renderRichText(counter?.title || team.title || '제목 없음')}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{renderRichText(counter?.heroes || team.heroes || '영웅 정보 없음')}</p>
              {counter && <p className="mt-1 text-xs text-zinc-500">상대 방어팀: {team.title || team.heroes || '제목 없음'}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPreview(record)}>내용 보기</Button>
              <Button disabled={Boolean(restoring)} onClick={() => restore(record)}>{restoring === record.id ? '복원 중…' : '복원'}</Button>
            </div>
          </div>
        </article>;
      })}
      {!records.length && !error && <EmptyState text="복원할 삭제 기록이 없습니다." />}
    </div>}
    <div className="mt-4 flex items-center justify-center gap-3">
      <Button variant="secondary" disabled={page === 0 || loading || Boolean(restoring)} onClick={() => setPage(value => value - 1)}>이전</Button>
      <span className="text-sm text-zinc-500">{page + 1}페이지</span>
      <Button variant="secondary" disabled={records.length < 50 || loading || Boolean(restoring)} onClick={() => setPage(value => value + 1)}>다음</Button>
    </div>
    {preview && <Modal title="삭제된 내용" onClose={() => setPreview(null)}>
      <div className="space-y-4 text-sm text-zinc-700">
        <p>상대 / 팀: {renderRichText(preview.payload?.team?.title || preview.payload?.team?.heroes || '제목 없음')}</p>
        {(preview.kind === 'counter' ? [preview.payload.counter] : preview.kind === 'enemy_team' ? parseCounterDecks(preview.payload?.team?.counter_decks) : [preview.payload.team]).map((deck, index) => <div key={index} className="rounded-xl bg-zinc-50 p-4">
          <h3 className="mb-2 font-semibold">{renderRichText(deck.title || `카운터 ${index + 1}`)}</h3>
          {Object.entries({영웅:deck.heroes,장비:deck.gears,반지:String(deck.rings || "").startsWith("[") ? counterRingSlots(deck.rings).map((ring,i) => ring ? `${splitList(deck.heroes)[i] || (i + 1) + "번 영웅"}: ${ring}` : "").filter(Boolean).join("\n") : deck.rings,펫:deck.pet,진형:deck.formation,속공순서:describeCounterOrder(deck.speed_order,splitList(deck.heroes),"speed"),팀속공:deck.team_speed,스킬순서:describeCounterOrder(deck.skill_order,splitList(deck.heroes),"skill"),'영웅 1 장비':deck.gear_1,'영웅 2 장비':deck.gear_2,'영웅 3 장비':deck.gear_3,메모:deck.note}).filter(([,value]) => value).map(([label,value]) => <p key={label} className="mt-2 whitespace-pre-wrap"><b>{label}: </b>{renderRichText(value)}</p>)}
        </div>)}
      </div>
    </Modal>}
  </PageShell>;
}

function MemberManagementPage({ users, setUsers, currentUser, setCurrentUser, reloadData }) {
  const [selectedGuild, setSelectedGuild] = useState(null);
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
  const pending = users.filter((u) => u.status === "pending" && !isHiddenUserId(u.id));
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
    if (!canEditMemo && Object.prototype.hasOwnProperty.call(patch, 'memo')) return alert('관리자 메모는 사이트 소유자만 수정할 수 있습니다.');
    if (!canEditMemo && user.role === 'admin' && ((patch.role && patch.role !== user.role) || (patch.status && patch.status !== user.status))) return alert('관리자 권한은 사이트 소유자만 변경할 수 있습니다.');

    const isOwner = isSuperAdminId(user.id);

    if (isOwner && (patch.status === "blocked" || patch.status === "rejected")) {
      return alert("최고 관리자 계정은 차단하거나 거절할 수 없습니다.");
    }

    const dbPatch = {};
    if (patch.status) dbPatch.status = patch.status;
    if (patch.role) dbPatch.role = patch.role;
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
      <p className="mb-4 text-xs text-zinc-500">이번주 카운터 작성 횟수: 한국시간 월요일 00:00부터 새로 등록한 덱 수입니다. 기능 적용 이후부터 집계하며, 수정·재저장은 제외합니다.</p>
      {statsError && <p role="alert" className="mb-4 text-sm text-red-600">{statsError}</p>}

      <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-950">그룹별 인원</h2>
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

      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950">가입 승인 대기</h2>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-700">{pending.length}건</span>
        </div>
        <MemberTable currentUser={currentUser} weeklyCounts={weeklyCounts} list={pending} pending updateUser={updateUser} deleteUser={deleteUser} />
      </section>

      <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-zinc-950">전체 회원</h2>
        <MemberTable currentUser={currentUser} weeklyCounts={weeklyCounts} list={members} updateUser={updateUser} deleteUser={deleteUser} />
      </section>
    </PageShell>
  );
}

function MemberTable({ list, pending, updateUser, deleteUser, currentUser, weeklyCounts }) {
  return (
    <div className="member-table-region mt-4">
      <table className="member-table w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs font-semibold uppercase text-zinc-400">
            <th className="px-3 py-3">게임 닉네임</th>
            <th className="px-3 py-3">아이디</th>
            <th className="px-3 py-3">상태</th>
            <th className="px-3 py-3">등급</th>
            <th className="px-3 py-3">마지막 접속</th>
            <th className="px-3 py-3">이번주 카운터 작성 횟수</th>
            <th className="px-3 py-3">관리자 메모</th>
            <th className="px-3 py-3 text-right">관리</th>
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
  const protectedAdmin = u.isOwner || isSuperAdminId(u.id) || (!canEditMemo && u.role === "admin");
  const [memo, setMemo] = useState(u.memo || "");
  useEffect(() => setMemo(u.memo || ""), [u.memo]);

  const saveMemo = () => {
    updateUser(u, { memo });
  };

  return (
    <tr className="border-b border-zinc-100 align-top">
      <td data-label="게임 닉네임" className="px-3 py-4 font-semibold text-zinc-950">{u.gameNickname}</td>
      <td data-label="아이디" className="px-3 py-4 text-zinc-600">{u.id}</td>
      <td data-label="상태" className="px-3 py-4"><StatusBadge status={u.status} /></td>
      <td data-label="등급" className="px-3 py-4"><RoleBadge role={u.role} /></td>
      <td data-label="마지막 접속" className="px-3 py-4 text-xs text-zinc-500">{formatLastSeen(u.lastSeenAt)}</td>
      <td data-label="이번주 카운터 작성 횟수" className="px-3 py-4 font-semibold text-zinc-950">{weeklyCount === null ? "—" : `${weeklyCount}회`}</td>
      <td data-label="관리자 메모" className="px-3 py-4">
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
      <td data-label="관리" className="px-3 py-4">
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
                value={u.role}
                onChange={(e) => updateUser(u, { role: e.target.value, status: "approved" })}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 outline-none focus:ring-4 focus:ring-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="guest">게스트</option>
                <option value="member">일반회원</option>
                <option value="admin">관리자</option>
              </select>
              {!protectedAdmin && <DeleteButton onConfirm={() => deleteUser(u)}>삭제</DeleteButton>}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }) {
  const style = { pending: "bg-amber-50 text-amber-700 ring-amber-200", approved: "bg-emerald-50 text-emerald-700 ring-emerald-200", rejected: "bg-zinc-100 text-zinc-600 ring-zinc-200", blocked: "bg-red-50 text-red-700 ring-red-200" }[status] || "bg-zinc-100 text-zinc-600 ring-zinc-200";
  return <span className={cx("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1", style)}>{statusLabel(status)}</span>;
}
function RoleBadge({ role }) { return <span className={cx("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1", role === "admin" ? "bg-zinc-950 text-white ring-zinc-950" : "bg-white text-zinc-600 ring-zinc-200")}>{roleLabel(role)}</span>; }
function EmptyState({ text }) { return <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-400">{text}</div>; }
function PlaceholderPage({ title, desc }) { return <PageShell><PageHeader eyebrow="Coming Soon" title={title} desc={desc} /><EmptyState text="여기는 다음 단계에서 내용을 추가하면 됩니다." /></PageShell>; }

export default function App() {
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(FALLBACK_SETTINGS);
  const [defenseTeams, setDefenseTeams] = useState([]);
  const [enemyDefenseTeams, setEnemyDefenseTeams] = useState([]);
  const [attackTeams, setAttackTeams] = useState([]);
  const [notices, setNotices] = useState([]);
  const [totalWarTeams, setTotalWarTeams] = useState([]);
  const [arenaTeams, setArenaTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [active, setActive] = useState("attack");
  const [menuOpen, setMenuOpen] = useState(false);

  const [authUserId, setAuthUserId] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const loadVersion = useRef(0);

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
      setUsers([]); setCurrentUser(null);
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
      const results = await Promise.all([
        profile.role === 'admin' ? supabase.from('profiles').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [profileRes.data] }),
        supabase.from('defense_teams').select('*').order('sort_order'),
        supabase.from('enemy_defense_teams').select('*').order('sort_order').range(0, 5000),
        supabase.from('attack_teams').select('*').order('sort_order'),
        supabase.from('notices').select('*').order('created_at', { ascending: false }),
        supabase.from('total_war_teams').select('*').order('sort_order'),
        supabase.from('arena_teams').select('*').order('sort_order'),
      ]);
      if (version !== loadVersion.current) return;
      const failed = results.find(result => result.error);
      if (failed) throw failed.error;
      setUsers((results[0].data || []).map(mapProfile));
      [setDefenseTeams,setEnemyDefenseTeams,setAttackTeams,setNotices,setTotalWarTeams,setArenaTeams]
        .forEach((setter,index) => setter(results[index+1].data || []));
    } catch {
      if (version === loadVersion.current) setLoadError('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally { if (version === loadVersion.current) setLoading(false); }
  }, [authReady, authUserId]);

  useEffect(() => { loadData(); }, [loadData]);
  const syncedCurrentUser = currentUser;
  const logout = async () => {
    loadVersion.current += 1;
    setCurrentUser(null); setUsers([]); setActive('dashboard');
    await supabase.auth.signOut({ scope: 'local' });
  };

  if (!authReady || loading) return <div className="grid min-h-screen place-items-center bg-[#0d0f12] text-zinc-400">데이터 불러오는 중…</div>;
  if (loadError) return <div className="grid min-h-screen place-items-center bg-[#0d0f12] p-5 text-white"><div><p role="alert">{loadError}</p><button onClick={loadData} className="mr-5 mt-5">다시 시도</button><button onClick={logout}>로그아웃</button></div></div>;
  if (!syncedCurrentUser) return <SecureAuth settings={settings} />;
  if (syncedCurrentUser.status === 'pending') return <PendingScreen user={syncedCurrentUser} logout={logout} settings={settings} />;
  if (syncedCurrentUser.status !== 'approved') return <div className="grid min-h-screen place-items-center"><div>이 계정은 이용할 수 없습니다.<button onClick={logout} className="ml-4">로그아웃</button></div></div>;
  if (syncedCurrentUser.mustChangePassword) return <PasswordChange required={syncedCurrentUser.mustChangePassword} onDone={logout} onLogout={logout} />;

  const safeActive = navItems.find((item) => item.id === active && item.visibleTo.includes(syncedCurrentUser.role) && (!item.ownerOnly || syncedCurrentUser.isOwner)) ? active : "attack";

  return (
    <div className="site-theme min-h-screen bg-[#f6f7f9] font-sans text-zinc-950">
      <style>{"@keyframes snowSway{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}.snow-sway-icon{animation:snowSway 3.8s ease-in-out infinite;transform-origin:center}"}</style>
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      )}

      <Sidebar
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

        {safeActive === "board" && <GuildBoardPage key={syncedCurrentUser.id} currentUser={syncedCurrentUser} users={users} />}

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
      </main>
    </div>
  );
}
