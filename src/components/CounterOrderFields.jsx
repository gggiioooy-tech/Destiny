import React from 'react';
import { parseCounterOrder } from '../lib/counterOrders.js';
const selectClass = 'mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-950';
const skillName = skill => skill === '각성기' ? skill : skill ? `스킬${skill}` : '미지정';
export function CounterOrderFields({ heroes, value, kind, onChange }) {
  const order = parseCounterOrder(value, heroes, kind);
  const speed = kind === 'speed';
  const label = speed ? '속공순서' : '스킬순서';
  const update = (index, next) => onChange(JSON.stringify({ ...order, steps: order.steps.map((step, i) => i === index ? next : step) }));
  return <section className="space-y-3">
    <h5 className="text-sm font-semibold text-zinc-950">추천 {label}</h5>
    <div className="grid gap-3 md:grid-cols-3">
      {order.steps.map((step, index) => {
        const hero = speed ? step : step.hero;
        return <div key={index} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <label className="block text-xs font-semibold text-zinc-600">{label}{index + 1}
            <select aria-label={`${label}${index + 1} 영웅`} className={selectClass} value={hero} onChange={e => update(index, speed ? e.target.value : { ...step, hero: e.target.value })}>
              <option value="">영웅 선택</option>
              {hero && !heroes.includes(hero) && <option value={hero} disabled>{hero} (다시 선택)</option>}
              {heroes.map(name => <option key={name} value={name} disabled={speed && name !== hero && order.steps.includes(name)}>{name}</option>)}
            </select>
          </label>
          {!speed && <><label className="mt-3 block text-xs text-zinc-600">스킬
            <select aria-label={`스킬순서${index + 1} 스킬`} className={selectClass} value={step.skill} onChange={e => update(index, {...step, skill:e.target.value})}>
              <option value="">스킬 선택</option><option value="1">스킬1</option><option value="2">스킬2</option><option value="각성기">각성기</option>
            </select>
          </label>{order.steps.length > 1 && <button type="button" className="mt-3 text-xs text-red-600" onClick={() => onChange(JSON.stringify({...order,steps:order.steps.filter((_,i)=>i!==index)}))}>{label}{index + 1} 삭제</button>}</>}
        </div>;
      })}
    </div>
    {!speed && <button type="button" className="site-button rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs" onClick={() => onChange(JSON.stringify({...order,steps:[...order.steps,{hero:'',skill:''}]}))}>+ 스킬순서 추가</button>}
    {order.note && <label className="block text-xs text-zinc-500">기존 순서 메모
      <textarea className={selectClass} rows={3} value={order.note} onChange={e=>onChange(JSON.stringify({...order,note:e.target.value}))} />
    </label>}
  </section>;
}
export function CounterOrderDisplay({ heroes, value, kind }) {
  const {steps,note} = parseCounterOrder(value, heroes, kind);
  const speed = kind === 'speed';
  return <div className="space-y-2">
    <div className="grid gap-2 sm:grid-cols-3">
      {steps.map((step,index) => <div key={index} className="min-w-0 rounded-lg border border-zinc-200 p-2">
        <p className="text-[11px] text-zinc-500">{speed ? '속공순서' : '스킬순서'}{index+1}</p>
        <p className="mt-1 text-sm font-semibold text-zinc-950">{(speed ? step : step.hero) || '미지정'}</p>
        {!speed && <p className="mt-1 text-xs text-zinc-700">{skillName(step.skill)}</p>}
      </div>)}
    </div>
    {note && <p className="whitespace-pre-wrap text-xs text-zinc-500">기존 메모: {note}</p>}
  </div>;
}
