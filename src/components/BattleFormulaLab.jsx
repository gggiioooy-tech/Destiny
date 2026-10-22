import React,{useState} from 'react';
import {calculateRecovery,calculateShield,convertedHealth} from '../lib/combatDamage.js';

export default function BattleFormulaLab(){
  const [values,setValues]=useState({base:1000,regeneration:0,increase:0,decrease:0,hp:8000,maxHp:10000,percent:39});
  const [model,setModel]=useState('additive'),[blocked,setBlocked]=useState(false);
  const labels={base:'회복·보호막 기초량',regeneration:'재생 %',increase:'받는 회복 증가 %',decrease:'받는 회복 감소 %',hp:'현재 생명력',maxHp:'최대 생명력',percent:'전환 후 생명력 %'};
  const valid=Object.values(values).every(v=>Number.isFinite(v)&&v>=0&&v<=1000000)&&values.hp<=values.maxHp&&values.percent<=100;
  return <details className="rounded-2xl border border-zinc-200 bg-white p-4">
    <summary className="cursor-pointer font-bold">회복·보호막·생명력 전환 검산</summary>
    <p className="my-3 text-xs text-zinc-600">재생과 회복 증감의 합산 순서는 실측 검증 전입니다. 아래 두 모델을 비교할 수 있으며 결과는 현재 전투에 자동 적용되지 않습니다. 생명력 전환은 현재 HP를 늘리지 않고 최대 HP의 지정 비율 이하로 낮춥니다.</p>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(labels).map(([key,label])=><label key={key} className="text-xs">{label}<input type="number" min="0" max={key==='percent'?100:1000000} value={values[key]} onChange={e=>setValues(old=>({...old,[key]:e.target.value===''?'':Number(e.target.value)}))} className="mt-1 w-full rounded-lg border p-2"/></label>)}</div>
    <div className="my-3 flex flex-wrap items-center gap-3"><label className="text-xs">회복 실험 모델<select value={model} onChange={e=>setModel(e.target.value)} className="ml-2 rounded border p-2"><option value="additive">재생·증가·감소 합산</option><option value="separate">재생 별도 곱연산</option></select></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={blocked} onChange={e=>setBlocked(e.target.checked)}/>회복 불가</label></div>
    {valid?<dl className="grid gap-2 text-sm sm:grid-cols-3"><div>회복량 <strong>{calculateRecovery({...values,model,blocked}).toLocaleString()}</strong></div><div>보호막량 <strong>{calculateShield(values).toLocaleString()}</strong></div><div>전환 후 HP <strong>{convertedHealth(values).toLocaleString()}</strong></div></dl>:<p role="status" className="text-sm text-red-700">유효한 수치를 입력해 주세요. 현재 HP는 최대 HP 이하, 전환 비율은 0~100%입니다.</p>}
    <p className="mt-3 text-xs text-zinc-500">고정 피해·지속 피해에 치명타/방어/피해 보정이 적용되는 범위와 최종 반올림 단계는 추가 검증 대상입니다. 현재 계산기의 기본 반올림은 최종 타격·회복·보호막 단위입니다.</p>
  </details>;
}
