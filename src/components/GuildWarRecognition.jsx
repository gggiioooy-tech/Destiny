import React, { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import RecognitionHeroPicker from "./RecognitionHeroPicker.jsx";
import { useRecognitionCorrection } from "../lib/useRecognitionCorrection.js";
import { recognizeGuildWarHeroes, warmGuildWarRecognitionWorker, saveHeroCorrectionSample, PICKER_HERO_NAMES, GUILD_WAR_ENGINE_LABEL } from "../lib/guildWarRecognition.js";

export default function GuildWarRecognition({ onHeroesChange }) {
  const inputRef = useRef(null);
  const requestRef = useRef(0);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const correction = useRecognitionCorrection({
    result, setResult, onHeroesChange,
    persist: async (detail) => {
      if (detail.sample && detail.cardValid !== false && !saveHeroCorrectionSample(detail.name, detail.sample)) {
        throw new Error("수정 기록을 저장하지 못했습니다.");
      }
    },
  });
  useEffect(() => {
    const timer = setTimeout(warmGuildWarRecognitionWorker, 350);
    return () => { clearTimeout(timer); requestRef.current += 1; };
  }, []);

  async function recognize(file) {
    if (!file || busyRef.current) return;
    const request = ++requestRef.current;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setResult(null);
    onHeroesChange([]);
    setProgress(0);
    setStage("스크린샷 불러오는 중");
    try {
      const data = await recognizeGuildWarHeroes(file, (nextStage, nextProgress) => {
        if (request !== requestRef.current) return;
        setStage(nextStage);
        setProgress(nextProgress || 0);
      });
      if (request !== requestRef.current) return;
      const details = data.results.map((item, index) => ({ ...item, sample: data.samples?.[index] || "" }));
      const heroes = details.map(item => item.name || "");
      setResult({ requestId: request, details, heroes });
      onHeroesChange(heroes);
    } catch (err) {
      if (request === requestRef.current) setError(err.message || "스크린샷 인식에 실패했습니다.");
    } finally {
      if (request === requestRef.current) { busyRef.current = false; setBusy(false); }
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  return <section className="mt-4 border-t border-zinc-200 pt-4" aria-label="길드전 스크린샷 인식" onPaste={event => {
    const file = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith("image/"))?.getAsFile();
    if (file) { event.preventDefault(); recognize(file); }
  }}>
    <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
      <ScanLine size={16} />{busy ? `${stage} · ${progress}%` : "길드전 스크린샷 인식"}
    </button>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="길드전 스크린샷 파일" className="hidden" onChange={event => recognize(event.target.files?.[0])} />
    <p className="mt-2 text-xs leading-5 text-zinc-500">상대 방어팀 패널의 테두리가 모두 보이는 스크린샷을 올려 주세요. 영웅 3명을 인식하면 해당 방어팀을 바로 검색합니다.</p>
    <p className="mt-1 text-[10px] text-zinc-400">{GUILD_WAR_ENGINE_LABEL}</p>
    {busy && <progress aria-label="인식 진행률" max="100" value={progress} className="mt-2 w-full" />}
    {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    {result && <>
      <RecognitionHeroPicker key={result.requestId} details={result.details} heroNames={PICKER_HERO_NAMES} onSelect={correction.select} onRetry={correction.retry} />
      <button type="button" onClick={() => onHeroesChange(result.heroes)} className="mt-2 min-h-9 text-xs font-semibold underline">인식한 영웅으로 다시 검색</button>
      <p className="mt-1 text-[10px] text-zinc-400">영웅을 수정하면 검색 결과에 바로 반영됩니다. 수정 기록은 이 브라우저에 저장됩니다.</p>
    </>}
  </section>;
}
