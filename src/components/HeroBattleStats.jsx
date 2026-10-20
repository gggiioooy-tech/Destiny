import React from 'react';
import {statColumns,formatHeroStat,resolvedHeroStats} from '../lib/heroBattleStats.js';
export default function HeroBattleStats({side,stats,speeds,health}){
 const heroes=(side?.heroIds||[]).map((id,index)=>({id,name:side.heroes?.[index]||`영웅 #${id}`,values:resolvedHeroStats(id,stats,speeds,health)}));
 return <details className="red-pill-details min-w-0">
  <summary className="red-pill-toggle"><span className="red-pill-closed">빨간약</span><span className="red-pill-open">빨간약닫기</span></summary>
  <div className="mt-3 space-y-2">
   <p className="text-xs text-zinc-500">전투 시작 기준 · 미확인 수치 0</p>
   <section className="red-pill-hero red-pill-comparison" aria-label="영웅별 능력치 비교">
    <table className="red-pill-table">
     <caption className="sr-only">영웅 3명의 능력치를 나란히 비교</caption>
     <colgroup><col className="red-pill-label-column" />{heroes.map((hero,index)=><col key={`${hero.id}-${index}`} />)}</colgroup>
     <thead><tr><th scope="col">능력치</th>{heroes.map((hero,index)=><th key={`${hero.id}-${index}`} scope="col">{hero.name}</th>)}</tr></thead>
     <tbody>{statColumns.flat().map(([key,label,percent])=><tr key={key}><th scope="row">{label}</th>{heroes.map((hero,index)=><td key={`${hero.id}-${index}`}>{formatHeroStat(hero.values[key],percent)}</td>)}</tr>)}</tbody>
    </table>
   </section>
  </div>
 </details>;
}
