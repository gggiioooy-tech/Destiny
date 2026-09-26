import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { getHeroAlternatives, uniqueHeroNames } from "../lib/recognitionCorrections.js";

export default function RecognitionHeroPicker({ details = [], heroNames = [], onSelect, onRetry, compact = false }) {
  const [editing, setEditing] = useState(null);
  return <div className={`mt-3 gap-2 ${compact ? "flex flex-wrap" : "grid"}`} aria-label="인식된 방어팀 영웅">
    {details.map((item, index) => {
      const uncertain = !item.confident && !item.corrected;
      const compactCard = compact && !uncertain && editing !== index;
      const alternatives = getHeroAlternatives(details, index);
      const occupied = uniqueHeroNames(details.filter((_, slot) => slot !== index).map((hero) => hero.name));
      const names = uniqueHeroNames([...heroNames, ...details.flatMap((hero) => [hero.name, ...(hero.candidates || []).map((candidate) => candidate.name)])])
        .filter((name) => !occupied.includes(name)).sort((a, b) => a.localeCompare(b, "ko"));
      const choose = (name) => { onSelect(index, name); setEditing(null); };
      return <div key={index} className={`min-w-0 max-w-full rounded-lg border ${compactCard ? "px-2 py-1" : "px-2.5 py-2"} ${compact && !compactCard ? "w-full" : ""} ${uncertain ? "border-amber-200 bg-amber-50/70" : "border-zinc-200 bg-zinc-50/60"}`}>
        <div className={`flex items-center ${compactCard ? "gap-1" : "gap-2"}`}>
          {item.sample && <img src={item.sample} alt={`${index + 1}번 인식 카드`} className={`${compactCard ? "h-7 w-6" : "h-10 w-9"} shrink-0 rounded object-cover`} />}
          <div className="min-w-0 flex-1">
            <span className="break-words text-xs font-semibold text-zinc-800">{item.name || "인식 실패"}</span>
            {uncertain && <span className="ml-2 text-[10px] text-amber-700">후보 확인</span>}
            {item.corrected && <span className="ml-2 text-[10px] text-zinc-500">수정됨</span>}
          </div>
          <button type="button" aria-label={`${index + 1}번 영웅 수정`} aria-expanded={editing === index} onClick={() => setEditing(editing === index ? null : index)} className={`flex ${compactCard ? "min-h-8 min-w-8" : "min-h-9 min-w-9"} shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-600`}>
            <Pencil size={13} />
          </button>
        </div>
        {(uncertain || editing === index) && <div className="mt-2 flex flex-wrap gap-1.5">
          {alternatives.map((name) => <button key={name} type="button" onClick={() => choose(name)} aria-label={`${index + 1}번 영웅을 ${name}로 변경`} className="min-h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100">{name}</button>)}
          {editing !== index && <button type="button" onClick={() => setEditing(index)} className="min-h-9 rounded-lg px-2 text-[11px] text-zinc-500 underline underline-offset-2">다른 영웅</button>}
        </div>}
        {editing === index && <select aria-label={`${index + 1}번 다른 영웅 선택`} value={item.name || ""} onChange={(event) => choose(event.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-800">
          {!item.name && <option value="" disabled>영웅 선택</option>}
          {names.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>}
        {item.saveState === "error" && <div className="mt-1 text-[10px] text-zinc-500" role="status">결과는 반영됐어요. 수정 기록 저장 실패 <button type="button" onClick={() => onRetry(index)} className="min-h-8 px-1 underline">다시 저장</button></div>}
      </div>;
    })}
  </div>;
}
