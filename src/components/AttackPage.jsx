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

function AttackPage({ currentUser, attackTeams, setAttackTeams, enemyDefenseTeams, setEnemyDefenseTeams, reloadData, temporary = false }) {
  const pageTitle = temporary ? "휴지통" : "공격팀";
  const pageEyebrow = temporary ? "Recycle Bin" : "Attack Team";
  const pageDescription = temporary
    ? "공격팀에서 폐기한 카운터덱을 보관하는 페이지입니다. 승급하면 기존 카운터덱을 유지한 채 공격팀으로 복구됩니다."
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
  const [showAllEnemyDefense, setShowAllEnemyDefense] = useState(temporary);
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
      const { data, error } = kind === "enemy"
        ? await supabase.rpc("recycle_counter_deck", { team_id: team.id, restore: true })
        : await supabase.rpc("promote_temporary_attack_team", { team_id: team.id, team_kind: kind });
      if (error) throw error;
      setSelectedEnemyDefense(null);
      await reloadData();
      setPromotionMessage(kind === "enemy"
        ? `공격팀으로 승급했습니다. 기존 카운터덱은 유지하고 ${data.moved_count}개의 카운터덱을 복구했습니다.`
        : "공격팀으로 승급했습니다.");
    } catch (error) {
      alert(`승급 실패: ${error.message}`);
    } finally {
      setPromoting(null);
    }
  };

  const moveCounterDeck = async (team, deck) => {
    if (promoting) return;
    setPromoting(deck.counter_id);
    setPromotionMessage("");
    try {
      const { data, error } = await supabase.rpc("recycle_counter_deck", {
        team_id: team.id, deck_id: deck.counter_id, restore: temporary,
      });
      if (error) throw error;
      const { data: refreshedTeam, error: refreshError } = await supabase.from("enemy_defense_teams").select("*").eq("id", team.id).maybeSingle();
      setSelectedEnemyDefense(refreshError || data.remaining_count === 0 ? null : refreshedTeam);
      await reloadData();
      setPromotionMessage(temporary
        ? "카운터덱을 공격팀으로 승급했습니다. 기존 카운터덱은 그대로 유지됩니다."
        : "카운터덱을 휴지통으로 옮겼습니다. 공격팀 검색에서 제외되며, 휴지통에서 승급하면 복구할 수 있습니다.");
    } catch (error) {
      alert(`${temporary ? "승급" : "폐기"} 실패: ${error.message}`);
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
      if (!enemySearchKeyword) return temporary || (currentUser.role === "admin" && showAllEnemyDefense);
      if (!temporary && parseCounterDecks(team.counter_decks).length === 0) return false;
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

      {temporary && <p className="mb-4 text-sm text-zinc-500">카운터덱별로 승급하면 공격팀으로 복구됩니다. 전체 승급은 해당 상대 방어팀의 카운터덱을 모두 복구합니다.</p>}
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
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-zinc-400">
                {temporary ? "폐기된 카운터덱" : currentUser.role === "admin" && !enemyHeroSearch.trim() && showAllEnemyDefense ? "등록된 방어팀" : "검색된 방어팀"}
              </div>
              {currentUser.role === "admin" && (
                <div className="flex flex-wrap gap-2">
                  {!temporary && <Button onClick={() => setShowAllEnemyDefense((v) => !v)} variant="secondary" className="px-3 py-1.5 text-xs">
                    {showAllEnemyDefense ? "상대방어팀 일괄보기 닫기" : "상대방어팀 일괄보기"}
                  </Button>}
                  {!temporary && <Button
                    onClick={() => setEnemyDefenseEditing({ ...emptyEnemyDefense, sort_order: enemyDefenseTeams.length + 1 })}
                    variant="secondary"
                    className="px-3 py-1.5 text-xs"
                  >
                    <Plus size={14} /> 상대 방어팀 추가
                  </Button>}
                </div>
              )}
            </div>

            {!temporary && !enemyHeroSearch.trim() && currentUser.role !== "admin" ? null : !enemyHeroSearch.trim() && currentUser.role === "admin" && !showAllEnemyDefense ? null : searchedDefenseTeams.length === 0 ? (
              <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-950">{temporary ? enemySearchKeyword ? "검색된 폐기 카운터덱이 없습니다." : "휴지통이 비어 있습니다." : "검색된 방어팀이 없습니다."}</div>
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
                        {temporary && <Button onClick={() => promoteTeam(team)} disabled={Boolean(promoting)} className="px-3 py-1.5 text-xs">{promoting === team.id ? "승급 중…" : "전체 승급"}</Button>}
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
                    <div className="grid items-center gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-950">카운터덱 #{deckIndex + 1}</p>
                        {currentUser.role === "admin" && <CounterTransferButton supabase={supabase} target="seori" teamId={selectedEnemyDefense.id} deck={deck} />}
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
                        {currentUser.role === "admin" && <Button
                          onClick={() => moveCounterDeck(selectedEnemyDefense, deck)}
                          disabled={Boolean(promoting)}
                          variant="secondary"
                          className="mt-3 px-3 py-1.5 text-xs"
                        >
                          {temporary ? <CheckCircle2 size={13} /> : <Trash2 size={13} />}
                          {promoting === deck.counter_id ? "이동 중…" : temporary ? "승급" : "폐기"}
                        </Button>}
                      </div>
                      <p className="counter-guide-heading break-keep px-3 py-3 text-center text-lg font-normal leading-relaxed text-zinc-700 sm:px-6 sm:py-5 sm:text-xl">
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


export default AttackPage;
