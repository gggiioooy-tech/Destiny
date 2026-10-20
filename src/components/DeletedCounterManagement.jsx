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


export default DeletedCounterManagement;
