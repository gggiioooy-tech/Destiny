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

function guideEquipmentSlots(value) {
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(v => String(v ?? "")); } catch { /* Legacy lists. */ }
  return splitList(value);
}

function validateGuideOrders(form) {
  const heroes = splitList(form.heroes);
  const speed = parseCounterOrder(form.speed_order, heroes, "speed").steps.filter(Boolean);
  const skills = parseCounterOrder(form.skill_order, heroes, "skill").steps;
  if (speed.some(hero => !heroes.includes(hero)) || new Set(speed).size !== speed.length || skills.some(step => (step.hero && !heroes.includes(step.hero)) || Boolean(step.hero) !== Boolean(step.skill))) {
    alert("입력한 영웅에 맞게 속공·스킬순서를 확인해 주세요. 스킬순서는 영웅과 스킬을 함께 선택해야 합니다.");
    return false;
  }
  return true;
}

function GuideTeamFields({ form, setForm }) {
  const heroes = splitList(form.heroes);
  const rings = guideEquipmentSlots(form.rings);
  const gears = guideEquipmentSlots(form.gears);
  const slots = Math.max(3, heroes.length, rings.length, gears.length);
  const updateEquipment = (field, index, value) => {
    const values = Array.from({ length: slots }, (_, i) => guideEquipmentSlots(form[field])[i] || "");
    values[index] = value;
    setForm(prev => ({ ...prev, [field]: JSON.stringify(values) }));
  };
  return <>
    <TextArea label="영웅명 (한 줄에 한 명)" value={form.heroes} onChange={v => setForm(prev => ({ ...prev, heroes: v }))} placeholder={"카일\n란드그리드\n칼 헤론"} rows={Math.max(3, heroes.length)} />
    <div className="grid min-w-0 gap-4 md:grid-cols-3">
      {Array.from({ length: slots }, (_, i) => {
        const hero = heroes[i] || (i + 1) + "번 영웅";
        return <div key={i} className="min-w-0 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <h5 className="break-words text-sm font-semibold text-zinc-950">{hero}</h5>
          <TextArea label={hero + " 반지"} value={rings[i] || ""} onChange={v => updateEquipment("rings", i, v)} rows={2} />
          <TextArea label={hero + " 장비세팅"} value={gears[i] || ""} onChange={v => updateEquipment("gears", i, v)} rows={4} />
        </div>;
      })}
    </div>
    <Input label="펫" value={form.pet} onChange={v => setForm(prev => ({ ...prev, pet: v }))} placeholder="예: 연지" />
    <FormationField label="진형" value={form.formation} onChange={v => setForm(prev => ({ ...prev, formation: v }))} />
    <CounterOrderFields heroes={heroes} value={form.speed_order} kind="speed" onChange={v => setForm(prev => ({ ...prev, speed_order: v }))} />
    <Input label="팀속공 추천" value={form.team_speed} onChange={v => setForm(prev => ({ ...prev, team_speed: v }))} />
    <CounterOrderFields heroes={heroes} value={form.skill_order} kind="skill" onChange={v => setForm(prev => ({ ...prev, skill_order: v }))} />
  </>;
}

function TotalWarPage({ currentUser, totalWarTeams, setTotalWarTeams, reloadData }) {
  const [editing, setEditing] = useState(null);
  if (isGuest(currentUser)) {
    return (
      <PageShell>
        <PageHeader eyebrow="Total War" title="총력전 공략" desc="총력전 추천 조합과 영웅별 반지, 속공등을 정리해둔 페이지입니다." />
        <GuestLockedContent />
      </PageShell>
    );
  }

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
              <p className="mt-2 text-xs text-zinc-400">최근 수정 {formatUpdatedAt(team.updated_at || team.created_at)}</p>
              {currentUser.role === "admin" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => setEditing(team)} variant="secondary"><Pencil size={14} /> 수정</Button>
                  <DeleteButton onConfirm={() => deleteTotalWarTeam(team)}>삭제</DeleteButton>
                </div>
              )}
            </div>

            <div className="min-w-0 grid gap-5 p-4 sm:p-5 2xl:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
              <div>
                <div className="text-xs font-semibold text-zinc-400">영웅 구성</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {splitList(team.heroes).map((hero, heroIndex) => {
                    const ring = guideEquipmentSlots(team.rings)[heroIndex];
                    const gear = guideEquipmentSlots(team.gears)[heroIndex];
                    return (
                      <div key={`${hero}-${heroIndex}`} className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
                        <div className="text-xs font-semibold text-zinc-800">{renderRichText(hero, "")}</div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-[11px] text-zinc-500">반지: {renderRichText(ring, "미입력")}</div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-[11px] text-zinc-500">장비: {renderRichText(gear, "미입력")}</div>
                      </div>
                    );
                  })}
                  {splitList(team.heroes).length === 0 && <div className="text-sm text-zinc-400">등록된 영웅이 없습니다.</div>}
                </div>

                <div className="mt-4 grid gap-2">
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">속공순서 추천</div>
                    <CounterOrderDisplay heroes={splitList(team.heroes)} value={team.speed_order} kind="speed" />
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">팀속공 추천</div>
                    <div className="whitespace-pre-wrap">{renderRichText(team.team_speed, "미입력")}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                    <div className="mb-1 text-xs font-semibold text-zinc-400">스킬순서</div>
                    <CounterOrderDisplay heroes={splitList(team.heroes)} value={team.skill_order} kind="skill" />
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
  const [form, setForm] = useState({ ...emptyTotalWar, ...item, heroes: splitList(item.heroes).join("\n") });
  const [saving, setSaving] = useState(false);
  const isNew = !item.id;

  const save = async () => {
    if (!validateGuideOrders(form)) return;
    setSaving(true);
    const payload = {
      title: form.title || "",
      heroes: form.heroes || "",
      rings: form.rings || "",
      gears: form.gears || "",
      pet: form.pet || "",
      formation: normalizedFormation(form.formation),
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
        <GuideTeamFields form={form} setForm={setForm} />
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


export default TotalWarPage;
