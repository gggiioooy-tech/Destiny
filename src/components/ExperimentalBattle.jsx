import React,{useEffect,useMemo,useState} from 'react';
import {canViewHeroStats} from '../lib/heroBattleStats.js';
import {SIM_HEROES,MODEL_LIMITS,prepareHeroes,createBattle,advanceBattle,defaultSkillPlans} from '../lib/experimentalBattle.js';
import {HERO_GROWTH} from '../lib/combatDamage.js';
import {inspectSetup,swapTeams,advanceSession,finishSession} from '../lib/simulationWorkspace.js';
import BattleFormulaLab from './BattleFormulaLab.jsx';
import BattleSetup from './BattleSetup.jsx';
import BattleArena from './BattleArena.jsx';
import SimulationPresets from './SimulationPresets.jsx';
import SimulationResults from './SimulationResults.jsx';
import BattlePrediction from './BattlePrediction.jsx';
import PrebattleSetup from './PrebattleSetup.jsx';
import {BASE_STATS,calculatePrebattle,defaultPrebattleSettings} from '../lib/prebattleStats.js';
import './simulationWorkspace.css';

function panelDraft(report){const names=prepareHeroes(report);return prepareHeroes().map((h,i)=>({...h,name:names[i].name,attack:BASE_STATS[names[i].name]?.attack||0,defense:BASE_STATS[names[i].name]?.defense||0,maxHp:BASE_STATS[names[i].name]?.maxHp||1,speed:0,crit:5,critDamage:150,origin:'테스트 기본값 · 장비 미반영 · 영웅 정보창 수치 입력 필요',exampleStats:true,panelEntered:[]}));}

export default function ExperimentalBattle({currentUser,report}){
  const permitted=canViewHeroStats(currentUser);
  const [draft,setDraft]=useState(()=>panelDraft(report)),[plans,setPlans]=useState(()=>defaultSkillPlans(panelDraft(report)));
  const [inputBasis,setInputBasis]=useState('panel'),[teamSettings,setTeamSettings]=useState(defaultPrebattleSettings);
  const [session,setSession]=useState(null),[view,setView]=useState('setup'),[running,setRunning]=useState(false),[speed,setSpeed]=useState(1),[seed,setSeed]=useState(1),[error,setError]=useState('');
  const battle=session?.frames[session.cursor]||null;
  const conversion=useMemo(()=>{try{return calculatePrebattle(draft,teamSettings,{basis:inputBasis});}catch(e){return {heroes:draft,breakdown:[],warnings:[],error:e.message};}},[draft,teamSettings,inputBasis]);
  useEffect(()=>{
    if(!running||!permitted)return;
    const id=setInterval(()=>setSession(old=>advanceSession(old,advanceBattle)),1600/speed);
    return()=>clearInterval(id);
  },[running,speed,permitted]);
  useEffect(()=>{if(battle?.done){setRunning(false);setView('results');}},[battle?.done]);
  if(!permitted)return null;
  const readiness=inspectSetup(conversion.heroes,plans);
  if(conversion.error)readiness.errors.push(conversion.error);
  function start(instant=false){
    setRunning(false);
    try{
      if(readiness.errors.length)throw Error(readiness.errors[0]);
      if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('난수 시드는 0~4294967295 범위의 정수로 입력해 주세요.');
      const next={frames:[createBattle(conversion.heroes,{seed,plans})],cursor:0};
      setSession(instant?finishSession(next,advanceBattle):next);setView(instant?'results':'battle');setRunning(!instant);setError('');
    }catch(e){setError(e.message);setView('setup');}
  }
  function stop(){setRunning(false);setSession(old=>old?{frames:[...old.frames.slice(0,old.cursor),{...old.frames[old.cursor],done:true,stopped:true,winner:null,action:null}],cursor:old.cursor}:old);}
  function seek(index){setRunning(false);setSession(old=>old?{...old,cursor:Math.max(0,Math.min(old.frames.length-1,Number(index)))}:old);setView('battle');}
  function load(doc){setRunning(false);setDraft(doc.draft);setPlans(doc.plans);setSeed(doc.seed);setInputBasis(doc.inputBasis||'battle');setTeamSettings(doc.teamSettings||defaultPrebattleSettings());setSession(null);setError('');setView('setup');}
  function reset(){const heroes=inputBasis==='panel'?panelDraft(report):prepareHeroes(report);load({draft:heroes,plans:defaultSkillPlans(heroes,inputBasis==='battle'?report:null),seed:1,inputBasis,teamSettings:defaultPrebattleSettings()});}
  function swap(){const next=swapTeams(draft,plans);load({...next,seed,inputBasis,teamSettings:{attacker:teamSettings.defender,defender:teamSettings.attacker}});}
  function changeBasis(next){const heroes=next==='panel'?panelDraft(report):prepareHeroes(report);load({draft:heroes,plans:defaultSkillPlans(heroes,next==='battle'?report:null),seed,inputBasis:next,teamSettings});}
  function changeView(next){if(next==='setup')setRunning(false);setView(next);}
  return <div className="sim-workspace">
    <header className="sim-workspace-heading"><div><p className="sim-eyebrow">GUILD WAR LAB</p><h2>전투 시뮬레이터 <span>{SIM_HEROES.length}종 영웅 선택</span></h2><p>{HERO_GROWTH.label} · {inputBasis==='panel'?'영웅 정보창 입력 → 전투 수치 자동 계산':'수집된 전투 시작 수치'}</p></div><span className="sim-model-badge">참고용 계산</span></header>
    <div className="sim-speed-summary"><span>공격팀 속공 합 <b>{readiness.speed.attacker}</b></span><span className="sim-speed-vs">VS</span><span>방어팀 속공 합 <b>{readiness.speed.defender}</b></span><small>{readiness.speed.attacker===readiness.speed.defender?'동률 · 시드로 선스킬 결정':readiness.speed.attacker>readiness.speed.defender?'공격팀 선스킬':'방어팀 선스킬'}</small></div>
    <nav className="sim-tabs" role="tablist" aria-label="시뮬레이션 단계">{[['setup','01','편성'],['battle','02','전투'],['results','03','결과 분석']].map(([key,n,label])=><button key={key} id={`sim-tab-${key}`} type="button" role="tab" aria-selected={view===key} aria-controls={`sim-panel-${key}`} tabIndex={view===key?0:-1} onKeyDown={e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const keys=['setup','battle','results'],next=keys[(keys.indexOf(key)+(e.key==='ArrowRight'?1:2))%3];changeView(next);document.getElementById('sim-tab-'+next)?.focus();}}} onClick={()=>changeView(key)}><small>{n}</small>{label}</button>)}</nav>
    {error&&<p role="alert" className="sim-error-banner">{error}</p>}
    <section id="sim-panel-setup" role="tabpanel" aria-labelledby="sim-tab-setup" hidden={view!=='setup'}>
      <SimulationPresets currentUser={currentUser} snapshot={{draft,plans,seed,inputBasis,teamSettings}} onLoad={load} disabled={running}/>
      <PrebattleSetup basis={inputBasis} onBasis={changeBasis} settings={teamSettings} setSettings={setTeamSettings} draft={draft} conversion={conversion}/>
      <div className="sim-setup-toolbar"><p>{readiness.exampleCount?`예시 스탯 ${readiness.exampleCount}명 · 실제 비교에는 수치를 입력해 주세요.`:'입력한 시작 스탯으로 전투를 계산합니다.'}</p><div><button type="button" className="sim-button" onClick={swap}>공격·방어 교환</button><button type="button" className="sim-button" onClick={reset}>{report?'저장 전투로 초기화':'기본 편성으로 초기화'}</button></div></div>
      <BattleSetup draft={draft} setDraft={setDraft} plans={plans} setPlans={setPlans} report={inputBasis==='battle'?report:null} seed={seed} setSeed={setSeed} inputBasis={inputBasis}/>
      <BattlePrediction draft={conversion.heroes} plans={plans} seed={seed} disabled={running||readiness.errors.length>0} exampleCount={readiness.exampleCount}/>
    </section>
    <section id="sim-panel-battle" role="tabpanel" aria-labelledby="sim-tab-battle" hidden={view!=='battle'}><BattleArena draft={conversion.heroes} battle={battle} running={running}/>{session&&<div className="sim-scrubber"><button type="button" className="sim-button" disabled={running||session.cursor===0} onClick={()=>seek(session.cursor-1)}>← 이전</button><label>장면 {session.cursor} / {session.frames.length-1}<input aria-label="전투 장면 이동" type="range" min="0" max={session.frames.length-1} value={session.cursor} onChange={e=>seek(e.target.value)}/></label><button type="button" className="sim-button" disabled={running||battle?.done} onClick={()=>setSession(old=>advanceSession(old,advanceBattle))}>다음 →</button></div>}</section>
    <section id="sim-panel-results" role="tabpanel" aria-labelledby="sim-tab-results" hidden={view!=='results'}><SimulationResults session={session} onSeek={seek}/></section>
    <div className="sim-action-bar"><div><button type="button" onClick={()=>start()} className="sim-button sim-button-primary" disabled={running||readiness.errors.length>0}>{session?'새 전투 시작':'전투 시작'}</button><button type="button" onClick={()=>start(true)} className="sim-button" disabled={running||readiness.errors.length>0}>빠른 계산</button><button type="button" className="sim-button" disabled={!session||battle?.done} onClick={()=>{setRunning(v=>!v);setView('battle');}}>{running?'일시정지':'계속 진행'}</button><button type="button" className="sim-button" disabled={!session||battle?.done} onClick={stop}>전투 종료</button></div><label>배속<select aria-label="전투 진행 속도" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.5,1,2,4].map(n=><option key={n} value={n}>{n}배</option>)}</select></label></div>
    {readiness.errors.length>0&&<p role="alert" className="sim-error-banner">{readiness.errors.join(' ')}</p>}
    <details className="sim-coverage"><summary>계산 범위 · 빠진 효과 확인</summary><p>{MODEL_LIMITS}</p><p>영웅별 소요 시간 자료는 일부만 확보했습니다. 반격·협공·서버 지연·쿨타임 변경과 전체 펫·장비·고유 패시브는 아직 완전 재현되지 않았습니다. 실제 승패 예측 도구로 검증된 상태는 아닙니다.</p><div className="sim-coverage-grid">{readiness.coverage.map(h=><article key={h.id}><strong>{h.side==='attacker'?'공격':'방어'} · {h.name}</strong><ul>{h.issues.slice(0,8).map((issue,i)=><li key={i}>{issue.skill} · {issue.text}</li>)}</ul>{h.issues.length>8&&<small>외 {h.issues.length-8}개 · 영웅 스킬 자료에서 확인</small>}</article>)}</div></details>
    <p className="sim-source-note">편성을 바꾸면 새 전투 시작을 눌러 적용하세요. 기존 전투 장면은 계산 당시의 설정을 유지합니다.</p><BattleFormulaLab/>
  </div>;
}
