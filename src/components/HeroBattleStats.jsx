import React from 'react';
import {statColumns,formatHeroStat,resolvedHeroStats} from '../lib/heroBattleStats.js';
export default function HeroBattleStats({side,stats,speeds,health}){
 return <details className="red-pill-details min-w-0">
  <summary className="red-pill-toggle"><span className="red-pill-closed">빨간약</span><span className="red-pill-open">빨간약닫기</span></summary>
  <div className="mt-3 space-y-3">
   <p className="text-xs text-zinc-500">전투 시작 기준 · 미확인 수치 0</p>
   {(side?.heroIds||[]).map((id,index)=>{const values=resolvedHeroStats(id,stats,speeds,health);return <section key={`${id}-${index}`} className="red-pill-hero" aria-label={`${side.heroes?.[index]||'영웅'} 능력치`}>
    <h4 className="red-pill-name">{side.heroes?.[index]||`영웅 #${id}`}</h4>
    <div className="red-pill-grid">{statColumns.map((column,columnIndex)=><dl key={columnIndex} className="min-w-0">{column.map(([key,label,percent])=><div key={key} className="red-pill-stat"><dt>{label}</dt><dd>{formatHeroStat(values[key],percent)}</dd></div>)}</dl>)}</div>
   </section>})}
  </div>
 </details>;
}
