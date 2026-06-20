import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
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

const SUPABASE_URL = "https://kqygrszkbuzxmmfndhye.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxeWdyc3prYnV6eG1tZm5kaHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MjI2OTUsImV4cCI6MjA5NzQ5ODY5NX0.SDIjG-rrBt4apIxTYT-qg9vyJuVgzN9uxiwpQ_QkOLs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const OWNER_ID = "15month";
const SESSION_KEY = "seori_guild_current_user_id";

const FALLBACK_SETTINGS = {
  guild_name: "15월",
  site_title: "세븐나이츠 리버스 운명길드 길드전 공략 사이트",
  main_subtitle: "방어팀 배치와 방어팀별 공격법을 정리한 길드 전용 공략 센터입니다.",
  hero_notice: "승인된 길드원만 열람할 수 있습니다.",
  footer_text: "made by 15월",
  quick_notice: "",
  attack_guide_title: "공격잘가는법 내용",
  attack_guide_text: "",
  attack_guide_items: "",
  dashboard_banner_title: "길드전 준비 현황",
  dashboard_banner_body: "방어팀을 확인하고, 상대 조합에 맞는 공격법을 선택하세요.",
};

const navItems = [
  { id: "dashboard", label: "메인", icon: BarChart3, visibleTo: ["guest", "member", "admin"] },
  { id: "attackTips", label: "공격잘가는법", icon: ScrollText, visibleTo: ["guest", "member", "admin"] },
  { id: "defense", label: "방어팀", icon: Shield, visibleTo: ["guest", "member", "admin"] },
  { id: "attack", label: "공격팀", icon: Swords, visibleTo: ["guest", "member", "admin"] },
  { id: "total", label: "총력전 공략", icon: ScrollText, visibleTo: ["guest", "member", "admin"] },
  { id: "arena", label: "결투장 공략", icon: Swords, visibleTo: ["guest", "member", "admin"] },
  { id: "notices", label: "공지", icon: ScrollText, visibleTo: ["guest", "member", "admin"] },
  { id: "content", label: "콘텐츠 문구 관리", icon: Pencil, visibleTo: ["admin"] },
  { id: "backup", label: "백업", icon: Save, visibleTo: ["admin"] },
  { id: "members", label: "회원 관리", icon: Users, visibleTo: ["admin"] },
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

function parseCounterDecks(value) {
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

function renderRichText(value, fallback = "미입력") {
  const text = value === undefined || value === null || value === "" ? fallback : String(value);
  const regex = new RegExp("[(](노|굵|빨글)[)]", "g");
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

    if (!className) return <React.Fragment key={index}>{part.text}</React.Fragment>;
    return <span key={index} className={className}>{part.text}</span>;
  });
}

function getKoreanInitials(value) {
  const initials = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
  return String(value || "")
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0) - 44032;
      if (code < 0 || code > 11171) return char;
      return initials[Math.floor(code / 588)];
    })
    .join("");
}

function matchesHeroSearch(hero, query) {
  const keyword = String(query || "").trim().toLowerCase();
  if (!keyword) return false;
  const heroText = String(hero || "").toLowerCase();
  const heroInitials = getKoreanInitials(hero).toLowerCase();
  return heroText.includes(keyword) || heroInitials.includes(keyword);
}

function mapProfile(row) {
  return {
    dbId: row.id,
    id: row.user_id,
    password: row.password,
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

async function updateLastSeen(user, setUsers, setCurrentUser) {
  if (!user?.id) return;
  const now = new Date().toISOString();
  const activeUser = { ...user, lastSeenAt: now };

  // 로그인은 먼저 바로 처리하고, 마지막 접속 기록은 뒤에서 저장
  setUsers?.((prev) => prev.map((u) => (u.id === user.id ? { ...u, lastSeenAt: now } : u)));
  setCurrentUser?.(activeUser);

  try {
    await supabase.from("profiles").update({ last_seen_at: now }).eq("user_id", user.id);
  } catch {
    // 마지막 접속 기록 저장 실패가 로그인 자체를 막지 않게 처리
  }
}

function roleLabel(role) {
  return { guest: "게스트", member: "일반회원", admin: "관리자" }[role] || role;
}

async function upsertSetting(key, value) {
  return supabase.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

function PageShell({ children }) {
  return <div className="min-h-screen bg-[#f6f7f9] px-4 py-5 sm:px-5 sm:py-6 md:px-8 md:py-9">{children}</div>;
}

function PageHeader({ eyebrow, title, desc, action }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
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
    <button disabled={disabled} onClick={onClick} className={cx("inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", styles[variant], className)}>
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
        onChange={(e) => onChange(e.target.value)}
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
        onChange={(e) => onChange(e.target.value)}
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

function AuthScreen({ users, setUsers, setCurrentUser, settings }) {
  const [mode, setMode] = useState("login");
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [gameNickname, setGameNickname] = useState("");
  const [signupId, setSignupId] = useState("");
  const [signupPw, setSignupPw] = useState("");
  const [signupPw2, setSignupPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetAlerts = () => { setMessage(""); setError(""); };

  const login = () => {
    resetAlerts();
    const user = users.find((u) => u.id === loginId.trim() && u.password === loginPw);
    if (!user) return setError("아이디 또는 비밀번호가 일치하지 않습니다.");
    if (user.status === "rejected") return setError("가입 신청이 거절된 계정입니다.");
    if (user.status === "blocked") return setError("차단된 계정입니다. 관리자에게 문의하세요.");
    .setItem(SESSION_KEY, user.id);localStorage
    updateLastSeen(user, setUsers, setCurrentUser);
  };

  const signup = async () => {
    resetAlerts();
    const nickname = gameNickname.trim();
    const id = signupId.trim();
    if (!nickname || !id || !signupPw || !signupPw2) return setError("게임 닉네임, 아이디, 비밀번호를 모두 입력해주세요.");
    if (id.length < 4) return setError("아이디는 4글자 이상으로 입력해주세요.");
    if (signupPw.length < 4) return setError("비밀번호는 4글자 이상으로 입력해주세요.");
    if (signupPw !== signupPw2) return setError("비밀번호 확인이 일치하지 않습니다.");
    if (users.some((u) => u.id === id)) return setError("이미 사용 중인 아이디입니다.");
    if (users.some((u) => u.gameNickname === nickname && u.status !== "rejected")) return setError("이미 신청된 게임 닉네임입니다.");

    setSubmitting(true);
    const { data, error: insertError } = await supabase
      .from("profiles")
      .insert({ user_id: id, password: signupPw, game_nickname: nickname, role: "member", status: "pending" })
      .select()
      .single();
    setSubmitting(false);

    if (insertError) return setError(`가입 신청 저장 실패: ${insertError.message}`);
    setUsers((prev) => [mapProfile(data), ...prev]);
    setMessage("가입 신청이 완료되었습니다. 관리자 승인 후 이용할 수 있습니다.");
    setMode("login");
    setLoginId(id);
    setLoginPw("");
    setGameNickname("");
    setSignupId("");
    setSignupPw("");
    setSignupPw2("");
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-7 px-4 py-7 sm:px-5 sm:py-10 lg:grid-cols-[1fr_420px]">
        <section className="relative min-h-[420px]">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-zinc-950">
              <Snowflake size={26} strokeWidth={2.4} className="snow-sway-icon" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{renderRichText(settings.guild_name, "")}</p>
              
            </div>
          </div>
          <p className="text-sm font-medium text-zinc-500">made by 15월</p>
          <h1 className="mt-4 max-w-4xl break-keep text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl md:text-6xl">{renderRichText(settings.site_title, "")}</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-zinc-400">{renderRichText(settings.main_subtitle, "")}</p>
          
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/30 sm:p-5">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-black/30 p-1">
            <button onClick={() => { setMode("login"); resetAlerts(); }} className={cx("rounded-lg py-2.5 text-sm font-semibold transition", mode === "login" ? "bg-white text-zinc-950" : "text-zinc-500 hover:text-white")}>로그인</button>
            <button onClick={() => { setMode("signup"); resetAlerts(); }} className={cx("rounded-lg py-2.5 text-sm font-semibold transition", mode === "signup" ? "bg-white text-zinc-950" : "text-zinc-500 hover:text-white")}>회원가입</button>
          </div>

          {mode === "login" ? (
            <div className="space-y-4">
              <Input label="아이디" value={loginId} onChange={setLoginId} placeholder="아이디" dark />
              <div>
                <label className="text-xs font-semibold text-zinc-300">비밀번호</label>
                <div className="relative mt-2">
                  <input type={showPw ? "text" : "password"} value={loginPw} onChange={(e) => setLoginPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} placeholder="비밀번호" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-4 focus:ring-white/10" />
                  <button onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>
              <Button onClick={login} className="w-full">로그인 <ChevronRight size={17} /></Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input label="게임 닉네임" value={gameNickname} onChange={setGameNickname} placeholder="예: 15월" dark />
              <Input label="아이디" value={signupId} onChange={setSignupId} placeholder="로그인 아이디" dark />
              <Input label="비밀번호" type="password" value={signupPw} onChange={setSignupPw} placeholder="비밀번호" dark />
              <Input label="비밀번호 확인" type="password" value={signupPw2} onChange={setSignupPw2} placeholder="한 번 더 입력" dark onEnter={signup} />
              <Button disabled={submitting} onClick={signup} className="w-full"><UserPlus size={17} /> {submitting ? "신청 중" : "가입 신청"}</Button>
            </div>
          )}

          {message && <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
          {error && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
          <p className="mt-5 text-center text-xs text-zinc-600">{renderRichText(settings.footer_text, "")}</p>
        </section>
      </div>
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
  const availableNav = navItems.filter((item) => item.visibleTo.includes(currentUser.role));
  return (
    <aside className={cx("fixed inset-y-0 left-0 z-40 w-64 border-r border-zinc-200 bg-white transition-transform duration-300 lg:translate-x-0", isOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex h-full flex-col">
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
          </div>
          <Button onClick={logout} variant="secondary" className="mt-3 w-full"><LogOut size={16} /> 로그아웃</Button>
        </div>
      </div>
    </aside>
  );
}

function MobileHeader({ setIsOpen, currentUser, settings }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-3 py-3 backdrop-blur sm:px-4 lg:hidden">
      <div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-950 text-white">
              <Snowflake size={24} strokeWidth={2.4} className="snow-sway-icon" />
            </div><div><div className="text-sm font-semibold">{renderRichText(settings.guild_name, "")}</div><div className="text-[11px] text-zinc-500">{currentUser.gameNickname}</div></div></div>
      <button onClick={() => setIsOpen(true)} className="rounded-lg border border-zinc-200 bg-white p-2"><Menu size={20} /></button>
    </header>
  );
}

function Dashboard({ setActive, currentUser, users, settings, setSettings }) {
  const guestMode = isGuest(currentUser);
  const pendingCount = users.filter((u) => u.status === "pending").length;
  const approvedCount = users.filter((u) => u.status === "approved").length;
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
        <div className="grid gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
          <div className="max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">{renderRichText(settings.footer_text, "")}</p>
          <h1 className="mt-4 max-w-5xl break-keep text-3xl font-semibold leading-tight tracking-[-0.04em] text-zinc-950 sm:text-4xl md:text-6xl">{renderRichText(settings.site_title, "")}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-500">어서오세요, <b className="font-semibold text-zinc-950">{currentUser.gameNickname}</b>님. 길드전 방어팀 배치와 공격 족보를 확인하는 길드전 공략 사이트 입니다.</p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            <Button onClick={() => setActive("attackTips")}>공격잘가는법 <ChevronRight size={16} /></Button>
            <Button onClick={() => setActive("defense")}>방어팀 보기 <ChevronRight size={16} /></Button>
            <Button onClick={() => setActive("attack")}>공격팀 보기 <ChevronRight size={16} /></Button>
            <Button onClick={() => setActive("total")}>총력전 공략 보기 <ChevronRight size={16} /></Button>
            <Button onClick={() => setActive("arena")}>결투장 공략 보기 <ChevronRight size={16} /></Button>
            <Button onClick={() => setActive("notices")}>공지 보기 <ChevronRight size={16} /></Button>
            {currentUser.role === "admin" && <Button onClick={() => setActive("members")} variant="secondary">가입 승인 {pendingCount}건</Button>}
          </div>
          <div className="mt-3 w-fit rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-500 shadow-sm">
            문의사항은 인게임 채팅 또는 카카오톡으로 15월한테 전달해주세요.
          </div>
          </div>

          {!guestMode && (currentUser.id === OWNER_ID || settings.quick_notice) && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
              <div className="text-xs font-semibold text-zinc-400">중요 공지</div>
              {currentUser.id === OWNER_ID ? (
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
          <FeatureCard title="공격잘가는법" desc="길드전 공격 전 기본 운영법과 주의사항을 확인하세요." icon={ScrollText} onClick={() => setActive("attackTips")} />
          <FeatureCard title="방어팀" desc="공덱/방덱/마덱 추천 방어팀 구성을 확인하세요." icon={Shield} onClick={() => setActive("defense")} />
          <FeatureCard title="공격팀" desc="상대 유형별 족보와 주의사항을 확인하세요." icon={Swords} onClick={() => setActive("attack")} />
          <FeatureCard title="총력전 공략" desc="총력전 추천 조합과 속공 기준을 확인하세요." icon={ScrollText} onClick={() => setActive("total")} />
          <FeatureCard title="결투장 공략" desc="결투장 추천 조합과 장비세팅을 확인하세요." icon={Swords} onClick={() => setActive("arena")} />
          <FeatureCard title="공지" desc="길드전 관련 공지와 변경사항을 확인하세요." icon={ScrollText} onClick={() => setActive("notices")} />
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
        <PageHeader eyebrow="Attack Guide" title="공격잘가는법" desc="길드전 공격 전에 확인할 기본 운영법과 주의사항을 정리하는 페이지입니다." />
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
        desc="길드전 공격 전에 확인할 기본 운영법과 주의사항을 정리하는 페이지입니다."
        action={currentUser.role === "admin" && <div className="flex flex-wrap gap-2"><Button onClick={addItem} variant="secondary"><Plus size={16} /> 추가</Button><Button onClick={save}><Save size={16} /> {saving ? "저장 중" : "저장"}</Button></div>}
      />

      {currentUser.role === "admin" ? (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
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
          <div key={team.id} className="grid overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:grid-cols-[220px_1fr]">
            <div className="border-b border-zinc-200 bg-zinc-50 p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-400">#{team.sort_order || index + 1}</p>
                {currentUser.role === "admin" && team.is_public === false && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">비공개</span>}
              </div>
              <h3 className="mt-2 text-xl font-semibold text-zinc-950">{renderRichText(team.title, "")}</h3>
              {team.subtitle && <p className="mt-1 text-sm text-zinc-500">{renderRichText(team.subtitle, "")}</p>}
              {currentUser.role === "admin" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => setEditing(team)} variant="secondary"><Pencil size={14} /> 수정</Button>
                  <DeleteButton onConfirm={() => deleteDefenseTeam(team)}>삭제</DeleteButton>
                </div>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-zinc-400">
                <span>추천도 <b className="ml-1 text-zinc-800">{team.power || "0"}/10</b></span>
                <span>펫 <b className="ml-1 text-zinc-800">{team.pet || "미입력"}</b></span>
                <span>진형 <b className="ml-1 text-zinc-800">{team.formation || "미입력"}</b></span>
                <span>최근 수정 <b className="ml-1 text-zinc-700">{formatUpdatedAt(team.updated_at || team.created_at)}</b></span>
              </div>
            </div>
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_220px] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3"><span className="text-xs font-semibold text-zinc-400">영웅 구성</span></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {splitList(team.heroes).map((hero, heroIndex) => {
                    const ring = splitList(team.rings)[heroIndex];
                    const gear = splitList(team.gears)[heroIndex];
                    return (
                      <div key={`${hero}-${heroIndex}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                        <div className="text-xs font-semibold text-zinc-800">{renderRichText(hero, "")}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">반지: {renderRichText(ring, "미입력")}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">장비: {renderRichText(gear, "미입력")}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">속공순서 추천</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.speed_order, "미입력")}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">팀속공 추천</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.team_speed, "미입력")}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">스킬순서</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.skill_order, "미입력")}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">{renderRichText(team.note, "메모 없음")}</div>
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
        <div className="flex justify-between gap-2">
          <Button onClick={save}><Save size={16} /> {saving ? "저장 중" : "저장"}</Button>
          {!isNew && <DeleteButton onConfirm={remove}>삭제</DeleteButton>}
        </div>
      </div>
    </Modal>
  );
}

function AttackPage({ currentUser, attackTeams, setAttackTeams, enemyDefenseTeams, setEnemyDefenseTeams, reloadData }) {
  if (isGuest(currentUser)) {
    return (
      <PageShell>
        <PageHeader eyebrow="Attack Team" title="공격팀" desc="상대 방어팀별 공격 조합과 속공 기준을 정리하는 페이지입니다." />
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

  const enemyTypes = ["전체", ...Array.from(new Set(attackTeams.map((team) => team.enemy_type).filter(Boolean)))];
  const list = attackTeams
    .filter((team) => filter === "전체" || team.enemy_type === filter)
    .filter((team) => isVisibleItem(team, currentUser))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const selectedCounterDecks = selectedEnemyDefense
    ? (() => {
        const parsed = parseCounterDecks(selectedEnemyDefense.counter_decks);
        if (parsed.length > 0) return parsed;

        // 이전 단일 카운터 방식으로 저장된 데이터도 화면에 표시되게 변환
        if (
          selectedEnemyDefense.counter_heroes ||
          selectedEnemyDefense.counter_rings ||
          selectedEnemyDefense.counter_speed_order ||
          selectedEnemyDefense.counter_team_speed ||
          selectedEnemyDefense.counter_gear_1 ||
          selectedEnemyDefense.counter_gear_2 ||
          selectedEnemyDefense.counter_gear_3 ||
          selectedEnemyDefense.counter_note
        ) {
          return [
            {
              title: "카운터덱 1",
              power: selectedEnemyDefense.counter_power || "",
              heroes: selectedEnemyDefense.counter_heroes || "",
              rings: selectedEnemyDefense.counter_rings || "",
              formation: selectedEnemyDefense.counter_formation || "",
              speed_order: selectedEnemyDefense.counter_speed_order || "",
              team_speed: selectedEnemyDefense.counter_team_speed || "",
              skill_order: selectedEnemyDefense.counter_skill_order || "",
              gear_1: selectedEnemyDefense.counter_gear_1 || "",
              gear_2: selectedEnemyDefense.counter_gear_2 || "",
              gear_3: selectedEnemyDefense.counter_gear_3 || "",
              note: selectedEnemyDefense.counter_note || "",
            },
          ];
        }

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
      const titleMatch = String(team.title || "").toLowerCase().includes(enemySearchKeyword.toLowerCase());
      const titleInitialMatch = getKoreanInitials(team.title || "").toLowerCase().includes(enemySearchKeyword.toLowerCase());
      const heroMatch = splitList(team.heroes).some((hero) => matchesHeroSearch(hero, enemySearchKeyword));
      return titleMatch || titleInitialMatch || heroMatch;
    })
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const deleteEnemyDefenseTeam = async (team) => {
    if (!team?.id) return alert("삭제할 상대 방어팀 ID를 찾지 못했습니다.");

    setEnemyDefenseTeams((prev) => prev.filter((item) => item.id !== team.id));

    const { error } = await supabase
      .from("enemy_defense_teams")
      .delete()
      .eq("id", team.id);

    if (error) {
      alert(`삭제 실패: ${error.message}`);
      await reloadData();
      return;
    }

    await reloadData();
  };

  const defenseCategoryLabel = (category) => ({ attack: "공덱", tank: "방덱", magic: "마덱" }[category] || category || "미분류");

  const deleteAttackTeam = async (team) => {
    if (!team?.id) return alert("삭제할 공격팀 ID를 찾지 못했습니다.");

    setAttackTeams((prev) => prev.filter((item) => item.id !== team.id));

    const { error } = await supabase
      .from("attack_teams")
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
        eyebrow="Attack Team"
        title="공격팀"
        desc="상대 방어팀별 공격 조합과 속공 기준을 정리하는 페이지입니다."
      />

      <div className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
          <div>
            <Input
              label="상대 영웅 검색"
              value={enemyHeroSearch}
              onChange={setEnemyHeroSearch}
              placeholder="예: 여포 또는 ㅇㅍ"
            />
            <p className="mt-2 text-xs leading-5 text-zinc-400">상대 방어팀에 들어간 영웅명이나 초성을 검색하면 해당 영웅이 포함된 방어팀 목록이 나옵니다.</p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-zinc-400">{currentUser.role === "admin" && !enemyHeroSearch.trim() && showAllEnemyDefense ? "등록된 방어팀" : "검색된 방어팀"}</div>
              {currentUser.role === "admin" && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setShowAllEnemyDefense((v) => !v)} variant="secondary" className="px-3 py-1.5 text-xs">
                    {showAllEnemyDefense ? "상대방어팀 일괄보기 닫기" : "상대방어팀 일괄보기"}
                  </Button>
                  <Button onClick={() => setEnemyDefenseEditing({ ...emptyEnemyDefense, sort_order: enemyDefenseTeams.length + 1 })} variant="secondary" className="px-3 py-1.5 text-xs">
                    <Plus size={14} /> 상대 방어팀 추가
                  </Button>
                </div>
              )}
            </div>
            {!enemyHeroSearch.trim() && currentUser.role !== "admin" ? null : !enemyHeroSearch.trim() && currentUser.role === "admin" && !showAllEnemyDefense ? null : searchedDefenseTeams.length === 0 ? (
              <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-400">검색된 방어팀이 없습니다.</div>
            ) : (
              <div className="grid gap-2 lg:grid-cols-2">
                {searchedDefenseTeams.map((team) => (
                  <div
                    key={team.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-300 hover:bg-white"
                  >
                    <button onClick={() => { setSelectedEnemyDefense(team); setFilter(team.title); }} className="w-full text-left">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-zinc-950">{team.title}</div>
                        <div className="flex items-center gap-2">
                          {currentUser.role === "admin" && team.is_public === false && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">비공개</span>}
                          {team.note && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-zinc-500 ring-1 ring-zinc-200">속공 {team.note}</span>}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {splitList(team.heroes).map((hero) => (
                          <span key={hero} className={cx("rounded-md px-2 py-1 text-[11px] font-medium", matchesHeroSearch(hero, enemyHeroSearch) ? "bg-zinc-950 text-white" : "bg-white text-zinc-500 ring-1 ring-zinc-200")}>
                            {hero}
                          </span>
                        ))}
                      </div>
                    </button>
                    {currentUser.role === "admin" && (
                      <div className="mt-3 flex gap-2">
                        <Button onClick={() => setEnemyDefenseEditing(team)} variant="secondary" className="px-3 py-1.5 text-xs"><Pencil size={13} /> 수정</Button>
                        <DeleteButton onConfirm={() => deleteEnemyDefenseTeam(team)} className="px-3 py-1.5 text-xs">삭제</DeleteButton>
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Counter Guide</p>
              <h2 className="mt-2 break-keep text-xl font-semibold text-zinc-950 sm:text-2xl">{renderRichText(selectedEnemyDefense.title, "")} 카운터치는 법</h2>
              <p className="mt-2 text-xs text-zinc-400">최근 수정 {formatUpdatedAt(selectedEnemyDefense.updated_at || selectedEnemyDefense.created_at)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {splitList(selectedEnemyDefense.heroes).map((hero) => (
                  <span key={hero} className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600">{hero}</span>
                ))}
              </div>
              {selectedEnemyDefense.note && <p className="mt-3 text-sm text-zinc-500">상대 속공: {renderRichText(selectedEnemyDefense.note, "")} </p>}
            </div>
            <Button onClick={() => { setSelectedEnemyDefense(null); setFilter("전체"); }} variant="secondary">닫기</Button>
          </div>

          <div className="mt-5 space-y-3">
            {selectedCounterDecks.length === 0 ? (
              <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-400">등록된 카운터덱이 없습니다.</div>
            ) : selectedCounterDecks.map((deck, deckIndex) => {
              const counterHeroes = splitList(deck.heroes);
                const counterRings = splitList(deck.rings);
                const counterGears = [deck.gear_1 || "", deck.gear_2 || "", deck.gear_3 || ""];
              return (
                <div key={deckIndex} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-zinc-400">카운터덱 #{deckIndex + 1}</p>
                      <h3 className="mt-1 text-lg font-semibold text-zinc-950">{renderRichText(deck.title || `카운터덱 ${deckIndex + 1}`, "")}</h3>
                      <p className="mt-1 text-xs font-semibold text-zinc-500">추천도 <span className="text-zinc-800">{deck.power || "0"}/10</span></p>
                      <p className="mt-1 text-xs text-zinc-400">최근 수정 {formatUpdatedAt(selectedEnemyDefense.updated_at || selectedEnemyDefense.created_at)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_260px]">
                    <div>
                      <div className="text-xs font-semibold text-zinc-400">추천 카운터 영웅</div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {counterHeroes.length === 0 ? (
                          <div className="text-sm text-zinc-400">등록된 카운터 영웅이 없습니다.</div>
                        ) : counterHeroes.map((hero, index) => (
                          <div key={`${hero}-${index}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-3">
                            <div className="text-xs font-semibold text-zinc-950">{renderRichText(hero, "")}</div>
                            <div className="mt-1 text-[11px] text-zinc-950">반지: {renderRichText(counterRings[index], "미입력")}</div>
                            <div className="mt-1 text-[11px] text-zinc-950 whitespace-pre-wrap">장비: {renderRichText(counterGears[index], "미입력")}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-zinc-400">
                        <span>펫 <b className="ml-1 text-sm font-semibold text-zinc-800">{deck.pet || "미입력"}</b></span>
                        <span>진형 <b className="ml-1 text-sm font-semibold text-zinc-800">{deck.formation || "미입력"}</b></span>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl bg-white p-4 text-sm leading-6 text-zinc-600 ring-1 ring-zinc-200">
                          <div className="mb-1 text-xs font-semibold text-zinc-400">추천 속공순서</div>
                          <div className="whitespace-pre-wrap">{renderRichText(deck.speed_order, "미입력")}</div>
                        </div>
                        <div className="rounded-xl bg-white p-4 text-sm leading-6 text-zinc-600 ring-1 ring-zinc-200">
                          <div className="mb-1 text-xs font-semibold text-zinc-400">추천 카운터 팀속공</div>
                          <div className="whitespace-pre-wrap">{renderRichText(deck.team_speed, "미입력")}</div>
                        </div>
                        <div className="rounded-xl bg-white p-4 text-sm leading-6 text-zinc-600 ring-1 ring-zinc-200">
                          <div className="mb-1 text-xs font-semibold text-zinc-400">추천 카운터 스킬순서</div>
                          <div className="whitespace-pre-wrap">{renderRichText(deck.skill_order, "미입력")}</div>
                        </div>
                      </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white p-4 text-sm leading-6 text-zinc-600 ring-1 ring-zinc-200 whitespace-pre-wrap">
                      <div className="mb-1 text-xs font-semibold text-zinc-400">그외 참고사항</div>
                      {renderRichText(deck.note, "메모 없음")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {enemyDefenseEditing && <EnemyDefenseEditor item={enemyDefenseEditing} onClose={() => setEnemyDefenseEditing(null)} onSaved={async () => { setEnemyDefenseEditing(null); await reloadData(); }} />}
    </PageShell>
  );
}

function EnemyDefenseEditor({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ ...emptyEnemyDefense, ...item });
  const [counterDecks, setCounterDecks] = useState(() => {
    const parsed = parseCounterDecks(item.counter_decks);
    if (parsed.length > 0) return parsed;

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

    return [{ ...emptyCounterDeck, title: "카운터덱 1" }];
  });
  const [saving, setSaving] = useState(false);
  const isNew = !item.id;

  const updateDeck = (index, patch) => {
    setCounterDecks((prev) => prev.map((deck, i) => (i === index ? { ...deck, ...patch } : deck)));
  };

  const addDeck = () => {
    setCounterDecks((prev) => [...prev, { ...emptyCounterDeck, title: `카운터덱 ${prev.length + 1}` }]);
  };

  const removeDeck = (index) => {
    const target = counterDecks[index];
    setCounterDecks((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      category: "enemy",
      title: form.title || "",
      heroes: form.heroes || "",
      note: form.note || "",
      counter_decks: stringifyCounterDecks(counterDecks),
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
          <div className="mb-4 flex items-center justify-between gap-3">
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
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-zinc-950">카운터덱 #{deckIndex + 1}</h4>
                    {counterDecks.length > 1 && <DeleteButton onConfirm={() => removeDeck(deckIndex)} className="px-3 py-1.5 text-xs">삭제</DeleteButton>}
                  </div>

                  <div className="grid gap-4">
                    <Input label="카운터덱 이름" value={deck.title} onChange={(v) => updateDeck(deckIndex, { title: v })} />
                    <Input label="추천도 / 10점 만점" value={deck.power} onChange={(v) => updateDeck(deckIndex, { power: v })} placeholder="예: 9" />
                    <TextArea label="추천 카운터 영웅" value={deck.heroes} onChange={(v) => updateDeck(deckIndex, { heroes: v })} rows={3} />
                    <TextArea label="추천 카운터 반지" value={deck.rings} onChange={(v) => updateDeck(deckIndex, { rings: v })} rows={3} />
                    <Input label="추천 카운터 펫" value={deck.pet} onChange={(v) => updateDeck(deckIndex, { pet: v })} placeholder="예: 연지" />
                    <Input label="추천 카운터 진형" value={deck.formation} onChange={(v) => updateDeck(deckIndex, { formation: v })} placeholder="예: 공격진형 / 보호진형" />
                    <TextArea label="추천 속공순서" value={deck.speed_order} onChange={(v) => updateDeck(deckIndex, { speed_order: v })} rows={3} />
                    <Input label="추천 카운터 팀속공" value={deck.team_speed} onChange={(v) => updateDeck(deckIndex, { team_speed: v })} />
                    <TextArea label="추천 카운터 스킬순서" value={deck.skill_order} onChange={(v) => updateDeck(deckIndex, { skill_order: v })} placeholder="예: 여포1스 파이2스 여포2스" rows={3} />
                    <div className="grid gap-4 md:grid-cols-3">
                      <TextArea label={`추천 카운터 장비세팅 ${counterHeroes[0] || "1번 영웅"}`} value={deck.gear_1} onChange={(v) => updateDeck(deckIndex, { gear_1: v })} rows={3} />
                      <TextArea label={`추천 카운터 장비세팅 ${counterHeroes[1] || "2번 영웅"}`} value={deck.gear_2} onChange={(v) => updateDeck(deckIndex, { gear_2: v })} rows={3} />
                      <TextArea label={`추천 카운터 장비세팅 ${counterHeroes[2] || "3번 영웅"}`} value={deck.gear_3} onChange={(v) => updateDeck(deckIndex, { gear_3: v })} rows={3} />
                    </div>
                    <TextArea label="그외 참고사항" value={deck.note} onChange={(v) => updateDeck(deckIndex, { note: v })} rows={4} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <Button onClick={save}><Save size={16} /> {saving ? "저장 중" : "저장"}</Button>
          {!isNew && <DeleteButton onConfirm={remove}>삭제</DeleteButton>}
        </div>
      </div>
    </Modal>
  );
}

function AttackTeamEditor({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ ...emptyAttackTeam, ...item });
  const [saving, setSaving] = useState(false);
  const isNew = !item.id;

  const save = async () => {
    setSaving(true);
    const payload = {
      enemy_type: form.enemy_type || "",
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
        <Input label="진형" value={form.formation} onChange={(v) => setForm({ ...form, formation: v })} placeholder="예: 공격진형 / 보호진형" />
        <TextArea label="속공순서 추천" value={form.speed_order} onChange={(v) => setForm({ ...form, speed_order: v })} placeholder="예: 여포 → 칼헤론 → 란드그리드" rows={3} />
        <TextArea label="팀속공 추천" value={form.team_speed} onChange={(v) => setForm({ ...form, team_speed: v })} placeholder="예: 팀속공 232 이상" rows={3} />
        <TextArea label="스킬순서" value={form.skill_order} onChange={(v) => setForm({ ...form, skill_order: v })} placeholder="예: 여포1스 파이2스 여포2스" rows={3} />
        <TextArea label="공격 핵심 메모" value={form.note} onChange={(v) => setForm({ ...form, note: v })} rows={4} />
        <Input label="정렬 순서" value={form.sort_order} onChange={(v) => setForm({ ...form, sort_order: v })} />
        <Select label="공개 상태" value={String(form.is_public !== false)} onChange={(v) => setForm({ ...form, is_public: v === "true" })} options={[["true", "공개"], ["false", "비공개"]]} />
        <div className="flex justify-between gap-2">
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
          <div key={team.id} className="grid overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:grid-cols-[220px_1fr]">
            <div className="border-b border-zinc-200 bg-zinc-50 p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-400">#{team.sort_order || index + 1}</p>
                {currentUser.role === "admin" && team.is_public === false && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">비공개</span>}
              </div>
              <h3 className="mt-2 text-xl font-semibold text-zinc-950">{renderRichText(team.title, "")}</h3>
              <p className="mt-2 text-sm text-zinc-500">펫: <span className="font-semibold text-zinc-800">{team.pet || "미입력"}</span></p>
              <p className="mt-1 text-sm text-zinc-500">진형: <span className="font-semibold text-zinc-800">{team.formation || "미입력"}</span></p>
              <p className="mt-2 text-xs text-zinc-400">최근 수정 {formatUpdatedAt(team.updated_at || team.created_at)}</p>
              {currentUser.role === "admin" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => setEditing(team)} variant="secondary"><Pencil size={14} /> 수정</Button>
                  <DeleteButton onConfirm={() => deleteTotalWarTeam(team)}>삭제</DeleteButton>
                </div>
              )}
            </div>

            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_240px] lg:items-start">
              <div>
                <div className="text-xs font-semibold text-zinc-400">영웅 구성</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {splitList(team.heroes).map((hero, heroIndex) => {
                    const ring = splitList(team.rings)[heroIndex];
                    const gear = splitList(team.gears)[heroIndex];
                    return (
                      <div key={`${hero}-${heroIndex}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                        <div className="text-xs font-semibold text-zinc-800">{renderRichText(hero, "")}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">반지: {renderRichText(ring, "미입력")}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">장비: {renderRichText(gear, "미입력")}</div>
                      </div>
                    );
                  })}
                  {splitList(team.heroes).length === 0 && <div className="text-sm text-zinc-400">등록된 영웅이 없습니다.</div>}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">속공순서 추천</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.speed_order, "미입력")}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">팀속공 추천</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.team_speed, "미입력")}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">스킬순서</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.skill_order, "미입력")}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600 whitespace-pre-wrap">{renderRichText(team.note, "메모 없음")}</div>
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
        <div className="flex justify-between gap-2">
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
          <div key={team.id} className="grid overflow-hidden rounded-2xl border border-zinc-200 bg-white lg:grid-cols-[220px_1fr]">
            <div className="border-b border-zinc-200 bg-zinc-50 p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-400">#{team.sort_order || index + 1}</p>
                {currentUser.role === "admin" && team.is_public === false && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">비공개</span>}
              </div>
              <h3 className="mt-2 text-xl font-semibold text-zinc-950">{renderRichText(team.title, "")}</h3>
              <p className="mt-2 text-sm text-zinc-500">펫: <span className="font-semibold text-zinc-800">{team.pet || "미입력"}</span></p>
              <p className="mt-1 text-sm text-zinc-500">진형: <span className="font-semibold text-zinc-800">{team.formation || "미입력"}</span></p>
              <p className="mt-2 text-xs text-zinc-400">최근 수정 {formatUpdatedAt(team.updated_at || team.created_at)}</p>
              {currentUser.role === "admin" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => setEditing(team)} variant="secondary"><Pencil size={14} /> 수정</Button>
                  <DeleteButton onConfirm={() => deleteArenaTeam(team)}>삭제</DeleteButton>
                </div>
              )}
            </div>

            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_240px] lg:items-start">
              <div>
                <div className="text-xs font-semibold text-zinc-400">영웅 구성</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {splitList(team.heroes).map((hero, heroIndex) => {
                    const ring = splitList(team.rings)[heroIndex];
                    const gear = splitList(team.gears)[heroIndex];
                    return (
                      <div key={`${hero}-${heroIndex}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                        <div className="text-xs font-semibold text-zinc-800">{renderRichText(hero, "")}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">반지: {renderRichText(ring, "미입력")}</div>
                        <div className="mt-1 text-[11px] text-zinc-500">장비: {renderRichText(gear, "미입력")}</div>
                      </div>
                    );
                  })}
                  {splitList(team.heroes).length === 0 && <div className="text-sm text-zinc-400">등록된 영웅이 없습니다.</div>}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">속공순서 추천</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.speed_order, "미입력")}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">팀속공 추천</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.team_speed, "미입력")}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">스킬순서</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.skill_order, "미입력")}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600 whitespace-pre-wrap">{renderRichText(team.note, "메모 없음")}</div>
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
        <div className="flex justify-between gap-2">
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
        <PageHeader eyebrow="Notice" title="공지" desc="길드전 관련 공지를 확인하세요." />
        <GuestLockedContent />
      </PageShell>
    );
  }

  const [editing, setEditing] = useState(null);
  const visibleNotices = notices.filter((notice) => isVisibleItem(notice, currentUser));
  return <PageShell><PageHeader eyebrow="Notice" title="공지" desc="길드전 관련 공지를 확인하세요." action={currentUser.role === "admin" && <Button onClick={() => setEditing(emptyNotice)}><Plus size={16} /> 작성</Button>} /><div className="space-y-3">{visibleNotices.map((notice) => <article key={notice.id} className="rounded-2xl border border-zinc-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-400"><span>최근 수정 {formatUpdatedAt(notice.updated_at || notice.created_at)}</span>{currentUser.role === "admin" && notice.is_public === false && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">비공개</span>}</div><h2 className="mt-2 text-xl font-semibold text-zinc-950">{renderRichText(notice.title, "")}</h2></div>{currentUser.role === "admin" && <Button onClick={() => setEditing(notice)} variant="secondary"><Pencil size={14} /> 수정</Button>}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600">{renderRichText(notice.body, "")}</p></article>)}{visibleNotices.length === 0 && <EmptyState text="등록된 공지가 없습니다." />}</div>{editing && <NoticeEditor item={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reloadData(); }} />}</PageShell>;
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
  return <Modal title={isNew ? "공지 작성" : "공지 수정"} onClose={onClose}><div className="grid gap-4"><Input label="제목" value={form.title} onChange={(v) => setForm({ ...form, title: v })} /><TextArea label="내용" value={form.body} onChange={(v) => setForm({ ...form, body: v })} rows={8} /><Select label="공개 상태" value={String(form.is_public !== false)} onChange={(v) => setForm({ ...form, is_public: v === "true" })} options={[["true", "공개"], ["false", "비공개"]]} /><div className="flex justify-between gap-2"><Button onClick={save}><Save size={16} /> 저장</Button>{!isNew && <DeleteButton onConfirm={remove}>삭제</DeleteButton>}</div></div></Modal>;
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
  const fields = [["guild_name", "길드명"], ["site_title", "사이트 메인 제목"], ["main_subtitle", "메인 설명"], ["hero_notice", "승인 대기 안내 문구"], ["footer_text", "제작자 문구"]];
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
      site: "seori-guild-site",
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
    const fileName = `seori-guild-backup-${today}.json`;
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
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3 backdrop-blur-sm sm:p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold text-zinc-950">{title}</h2><button onClick={onClose} className="rounded-lg bg-zinc-100 p-2 text-zinc-500 hover:text-zinc-950"><X size={18} /></button></div>{children}</div></div>;
}

function MemberManagementPage({ users, setUsers, currentUser, setCurrentUser, reloadData }) {
  const [selectedGuild, setSelectedGuild] = useState(null);
  const pending = users.filter((u) => u.status === "pending");
  const members = users.filter((u) => u.status !== "pending");
  const getUserGuilds = (user) => String(user.memo || "")
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
  const updateUser = async (id, patch) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    if (target.id === OWNER_ID && (patch.status === "blocked" || patch.status === "rejected" || (patch.role && patch.role !== "admin"))) return;
    const dbPatch = {};
    if (patch.status) dbPatch.status = patch.status;
    if (patch.role) dbPatch.role = patch.role;
    if (Object.prototype.hasOwnProperty.call(patch, "memo")) dbPatch.memo = patch.memo;
    const { error } = await supabase.from("profiles").update(dbPatch).eq("user_id", id);
    if (error) return alert(`회원 정보 수정 실패: ${error.message}`);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    if (currentUser.id === id) setCurrentUser((u) => ({ ...u, ...patch }));
  };

  const deleteUser = async (id) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    if (target.id === OWNER_ID) return alert("최고 관리자 계정은 삭제할 수 없습니다.");

    setUsers((prev) => prev.filter((u) => u.id !== id));

    const query = supabase.from("profiles").delete();
    const { error } = target.dbId
      ? await query.eq("id", target.dbId)
      : await query.eq("user_id", id);

    if (error) {
      alert(`회원 삭제 실패: ${error.message}`);
      await reloadData();
      return;
    }
  };

  return <PageShell><PageHeader eyebrow="Admin" title="회원 관리" desc="게임 닉네임을 확인한 뒤 승인하세요." />
  <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-5">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-zinc-950">길드별 인원</h2>
      <span className="text-xs font-semibold text-zinc-400">관리자 메모 기준</span>
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {memoCountList.length === 0 ? <span className="text-sm text-zinc-400">입력된 메모가 없습니다.</span> : memoCountList.map(([memo, count]) => (
        <button
          key={memo}
          onClick={() => setSelectedGuild((prev) => prev === memo ? null : memo)}
          className={cx("rounded-full px-3 py-1.5 text-sm font-semibold transition", selectedGuild === memo ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200")}
        >
          {memo} {count}명
        </button>
      ))}
    </div>
  {selectedGuild && (
      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-950">{selectedGuild} 회원 목록</div>
          <button onClick={() => setSelectedGuild(null)} className="text-xs font-semibold text-zinc-400 hover:text-zinc-700">닫기</button>
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
  <section className="rounded-2xl border border-zinc-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-zinc-950">가입 승인 대기</h2><span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-700">{pending.length}건</span></div><MemberTable list={pending} pending updateUser={updateUser} deleteUser={deleteUser} /></section><section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="text-lg font-semibold text-zinc-950">전체 회원</h2><MemberTable list={members} updateUser={updateUser} deleteUser={deleteUser} /></section></PageShell>;
}

function MemberTable({ list, pending, updateUser, deleteUser }) {
  return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-sm"><thead><tr className="border-b border-zinc-200 text-xs font-semibold uppercase text-zinc-400"><th className="px-3 py-3">게임 닉네임</th><th className="px-3 py-3">아이디</th><th className="px-3 py-3">상태</th><th className="px-3 py-3">등급</th><th className="px-3 py-3">마지막 접속</th><th className="px-3 py-3">관리자 메모</th><th className="px-3 py-3 text-right">관리</th></tr></thead><tbody>{list.length === 0 ? <tr><td colSpan={7} className="py-8 text-center text-zinc-400">표시할 회원이 없습니다.</td></tr> : list.map((u) => <MemberRow key={u.id} user={u} pending={pending} updateUser={updateUser} deleteUser={deleteUser} />)}</tbody></table></div>;
}

function MemberRow({ user: u, pending, updateUser, deleteUser }) {
  const [memo, setMemo] = useState(u.memo || "");
  useEffect(() => setMemo(u.memo || ""), [u.memo]);

  const saveMemo = () => {
    updateUser(u.id, { memo });
  };

  return (
    <tr className="border-b border-zinc-100 align-top">
      <td className="px-3 py-4 font-semibold text-zinc-950">{u.gameNickname}</td>
      <td className="px-3 py-4 text-zinc-600">{u.id}</td>
      <td className="px-3 py-4"><StatusBadge status={u.status} /></td>
      <td className="px-3 py-4"><RoleBadge role={u.role} /></td>
      <td className="px-3 py-4 text-xs text-zinc-500">{formatLastSeen(u.lastSeenAt)}</td>
      <td className="px-3 py-4">
        <div className="flex min-w-[220px] gap-2">
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveMemo()}
            placeholder="예: 운명 , Guest"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-950 outline-none focus:ring-4 focus:ring-zinc-200/70"
          />
          <Button onClick={saveMemo} variant="secondary" className="shrink-0 px-3 py-2 text-xs">저장</Button>
        </div>
      </td>
      <td className="px-3 py-4">
        <div className="flex flex-wrap justify-end gap-2">
          {pending ? <><Button onClick={() => updateUser(u.id, { status: "approved", role: "member" })}><CheckCircle2 size={15} /> 승인</Button><Button onClick={() => updateUser(u.id, { status: "rejected" })} variant="subtle"><Ban size={15} /> 거절</Button></> : <><select disabled={u.id === OWNER_ID} value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value, status: "approved" })} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 outline-none focus:ring-4 focus:ring-zinc-200/70 disabled:cursor-not-allowed disabled:opacity-50"><option value="guest">게스트</option><option value="member">일반회원</option><option value="admin">관리자</option></select><DeleteButton onConfirm={() => deleteUser(u.id)} className={u.id === OWNER_ID ? "pointer-events-none opacity-50" : ""}>삭제</DeleteButton></>}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }) {
  const style = { pending: "bg-amber-50 text-amber-700 ring-amber-200", approved: "bg-emerald-50 text-emerald-700 ring-emerald-200", rejected: "bg-zinc-100 text-zinc-600 ring-zinc-200", blocked: "bg-red-50 text-red-700 ring-red-200" }[status] || "bg-zinc-100 text-zinc-600 ring-zinc-200";
  return <span className={cx("rounded-full px-2.5 py-1 text-xs font-medium ring-1", style)}>{statusLabel(status)}</span>;
}
function RoleBadge({ role }) { return <span className={cx("rounded-full px-2.5 py-1 text-xs font-medium ring-1", role === "admin" ? "bg-zinc-950 text-white ring-zinc-950" : "bg-white text-zinc-600 ring-zinc-200")}>{roleLabel(role)}</span>; }
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
  const [active, setActive] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
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
    if (profilesRes.error) alert(`회원 목록 불러오기 실패: ${profilesRes.error.message}`);
    if (!profilesRes.error) setUsers((profilesRes.data || []).map(mapProfile));
    if (!settingsRes.error) {
      const obj = { ...FALLBACK_SETTINGS };
      (settingsRes.data || []).forEach((row) => { obj[row.key] = row.value; });
      setSettings(obj);
    }
    if (!defenseRes.error) setDefenseTeams(defenseRes.data || []);
    if (!enemyDefenseRes.error) setEnemyDefenseTeams(enemyDefenseRes.data || []);
    if (!attackTeamsRes.error) setAttackTeams(attackTeamsRes.data || []);
    if (!noticesRes.error) setNotices(noticesRes.data || []);
    if (!totalWarRes.error) setTotalWarTeams(totalWarRes.data || []);
    if (!arenaRes.error) setArenaTeams(arenaRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const syncedCurrentUser = useMemo(() => {
    if (!currentUser) return null;
    return users.find((u) => u.id === currentUser.id) || currentUser;
  }, [users, currentUser]);

  useEffect(() => {
    if (loading || currentUser || users.length === 0) return;
    const savedId = localStorage.getItem(SESSION_KEY);
    if (!savedId) return;

    const savedUser = users.find((u) => u.id === savedId);
    if (savedUser && savedUser.status === "approved") {
      updateLastSeen(savedUser, setUsers, setCurrentUser);
    } else if (savedUser && savedUser.status !== "approved") {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [loading, users, currentUser]);

  useEffect(() => {
    if (!syncedCurrentUser || syncedCurrentUser.status !== "approved") return;

    const timer = window.setInterval(() => {
      updateLastSeen(syncedCurrentUser, setUsers, setCurrentUser);
    }, 5 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [syncedCurrentUser?.id, syncedCurrentUser?.status]);

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
    setActive("dashboard");
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#0d0f12] text-white"><div className="text-sm text-zinc-400">데이터 불러오는 중...</div></div>;
  if (!syncedCurrentUser) return <AuthScreen users={users} setUsers={setUsers} setCurrentUser={setCurrentUser} settings={settings} />;
  if (syncedCurrentUser.status === "pending") return <PendingScreen user={syncedCurrentUser} logout={logout} settings={settings} />;
  if (syncedCurrentUser.status !== "approved") return <AuthScreen users={users} setUsers={setUsers} setCurrentUser={setCurrentUser} settings={settings} />;

  const safeActive = navItems.find((item) => item.id === active && item.visibleTo.includes(syncedCurrentUser.role)) ? active : "dashboard";

  return (
    <div className="min-h-screen bg-[#f6f7f9] font-sans text-zinc-950">
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

        {safeActive === "dashboard" && (
          <Dashboard
            setActive={setActive}
            currentUser={syncedCurrentUser}
            users={users}
            settings={settings}
            setSettings={setSettings}
          />
        )}

        {safeActive === "attackTips" && (
          <AttackTipsPage
            currentUser={syncedCurrentUser}
            settings={settings}
            setSettings={setSettings}
          />
        )}

        {safeActive === "defense" && (
          <DefensePage
            currentUser={syncedCurrentUser}
            defenseTeams={defenseTeams}
            setDefenseTeams={setDefenseTeams}
            reloadData={loadData}
          />
        )}

        {safeActive === "attack" && (
          <AttackPage
            currentUser={syncedCurrentUser}
            attackTeams={attackTeams}
            setAttackTeams={setAttackTeams}
            enemyDefenseTeams={enemyDefenseTeams}
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

        {safeActive === "notices" && (
          <NoticesPage
            currentUser={syncedCurrentUser}
            notices={notices}
            reloadData={loadData}
          />
        )}

        {safeActive === "content" && syncedCurrentUser.role === "admin" && (
          <ContentManagementPage
            settings={settings}
            setSettings={setSettings}
            reloadData={loadData}
          />
        )}

        {safeActive === "backup" && syncedCurrentUser.role === "admin" && (
          <BackupPage />
        )}

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
