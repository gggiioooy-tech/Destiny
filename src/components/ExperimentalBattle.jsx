import React,{useEffect,useState} from 'react';
import {canViewHeroStats} from '../lib/heroBattleStats.js';
import {SIM_HEROES,MODEL_LIMITS,prepareHeroes,createBattle,advanceBattle} from '../lib/experimentalBattle.js';

const fields=[['attack','공격력'],['defense','방어력'],['maxHp','생명력'],['speed','속공'],['crit','치명타 %'],['critDamage','치명피해 %'],['accuracy','효과적중 %'],['resist','효과저항 %']];
const number=n=>Math.round(n).toLocaleString('ko-KR');
export default function ExperimentalBattle({currentUser,report}){
  const permitted=canViewHeroStats(currentUser);
  const [draft,setDraft]=useState(()=>prepareHeroes(report));
  const [battle,setBattle]=useState(null),[running,setRunning]=useState(false),[speed,setSpeed]=useState(1),[seed,setSeed]=useState(1),[armor,setArmor]=useState(1000),[error,setError]=useState('');
  useEffect(()=>{
    if(!running||!permitted)return;
    const id=setInterval(()=>setBattle(old=>old?advanceBattle(old):old),1000/speed);
    return()=>clearInterval(id);
  },[running,speed,permitted]);
  useEffect(()=>{if(battle?.done)setRunning(false);},[battle?.done]);
  if(!permitted)return null;
  function edit(i,key,value){setDraft(old=>old.map((h,j)=>j===i?{...h,[key]:value,origin:'직접 설정'}:h));}
  function start(){try{setBattle(createBattle(draft,{seed,armor}));setRunning(true);setError('');}catch(e){setError(e.message);}}
  const units=battle?.units||draft;
  return <div className="space-y-4">
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><strong>실시간 계산 · 실험판</strong><p className="mt-1">{MODEL_LIMITS}</p><p className="mt-1">현재 연희·쥬리·각성 윤건 지원. 스킬 배율 일부와 보호막·무효화·수면·방어 감소·불사를 적용합니다. 대상 선택은 앞줄 우선 / 스킬은 전체 공격으로 단순화하며, 2스 → 1스 → 평타 순으로 행동합니다. 지속시간은 해당 영웅 행동 횟수로 셉니다.</p></div>
    <details open={!battle} className="rounded-2xl border border-zinc-200 bg-white p-4"><summary className="cursor-pointer font-bold">영웅 배치 · 스탯 설정</summary><p className="my-3 text-xs text-zinc-500">같은 팀·같은 영웅의 수집 스탯이 있으면 불러옵니다. 나머지는 테스트 기본값입니다. 영웅 변경 시 스탯은 유지되므로 직접 조정해 주세요.</p>
      <div className="grid gap-3 lg:grid-cols-2">{['attacker','defender'].map(side=><fieldset key={side} className="min-w-0 space-y-3"><legend className="mb-2 font-bold">{side==='attacker'?'공격팀':'방어팀'}</legend>{draft.map((h,i)=>h.side===side&&<div key={h.id} className="rounded-xl border border-zinc-200 p-3"><div className="flex items-center justify-between gap-2"><select aria-label={`${side==='attacker'?'공격':'방어'} ${i%3+1}번 영웅`} value={h.name} onChange={e=>edit(i,'name',e.target.value)} className="rounded-lg border p-2 font-semibold">{SIM_HEROES.map(name=><option key={name}>{name}</option>)}</select><small>{h.origin}</small></div><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{fields.map(([key,label])=><label key={key} className="text-xs text-zinc-600">{label}<input type="number" min={key==='resist'?-1000000:key==='maxHp'?1:0} max="1000000" value={h[key]} onChange={e=>edit(i,key,e.target.value===''?'':Number(e.target.value))} className="mt-1 w-full rounded-lg border p-2 text-zinc-900"/></label>)}</div></div>)}</fieldset>)}</div>
      <div className="mt-4 flex flex-wrap gap-4"><label className="text-xs">난수 시드<input type="number" value={seed} onChange={e=>setSeed(Number(e.target.value))} className="ml-2 w-24 rounded border p-2"/></label><label className="text-xs">임시 방어 보정 상수<input type="number" min="1" max="100000" value={armor} onChange={e=>setArmor(Number(e.target.value))} className="ml-2 w-24 rounded border p-2"/></label></div><p className="mt-2 text-xs text-zinc-500">추정 피해 = 스킬 기초 피해 × 상수 ÷ (상수 + 보정 방어력) × 치명타 배율. 장비·펫의 스탯 증가분은 입력값에 포함해 주세요. 동일 설정·시드는 동일 결과가 나옵니다.</p>
    </details>
    <section className="overflow-hidden rounded-2xl border border-slate-600 bg-slate-950 p-4 text-slate-100 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs tracking-widest text-amber-200">15MONTH · LIVE BATTLE</p><h2 className="text-xl font-bold">{battle?.done?(battle.winner?(battle.winner==='attacker'?'공격팀':'방어팀')+' 승리':'판정 보류'):running?'전투 진행 중':'전투 대기'}</h2></div><span className="rounded-full border border-slate-600 px-3 py-1 text-xs">라운드 {battle?.round||0} · 행동 {battle?.step||0} · 추정 계산</span></div>
      <div className="grid grid-cols-2 gap-3 sm:gap-8">{['attacker','defender'].map(side=><div key={side} className="space-y-3"><h3 className={side==='attacker'?'text-blue-300':'text-red-300'}>{side==='attacker'?'공격팀':'방어팀'}</h3>{units.filter(u=>u.side===side).map(u=><article key={u.id} className={`rounded-xl border p-3 transition-colors motion-reduce:transition-none ${battle?.active===u.id?'border-amber-300 bg-slate-700':battle?.targets.includes(u.id)?'border-red-300 bg-slate-800':'border-slate-600 bg-slate-900'} ${u.hp===0?'opacity-40':''}`}><div className="flex items-center justify-between"><strong>{u.name}</strong><span aria-hidden="true">{u.name==='연희'?'☾':u.name==='쥬리'?'⚖':'✦'}</span></div><div className="my-2 h-2 overflow-hidden rounded bg-slate-700"><div className="h-full bg-emerald-400 transition-all motion-reduce:transition-none" style={{width:`${100*(u.hp??u.maxHp)/u.maxHp}%`}}/></div><p className="text-xs">HP {number(u.hp??u.maxHp)} / {number(u.maxHp)}</p><p className="mt-1 text-xs text-blue-200">보호막 {number(u.barrier||0)}</p><p className="mt-1 min-h-4 text-xs text-amber-200">{u.hp===0?'전투 불능':[u.nullify?'무효화 '+u.nullify:'',u.sleep?'수면 '+u.sleep:'',u.immortal?'불사 '+u.immortal:'',u.defDown?'방어 감소':''].filter(Boolean).join(' · ')}</p></article>)}</div>)}</div>
      <div className="mt-5 flex flex-wrap items-center gap-2"><button onClick={start} className="rounded-xl bg-amber-200 px-4 py-3 font-bold text-slate-950">{battle?'새 전투 시작':'전투 시작'}</button><button disabled={!battle||battle.done} onClick={()=>setRunning(v=>!v)} className="rounded-xl border border-slate-500 px-4 py-3 disabled:opacity-40">{running?'일시정지':'계속 진행'}</button><button disabled={!battle||running||battle.done} onClick={()=>setBattle(advanceBattle)} className="rounded-xl border border-slate-500 px-4 py-3 disabled:opacity-40">한 행동 진행</button><select aria-label="계산 진행 속도" value={speed} onChange={e=>setSpeed(Number(e.target.value))} className="rounded-lg border border-slate-500 bg-slate-900 p-3">{[1,2,4].map(n=><option key={n} value={n}>{n}배속</option>)}</select></div>
      <p role="status" className="mt-4 min-h-12 text-sm text-amber-100">{battle?.log[0]?.text||'영웅과 스탯을 설정하고 전투 시작을 누르세요. 저장된 리플레이의 피해값을 사용하지 않고 매 행동을 계산합니다.'}</p>
      <details className="mt-3"><summary className="cursor-pointer text-sm text-slate-300">계산 로그 ({battle?.log.length||0})</summary><ol className="mt-3 max-h-72 space-y-2 overflow-auto text-xs text-slate-300">{battle?.log.map(row=><li key={row.step}>#{row.step} · {row.text}</li>)}</ol></details>
    </section>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
