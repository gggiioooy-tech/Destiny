import {hitProbabilities,calculateHit,rollEffect,calculateShield,calculateRecovery,convertedHealth,HERO_GROWTH} from './combatDamage.js';
import {receiveDamage,tickPersonalTurn} from './battleSurvival.js';
import {SIM_ROSTER,canonicalHero,heroSkills,skillFor,DETAILED_HEROES} from './simulationSkills.js';
import {actionTiming,BATTLE_LIMIT_MS,TIMING_CATALOG,resolveTimeout} from './battleTiming.js';
import {reducePanelTimedBuffs,incomingModifiers} from './prebattleStats.js';
// Experimental community model; action scheduling is still a prototype.
export const SIM_HEROES=SIM_ROSTER.map(h=>h.name);
export const MODEL_LIMITS='6초월·5강·풀스킬 강화 기준입니다. 영웅별 리플레이 관측 시간과 210초 제한을 사용하며 미확보 시간은 추정입니다. 확인된 스킬 쿨타임과 각성 게이지를 계산합니다. 시간 초과는 팀 최대 HP 대비 잔여 HP 비율과 불사·불굴 조건으로 판정합니다. 고유 패시브·각성기 부가 효과·반격·협공·쿨타임 변경·전체 펫/장비 효과와 서버 지연은 완전 구현되지 않아 승패는 참고용입니다. 입력은 전투 시작 스탯이며 상시 증가를 중복 가산하지 않습니다.';
export function prepareHeroes(report){
  return Array.from({length:6},(_,i)=>{
    const side=i<3?'attacker':'defender',candidate=canonicalHero(report?.heroes.filter(h=>h.side===side)[i%3]?.name);
    const name=SIM_HEROES.includes(candidate)?candidate:['연희','쥬리','윤건'][i%3];
    const source=report?.heroes.find(h=>h.side===side&&canonicalHero(h.name)===name);
    const s=source?.stats;
    return {id:i,name,side,attack:s?Math.max(s['1']||0,s['3']||0):8000,defense:s?.['5']??1800,maxHp:s?.['7']??10000,speed:s?.['9']??(100-i),crit:(s?.['10']??750)/10,critDamage:(s?.['11']??1500)/10,accuracy:(s?.['13']??0)/10,resist:(s?.['14']??0)/10,block:(s?.['17']??0)/10,shred:(s?.['22']??0)/10,elasticity:(s?.['23']??0)/10,weakPoint:(s?.['12']??0)/10,damageReduction:(s?.['18']??0)/10,amplification:(s?.['21']??0)/10,regeneration:(s?.['24']??0)/10,damageIncrease:0,vulnerability:0,weakBonus:0,missChance:0,blockBuff:0,blockDebuff:0,blockReduction:50,origin:source?'수집된 시작 스탯':'테스트 기본값'};
  });
}
export function defaultSkillPlans(heroes,report){
  const plans={attacker:[{id:0,code:3},{id:2,code:2},{id:2,code:3}],defender:[{id:3,code:3},{id:5,code:2},{id:5,code:3}]};
  if(heroes&&report?.timeline)for(const side of ['attacker','defender']){
    const observed=[];
    for(const action of report.timeline){
      if(![2,3].includes(action.skillCode))continue;
      const source=report.heroes.find(h=>h.objectId===action.source&&h.side===side);
      const unit=source&&heroes.find(h=>h.side===side&&h.name===canonicalHero(source.name));
      if(unit)observed.push({id:unit.id,code:action.skillCode});
      if(observed.length===3)break;
    }
    if(observed.length===3)plans[side]=observed;
  }
  if(heroes)for(const side of ['attacker','defender'])for(const p of plans[side])if(!skillFor(heroes[p.id]?.name,p.code))p.code=heroSkills(heroes[p.id]?.name).find(s=>[2,3].includes(s.code))?.code||2;
  return plans;
}
export function changeHero(heroes,index,name,report){
  if(!SIM_HEROES.includes(name))return heroes;
  const old=heroes[index],source=report?.heroes.find(h=>h.side===old.side&&canonicalHero(h.name)===name);
  const defaults=prepareHeroes(source?{heroes:[source]}:undefined)[old.side==='attacker'?0:3];
  // Reset old hero's equipment stats instead of silently transferring them.
  return heroes.map((h,i)=>i===index?{...defaults,id:old.id,side:old.side,name,origin:source?'수집된 시작 스탯':'테스트 기본값 · 직접 입력 필요'}:h);
}
function passiveState(name){
  if(DETAILED_HEROES.has(name))return {};
  const raw=heroSkills(name).find(s=>s.code===4)?.raw,text=raw?.text||'';
  let self=raw?.targetType===1;const own=[];
  for(const l of text.split('\n')){
    const label=l.replace(/^[\[(]\s*/,'');
    if(/^자신/.test(label))self=true;
    else if(/^(?:모든 )?(?:아군|적군)|^단일 (?:아군|적군)/.test(label))self=false;
    if(self&&l.startsWith('-')&&!/경우|이하|이상|발동 시|부활 시|아군|적군/.test(l))own.push(l);
  }
  const direct=own.join('\n');
  const shield=direct.match(/시전자 (?:물리 |마법 )?(공격력|최대 생명력)의\s*([\d.]+)%.*?보호막\s*\[(\d+)턴/);
  const reviveUpgrade=text.match(/효과 상승\s*[:：]\s*부활 시 생명력\s*(\d+)%/);
  const reviveImmunity=text.match(/(?:자신 )?부활 시 모든 피해 면역\s*\[(\d+)턴/);
  return {nullify:Number(direct.match(/모든 피해 무효화\s*\[피격\s*(\d+)회/)?.[1]||0),
    guts:/권능/.test(direct),revivePercent:Number(reviveUpgrade?.[1]||direct.match(/사망 시 생명력\s*(\d+)%로 부활/)?.[1]||0),
    reviveIndomitableHits:Number(direct.match(/사망 시 불굴 상태로 부활\s*\[피격\s*(\d+)회/)?.[1]||0),
    reviveImmunity:Number(reviveImmunity?.[1]||0),
    initialShield:shield?{scale:shield[1]==='최대 생명력'?'maxHp':'attack',value:Number(shield[2])/100,turns:Number(shield[3])}:null,
    superiority:Number(direct.match(/우위\s*\[(\d+)턴/)?.[1]||0),
    ...(/축복/.test(direct)?{blessing:25}:{}),
    reviveImmortalTurns:Number(direct.match(/사망 시 불사.*?\[(\d+)턴/)?.[1]||0),
    immunity:Number(direct.match(/모든 피해 면역\s*\[(\d+)턴/)?.[1]||0),
    controlImmune:Number(direct.match(/행동 제어 면역\s*\[(\d+)턴/)?.[1]||0)};
}
export function createBattle(heroes,{seed=1,plans=defaultSkillPlans(heroes)}={}){
  if(heroes.length!==6||heroes.filter(h=>h.side==='attacker').length!==3||heroes.filter(h=>h.side==='defender').length!==3||heroes.some(h=>!SIM_HEROES.includes(h.name)))throw Error('지원 영웅을 양 팀에 3명씩 배치해 주세요.');
  for(const h of heroes)for(const k of ['attack','defense','maxHp','speed','crit','critDamage','accuracy','resist','block','shred','elasticity','blockBuff','blockDebuff','blockReduction','weakPoint','damageReduction','amplification','regeneration','damageIncrease','vulnerability','weakBonus','missChance'])if(!Number.isFinite(h[k])||Math.abs(h[k])>1000000||(h[k]<0&&!['resist','crit','weakPoint','block'].includes(k))||(k==='maxHp'&&h[k]<1)||(k==='blockReduction'&&h[k]>100))throw Error('스탯은 유효한 숫자로 입력해 주세요. 막기 피해감소는 0~100%입니다.');
  for(const side of ['attacker','defender'])if(!Array.isArray(plans[side])||plans[side].length!==3||plans[side].some(p=>!Number.isInteger(p.id)||heroes[p.id]?.side!==side||![2,3].includes(p.code)))throw Error('팀마다 사용할 스킬 3개를 선택해 주세요.');
  const state={growth:HERO_GROWTH,units:heroes.map((h,i)=>({...h,id:i,hp:h.maxHp,barrier:h.name==='윤건'?calculateShield({base:h.attack*1.85,regeneration:h.regeneration}):0,barrierTurns:h.name==='윤건'?3:0,damageBuffTurns:h.name==='연희'?3:0,blessing:h.name==='윤건'?25:0,reviveImmortalTurns:h.name==='쥬리'?3:0,controlImmune:h.name==='쥬리'?3:0,nullify:h.name==='쥬리'?3:0,sleep:0,defDown:0,defTurns:0,immortal:0,immunity:0,annihilation:0,control:0,silence:0,healBlock:0,damageDealt:0,healingDone:0,awakenGauge:0,awakenMax:skillFor(h.name,7)?.raw.gauge||0,awakenUsed:false,...passiveState(h.name),revived:false,triggered:false,actions:0,skillActions:0})),seed:(Number(seed)>>>0)||1,step:0,turn:0,round:0,phase:0,plans:structuredClone(plans),queue:[],log:[],done:false,winner:null,active:null,targets:[],impacts:[],action:null,awakenLocks:{attacker:0,defender:0}};
  for(const unit of state.units){
    unit.readyAt={};
    if(unit.initialShield){unit.barrier=calculateShield({base:unit[unit.initialShield.scale]*unit.initialShield.value,regeneration:unit.regeneration});unit.barrierTurns=unit.initialShield.turns;}
  }
  state.elapsedMs=0;state.timeLimitMs=BATTLE_LIMIT_MS;state.timingEstimates=0;state.timingObserved=0;
  const sum=side=>heroes.filter(h=>h.side===side).reduce((n,h)=>n+h.speed,0),a=sum('attacker'),b=sum('defender');
  state.skillSide=a===b?(random(state)<.5?'attacker':'defender'):a>b?'attacker':'defender';return state;
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function scheduled(s){
  if(s.phase===0){
    const side=s.skillSide,ready=s.units.filter(u=>u.side===side&&u.hp>0&&!u.sleep&&!u.control&&!u.silence),plan=s.plans[side];
    s.plans[side]=plan.filter(p=>ready.some(u=>u.id===p.id));
    const reserved=s.plans[side][0]||null;
    const usable=(unit,code,isReserved=false)=>{
      const spec=skillFor(unit.name,code);if(!spec)return false;
      if((unit.readyAt?.[code]||0)>(s.elapsedMs||0))return false;
      if(spec.hits||!spec.effects.length)return true;
      const healing=spec.effects.some(e=>e.type==='heal'),revival=spec.effects.some(e=>e.type==='revive');
      if(!healing&&!revival)return true;
      return healing&&s.units.some(u=>u.side===side&&u.hp>0&&u.hp/u.maxHp<(isReserved?.999:.7))||revival&&s.units.some(u=>u.side===side&&u.hp===0&&!u.annihilation);
    };
    const lock=s.awakenLocks[side],awakened=!reserved&&!lock?ready.filter(u=>!u.awakenUsed&&u.awakenMax>0&&u.awakenGauge>=u.awakenMax&&usable(u,7)).sort((a,b)=>b.speed-a.speed||a.id-b.id)[0]:null;
    const candidate=reserved?s.units[reserved.id]:awakened||ready.sort((a,b)=>a.skillActions-b.skillActions||a.id-b.id).find(u=>heroSkills(u.name).some(v=>[2,3].includes(v.code)&&usable(u,v.code)));
    const available=candidate?heroSkills(candidate.name).filter(v=>[2,3].includes(v.code)&&usable(candidate,v.code)):[];
    const code=reserved?.code||(awakened?7:available[candidate?.skillActions%available.length]?.code||2);
    const actor=candidate&&usable(candidate,code,Boolean(reserved))?candidate:null;
    if(actor&&reserved)s.plans[side].shift();
    s.phase=1;s.skillSide=side==='attacker'?'defender':'attacker';
    s.awakenLocks[side]=actor&&code===7?2:Math.max(0,lock-1);
    return {actor,code,kind:'skill',side};
  }
  if(!s.queue.some(id=>s.units[id].hp>0)){
    s.round++;const ties=new Map(s.units.map(u=>[u.id,random(s)]));
    s.queue=s.units.filter(u=>u.hp>0).sort((a,b)=>b.speed-a.speed||(a.id%3)-(b.id%3)||ties.get(a.id)-ties.get(b.id)).map(u=>u.id);
  }
  let actor;while(s.queue.length&&!actor){const u=s.units[s.queue.shift()];if(u.hp>0)actor=u;}
  s.phase=(s.phase+1)%3;s.turn++;return {actor,code:1,kind:'basic'};
}
function finishStep(s,events,meta={}){
  s.targets=[...new Set(s.targets)];
  const alive=side=>s.units.some(u=>u.side===side&&u.hp>0),a=alive('attacker'),b=alive('defender');
  if(!a||!b){s.done=true;s.winner=a&&!b?'attacker':b&&!a?'defender':null;s.endReason='elimination';}
  else if(s.elapsedMs>=s.timeLimitMs){const verdict=resolveTimeout(s.units);s.done=true;s.winner=verdict.winner;s.endReason='timeout';s.timeoutVerdict=verdict;events.push('3분 30초 종료 · 잔여 HP 비율 및 불사·불굴 판정');}
  else if(s.step>=180){s.done=true;s.winner=null;s.endReason='action_guard';}
  if(s.done)events.push(s.winner?(s.winner==='attacker'?'공격팀':'방어팀')+' 승리 (추정 모델)':'동률 또는 계산 안전 한도 · 판정 보류');
  s.log=[{step:s.step,turn:s.turn,round:s.round,...meta,text:events.join(' / ')},...s.log].slice(0,180);return s;
}
export function advanceBattle(previous){
  if(previous.done)return previous;
  const s=structuredClone(previous),events=[];s.targets=[];s.impacts=[];s.action=null;s.reactions=[];
  const alive=side=>s.units.filter(u=>u.side===side&&u.hp>0),action=scheduled(s),{actor,code,kind}=action;
  s.step++;s.active=actor?.id??null;
  const timing=actor&&!(actor.sleep>0||actor.control>0)?actionTiming(actor.name,code,kind==='basic'?'basic':'skill'):{medianMs:200,estimated:true,count:0};
  const spacing=s.step===1?0:TIMING_CATALOG.spacing?.medianMs||200;
  const actionStartMs=(s.elapsedMs||0)+spacing,duration=actor&&(actor.sleep>0||actor.control>0)?200:timing.medianMs;
  s.lastTiming={...timing,durationMs:duration,spacingMs:spacing,startMs:actionStartMs,endMs:actionStartMs+duration};
  if(timing.estimated)s.timingEstimates++;else s.timingObserved++;
  if(actionStartMs+duration>s.timeLimitMs){s.elapsedMs=s.timeLimitMs;return finishStep(s,['시간 제한 안에 다음 행동을 완료하지 못했습니다.'],{kind:'timeout'});}
  s.elapsedMs=actionStartMs+duration;
  if(!actor)return finishStep(s,[`${action.side==='attacker'?'공격':'방어'}팀 · 사용 가능한 스킬 없음`],{kind:'skip'});
  const before={...actor};
  const enemies=alive(actor.side==='attacker'?'defender':'attacker');
  const weak=random(s)<Math.min(1,actor.weakPoint/100);
  const targetsFor=n=>n===1&&weak?[...enemies].sort((a,b)=>(a.immortal>0||a.immunity>0)-(b.immortal>0||b.immunity>0)||a.hp/a.maxHp-b.hp/b.maxHp).slice(0,1):enemies.slice(0,n);
  const singleTarget=actor.name==='윤건'&&code!==7?code===1:actor.name==='연희'||actor.name==='쥬리'?false:skillFor(actor.name,code)?.targets===1;
  const landed=new Set(),reactions=[],counterCandidates=new Set();
  function countRadHits(target){
    for(const rad of s.units.filter(u=>u.side===target.side&&u.name==='라드그리드'&&u.hp>0)){
      rad.alliedHits=(rad.alliedHits||0)+1;
      if(rad.alliedHits>=5){rad.alliedHits-=5;reactions.push({source:rad.id,code:4,kind:'rad_passive'});}
    }
  }
  function hit(target,base,{ignore=0,pierce=false,beforeDamage=null}={}){
    if(target.hp<=0)return;
    s.targets.push(target.id);
    const paralysis=target.control>0&&target.controlName==='마비';
    const chances=hitProbabilities({crit:actor.crit,block:paralysis?0:target.block,blockBuff:paralysis?0:target.blockBuff,blockDebuff:target.blockDebuff,shred:actor.shred});
    const hitWeak=singleTarget?weak:random(s)<Math.min(1,actor.weakPoint/100);
    const superiority=target.superiority>0&&target.attack>actor.attack;
    const missed=superiority||(kind==='basic'&&actor.blind>0)||(!hitWeak&&random(s)<Math.min(1,(actor.missChance+(actor.superiorityMiss||0))/100)),roll=random(s),critical=!missed&&(target.sleep>0||roll<chances.critical),isBlock=!critical&&roll<chances.critical+chances.blocked;
    if(!missed)beforeDamage?.();
    const damage=calculateHit({base,defense:target.defense,defenseDecrease:target.defDown,ignore,critDamage:actor.critDamage,elasticity:target.elasticity,critical,blocked:isBlock,blockReduction:target.blockReduction,weak:hitWeak,weakBonus:actor.weakBonus,damageIncrease:actor.damageIncrease+(actor.name==='연희'&&actor.damageBuffTurns>0&&!actor.panelComputed?35:0),amplification:actor.amplification,...incomingModifiers(actor,target),missed});
    const previousRevived=target.revived;
    const outcome=receiveDamage(target,superiority?damage*.8:damage,{pierce:pierce||actor.name==='탄지로'});Object.assign(target,outcome.target);
    if(superiority&&rollEffect({baseChance:100,accuracy:target.accuracy,resistance:actor.resist},()=>random(s))){actor.defDown=Math.max(actor.defDown,.36);actor.defTurns=Math.max(actor.defTurns,2);actor.superiorityMiss=60;actor.superiorityMissTurns=2;}
    if(!missed)landed.add(target.id);
    if(!missed&&outcome.kind!=='immune')countRadHits(target);
    if(!missed&&target.name==='루디')counterCandidates.add(target.id);
    if(target.hp===0||target.revived!==previousRevived)target.awakenGauge=Math.floor((target.awakenGauge||0)*.9);
    actor.damageDealt+=outcome.damage+outcome.absorbed;
    s.impacts.push({target:target.id,damage:outcome.damage,absorbed:outcome.absorbed,critical,blocked:isBlock,weak:hitWeak,missed,kind:outcome.kind,events:outcome.events});
    events.push(`${target.name} ${outcome.kind==='damage'?'−'+outcome.damage.toLocaleString()+(critical?' 치명타':'')+(isBlock?' 막기':'')+(hitWeak?' 약점':'')+(missed?' 빗나감':''):outcome.events.join(' · ')}${outcome.absorbed?' · 보호막 '+outcome.absorbed.toLocaleString():''}`);
    if(outcome.kind==='damage'&&outcome.events.length)events.push(...outcome.events.map(e=>target.name+' · '+e));
    if(target.sleep&&outcome.damage>=target.maxHp*(target.sleepBreak||.3))target.sleep=0;
    if(!missed&&target.hp>0&&target.control>0&&target.controlName==='감전'&&target.shockSource){
      const shockCaster=s.units[target.shockSource.id];
      const shock=calculateHit({base:target.shockSource.attack*.4,defense:target.defense,defenseDecrease:target.defDown,...(shockCaster?incomingModifiers(shockCaster,target):{damageReduction:target.damageReduction})});
      const extra=receiveDamage(target,shock);Object.assign(target,extra.target);
      const caster=s.units[target.shockSource.id];if(caster)caster.damageDealt+=extra.damage+extra.absorbed;
      s.impacts.push({target:target.id,damage:extra.damage,absorbed:extra.absorbed,kind:'shock'});events.push(`${target.name} · 감전 추가 피해 ${extra.damage}`);
    }
    if(target.name==='연희'&&!target.triggered&&target.hp>0&&target.hp<=target.maxHp*.7){target.nullify=4;target.triggered=true;events.push('연희 · 피해 무효화 4회');}
    return {missed};
  }
  const effect=(target,chance,status)=>rollEffect({baseChance:chance+(actor.effectChanceBonus||0)+(status==='감전'?actor.shockChanceBonus||0:0),accuracy:actor.accuracy,resistance:target.control>0&&target.controlName==='공포'?0:target.resist},()=>random(s));
  if(actor.sleep>0||actor.control>0){events.push(`${actor.name} · ${actor.sleep?'수면':actor.controlName||'행동 제어'}으로 행동 불가`);}
  else {
    actor.actions++;if(kind==='skill')actor.skillActions++;
    if([2,3].includes(code)){const cooldown=skillFor(actor.name,code)?.cooldown||0;actor.readyAt[code]=actionStartMs+cooldown*1000;}
    let skill='기본 공격';
    if(actor.name==='연희'&&code!==7){
      skill=code===3?'종말의 영면':code===2?'파괴의 손짓':'기본 공격';
      const targets=targetsFor(code===1?2:3);
      for(const t of targets){for(let i=0;i<(code===1?1:3);i++)hit(t,actor.attack*(code===3?.55:code===2?.51:1.3)+(code===2?Math.min(t.maxHp*.07,actor.attack):0),{ignore:code===3?.4:0,pierce:code!==1});if(t.hp>0&&landed.has(t.id)&&!t.controlImmune&&code!==2&&effect(t,code===3?50:40)){t.sleep=code===3?2:1;s.plans[t.side]=s.plans[t.side].filter(p=>p.id!==t.id);}}
      if(code!==1){actor.barrier=Math.max(actor.barrier,calculateShield({base:actor.attack*1.35,regeneration:actor.regeneration}));actor.barrierTurns=3;}
    } else if(actor.name==='쥬리'&&code!==7){
      skill=code===3?'최고 판결':code===2?'천상의 심판':'기본 공격';
      for(const t of targetsFor(code===1?2:3)){let checked=false;for(let i=0;i<(code===1?1:2);i++)hit(t,actor.attack*(code===3?.87:code===2?.77:.7)+(code===1?Math.min(t.maxHp*.08,actor.attack*1.5):0),{pierce:code===2,beforeDamage:()=>{if(code===3&&!checked){checked=true;if(effect(t,70))t.annihilation=2;}}});if(code===2&&t.hp>0&&landed.has(t.id)&&effect(t,100)){t.defDown=.29;t.defTurns=3;}}
    } else if(actor.name==='윤건'&&code!==7) {
      skill=code===3?'신속연사':code===2?'십연자포':'기본 공격';
      const targets=targetsFor(code===1?1:3);
      if(code===3)for(const t of targets){const hp=convertedHealth({hp:t.hp,maxHp:t.maxHp,percent:39,immortal:t.immortal>0});events.push(`${t.name} 생명력 전환 ${t.hp} → ${hp}`);t.hp=hp;}
      for(const t of targets)for(let i=0;i<(code===1?1:3);i++)hit(t,actor.attack*(code===3?.58:code===2?.5:1.45)*(code===3?1+.5*t.hp/t.maxHp:1),{ignore:code!==1?.4:0,pierce:code===3});
      actor.nullify=Math.min(6,actor.nullify+(code===1?1:2));
    } else {
      const spec=skillFor(actor.name,code);
      skill=spec?.name||`${code===1?'기본 공격':(code-1)+'스킬'} · 자료 없음`;
      if(!spec)events.push('스킬 자료 미확인 · 임의 피해를 생성하지 않습니다');
      else {
        const targets=targetsFor(spec.targets);
        const apply=(target,e)=>{
          if((target.hp<=0&&e.type!=='revive')||(e.group==='enemy'?!effect(target,e.chance,e.status):random(s)>=e.chance/100))return;
          if(e.type==='control'&&target.controlImmune||e.type==='heal'&&(target.healBlock||target.indomitableHits>0)||e.type==='revive'&&(target.hp>0||target.annihilation))return;
          if(e.type==='control'&&!target.controlImmune){
            if(e.status==='수면'||e.status==='깊은 수면'){target.sleep=Math.max(target.sleep,e.duration);target.sleepBreak=e.status==='깊은 수면'?.3:.07;}
            else if(e.status==='침묵')target.silence=Math.max(target.silence,e.duration);
            else if(e.status==='실명')target.blind=Math.max(target.blind||0,e.duration);
            else {target.control=Math.max(target.control,e.duration);target.controlName=e.status;}
            if(e.status==='감전')target.shockSource={id:actor.id,attack:actor.attack};
            if(e.status!=='실명')s.plans[target.side]=s.plans[target.side].filter(p=>p.id!==target.id);
          } else if(e.type==='annihilation')target.annihilation=Math.max(target.annihilation,e.duration);
          else if(e.type==='dot'){
            const entry={name:e.status,source:actor.id,attack:actor.attack,remaining:e.duration,value:e.value,scale:e.scale,cap:e.cap,pierce:e.pierce};
            target.dots=[...(target.dots||[]).filter(d=>d.name!==e.status||d.source!==actor.id),entry];
          }
          else if(e.type==='blockDown'){target.blockDebuff=Math.max(target.blockDebuff,e.value);target.blockDownTurns=Math.max(target.blockDownTurns||0,e.duration);}
          else if(e.type==='defDown'){target.defDown=e.maxStacks>1?Math.min(e.value*e.maxStacks,target.defDown+e.value):Math.max(target.defDown,e.value);target.defTurns=e.duration;}
          else if(e.type==='shield'){target.barrier=Math.max(target.barrier,calculateShield({base:actor[e.scale]*e.value,regeneration:target.regeneration}));target.barrierTurns=e.duration;}
          else if(e.type==='heal'&&!target.healBlock){const amount=Math.min(target.maxHp-target.hp,calculateRecovery({base:actor[e.scale]*e.value,regeneration:target.regeneration,increase:target.healingIncrease||0,decrease:target.healingReduction||0}));target.hp+=amount;actor.healingDone+=amount;s.impacts.push({target:target.id,heal:amount});}
          else if(e.type==='revive'&&target.hp===0&&!target.annihilation){target.hp=Math.max(1,Math.round(target.maxHp*e.value/100));s.impacts.push({target:target.id,heal:target.hp});}
          else if(e.type==='nullify')target.nullify=Math.max(target.nullify,e.value);
          else if(['immunity','controlImmune','healBlock'].includes(e.type))target[e.type]=Math.max(target[e.type],e.duration);
          else if(e.type==='cleanse'){for(const key of ['sleep','control','silence','blind','healBlock','defDown','defTurns','annihilation','blockDownTurns','blockDebuff','superiorityMiss','superiorityMissTurns'])target[key]=0;target.dots=[];}
          else if(e.type==='dispel'){
            // Approximate ordering is explicit: shields, then timed damage buffs,
            // then control immunity. Never dispel immunity/nullification/guts.
            let left=e.value;
            if(left&&target.barrier>0){target.barrier=0;target.barrierTurns=0;left--;}
            while(left&&target.panelTimedBuffs?.length){const buff=target.panelTimedBuffs[0];target[buff.stat]-=buff.delta;target.panelTimedBuffs=target.panelTimedBuffs.slice(1);left--;}
            for(const key of ['damageBuffTurns','controlImmune','superiority'])if(left&&target[key]>0&&!(key==='damageBuffTurns'&&target.panelComputed)){target[key]=0;left--;}
          }
          else if(e.type==='reduceBuff'){
            Object.assign(target,reducePanelTimedBuffs(target,e.value));
            const hadImmortal=target.immortal>0;
            for(const key of ['immunity','controlImmune','barrierTurns','damageBuffTurns','immortal'])target[key]=Math.max(0,(target[key]||0)-e.value);
            if(!target.barrierTurns)target.barrier=0;
            if(hadImmortal&&!target.immortal){target.hp=0;target.barrier=0;}
          }
          const labels={heal:'회복',shield:'보호막',revive:'부활',annihilation:'절멸',defDown:'방어력 감소',nullify:'피해 무효화',immunity:'피해 면역',controlImmune:'행동 제어 면역',healBlock:'회복 불가',cleanse:'디버프 해제',reduceBuff:'턴제 버프 감소'};
          events.push(`${target.name} · ${e.status||labels[e.type]||'효과 적용'}`);
        };
        const effectTargets=e=>e.group==='self'?[actor]:e.group==='team'?(e.type==='revive'?s.units.filter(u=>u.side===actor.side&&u.hp===0):alive(actor.side).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)).slice(0,Math.min(3,spec.raw.targets||3)):targets;
        for(const e of spec.effects.filter(e=>e.before))for(const t of effectTargets(e))apply(t,e);
        for(const t of targets)for(let i=0;i<spec.hits;i++){
          const base=actor[spec.scale]*spec.coefficient+actor.defense*spec.defenseCoefficient+actor.maxHp*(spec.selfHpCoefficient||0)+(spec.hpRatio?Math.min(t.maxHp*spec.hpRatio,actor.attack*spec.hpCap):0);
          const boost=spec.hpBoost?1+spec.hpBoost.value*(spec.hpBoost.kind==='lost'?1-t.hp/t.maxHp:t.hp/t.maxHp):1;
          const result=hit(t,base*boost,{ignore:spec.ignore,pierce:spec.pierce});
          if(result&&!result.missed)for(const e of spec.effects.filter(e=>e.each&&e.group==='enemy'))apply(t,e);
        }
        for(const e of spec.effects.filter(e=>!e.each&&!e.before))for(const t of effectTargets(e))if(e.group!=='enemy'||!spec.hits||landed.has(t.id))apply(t,e);
        if(spec.unsupported.length)events.push(`미구현 조건 ${spec.unsupported.length}개 · 스킬 설명 확인`);
        if(!spec.hits&&!spec.effects.length)events.push('미구현 스킬 · 적용 가능한 수치 미확인');
      }
    }
    s.action={source:actor.id,side:actor.side,name:skill,kind,code};
    if(code===7){actor.awakenUsed=true;actor.awakenGauge=actor.awakenMax;events.push('각성기 · 전투당 1회 사용');}
    else if(kind==='skill'&&actor.awakenMax&&!actor.awakenUsed)actor.awakenGauge=Math.min(actor.awakenMax,actor.awakenGauge+45);
    events.unshift(`${actor.side==='attacker'?'공격':'방어'} ${actor.name} · ${skill}`);
  }
  // A separate timed reaction queue keeps fixed damage out of the active skill
  // coefficient, crit/block and personal-turn calculations. Trigger processing
  // after the main action is an approximation until interrupt order is verified.
  for(const id of counterCandidates){const rudy=s.units[id];if(rudy.hp>0&&!rudy.control&&!rudy.sleep&&random(s)<.38)reactions.push({source:id,code:4,kind:'counter',target:actor.id});}
  if(kind==='basic'&&actor.name==='하연'&&actor.hp>0&&!actor.control&&!actor.sleep&&random(s)<.63){
    const allies=alive(actor.side).filter(u=>u.id!==actor.id&&!u.control&&!u.sleep);
    if(allies.length){const helper=allies[Math.floor(random(s)*allies.length)];reactions.push({source:helper.id,code:1,kind:'assist',targets:[...new Set(s.targets)]});}
  }
  s.reactions=[];
  for(let i=0;i<reactions.length&&i<64&&!s.done;i++){
    const reaction=reactions[i],source=s.units[reaction.source];if(source.hp<=0)continue;
    if((reaction.kind==='counter'||reaction.kind==='assist')&&(source.sleep||source.control))continue;
    const targets=reaction.kind==='rad_passive'?s.units.filter(u=>u.side!==source.side&&u.hp>0):reaction.kind==='counter'?[s.units[reaction.target]].filter(u=>u.hp>0):(reaction.targets||[]).map(id=>s.units[id]).filter(u=>u.hp>0).slice(0,skillFor(source.name,1)?.targets||1);
    if(!targets.length)continue;
    const timing=actionTiming(source.name,reaction.code,reaction.kind==='rad_passive'?'reaction':reaction.kind),start=s.elapsedMs+(TIMING_CATALOG.spacing?.medianMs||200);
    if(start+timing.medianMs>s.timeLimitMs){s.elapsedMs=s.timeLimitMs;break;}
    s.elapsedMs=start+timing.medianMs;if(timing.estimated)s.timingEstimates++;else s.timingObserved++;
    const entry={source:source.id,name:reaction.kind==='rad_passive'?'라드 패시브 · 아군 피격 5회':reaction.kind==='counter'?'루디 반격':'하연 엄호 · '+source.name+' 협공',kind:reaction.kind,startMs:start,endMs:s.elapsedMs,estimated:timing.estimated,targets:[]};
    const spec=skillFor(source.name,1);
    for(const target of targets){
      const fixed=reaction.kind==='rad_passive',weak=random(s)<Math.max(0,Math.min(1,source.weakPoint/100)),missed=!fixed&&(source.blind>0||!weak&&random(s)<source.missChance/100);
      const chances=hitProbabilities({crit:source.crit,block:target.block,blockBuff:target.blockBuff,blockDebuff:target.blockDebuff,shred:source.shred}),roll=random(s),critical=!missed&&(target.sleep>0||roll<chances.critical),blocked=!critical&&roll<chances.critical+chances.blocked;
      const base=reaction.kind==='counter'?source.attack*.5+source.defense*.6:source[spec?.scale||'attack']*(spec?.coefficient||0)+source.defense*(spec?.defenseCoefficient||0)+source.maxHp*(spec?.selfHpCoefficient||0);
      const amount=fixed?1485:calculateHit({base,defense:target.defense,defenseDecrease:target.defDown,critDamage:source.critDamage,elasticity:target.elasticity,critical,blocked,blockReduction:target.blockReduction,weak,weakBonus:source.weakBonus,damageIncrease:source.damageIncrease,amplification:source.amplification,...incomingModifiers(source,target),missed});
      const outcome=receiveDamage(target,amount,{pierce:fixed||spec?.pierce||source.name==='탄지로'});Object.assign(target,outcome.target);
      source.damageDealt+=outcome.damage+outcome.absorbed;entry.targets.push(target.id);s.targets.push(target.id);
      s.impacts.push({target:target.id,damage:outcome.damage,absorbed:outcome.absorbed,kind:fixed?'rad_fixed':reaction.kind,source:source.id,critical:!fixed&&critical,missed});
      if(!missed&&outcome.kind!=='immune')countRadHits(target);
      if(fixed&&target.hp>0&&rollEffect({baseChance:35,accuracy:source.accuracy,resistance:target.resist},()=>random(s))){
        target.dots=[...(target.dots||[]).filter(d=>d.name!=='화상'||d.source!==source.id),{name:'화상',source:source.id,attack:source.attack,remaining:2,value:.8,scale:'attack',cap:null,pierce:false}];
      }
      if(reaction.kind==='counter'&&!missed&&target.hp>0&&!target.controlImmune&&rollEffect({baseChance:35,accuracy:source.accuracy,resistance:target.resist},()=>random(s))){target.control=1;target.controlName='기절';s.plans[target.side]=s.plans[target.side].filter(p=>p.id!==target.id);}
    }
    s.reactions.push(entry);events.push(`${entry.name}${reaction.kind==='rad_passive'?' → 1,485 관통 고정 피해':''} · 추가 행동 ${(timing.medianMs/1000).toFixed(3)}초`);
  }
  if(reactions.length>64)events.push('추가 행동 안전 한도 · 일부 미계산');
  if(kind==='basic'&&!s.done){
    // Only ailments already present when this personal turn began can tick.
    for(const dot of before.dots||[]){
      if(actor.hp<=0)break;
      const base=dot.scale==='targetHp'?Math.min(actor.maxHp*dot.value,dot.cap?dot.attack*dot.cap:Infinity):dot.attack*dot.value;
      const caster=s.units[dot.source];
      const damage=calculateHit({base,defense:actor.defense,defenseDecrease:actor.defDown,damageIncrease:caster?.damageIncrease||0,amplification:caster?.amplification||0,...(caster?incomingModifiers(caster,actor):{damageReduction:actor.damageReduction})});
      const outcome=receiveDamage(actor,damage,{pierce:dot.pierce});Object.assign(actor,outcome.target);
      if(caster)caster.damageDealt+=outcome.damage+outcome.absorbed;
      s.impacts.push({target:actor.id,damage:outcome.damage,absorbed:outcome.absorbed,kind:'dot'});events.push(`${actor.name} · ${dot.name} ${outcome.damage}`);
      const current=actor.dots?.find(d=>d.source===dot.source&&d.name===dot.name);if(current)current.remaining--;
    }
    actor.dots=(actor.dots||[]).filter(d=>d.remaining>0);
    const tick=tickPersonalTurn(actor,before);Object.assign(actor,tick.target);events.push(...tick.events.map(e=>actor.name+' · '+e));if(actor.hp>0&&actor.awakenMax&&!actor.awakenUsed)actor.awakenGauge=Math.min(actor.awakenMax,actor.awakenGauge+15);
  }
  return finishStep(s,events,{kind,source:actor.id,code});
}
