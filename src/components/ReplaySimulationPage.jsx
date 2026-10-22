import React from 'react';
import {canViewHeroStats} from '../lib/heroBattleStats.js';
import ExperimentalBattle from './ExperimentalBattle.jsx';

export default function ReplaySimulationPage({currentUser}){
  if(!canViewHeroStats(currentUser))return null;
  const identity=currentUser?.authUserId||currentUser?.id||'';
  return <section className="min-w-0 space-y-4 p-4 sm:p-6">
    <header><p className="text-xs font-semibold text-zinc-500">권한등급 4등급 전용</p><h1 className="mt-1 text-2xl font-bold">길드전 시뮬레이션</h1><p className="mt-2 text-sm text-zinc-600">편성하고, 계산하고, 장면별로 비교해 보세요.</p></header>
    <ExperimentalBattle key={identity} currentUser={currentUser}/>
  </section>;
}
