import React, { useState } from "react";
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
const SUPER_ADMIN_IDS = ["15month"];
const HIDDEN_USER_IDS = [];
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
    animeThemeAllowed: row.anime_theme_allowed === true,
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
      <p className="mt-2 text-sm leading-6 text-zinc-500">권한등급 2등급 이상부터 열람 가능합니다.</p>
    </div>
  );
}

function roleLabel(role, isOwner = false) {
  if (isOwner) return "권한등급 4등급";
  return { guest: "권한등급 1등급", member: "권한등급 2등급", admin: "권한등급 3등급" }[role] || role;
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

function Button({ children, onClick, variant = "primary", className = "", disabled, type = "button", ...props }) {
  const styles = {
    primary: "bg-zinc-950 text-white hover:bg-zinc-800",
    secondary: "bg-white text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50",
    subtle: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
    danger: "bg-red-50 text-red-700 hover:bg-red-100",
  };
  return (
    <button {...props} type={type} disabled={disabled} onClick={onClick} className={cx(`site-button site-button-${variant}`, "site-button inline-flex max-w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", styles[variant], className)}>
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

function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3 backdrop-blur-sm sm:p-4"><div className="site-modal max-h-[92dvh] w-full min-w-0 max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="min-w-0 text-xl font-semibold text-zinc-950">{title}</h2><button aria-label="닫기" onClick={onClose} className="shrink-0 rounded-lg bg-zinc-100 p-2 text-zinc-500 hover:text-zinc-950"><X size={18} /></button></div>{children}</div></div>;
}

function StatusBadge({ status }) {
  const style = { pending: "bg-amber-50 text-amber-700 ring-amber-200", approved: "bg-emerald-50 text-emerald-700 ring-emerald-200", rejected: "bg-zinc-100 text-zinc-600 ring-zinc-200", blocked: "bg-red-50 text-red-700 ring-red-200" }[status] || "bg-zinc-100 text-zinc-600 ring-zinc-200";
  return <span className={cx("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1", style)}>{statusLabel(status)}</span>;
}
function RoleBadge({ role, isOwner }) { return <span className={cx("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1", role === "admin" ? "bg-zinc-950 text-white ring-zinc-950" : "bg-white text-zinc-600 ring-zinc-200")}>{roleLabel(role, isOwner)}</span>; }
function EmptyState({ text }) { return <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-400">{text}</div>; }
function PlaceholderPage({ title, desc }) { return <PageShell><PageHeader eyebrow="Coming Soon" title={title} desc={desc} /><EmptyState text="여기는 다음 단계에서 내용을 추가하면 됩니다." /></PageShell>; }


export { cx, splitList, counterRingSlots, parseCounterDecks, parseAttackGuideItems, stringifyAttackGuideItems, stringifyCounterDecks, normalizeMultilineText, renderRichText, mapProfile, statusLabel, formatUpdatedAt, formatLastSeen, isVisibleItem, isGuest, GuestLockedContent, roleLabel, isSuperAdminId, isHiddenUserId, upsertSetting, PageShell, PageHeader, Button, DeleteButton, Input, TextArea, Select, splitFormation, normalizedFormation, FormationField, InfoChip, Modal, StatusBadge, RoleBadge, EmptyState, PlaceholderPage, emptyDefense, emptyTotalWar, emptyArena, emptyAttackTeam, emptyEnemyDefense, emptyCounterDeck, emptyNotice };
