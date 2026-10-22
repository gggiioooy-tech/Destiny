import React,{useState} from 'react';
import {heroProfile} from '../lib/simulationSkills.js';
import './battleArena.css';

const number=n=>Math.round(n||0).toLocaleString('ko-KR');
export function HeroPortrait({name,className=''}){
  const [failed,setFailed]=useState(false),profile=heroProfile(name);
  return profile?.portrait&&!failed?<img className={className} src={profile.portrait} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<span className={`battle-portrait-fallback ${className}`} aria-hidden="true">{name.slice(0,1)}</span>;
}
function badges(u){return [u.nullify>0&&`무효 ${u.nullify}`,u.barrier>0&&`보호막 ${number(u.barrier)}`,u.immortal>0&&`불사 ${u.immortal}`,u.sleep>0&&`수면 ${u.sleep}`,u.control>0&&`${u.controlName} ${u.control}`,u.silence>0&&`침묵 ${u.silence}`,u.immunity>0&&`면역 ${u.immunity}`,u.defDown>0&&`방어↓ ${Math.round(u.defDown*100)}%`].filter(Boolean);}

export default function BattleArena({draft,battle,running}){
  const units=battle?.units||draft,action=battle?.action;
  const winner=battle?.winner==='attacker'?'공격팀':battle?.winner==='defender'?'방어팀':null;
  return <section className="battle-theater" aria-label="실시간 전투 화면">
    <div className="battle-scoreboard"><div><span className="battle-live-label">GUILD WAR · SIMULATION</span><h2>{battle?.stopped?'사용자가 전투를 종료했습니다':battle?.done?(winner?`${winner} 승리 · 참고 결과`:'전투 종료 · 판정 보류'):running?'전투 진행 중':battle?'전투 일시정지':'전투 준비'}</h2></div><div className="battle-turn"><strong>{String(battle?.turn||0).padStart(2,'0')}</strong><span>TURN · 행동 {battle?.step||0}</span></div></div>
    <div className="battle-team-headings"><span>ATTACK <b>공격팀</b></span><span><b>방어팀</b> DEFENSE</span></div>
    <div className="battle-field">
      <div className="battle-floor" aria-hidden="true"/><span className="battle-versus" aria-hidden="true">VS</span>
      {['attacker','defender'].map(side=><div key={side} className={`battle-formation battle-formation-${side}`}>
        {units.filter(u=>u.side===side).map((u,index)=>{
          const impacts=(battle?.impacts||[]).filter(e=>e.target===u.id),damage=impacts.reduce((n,e)=>n+(e.damage||0)+(e.absorbed||0),0),healing=impacts.reduce((n,e)=>n+(e.heal||0),0);
          const hp=u.hp??u.maxHp,active=battle?.active===u.id,hit=impacts.length>0;
          return <article key={u.id} className={`battle-fighter battle-slot-${index} ${active?'battle-acting':''} ${hp<=0?'battle-fallen':''}`} aria-label={`${side==='attacker'?'공격':'방어'} ${u.name} 생명력 ${hp}/${u.maxHp}`}>
            <div className="battle-fighter-art" key={`${u.name}:${battle?.step||0}`}>
              <div className={`battle-portrait-ring ${hit?'battle-hit':''}`}><HeroPortrait key={u.name} name={u.name} className="battle-portrait"/></div>
              {active&&action&&<span className="battle-actor-flare" aria-hidden="true"/>}
              {hit&&<div className="battle-floating" aria-hidden="true">{damage>0?<><small>{impacts.some(e=>e.critical)?'CRITICAL':impacts.some(e=>e.weak)?'WEAK POINT':'HIT'}</small><strong>−{number(damage)}</strong></>:healing>0?<strong className="battle-heal">+{number(healing)}</strong>:<strong className="battle-immune">{impacts.some(e=>e.kind==='nullify')?'무효화':'면역'}</strong>}</div>}
              {hp<=0&&<span className="battle-dead-label">전투 불능</span>}
            </div>
            <div className="battle-fighter-info"><div className="battle-fighter-name"><b>{u.name}</b><span>{heroProfile(u.name)?.awakened?'각성':index===0?'선봉':'후열'}</span></div><div className="battle-hp" role="progressbar" aria-label={`${u.name} 생명력`} aria-valuemin={0} aria-valuemax={u.maxHp} aria-valuenow={hp}><i style={{width:`${Math.max(0,Math.min(100,100*hp/u.maxHp))}%`}}/></div><span className="battle-hp-number">{number(hp)} <span>/ {number(u.maxHp)}</span></span><div className="battle-badges">{badges(u).map(text=><span key={text}>{text}</span>)}</div></div>
          </article>;
        })}
      </div>)}
      {action&&<div key={`skill:${battle.step}`} className={`battle-skill-banner battle-skill-${action.side}`}><span>{units[action.source].name} · {action.kind==='basic'?'기본 공격':'스킬 발동'}</span><strong>{action.name}</strong></div>}
      {battle?.done&&<div className="battle-result"><span>전투 계산 종료</span><strong>{battle.stopped?'전투 중단':winner?`${winner} 승리`:'판정 보류'}</strong><small>{battle.stopped?'새 전투를 시작할 수 있습니다':'미구현 효과가 포함된 실험 결과'}</small></div>}
    </div>
    <div className="battle-commentary" role="status">{battle?.log[0]?.text||'양 팀 영웅과 시작 스탯을 설정하고 전투를 시작하세요.'}</div>
  </section>;
}
