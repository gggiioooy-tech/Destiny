import React,{useEffect,useState} from 'react';
import {canViewHeroStats} from '../lib/heroBattleStats.js';
import {SIM_HEROES,MODEL_LIMITS,prepareHeroes,createBattle,advanceBattle,defaultSkillPlans} from '../lib/experimentalBattle.js';
import {HERO_GROWTH} from '../lib/combatDamage.js';
import BattleFormulaLab from './BattleFormulaLab.jsx';
import BattleSetup from './BattleSetup.jsx';
import BattleArena from './BattleArena.jsx';

export default function ExperimentalBattle({currentUser,report}){
  const permitted=canViewHeroStats(currentUser);
  const [draft,setDraft]=useState(()=>prepareHeroes(report)),[plans,setPlans]=useState(()=>defaultSkillPlans(prepareHeroes(report),report));
  const [battle,setBattle]=useState(null),[running,setRunning]=useState(false),[speed,setSpeed]=useState(1),[seed,setSeed]=useState(1),[error,setError]=useState('');
  useEffect(()=>{
    if(!running||!permitted)return;
    const id=setInterval(()=>setBattle(old=>old?advanceBattle(old):old),1600/speed);
    return()=>clearInterval(id);
  },[running,speed,permitted]);
  useEffect(()=>{if(battle?.done)setRunning(false);},[battle?.done]);
  if(!permitted)return null;
  function start(){setRunning(false);try{setBattle(createBattle(draft,{seed,plans}));setRunning(true);setError('');}catch(e){setError(e.message);}}
  function stop(){setRunning(false);setBattle(old=>old?{...old,done:true,stopped:true,winner:null,action:null}:old);}
  return <div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">전투 시뮬레이터 <span className="ml-2 text-xs font-normal text-zinc-500">{SIM_HEROES.length}종 영웅 선택</span></strong><span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{HERO_GROWTH.label} · 실험판</span></div><p className="mt-2 text-xs leading-relaxed text-zinc-500">{MODEL_LIMITS}</p></div>
    <BattleSetup draft={draft} setDraft={setDraft} plans={plans} setPlans={setPlans} report={report} battle={battle} seed={seed} setSeed={setSeed}/>
    <BattleArena draft={draft} battle={battle} running={running}/>
    <div className="battle-controls"><button type="button" onClick={start} className="battle-start">{battle?'설정으로 새 전투':'전투 시작'}</button><button type="button" disabled={!battle||battle.done} onClick={()=>setRunning(v=>!v)}>{running?'일시정지':'계속 진행'}</button><button type="button" disabled={!battle||running||battle.done} onClick={()=>setBattle(advanceBattle)}>한 행동 진행</button><button type="button" disabled={!battle||battle.done} onClick={stop}>전투 종료</button><select aria-label="전투 진행 속도" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.5,1,2,4].map(n=><option key={n} value={n}>{n}배속</option>)}</select><span className="battle-stop-label">설정 변경은 새 전투에 적용됩니다.</span></div>
    {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {battle&&<details open={battle.done} className="rounded-xl border bg-white p-4"><summary className="cursor-pointer text-sm font-bold">전투 분석 · 행동 로그 {battle.log.length}개</summary><div className="battle-summary-grid mt-4">{['attacker','defender'].map(side=><div key={side}><h3 className="mb-2 text-sm font-semibold">{side==='attacker'?'공격':'방어'}팀 누적 피해 <small className="text-xs font-normal text-zinc-500">보호막 포함</small></h3><ul>{battle.units.filter(u=>u.side===side).map(u=><li key={u.id}><span>{u.name}</span><strong>{Math.round(u.damageDealt).toLocaleString()}</strong></li>)}</ul></div>)}</div><ol className="mt-4 max-h-80 space-y-2 overflow-auto text-xs leading-relaxed text-zinc-600">{battle.log.map(row=><li key={row.step} className="border-t pt-2"><strong className="text-zinc-800">#{row.step} · 턴 {row.turn}</strong> {row.text}</li>)}</ol></details>}
    <BattleFormulaLab/>
  </div>;
}
