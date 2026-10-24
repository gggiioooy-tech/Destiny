import {queuePassiveAttacks} from './passiveAttacks.js';
import {setTimedDebuff,setTimedBuff,setTimedDecrease} from './timedEffects.js';
import {conditionalDamage,afterOwnSkill,beforeOwnSkill,afterOwnHit,extraCondition,palanusMark,buffCount} from './skillRules.js';
import {syncDebuffs,cleanseDebuffs,extendDebuffs} from './statusEffects.js';
import {resetRevivalDebuffs} from './statusEffects.js';
import {releaseControl,blindForcesMiss} from './controlEffects.js';
import {applyEquipment} from './equipmentEffects.js';
import {grantNullification} from './nullificationEffects.js';
import {addDot,dotBase} from './damageOverTime.js';
import {chooseAutoSkill,AUTO_HEAL_THRESHOLD} from './autoSkill.js';
import {syncBuffs,dispelBuffs,reduceBuffDurations,extendBuffDurations,grantDelayedBuff,expireDelayedBuff} from './buffEffects.js';
import {specialHitEffects,directDebuffHits,crystalResonance,tickReflux,spreadReflux,addReflux,applyLubuMark} from './specialDebuffs.js';
import {damageShares,deferPain} from './passiveDamage.js';
import {onHealthThreshold,onAttackStacks,onSkillRules,beforeSkillRules,onRevivalRules,onGutsRules,onDeathRules,initializePassives,addStack,restoreHp,grantShield,roleCount} from './passiveRules.js';
import {afterControl,afterSkillPassive,afterHitPassive,afterHpChange} from './conditionalPassives.js';
import {combatSkill,transformDellons,addDellonsStacks} from './heroTransformations.js';
import {hasPassiveAwakening,awakeningIgnore,refreshPassiveAwakenings,consumePassiveAwakeningTurn,queueAwakeningBlock} from './passiveAwakening.js';
import {hitProbabilitiesFor,calculateHit,rollEffect,calculateShield,convertedHealth,HERO_GROWTH,casterEffect} from './combatDamage.js';
import {receiveDamage,tickPersonalTurn,damageImmune} from './battleSurvival.js';
import {SIM_ROSTER,canonicalHero,heroSkills,skillFor,DETAILED_HEROES,heroProfile} from './simulationSkills.js';
import {actionTiming,followupTiming,skillCooldownMs,BATTLE_LIMIT_MS,TIMING_CATALOG,resolveTimeout} from './battleTiming.js';
import {incomingModifiers,heroDamageType} from './prebattleStats.js';
// Experimental community model; action scheduling is still a prototype.
export const SIM_HEROES=SIM_ROSTER.map(h=>h.name);
export const MODEL_LIMITS='6초월·5강·풀스킬 강화 기준입니다. 영웅별 리플레이 관측 시간과 210초 제한을 사용하며 미확보 시간은 추정입니다. 확인된 스킬 쿨타임과 각성 게이지를 계산합니다. 시간 초과는 팀 최대 HP 대비 잔여 HP 비율과 불사·불굴 조건으로 판정합니다. 고유 패시브·각성기 부가 효과·반격·협공·쿨타임 변경·전체 펫/장비 효과와 서버 지연은 완전 구현되지 않아 승패는 참고용입니다. 영웅 정보창 수치는 펫·진형·상시 패시브를 자동 계산하며, 실전 시작 수치를 불러온 경우에는 중복 가산하지 않습니다.';
export function prepareHeroes(report){
  return Array.from({length:6},(_,i)=>{
    const side=i<3?'attacker':'defender',candidate=canonicalHero(report?.heroes.filter(h=>h.side===side)[i%3]?.name);
    const name=SIM_HEROES.includes(candidate)?candidate:['연희','쥬리','윤건'][i%3];
    const source=report?.heroes.find(h=>h.side===side&&canonicalHero(h.name)===name);
    const s=source?.stats;
    return {id:i,name,side,ring:'none',ringShield:'none',attack:s?Math.max(s['1']||0,s['3']||0):8000,defense:s?.['5']??1800,maxHp:s?.['7']??10000,speed:s?.['9']??(100-i),crit:(s?.['10']??750)/10,critDamage:(s?.['11']??1500)/10,accuracy:(s?.['13']??0)/10,resist:(s?.['14']??0)/10,block:(s?.['17']??0)/10,shred:(s?.['22']??0)/10,elasticity:(s?.['23']??0)/10,weakPoint:(s?.['12']??0)/10,damageReduction:(s?.['18']??0)/10,amplification:(s?.['21']??0)/10,regeneration:(s?.['24']??0)/10,damageIncrease:0,vulnerability:0,weakBonus:0,missChance:0,blockBuff:0,blockDebuff:0,blockReduction:50,origin:source?'수집된 시작 스탯':'테스트 기본값'};
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
  const raw=heroSkills(name).find(s=>s.code===4)?.raw,text=[raw?.text,raw?.enhanced,raw?.upgrades].filter(Boolean).join('\n').replace(/^효과 추가\s*[:：]\s*/gm,'- ');
  let self=raw?.targetType===1;const own=[];
  for(const l of text.split('\n')){
    const label=l.replace(/^[\[(]\s*/,'');
    if(/^자신/.test(label))self=true;
    else if(/^(?:모든 )?(?:아군|적군)|^단일 (?:아군|적군)/.test(label))self=false;
    if(self&&l.startsWith('-')&&!/경우|이하|이상|발동 시|부활 시|아군|적군/.test(l))own.push(l);
  }
  const direct=own.join('\n');
  const reviveUpgrade=text.match(/효과 상승\s*[:：]\s*부활 시 생명력\s*(\d+)%/);
  const reviveImmunity=text.match(/(?:자신 )?부활 시 모든 피해 면역\s*\[(\d+)턴/);
  return {nullify:Number(direct.match(/모든 피해 무효화\s*\[피격\s*(\d+)회/)?.[1]||0),
    guts:/권능/.test(direct),gutsShieldPercent:Number(text.match(/보호막 흡수량이? (?:물리 |마법 )?공격력의\s*([\d.]+)%/)?.[1]||text.match(/권능 발동\s*시.*?공격력의\s*([\d.]+)%/)?.[1]||0),revivePercent:Number(reviveUpgrade?.[1]||direct.match(/사망 시 생명력\s*(\d+)%로 부활/)?.[1]||0),
    reviveIndomitableHits:Number(direct.match(/사망 시 불굴 상태로 부활\s*\[피격\s*(\d+)회/)?.[1]||0),
    reviveImmunity:Number(reviveImmunity?.[1]||0),
    superiority:Number(direct.match(/우위\s*\[(\d+)턴/)?.[1]||0),
    ...(/축복/.test(direct)?{blessing:Number(raw?.definitions?.['축복']?.join(' ').match(/([\d.]+)%/)?.[1]||25)}:{}),
    reviveImmortalTurns:Number(text.match(/턴 상승\s*[:：]\s*불사 지속\s*(\d+)턴/)?.[1]||direct.match(/사망 시 불사.*?\[(\d+)턴/)?.[1]||0),
    immunity:Number(text.match(/턴 상승\s*[:：]\s*모든 피해 면역 지속\s*(\d+)턴/)?.[1]||direct.match(/모든 피해 면역\s*\[(\d+)턴/)?.[1]||0),
    controlImmune:Number(direct.match(/행동 제어 면역\s*\[(\d+)턴/)?.[1]||0)};
}
export function createBattle(heroes,{seed=1,plans=defaultSkillPlans(heroes)}={}){
  if(heroes.length!==6||heroes.filter(h=>h.side==='attacker').length!==3||heroes.filter(h=>h.side==='defender').length!==3||heroes.some(h=>!SIM_HEROES.includes(h.name)))throw Error('지원 영웅을 양 팀에 3명씩 배치해 주세요.');
  for(const side of ['attacker','defender']){const seats=heroes.filter(h=>h.side===side).map(h=>h.battleSeat??h.id%3+1);if(new Set(seats).size!==3||seats.some(n=>!Number.isInteger(n)||n<1||n>5))throw Error('자리번호는 팀별로 중복 없이 1~5번이어야 합니다.');}
  if(heroes.some(h=>!['none','daebul','daegwon','gwonbul'].includes(h.ring||'none')))throw Error('반지 종류를 확인해 주세요.');
  for(const h of heroes)for(const k of ['attack','defense','maxHp','speed','crit','critDamage','accuracy','resist','block','shred','elasticity','blockBuff','blockDebuff','blockReduction','weakPoint','damageReduction','amplification','regeneration','damageIncrease','vulnerability','weakBonus','missChance'])if(!Number.isFinite(h[k])||Math.abs(h[k])>1000000||(h[k]<0&&!['resist','crit','weakPoint','block'].includes(k))||(k==='maxHp'&&h[k]<1)||(k==='blockReduction'&&h[k]>100))throw Error('스탯은 유효한 숫자로 입력해 주세요. 막기 피해감소는 0~100%입니다.');
  for(const side of ['attacker','defender'])if(!Array.isArray(plans[side])||plans[side].length>3||plans[side].some(p=>!Number.isInteger(p.id)||heroes[p.id]?.side!==side||![2,3].includes(p.code)))throw Error('팀마다 예약 스킬을 0~3개 선택해 주세요.');
  const state={growth:HERO_GROWTH,units:heroes.map((h,i)=>({...h,id:i,hp:h.maxHp,barrier:h.name==='윤건'?calculateShield({base:h.attack*1.85,regeneration:h.regeneration}):0,barrierTurns:h.name==='윤건'?3:0,damageBuffTurns:h.name==='연희'?3:0,blessing:h.name==='윤건'?25:0,reviveImmortalTurns:h.name==='쥬리'?3:0,controlImmune:h.name==='쥬리'?3:0,nullify:h.name==='쥬리'?3:0,sleep:0,defDown:0,defTurns:0,immortal:0,immunity:0,annihilation:0,control:0,silence:0,healBlock:0,damageDealt:0,healingDone:0,awakenGauge:0,awakenMax:skillFor(h.name,7)?.raw.gauge||0,awakenUsed:false,...passiveState(h.name),revived:false,triggered:false,actions:0,skillActions:0})),seed:(Number(seed)>>>0)||1,step:0,turn:0,round:0,phase:0,plans:structuredClone(plans),queue:[],log:[],done:false,winner:null,active:null,targets:[],impacts:[],action:null,awakenLocks:{attacker:0,defender:0}};
  for(const unit of state.units){
    unit.readyAt={};unit.buffMaxTurns=Object.fromEntries(['immunity','controlImmune','immortal','barrierTurns','damageBuffTurns','superiority'].map(k=>[k,unit[k]||0]));
  }
  initializePassives(state.units);
  for(const unit of state.units){applyEquipment(unit);syncBuffs(unit);}
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
      const spec=combatSkill(unit,code);if(!spec)return false;
      if((unit.readyAt?.[code]||0)>(s.elapsedMs||0))return false;
      if(spec.requiresTargetBuff&&!s.units.some(t=>{if(t.side===side||t.hp<=0)return false;syncBuffs(t);return t.buffOrder.length>0;}))return false;
      if(spec.requiresAllyDebuff&&!s.units.some(t=>{if(t.side!==side||t.hp<=0)return false;syncDebuffs(t);return t.debuffOrder.length>0;}))return false;
      if(unit.name==='클레미스'&&code===7&&s.units.some(u=>u.side===side&&u.hp===0&&!u.annihilation))return true;
      if(spec.hits||!spec.effects.length)return true;
      if(code===7&&unit.name==='델론즈')return true;
      const healing=spec.effects.some(e=>e.type==='heal'),revival=spec.effects.some(e=>e.type==='revive');
      if(!healing&&!revival)return true;
      return healing&&s.units.some(u=>u.side===side&&u.hp>0&&!u.healBlock&&!u.immortal&&!u.indomitableHits&&u.hp/u.maxHp<(isReserved?.999:AUTO_HEAL_THRESHOLD))||revival&&s.units.some(u=>u.side===side&&u.hp===0&&!u.annihilation);
    };
    const lock=s.awakenLocks[side];
    const candidates=reserved?[]:ready.flatMap(unit=>heroSkills(unit.name).filter(v=>[2,3,7].includes(v.code)&&usable(unit,v.code)&&(v.code!==7||!hasPassiveAwakening(unit)&&!lock&&!unit.awakenUsed&&unit.awakenMax>0&&unit.awakenGauge>=unit.awakenMax)).map(v=>({unit,code:v.code,spec:combatSkill(unit,v.code)})));
    const automatic=reserved?null:chooseAutoSkill(candidates,s.units,side,()=>random(s));
    const candidate=reserved?s.units[reserved.id]:automatic?.unit;
    const code=reserved?.code||automatic?.code||2;
    const actor=candidate&&usable(candidate,code,Boolean(reserved))?candidate:null;
    if(actor&&reserved)s.plans[side].shift();
    s.phase=1;s.skillSide=side==='attacker'?'defender':'attacker';
    s.awakenLocks[side]=actor&&code===7?2:Math.max(0,lock-1);
    return {actor,code,kind:'skill',side};
  }
  if(!s.queue.some(id=>s.units[id].hp>0)){
    s.round++;const ties=new Map(s.units.map(u=>[u.id,random(s)]));
    s.queue=s.units.filter(u=>u.hp>0).sort((a,b)=>b.speed-a.speed||(a.battleSeat??a.id%3+1)-(b.battleSeat??b.id%3+1)||ties.get(a.id)-ties.get(b.id)).map(u=>u.id);
  }
  let actor;while(s.queue.length&&!actor){const u=s.units[s.queue.shift()];if(u.hp>0)actor=u;}
  s.phase=(s.phase+1)%3;s.turn++;return {actor,code:1,kind:'basic'};
}
function finishStep(s,events,meta={}){
  for(const u of s.units)if(u.cancelReservations){s.plans[u.side]=s.plans[u.side].filter(p=>p.id!==u.id);delete u.cancelReservations;}
  const counts=s.units.map(u=>(u.revivalCount||0)+(u.hp<=0?1:0));
  for(const unit of s.units.filter(u=>u.name==='델론즈'&&u.hp>0)){
    for(const dead of s.units){const count=Math.max(0,counts[dead.id]-(s.deathCounts?.[dead.id]||0));if(!count||dead.id===unit.id)continue;
      if(dead.side===unit.side){unit.awakenGauge=Math.min(unit.awakenMax,unit.awakenGauge+15*count);grantNullification(unit,count,{add:true,cap:6});addDellonsStacks(unit,count);events.push('델론즈 · 아군 사망 패시브');}
      else {const old=unit.enemyDeaths||0;unit.enemyDeaths=old+count;if(unit.transformed)grantNullification(unit,Math.floor(unit.enemyDeaths/2)-Math.floor(old/2),{add:true,cap:6});}
    }
  }s.deathCounts=counts;
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
  const s=structuredClone(previous),events=[];s.targets=[];s.impacts=[];s.action=null;s.reactions=[];refreshPassiveAwakenings(s.units,events);
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
  const before=structuredClone(actor);
  const enemies=alive(actor.side==='attacker'?'defender':'attacker');
  const weak=random(s)<Math.min(1,(actor.weakPoint+(combatSkill(actor,code)?.weakBonus||0))/100);
  const visible=enemies.filter(u=>!u.stealth);if(!visible.length)for(const u of enemies)u.stealth=0;
  const targetsFor=n=>{
    let pool=[...(n===1&&visible.length?visible:enemies)],preference=combatSkill(actor,code)?.targetPreference;
    if(n===1&&pool.some(u=>u.taunt>0))return pool.filter(u=>u.taunt>0).slice(0,1);
    if(n===1&&weak)return pool.sort((a,b)=>(a.immortal>0||a.immunity>0)-(b.immortal>0||b.immunity>0)||a.hp/a.maxHp-b.hp/b.maxHp).slice(0,1);
    const ties=new Map(pool.map(u=>[u.id,random(s)]));
    return pool.sort((a,b)=>preference==='buffs'?buffCount(b)-buffCount(a)||ties.get(a.id)-ties.get(b.id):preference==='attack'?b.attack-a.attack||ties.get(a.id)-ties.get(b.id):preference==='back'?(b.battleRow==='back')-(a.battleRow==='back')||ties.get(a.id)-ties.get(b.id):preference==='front'||n===1?(b.battleRow==='front')-(a.battleRow==='front')||ties.get(a.id)-ties.get(b.id):ties.get(a.id)-ties.get(b.id)).slice(0,n);
  };
  const singleTarget=actor.name==='윤건'&&code!==7?code===1:actor.name==='연희'||actor.name==='쥬리'?false:combatSkill(actor,code)?.targets===1;
  const landed=new Set(),reactions=[],counterCandidates=new Set(),extraUsed=new Set();
  let attackToken=s.step,directKillCount=0;
  function countRadHits(target){
    for(const rad of s.units.filter(u=>u.side===target.side&&u.name==='라드그리드'&&u.hp>0)){
      rad.alliedHits=(rad.alliedHits||0)+1;
      if(rad.alliedHits>=5){rad.alliedHits-=5;reactions.push({source:rad.id,code:4,kind:'rad_passive'});}
    }
  }
  function applyDamage(target,amount,options={}){
    options={damageType:options.fixed?null:heroDamageType(s.units[options.creditId??actor.id]?.name),...options};
    syncDebuffs(target);
    syncBuffs(target);
    const ice=target.control>0&&target.controlName==='빙극',frozen=target.control>0&&['빙결','빙극'].includes(target.controlName);
    const debuffs={reflux:(target.reflux||[]).map(e=>({...e})),crystals:(target.crystals||[]).map(e=>({...e}))};
    if(options.direct!==false&&!options.routed&&options.landed!==false&&!damageImmune(target,options)&&!(target.nullify>0)){
      const shares=damageShares(target,s.units,amount);amount=shares.find(p=>p.id===target.id)?.amount||0;
      for(const share of shares.filter(p=>p.id!==target.id)){const recipient=s.units[share.id],shared=applyDamage(recipient,share.amount,{...options,direct:false,routed:true});const credited=s.units[options.creditId??actor.id];credited.damageDealt+=shared.damage+shared.absorbed;s.impacts.push({target:recipient.id,damage:shared.damage,absorbed:shared.absorbed,kind:'shared'});}
      amount=deferPain(target,amount);
    }
    const beforeRevival=target.revivalCount||0,beforeGuts=target.gutsUsed,beforeHp=target.hp;
    const outcome=receiveDamage(target,amount,options),primaryLethal=beforeHp>0&&(outcome.target.hp<=0||(outcome.target.revivalCount||0)>beforeRevival);Object.assign(target,outcome.target);
    if(!beforeGuts&&target.gutsUsed&&outcome.events.includes('권능'))onGutsRules(target,s.units,events,()=>random(s));
    if(beforeHp>0&&(target.hp<=0||(target.revivalCount||0)>beforeRevival)){target.reflux=[];target.crystals=[];target.lubuMarks={};target.palMarks={};spreadReflux(target,debuffs.reflux,s.units,()=>random(s),events);onDeathRules(target,s.units,events);}
    if((target.revivalCount||0)>beforeRevival){onRevivalRules(target,s.units,events);queuePassiveAttacks('revive',target,s.units,reactions);}
    if(primaryLethal&&target.name==='아리스')target.arisRageHitToken=s.step;
    if(target.hp>0&&(target.revivalCount||0)===beforeRevival&&options.direct!==false&&!options.component&&options.landed!==false&&outcome.kind!=='immune'){afterHitPassive(target,s.units,events,{attackToken:['아리스','스쿨드'].includes(target.name)?s.step:attackToken});queuePassiveAttacks('hit',target,s.units,reactions);}
    afterHpChange(target,s.units,events);onHealthThreshold(target,s.units,events);
    if(target.hp>0&&target.control>0&&target.controlName==='오라'&&target.controlSource&&options.direct!==false&&!options.component&&options.landed!==false&&outcome.kind!=='immune'){
      const trigger={...target.controlSource},source=s.units[trigger.id],extra=applyDamage(target,trigger.attack*.15,{direct:false,fixed:true,creditId:trigger.id});
      if(source)source.damageDealt+=extra.damage+extra.absorbed;s.impacts.push({target:target.id,source:trigger.id,damage:extra.damage,absorbed:extra.absorbed,kind:'aura_fixed'});
    }
    if(target.hp>0&&target.control>0&&target.controlName==='감전'&&target.shockSource&&options.direct!==false&&!options.component&&options.landed!==false&&outcome.kind!=='immune'){
      const trigger={...target.shockSource},source=s.units[trigger.id];
      const amount=calculateHit({base:trigger.attack*.4,defense:target.defense,defenseDecrease:target.defDown,...(source?incomingModifiers(source,target):{damageReduction:target.damageReduction})});
      const extra=applyDamage(target,amount,{direct:false,creditId:trigger.id});
      if(source)source.damageDealt+=extra.damage+extra.absorbed;
      s.impacts.push({target:target.id,source:trigger.id,damage:extra.damage,absorbed:extra.absorbed,kind:'shock'});events.push(target.name+' · 감전 추가 피해 '+extra.damage);
    }
    if(target.hp>0&&options.direct!==false&&!options.component&&options.landed!==false&&outcome.kind!=='immune'&&(target.revivalCount||0)===beforeRevival)directDebuffHits(target,debuffs,s.units,()=>random(s),secondaryDamage,events,s.elapsedMs);
    if(frozen&&target.hp>0&&options.direct!==false&&options.landed!==false&&outcome.kind!=='immune'){
      const source=s.units[options.creditId??actor.id];if(ice&&source)restoreHp(source,outcome.damage+outcome.absorbed);releaseControl(target);
    }
    drainControlBursts(target);
    syncBuffs(target);
    return {...outcome,primaryLethal,target:{...target}};
  }
  function leechDamage(source,outcome){
    if(source.vampirism>0){const healed=restoreHp(source,(outcome.damage+outcome.absorbed)*source.vampirism/100);source.healingDone+=healed;if(healed)s.impacts.push({target:source.id,source:source.id,heal:healed,kind:'vampirism'});}
  }
  function secondaryDamage(target,amount,sourceId,kind){
    const out=applyDamage(target,amount,{direct:false,creditId:sourceId,fixed:kind==='crystal'});
    const source=s.units[sourceId];if(source)source.damageDealt+=out.damage+out.absorbed;
    s.impacts.push({target:target.id,source:sourceId,damage:out.damage,absorbed:out.absorbed,kind});
  }
  function drainControlBursts(target){
    const pending=target.pendingControlBursts||[];target.pendingControlBursts=[];
    for(const burst of pending){if(target.hp<=0)break;const source=s.units[burst.source];if(!source)continue;secondaryDamage(target,calculateHit({base:burst.base,ignore:burst.ignore,defense:target.defense,defenseDecrease:target.defDown,damageIncrease:source.damageIncrease,...incomingModifiers(source,target)}),source.id,'control_release');events.push(target.name+' · '+burst.name+' 해제 피해');}
  }
  function markPalanus(target){palanusMark(actor,target,code,s.units,()=>random(s),(t,n)=>{if(reduceBuffDurations(t,n).died)onDeathRules(t,s.units,events);});}
  function hit(target,base,{ignore=0,pierce=false,beforeDamage=null,components=[]}={}){
    if(target.hp<=0)return;
    const conditionTarget={...target};
    s.targets.push(target.id);
    const chances=hitProbabilitiesFor(actor,target,{critBonus:combatSkill(actor,code)?.critBonus||0});
    const hitWeak=singleTarget?weak:random(s)<Math.min(1,(actor.weakPoint+(combatSkill(actor,code)?.weakBonus||0))/100);
    const superiority=target.superiority>0&&target.attack>actor.attack;
    const missed=target.stealth>0||superiority||blindForcesMiss(actor,kind)||(!hitWeak&&random(s)<Math.min(1,(actor.missChance+(actor.superiorityMiss||0))/100)),roll=random(s),critical=!missed&&(target.sleep>0||roll<chances.critical),isBlock=!missed&&!critical&&roll<chances.critical+chances.blocked;
    if(!missed)beforeDamage?.();
    const damage=calculateHit({base,defense:target.defense,defenseDecrease:target.defDown,ignore:Math.min(1,awakeningIgnore(actor,actor.judgment>0?Math.max(.4,ignore):ignore)+(actor.defenseIgnore||0)),critDamage:actor.critDamage,elasticity:target.elasticity,critical,blocked:isBlock,blockReduction:target.blockReduction,weak:hitWeak,weakBonus:actor.weakBonus,damageIncrease:actor.damageIncrease+(actor.name==='연희'&&actor.damageBuffTurns>0&&!actor.panelComputed?35:0),amplification:actor.amplification,...incomingModifiers(actor,target),missed});
    const previousRevived=target.revived,previousRevivalCount=target.revivalCount||0;
    const outcome=applyDamage(target,superiority?damage*.8:damage,{pierce:pierce||actor.name==='탄지로',landed:!missed});Object.assign(target,outcome.target);
    if(outcome.primaryLethal)directKillCount++;
    if(superiority&&rollEffect(casterEffect(target,actor,100),()=>random(s))){actor.defDown=Math.max(actor.defDown,.36);actor.defTurns=Math.max(actor.defTurns,2);actor.superiorityMiss=60;actor.superiorityMissTurns=2;}
    if(!missed)landed.add(target.id);
    if(!missed&&outcome.kind!=='immune')countRadHits(target);
    if(!missed&&['루디','제이브'].includes(target.name))counterCandidates.add(target.id);
    if(isBlock&&!missed&&outcome.kind==='damage'&&!outcome.primaryLethal)queueAwakeningBlock(target,reactions,s.step);
    if((target.hp===0||target.revived!==previousRevived||(target.revivalCount||0)!==previousRevivalCount)&&!(hasPassiveAwakening(target)&&target.passiveAwakenActive))target.awakenGauge=Math.floor((target.awakenGauge||0)*.9);
    actor.damageDealt+=outcome.damage+outcome.absorbed;leechDamage(actor,outcome);
    s.impacts.push({target:target.id,damage:outcome.damage,absorbed:outcome.absorbed,critical,blocked:isBlock,weak:hitWeak,missed,kind:outcome.kind,events:outcome.events});
    events.push(`${target.name} ${outcome.kind==='damage'?'−'+outcome.damage.toLocaleString()+(critical?' 치명타':'')+(isBlock?' 막기':'')+(hitWeak?' 약점':'')+(missed?' 빗나감':''):outcome.events.join(' · ')}${outcome.absorbed?' · 보호막 '+outcome.absorbed.toLocaleString():''}`);
    if(outcome.kind==='damage'&&outcome.events.length)events.push(...outcome.events.map(e=>target.name+' · '+e));
    for(const component of components){
      if(target.hp<=0)break;
      const value=calculateHit({base:component,defense:target.defense,defenseDecrease:target.defDown,ignore:Math.min(1,awakeningIgnore(actor,ignore)+(actor.defenseIgnore||0)),critDamage:actor.critDamage,elasticity:target.elasticity,critical,blocked:isBlock,blockReduction:target.blockReduction,weak:hitWeak,weakBonus:actor.weakBonus,damageIncrease:actor.damageIncrease,amplification:actor.amplification,...incomingModifiers(actor,target),missed});
      const extra=applyDamage(target,superiority?value*.8:value,{component:true,pierce,creditId:actor.id,landed:!missed});actor.damageDealt+=extra.damage+extra.absorbed;leechDamage(actor,extra);
      s.impacts.push({target:target.id,source:actor.id,damage:extra.damage,absorbed:extra.absorbed,critical,blocked:isBlock,weak:hitWeak,missed,kind:'damage_component',events:extra.events});
      events.push(`${target.name} · 분리 피해 ${extra.damage}${extra.absorbed?' · 보호막 '+extra.absorbed:''}`);
    }
    if(target.sleep&&outcome.damage>=target.maxHp*(target.sleepBreak||.3))target.sleep=0;
    if(target.name==='연희'&&!target.triggered&&target.hp>0&&target.hp<=target.maxHp*.7){const gained=grantNullification(target,4);target.triggered=true;events.push(gained?'연희 · 피해 무효화 4회':'연희 · 체력 조건 발동 · 무효화 추가 없음');}
    if(!missed)afterOwnHit(actor);
    if(!missed&&target.hp>0)for(const extra of combatSkill(actor,code)?.extraDamage||[]){
      const key=target.id+'|'+extra.key;if(!extra.each&&extraUsed.has(key)||!extraCondition(extra.condition,actor,conditionTarget,{critical,weak:hitWeak}))continue;
      extraUsed.add(key);const base=actor.attack*extra.coefficient;
      const value=extra.fixed?Math.round(base):calculateHit({base,defense:target.defense,defenseDecrease:target.defDown,ignore:Math.min(1,awakeningIgnore(actor,extra.ignore)+(actor.defenseIgnore||0)),critDamage:actor.critDamage,elasticity:target.elasticity,critical,blocked:isBlock,weak:hitWeak,weakBonus:actor.weakBonus,damageIncrease:actor.damageIncrease,amplification:actor.amplification,...incomingModifiers(actor,target)});
      const out=applyDamage(target,value,{direct:false,pierce:extra.pierce,fixed:extra.fixed,creditId:actor.id});if(out.primaryLethal&&!extra.fixed)directKillCount++;actor.damageDealt+=out.damage+out.absorbed;s.impacts.push({target:target.id,source:actor.id,damage:out.damage,absorbed:out.absorbed,kind:'conditional_extra'});
    }
    return {missed};
  }
  const effect=(target,chance,status)=>rollEffect(casterEffect(actor,target,chance,status),()=>random(s));
  if(actor.sleep>0||actor.control>0){events.push(`${actor.name} · ${actor.sleep?'수면':actor.controlName||'행동 제어'}으로 행동 불가`);}
  else {
    const damageBefore=actor.damageDealt;
    actor.actions++;if(kind==='skill')actor.skillActions++;
    beforeOwnSkill(actor,code);
    if(kind==='skill')beforeSkillRules(actor,s.units,events,()=>random(s));
    if([2,3].includes(code))actor.readyAt[code]=actionStartMs+skillCooldownMs(actor.name,code,combatSkill(actor,code)?.cooldown||0);
    let skill='기본 공격';
    if(actor.name==='연희'&&code!==7){
      skill=code===3?'종말의 영면':code===2?'파괴의 손짓':'기본 공격';
      const targets=targetsFor(code===1?2:3);
      for(const t of targets){for(let i=0;i<(code===1?1:3);i++)hit(t,actor.attack*(code===3?.55:code===2?.51:1.3)+(code===2?Math.min(t.maxHp*.07,actor.attack):0),{ignore:code===3?.4:0,pierce:code!==1});if(t.hp>0&&landed.has(t.id)&&!t.controlImmune&&code!==2&&effect(t,code===3?50:40)){t.sleep=code===3?2:1;afterControl(t,events,s.units);s.plans[t.side]=s.plans[t.side].filter(p=>p.id!==t.id);}}
    } else if(actor.name==='쥬리'&&code!==7){
      skill=code===3?'최고 판결':code===2?'천상의 심판':'기본 공격';
      for(const t of targetsFor(code===1?2:3)){let checked=false;for(let i=0;i<(code===1?1:2);i++)hit(t,actor.attack*(code===3?.87:code===2?.77:.7)+(code===1?Math.min(t.maxHp*.08,actor.attack*1.5):0),{pierce:code===2,beforeDamage:()=>{if(code===3&&!checked){checked=true;if(effect(t,70))t.annihilation=2;}}});if(code===2&&t.hp>0&&landed.has(t.id)&&effect(t,100)){t.defDown=.29;t.defTurns=3;}}
    } else if(actor.name==='윤건'&&code!==7) {
      skill=code===3?'신속연사':code===2?'십연자포':'기본 공격';
      const fireYoon=(fireCode,power=1)=>{
      landed.clear();
      const targets=targetsFor(fireCode===1?1:3);
      if(fireCode===3){
        for(const t of targets)if(t.hp/t.maxHp>=.5&&!t.controlImmune&&!t.stealth&&effect(t,40,'오라')){t.control=2;t.controlName='오라';t.controlSource={id:actor.id,attack:actor.attack};afterControl(t,events,s.units);s.plans[t.side]=s.plans[t.side].filter(p=>p.id!==t.id);}
        for(const t of targets){const hp=convertedHealth({hp:t.hp,maxHp:t.maxHp,percent:39,immortal:t.immortal>0||t.indomitableHits>0});events.push(`${t.name} 생명력 전환 ${t.hp} → ${hp}`);t.hp=hp;}
        for(const t of targets){afterHpChange(t,s.units,events);onHealthThreshold(t,s.units,events);}
      }
      for(const t of targets)for(let i=0;i<(fireCode===1?1:3);i++)hit(t,power*actor.attack*(fireCode===3?.58:fireCode===2?.5:1.45)*(fireCode===3?1+.5*t.hp/t.maxHp:1),{ignore:fireCode!==1?.4:0,pierce:fireCode===3});
      for(const t of targets.filter(t=>t.hp>0&&landed.has(t.id)&&!t.stealth))if(effect(t,100)){
        const result=fireCode===1?reduceBuffDurations(t,1):fireCode===2?dispelBuffs(t,2):null;
        if(result?.died)onDeathRules(t,s.units,events);
      }
      };
      const killsBefore=directKillCount;
      fireYoon(code);
      const killed=directKillCount>killsBefore;
      if(code!==1&&killed&&actor.hp>0&&alive(actor.side==='attacker'?'defender':'attacker').length){
        const nextCode=code===2?3:2,followTiming=followupTiming(actor.name,code,nextCode),spacing=followTiming.spacingMs;
        if(s.elapsedMs+spacing+followTiming.medianMs<=s.timeLimitMs){
          s.elapsedMs+=spacing+followTiming.medianMs;if(followTiming.estimated)s.timingEstimates++;else s.timingObserved++;
          fireYoon(nextCode,.7);events.push(`윤건 · 처치 후 ${nextCode===2?'십연자포':'신속연사'} 70% 위력 1회 연속 발동`);
        }
      }
    } else if(actor.name==='클레미스'&&code===7){
      skill='구원의 힘';
      for(const target of s.units.filter(u=>u.side===actor.side&&u.id!==actor.id&&u.hp===0&&!u.annihilation).slice(0,2)){
        resetRevivalDebuffs(target);
        const offensive=[1,2].includes(heroProfile(target.name)?.role);
        target.hp=offensive?1:Math.max(1,Math.round(target.maxHp*.65));target.immortal=offensive?3:0;target.controlImmune=Math.max(target.controlImmune||0,offensive?3:2);
        target.revivalCount=(target.revivalCount||0)+1;onRevivalRules(target,s.units,events);queuePassiveAttacks('revive',target,s.units,reactions);
        events.push(`${target.name} · 클레미스 ${offensive?'불사 3턴':'생명력 65%'} 부활`);s.impacts.push({target:target.id,heal:target.hp});
      }
      for(const ally of alive(actor.side)){const amount=restoreHp(ally,actor.maxHp*.26);actor.healingDone+=amount;if(amount)s.impacts.push({target:ally.id,heal:amount});}
    } else {
      const spec=combatSkill(actor,code);
      skill=spec?.name||`${code===1?'기본 공격':(code-1)+'스킬'} · 자료 없음`;
      if(!spec)events.push('스킬 자료 미확인 · 임의 피해를 생성하지 않습니다');
      else {
        let targets=targetsFor(spec.targets);
        if(actor.name==='팔라누스'&&[2,3].includes(code))for(const t of targets)markPalanus(t);
        if(actor.name==='델론즈'&&code===7){transformDellons(actor,s.units);events.push('델론즈 · 변신 · 치명타 피해 중첩·행동 제어 면역');}
        const removedBuffs=new Map(),removedDebuffs=new Map(),conversionPending=new Set();
        const apply=(target,e)=>{
          syncDebuffs(target);
          syncBuffs(target);
          if(e.group==='enemy'&&target.stealth>0)return;
          if(e.targetCondition&&!(target[e.targetCondition.stat]>e.targetCondition.above))return;
          if(e.type==='instantDeathDown'&&!(target.instantDeathTurns>0))return;
          if((target.hp<=0&&e.type!=='revive')||(e.group==='enemy'?!effect(target,e.chance,e.status):random(s)>=e.chance/100))return;
          if(['shield','nullify','immunity','physicalImmunity','magicImmunity','controlImmune'].includes(e.type)&&target.buffBlock)return;
          if(e.status&&target.statusImmunities?.[e.status])return;
          if(e.type==='control'&&target.controlImmune||e.type==='heal'&&(target.healBlock||target.indomitableHits>0)||e.type==='revive'&&(target.hp>0||target.annihilation))return;
          if(e.type==='control'&&!target.controlImmune&&!target.statusImmunities?.[e.status]){
            if(e.status==='수면'||e.status==='깊은 수면'){target.sleep=Math.max(target.sleep,e.duration);target.sleepBreak=e.status==='깊은 수면'?.3:.07;}
            else if(e.status==='침묵')target.silence=Math.max(target.silence,e.duration);
            else if(e.status==='실명')target.blind=Math.max(target.blind||0,e.duration);
            else {target.control=Math.max(target.control,e.duration);target.controlName=e.status;target.controlSource={id:actor.id,attack:actor.attack};}
            if(e.status==='감전')target.shockSource={id:actor.id,attack:actor.attack};
            afterControl(target,events,s.units);
            drainControlBursts(target);
            if(e.status!=='실명')s.plans[target.side]=s.plans[target.side].filter(p=>p.id!==target.id);
          } else if(e.type==='instantDeath'){
            target.instantDeathStacks=(target.instantDeathStacks||0)+1;target.instantDeathTurns=e.duration;
            if(target.instantDeathStacks>=2){const fatal=applyDamage(target,target.hp,{execute:true,direct:false});Object.assign(target,fatal.target);target.instantDeathStacks=0;target.instantDeathTurns=0;}
          }
          else if(e.type==='instantDeathDown'&&target.instantDeathTurns>0){
            target.instantDeathTurns=Math.max(0,target.instantDeathTurns-e.value);
            if(!target.instantDeathTurns){const fatal=applyDamage(target,target.hp,{execute:true,direct:false});Object.assign(target,fatal.target);target.instantDeathStacks=0;target.instantDeathTurns=0;s.impacts.push({target:target.id,damage:fatal.damage,kind:'instant_death',events:fatal.events});}
          }
          else if(e.type==='buffBlock')target.buffBlock=Math.max(target.buffBlock||0,e.duration);
          else if(e.type==='link'&&!target.buffBlock)target.linkTurns=Math.max(target.linkTurns||0,e.duration);
          else if(e.type==='clone'&&!target.buffBlock)target.cloneTurns=Math.max(target.cloneTurns||0,e.duration);
          else if(e.type==='stealth'&&!target.buffBlock)target.stealth=Math.max(target.stealth||0,e.duration);
          else if(e.type==='taunt'&&!target.buffBlock){for(const other of s.units.filter(u=>u.side===target.side))other.taunt=0;target.taunt=e.duration;}
          else if(e.type==='gaugeDown'){target.awakenGauge=Math.max(0,target.awakenGauge-e.value);refreshPassiveAwakenings(s.units,events);}
          else if(e.type==='healthConvert'){target.hp=convertedHealth({hp:target.hp,maxHp:target.maxHp,percent:e.value,immortal:target.immortal>0||target.indomitableHits>0});conversionPending.add(target.id);}
          else if(e.type==='drain'){const amount=restoreHp(target,Math.max(0,actor.damageDealt-damageBefore)*e.value);actor.healingDone+=amount;}
          else if(e.type==='statTimed'){
            const typed=['attack','damageIncrease'].includes(e.stat)&&e.family!=='all';
            if(!typed||heroDamageType(target.name)===e.family){if(e.debuff)setTimedDebuff(target,e.stat,e.value,e.duration);else setTimedBuff(target,e.stat,e.value,e.duration,{ratio:e.ratio});}
          }
          else if(e.type==='statDecrease')setTimedDecrease(target,e.stat,e.value,e.duration,{ratio:e.ratio});
          else if(e.type==='cooldownUp'&&!target.cooldownImmune){for(const key of [2,3])target.readyAt[key]=Math.max(target.readyAt[key]||0,s.elapsedMs)+e.value*1000;s.plans[target.side]=s.plans[target.side].filter(p=>p.id!==target.id);}
          else if(e.type==='cooldownReset'){if(e.skillName){const resetSkill=heroSkills(target.name).find(v=>v.name===e.skillName);if(resetSkill)target.readyAt[resetSkill.code]=s.elapsedMs;}else target.readyAt={};}
          else if(e.type==='cooldownDown')for(const key of Object.keys(target.readyAt))target.readyAt[key]=Math.max(0,target.readyAt[key]-e.value*1000);
          else if(e.type==='extendBuff')extendBuffDurations(target,e.value);
          else if(e.type==='delayedTan')grantDelayedBuff(target,e.duration);
          else if(e.type==='extendDebuff')extendDebuffs(target,e.value);
          else if(e.type==='regen'){const count=e.perCleanse?(removedDebuffs.get(target.id)||0):1;if(count&&!target.buffBlock)target.regenBuff={base:actor.maxHp*e.value*count,remaining:e.duration};}
          else if(e.type==='annihilation')target.annihilation=Math.max(target.annihilation,e.duration);
          else if(e.type==='dot'){
            const entry={name:e.status,source:actor.id,attack:actor.attack,remaining:e.duration,value:e.value,scale:e.scale,cap:e.cap,pierce:e.pierce};
            const count=e.perDispel?(removedBuffs.get(target.id)||0):1;
            for(let n=0;n<count;n++)if(!e.perDispel||effect(target,e.instanceChance,e.status))addDot(target,entry);
          }
          else if(e.type==='blockDown'){target.blockDebuff=Math.max(target.blockDebuff,e.value);target.blockDownTurns=Math.max(target.blockDownTurns||0,e.duration);}
          else if(e.type==='defDown'){target.defDown=e.maxStacks>1?Math.min(e.value*e.maxStacks,target.defDown+e.value):Math.max(target.defDown,e.value);target.defTurns=e.duration;}
          else if(e.type==='shield')grantShield(target,actor[e.scale]*e.value,e.duration);
          else if(e.type==='heal'){const amount=restoreHp(target,actor[e.scale]*e.value);actor.healingDone+=amount;s.impacts.push({target:target.id,heal:amount});}
          else if(e.type==='revive'&&target.hp===0&&!target.annihilation){resetRevivalDebuffs(target);target.hp=Math.max(1,Math.round(target.maxHp*e.value/100));target.revivalCount=(target.revivalCount||0)+1;onRevivalRules(target,s.units,events);queuePassiveAttacks('revive',target,s.units,reactions);s.impacts.push({target:target.id,heal:target.hp});}
          else if(e.type==='nullify')grantNullification(target,e.value);
          else if(['immunity','physicalImmunity','magicImmunity','controlImmune','healBlock'].includes(e.type)){target[e.type]=Math.max(target[e.type],e.duration);target.buffMaxTurns??={};target.buffMaxTurns[e.type]=Math.max(target.buffMaxTurns[e.type]||0,e.duration);}
          else if(e.type==='cleanse')removedDebuffs.set(target.id,cleanseDebuffs(target,e.value??Infinity,{controlOnly:e.controlOnly}));
          else if(e.type==='dispel'){
            const result=dispelBuffs(target,e.value);removedBuffs.set(target.id,result.removed);
            if(result.died)onDeathRules(target,s.units,events);
          }
          else if(e.type==='reduceBuff'){
            if(reduceBuffDurations(target,e.value).died)onDeathRules(target,s.units,events);
          }
          const labels={heal:'회복',shield:'보호막',revive:'부활',annihilation:'절멸',defDown:'방어력 감소',nullify:'피해 무효화',immunity:'피해 면역',controlImmune:'행동 제어 면역',healBlock:'회복 불가',cleanse:'디버프 해제',reduceBuff:'턴제 버프 감소'};
          const durationKey={control:e.status==='수면'?'sleep':e.status==='침묵'?'silence':e.status==='실명'?'blind':'control',defDown:'defTurns',blockDown:'blockDownTurns',instantDeath:'instantDeathTurns',healBlock:'healBlock',buffBlock:'buffBlock',annihilation:'annihilation'}[e.type];
          if(durationKey&&e.duration){target.debuffMaxTurns??={};target.debuffMaxTurns[durationKey]=Math.max(target.debuffMaxTurns[durationKey]||0,e.duration);}
          syncDebuffs(target);
          syncBuffs(target);
          drainControlBursts(target);
          events.push(`${target.name} · ${e.status||labels[e.type]||'효과 적용'}`);
        };
        const effectTargets=e=>{
          let pool=e.group==='self'?[actor]:e.group==='team'?(e.type==='revive'?s.units.filter(u=>u.side===actor.side&&u.hp===0):alive(actor.side)):targets;
          pool=pool.filter(t=>(!e.excludeSelf||t.id!==actor.id)&&(!e.roles||e.roles.includes(heroProfile(t.name)?.role))&&(!e.row||t.battleRow===e.row));
          if(e.group==='team'){pool=pool.slice().sort((a,b)=>e.targetPreference==='lowestHp'?a.hp-b.hp||a.id-b.id:a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id);pool=pool.slice(0,Math.min(3,e.targetCount||spec.allyTargets||3));}return pool;
        };
        const applyEffects=(effects,post=false)=>{
          for(const e of effects){
            for(const t of effectTargets(e))if(!post||e.group!=='enemy'||!spec.hits||landed.has(t.id))apply(t,e);
            for(const id of conversionPending){const target=s.units[id];afterHpChange(target,s.units,events);onHealthThreshold(target,s.units,events);}conversionPending.clear();
          }
        };
        const strike=t=>{const targetDamageBefore=actor.damageDealt;for(let i=0;i<spec.hits;i++){
          const missing=Math.max(0,spec.targets-targets.length),base=actor[spec.scale]*(spec.coefficient+(spec.missingTargetCoefficient||0)*missing)+actor.defense*spec.defenseCoefficient+actor.maxHp*(spec.selfHpCoefficient||0)+(spec.hpRatio?Math.min(t.maxHp*spec.hpRatio,actor.attack*spec.hpCap):0);
          const boost=spec.hpBoost?1+spec.hpBoost.value*(spec.hpBoost.kind==='lost'?1-t.hp/t.maxHp:t.hp/t.maxHp):1;
          const ignore=actor.name==='팔라누스'&&(t.palMarks?.[actor.id]||0)>=2?.65:spec.ignore;
          const factor=boost*(1+(spec.missingTargetMultiplier||0)*missing),split=['기유','선란'].includes(actor.name);
          const parts=split?[actor[spec.scale]*(spec.coefficient+(spec.missingTargetCoefficient||0)*missing),actor.defense*spec.defenseCoefficient,actor.maxHp*(spec.selfHpCoefficient||0),spec.hpRatio?Math.min(t.maxHp*spec.hpRatio,actor.attack*(spec.hpCap||Infinity)):0,conditionalDamage(actor,t,code)].filter(v=>v>0).map(v=>v*factor):[(base+conditionalDamage(actor,t,code))*factor];
          const result=hit(t,parts[0]||0,{ignore,pierce:spec.pierce,components:parts.slice(1)});
          if(result&&!result.missed)for(const e of spec.effects.filter(e=>e.each&&e.group==='enemy'))apply(t,e);
          if(result&&!result.missed)specialHitEffects(actor,t,code,s.units,()=>random(s),{each:true});
        }
          if(landed.has(t.id)){
            if(actor.name==='팔라누스'&&code===1)markPalanus(t);
            if(actor.name==='팔라누스'&&(t.palMarks?.[actor.id]||0)>=1)for(const ally of alive(actor.side))restoreHp(ally,Math.max(0,actor.damageDealt-targetDamageBefore)*(code===1?.17:.24));
            specialHitEffects(actor,t,code,s.units,()=>random(s));if(actor.name==='밀리아'&&code===2)crystalResonance(actor,t,s.units,()=>random(s),secondaryDamage,events,s.elapsedMs);
            if(actor.name==='칼 헤론'&&[2,3].includes(code)&&t.thunderMarkSource===actor.id&&t.hp>0){const extra=applyDamage(t,1700,{direct:false,pierce:code===2,creditId:actor.id});actor.damageDealt+=extra.damage+extra.absorbed;s.impacts.push({target:t.id,source:actor.id,damage:extra.damage,absorbed:extra.absorbed,kind:'thunder_mark'});if(t.hp>0&&!t.controlImmune&&effect(t,50,'감전')){t.control=2;t.controlName='감전';t.shockSource={id:actor.id,attack:actor.attack};afterControl(t,events,s.units);s.plans[t.side]=s.plans[t.side].filter(p=>p.id!==t.id);}}
          }
          if(spec.executeRatio&&landed.has(t.id)&&t.hp>0&&t.hp/t.maxHp<=spec.executeRatio&&t.hp<=actor.attack*spec.executeCap){const out=applyDamage(t,t.hp,{execute:true,direct:false});Object.assign(t,out.target);if(out.primaryLethal)directKillCount++;actor.damageDealt+=out.damage;events.push(t.name+' · 처형');s.impacts.push({target:t.id,damage:out.damage,kind:'execute',events:out.events});}
        };
        const cast=()=>{
          landed.clear();removedBuffs.clear();removedDebuffs.clear();
          const killsBefore=directKillCount;
          applyEffects(spec.effects.filter(e=>e.before));
          for(const t of targets)strike(t);
          const killed=directKillCount>killsBefore;
          applyEffects(spec.effects.filter(e=>!e.each&&!e.before),true);
          return killed;
        };
        let killed=cast();
        if(killed&&spec.resetOwnCooldownOnDirectKill){actor.readyAt[code]=s.elapsedMs;events.push(actor.name+' · 직접 처치 · 해당 스킬 쿨타임 초기화');}
        for(let repeat=0;spec.repeatOnKill&&killed&&repeat<(spec.repeatLimit||3)&&actor.hp>0;repeat++){
          const followTiming=followupTiming(actor.name,code),spacing=followTiming.spacingMs;
          targets=targetsFor(spec.targets);if(!targets.length||s.elapsedMs+followTiming.medianMs+spacing>s.timeLimitMs)break;
          s.elapsedMs+=followTiming.medianMs+spacing;if(followTiming.estimated)s.timingEstimates++;else s.timingObserved++;killed=cast();events.push(actor.name+' · 처치 후 연속 발동 '+(repeat+1)+'회');
        }
        if(spec.cooldownReduction)for(const key of Object.keys(actor.readyAt))actor.readyAt[key]=Math.max(0,actor.readyAt[key]-spec.cooldownReduction*1000);
        if(spec.unsupported.length)events.push(`미구현 조건 ${spec.unsupported.length}개 · 스킬 설명 확인`);
        if(!spec.hits&&!spec.effects.length)events.push('미구현 스킬 · 적용 가능한 수치 미확인');
      }
    }
    if(actor.name==='손오공'&&code===3&&!actor.cloneTurns)actor.cloneTurns=5;
    afterOwnSkill(actor,code,s.units,events);
    actor.lastAttackBasic=kind==='basic';if(kind==='basic'||combatSkill(actor,code)?.hits>0){onAttackStacks(actor,s.units,events);queuePassiveAttacks('attack',actor,s.units,reactions);}
    if(actor.name==='멜키르'&&actor.passiveAttackCount>0&&actor.passiveAttackCount%3===0&&roleCount(s.units,actor.side,2)>=3)for(const target of enemies)addReflux(actor,target,1,100,()=>random(s));
    if(kind==='skill'){afterSkillPassive(actor,events);onSkillRules(actor,s.units,events,()=>random(s),{includeBefore:false});queuePassiveAttacks('partySkill',actor,s.units,reactions);}
    s.action={source:actor.id,side:actor.side,name:skill,kind,code};
    if(code===7){actor.awakenUsed=true;actor.awakenGauge=actor.awakenMax;events.push('각성기 · 전투당 1회 사용');}
    else if(kind==='skill'&&actor.awakenMax&&!actor.awakenUsed)actor.awakenGauge=Math.min(actor.awakenMax,actor.awakenGauge+45);
    events.unshift(`${actor.side==='attacker'?'공격':'방어'} ${actor.name} · ${skill}`);
  }
  refreshPassiveAwakenings(s.units,events);
  // A separate timed reaction queue keeps fixed damage out of the active skill
  // coefficient, crit/block and personal-turn calculations. Trigger processing
  // after the main action is an approximation until interrupt order is verified.
  for(const id of counterCandidates){const rudy=s.units[id];if(rudy.hp>0&&!rudy.control&&!rudy.sleep&&random(s)<.38)reactions.push({source:id,code:4,kind:'counter',target:actor.id});}
  if(kind==='basic'&&actor.name!=='쥬리'){const juri=alive(actor.side).find(u=>u.name==='쥬리'&&!u.control&&!u.sleep);if(juri&&random(s)<Math.min(1,.35+(juri.assistChanceBonus||0)/100))reactions.push({source:juri.id,code:4,kind:'juri_assist',targets:alive(actor.side==='attacker'?'defender':'attacker').map(u=>u.id)});}
  if(kind==='basic'&&actor.name!=='발리스타'){const ballista=alive(actor.side).find(u=>u.name==='발리스타'&&!u.control&&!u.sleep);if(ballista&&random(s)<Math.min(1,.3+(ballista.assistChanceBonus||0)/100))reactions.push({source:ballista.id,code:4,kind:'ballista_assist',targets:[...new Set(s.targets)],spec:{name:'발리스타 협공',attack:1,hits:1}});}
  if(kind==='basic'&&actor.name==='하연'&&actor.hp>0&&!actor.control&&!actor.sleep&&random(s)<.63){
    const allies=alive(actor.side).filter(u=>u.id!==actor.id&&!u.control&&!u.sleep);
    if(allies.length){const helper=allies[Math.floor(random(s)*allies.length)];reactions.push({source:helper.id,code:1,kind:'assist',targets:[...new Set(s.targets)]});}
  }
  s.reactions=[];
  for(let i=0;i<reactions.length&&i<64&&!s.done;i++){
    attackToken=s.step+':reaction:'+i;
    const reaction=reactions[i],source=s.units[reaction.source];if(source.hp<=0)continue;
    if((reaction.kind==='counter'||reaction.kind==='assist'||reaction.kind==='juri_assist'||reaction.kind==='ballista_assist')&&(source.sleep||source.control))continue;
    const targets=reaction.kind==='rad_passive'||reaction.kind==='hero_passive'?s.units.filter(u=>u.side!==source.side&&u.hp>0):reaction.kind==='counter'?[s.units[reaction.target]].filter(u=>u.hp>0):(reaction.targets||[]).map(id=>s.units[id]).filter(u=>u.hp>0).slice(0,reaction.kind==='juri_assist'?3:combatSkill(source,1)?.targets||1);
    if(!targets.length)continue;
    const timing=actionTiming(source.name,reaction.code,reaction.kind==='rad_passive'||reaction.kind==='hero_passive'?'reaction':reaction.kind==='ballista_assist'?'assist':reaction.kind),start=s.elapsedMs+(TIMING_CATALOG.spacing?.medianMs||200);
    if(start+timing.medianMs>s.timeLimitMs){s.elapsedMs=s.timeLimitMs;break;}
    s.elapsedMs=start+timing.medianMs;if(timing.estimated)s.timingEstimates++;else s.timingObserved++;
    const entry={source:source.id,name:reaction.spec?reaction.spec.name:reaction.kind==='rad_passive'?'라드 패시브 · 아군 피격 5회':reaction.kind==='counter'?source.name+' 반격':source.name==='쥬리'?'쥬리 협공':'하연 엄호 · '+source.name+' 협공',kind:reaction.kind,startMs:start,endMs:s.elapsedMs,estimated:timing.estimated,targets:[]};
    const spec=combatSkill(source,1),basicAssist=reaction.kind==='assist';
    for(const target of targets)for(let hitIndex=0;hitIndex<(reaction.spec?.hits||(basicAssist?spec?.hits:1)||1)&&target.hp>0;hitIndex++){
      const fixed=reaction.kind==='rad_passive'||Boolean(reaction.spec?.fixed),weak=random(s)<Math.max(0,Math.min(1,(source.weakPoint+(basicAssist?spec?.weakBonus||0:0))/100)),superiority=target.superiority>0&&target.attack>source.attack,missed=!fixed&&(target.stealth>0||superiority||blindForcesMiss(source,reaction.kind)||!weak&&random(s)<((source.missChance||0)+(source.superiorityMiss||0))/100);
      const chances=hitProbabilitiesFor(source,target,{critBonus:basicAssist?spec?.critBonus||0:0}),roll=random(s),critical=!fixed&&!missed&&(target.sleep>0||roll<chances.critical),blocked=!fixed&&!missed&&!critical&&roll<chances.critical+chances.blocked;
      const base=reaction.kind==='counter'?source.attack*.5+(source.name==='루디'?source.defense*.6:0):reaction.kind==='juri_assist'?(source.attack*.5+Math.min(target.maxHp*.1,source.attack*3))*(1+.5*target.hp/target.maxHp):source[spec?.scale||'attack']*((spec?.coefficient||0)+(spec?.missingTargetCoefficient||0)*Math.max(0,(spec?.targets||1)-targets.length))+source.defense*(spec?.defenseCoefficient||0)+source.maxHp*(spec?.selfHpCoefficient||0)+(spec?.hpRatio?Math.min(target.maxHp*spec.hpRatio,source.attack*(spec.hpCap||Infinity)):0);
      const passive=reaction.spec;const passiveBase=passive?source.attack*(passive.attack||0)+source.defense*(passive.defense||0)+target.defense*(passive.targetDefense||0)+(passive.hp?Math.min(target.maxHp*passive.hp,source.attack*passive.cap):0):base;
      const amount=fixed?(passive?.fixed||1485):calculateHit({base:passiveBase,ignore:Math.min(1,awakeningIgnore(source,passive?.ignore||(basicAssist?spec?.ignore:0)||0)+(source.defenseIgnore||0)),defense:target.defense,defenseDecrease:target.defDown,critDamage:source.critDamage,elasticity:target.elasticity,critical,blocked,blockReduction:target.blockReduction,weak,weakBonus:source.weakBonus,damageIncrease:source.damageIncrease,amplification:source.amplification,...incomingModifiers(source,target),missed});
      const outcome=applyDamage(target,superiority&&!fixed?amount*.8:amount,{pierce:reaction.kind==='rad_passive'||(passive?Boolean(passive.pierce):spec?.pierce)||source.name==='탄지로',fixed,landed:!missed,creditId:source.id});Object.assign(target,outcome.target);
      if(superiority&&!fixed&&rollEffect(casterEffect(target,source,100),()=>random(s))){source.defDown=Math.max(source.defDown,.36);source.defTurns=Math.max(source.defTurns,2);source.superiorityMiss=60;source.superiorityMissTurns=2;}
      if(!missed)afterOwnHit(source);
      if(blocked&&!missed&&outcome.kind==='damage'&&!outcome.primaryLethal)queueAwakeningBlock(target,reactions,s.step);
      source.damageDealt+=outcome.damage+outcome.absorbed;leechDamage(source,outcome);entry.targets.push(target.id);s.targets.push(target.id);
      s.impacts.push({target:target.id,damage:outcome.damage,absorbed:outcome.absorbed,kind:fixed?(reaction.kind==='rad_passive'?'rad_fixed':'passive_fixed'):reaction.kind,source:source.id,critical:!fixed&&critical,blocked:!fixed&&blocked,missed});
      if(!missed&&outcome.kind!=='immune')countRadHits(target);
      if(basicAssist&&!missed&&target.hp>0)for(const e of spec?.effects||[]){
        if(e.group!=='enemy'||!e.each&&hitIndex!==(spec.hits||1)-1||target.stealth||!rollEffect(casterEffect(source,target,e.chance,e.status),()=>random(s)))continue;
        if(e.type==='dot')addDot(target,{name:e.status,source:source.id,attack:source.attack,remaining:e.duration,value:e.value,scale:e.scale,cap:e.cap,pierce:e.pierce});
        if(e.type==='control'&&!target.controlImmune&&!target.statusImmunities?.[e.status]){
          if(e.status==='수면')target.sleep=Math.max(target.sleep,e.duration);
          else if(e.status==='침묵')target.silence=Math.max(target.silence,e.duration);
          else if(e.status==='실명')target.blind=Math.max(target.blind||0,e.duration);
          else {target.control=Math.max(target.control,e.duration);target.controlName=e.status;target.controlSource={id:source.id,attack:source.attack};}
          if(e.status==='감전')target.shockSource={id:source.id,attack:source.attack};
          afterControl(target,events,s.units);drainControlBursts(target);
          if(e.status!=='실명')s.plans[target.side]=s.plans[target.side].filter(p=>p.id!==target.id);
        }
        if(e.type==='defDown'){target.defDown=e.maxStacks>1?Math.min(e.value*e.maxStacks,target.defDown+e.value):Math.max(target.defDown,e.value);target.defTurns=Math.max(target.defTurns,e.duration);}
        syncDebuffs(target);
      }
      if(reaction.kind==='rad_passive'&&target.hp>0&&rollEffect(casterEffect(source,target,35,'화상'),()=>random(s))){
        addDot(target,{name:'화상',source:source.id,attack:source.attack,remaining:2,value:.8,scale:'attack',cap:null,pierce:false});
      }
      if(reaction.kind==='counter'&&source.name==='루디'&&!missed&&target.hp>0&&!target.controlImmune&&!target.statusImmunities?.['기절']&&rollEffect(casterEffect(source,target,35,'기절'),()=>random(s))){target.control=1;target.controlName='기절';afterControl(target,events,s.units);s.plans[target.side]=s.plans[target.side].filter(p=>p.id!==target.id);}
      if(!missed&&target.hp>0&&passive){
        if(passive.mark)applyLubuMark(source,target,()=>random(s),(t,n,id,k)=>secondaryDamage(t,calculateHit({base:n,defense:t.defense,defenseDecrease:t.defDown,damageIncrease:source.damageIncrease,...incomingModifiers(source,t)}),id,k),events);
        if(passive.control&&!target.controlImmune&&!target.statusImmunities?.[passive.control]&&rollEffect(casterEffect(source,target,passive.chance,passive.control),()=>random(s))){target.control=passive.turns;target.controlName=passive.control;target.controlSource={id:source.id,attack:source.attack};if(passive.control==='감전')target.shockSource={id:source.id,attack:source.attack};afterControl(target,events,s.units);drainControlBursts(target);s.plans[target.side]=s.plans[target.side].filter(p=>p.id!==target.id);}
        if(passive.defDown){target.defDown=Math.min(passive.defDown*passive.maxStacks,target.defDown+passive.defDown);target.defTurns=999;}
        if(passive.dispel){const result=dispelBuffs(target,passive.dispel);if(result.died)onDeathRules(target,s.units,events);}
        if(passive.reduceBuff&&rollEffect(casterEffect(source,target,100),()=>random(s))){if(reduceBuffDurations(target,passive.reduceBuff).died)onDeathRules(target,s.units,events);}
        if(passive.poison&&rollEffect(casterEffect(source,target,100,'중독'),()=>random(s)))addDot(target,{name:'중독',source:source.id,attack:source.attack,remaining:2,value:.3,scale:'targetHp',cap:1.5,pierce:false});
        if(passive.healingReduction&&rollEffect(casterEffect(source,target,100),()=>random(s))){target.healingReduction=Math.min(60,(target.healingReduction||0)+passive.healingReduction);}
        if(passive.magicVulnerability&&rollEffect(casterEffect(source,target,100),()=>random(s)))setTimedDebuff(target,'magicVulnerability',passive.magicVulnerability,2);
      }
    }
    if(reaction.kind!=='hero_passive'){source.lastAttackBasic=reaction.kind==='assist';onAttackStacks(source,s.units,events);queuePassiveAttacks('attack',source,s.units,reactions);}
    if(reaction.kind==='counter'&&source.name==='제이브')for(const target of targets)if(target.hp>0&&rollEffect(casterEffect(source,target,40,'용염'),()=>random(s)))addDot(target,{name:'용염',source:source.id,attack:source.attack,remaining:2,value:1.2,scale:'attack',cap:null,pierce:false});
    refreshPassiveAwakenings(s.units,events);s.reactions.push(entry);events.push(`${entry.name}${reaction.kind==='rad_passive'?' → 1,485 관통 고정 피해':''} · 추가 행동 ${(timing.medianMs/1000).toFixed(3)}초`);
  }
  if(reactions.length>64)events.push('추가 행동 안전 한도 · 일부 미계산');
  if(kind==='basic'&&!s.done){
    tickReflux(actor,before,s.units,()=>random(s),events);
    if(before.instantDeathTurns>0&&actor.instantDeathTurns>0){actor.instantDeathTurns--;if(actor.instantDeathTurns===0){applyDamage(actor,actor.hp,{execute:true,direct:false});actor.instantDeathStacks=0;events.push(actor.name+' · 즉사 만료');}else applyDamage(actor,actor.hp*.2,{direct:false,deferred:true});}
    for(const pain of before.deferredPain||[]){if(actor.hp<=0)break;const outcome=applyDamage(actor,pain.perTurn,{direct:false,deferred:true});events.push(actor.name+' · 고통 감내 이연 피해 '+outcome.damage);const current=actor.deferredPain?.find(p=>p.remaining===pain.remaining&&p.perTurn===pain.perTurn);if(current)current.remaining--;}
    actor.deferredPain=(actor.deferredPain||[]).filter(p=>p.remaining>0);
    if(before.delayedTan>0&&actor.delayedTan>0&&(before.delayedTanEpoch||0)===(actor.delayedTanEpoch||0)){actor.delayedTan--;if(!actor.delayedTan){expireDelayedBuff(actor);events.push(actor.name+' · 지연 버프 만료');}}
    // Only ailments already present when this personal turn began can tick.
    for(const dot of before.dots||[]){
      if(actor.hp<=0)break;
        const base=dotBase(actor,dot);
      const caster=s.units[dot.source];
      const damage=calculateHit({base,defense:actor.defense,defenseDecrease:actor.defDown,damageIncrease:caster?.damageIncrease||0,amplification:caster?.amplification||0,...(caster?incomingModifiers(caster,actor):{damageReduction:actor.damageReduction})});
      const outcome=applyDamage(actor,damage,{pierce:dot.pierce,direct:false});Object.assign(actor,outcome.target);
      if(caster)caster.damageDealt+=outcome.damage+outcome.absorbed;
      s.impacts.push({target:actor.id,damage:outcome.damage,absorbed:outcome.absorbed,kind:'dot'});events.push(`${actor.name} · ${dot.name} ${outcome.damage}`);
      const current=actor.dots?.find(d=>dot.effectId?d.effectId===dot.effectId:d.source===dot.source&&d.name===dot.name);if(current)current.remaining--;
    }
    actor.dots=(actor.dots||[]).filter(d=>d.remaining>0);
    if(before.regenBuff&&actor.regenBuff&&actor.hp>0){restoreHp(actor,actor.regenBuff.base);actor.regenBuff.remaining--;if(!actor.regenBuff.remaining)delete actor.regenBuff;}
    const beforeTickHp=actor.hp,tickRefluxEntries=(actor.reflux||[]).map(e=>({...e}));
    const tick=tickPersonalTurn(actor,before);Object.assign(actor,tick.target);
    if(beforeTickHp>0&&actor.hp<=0){actor.reflux=[];actor.crystals=[];actor.palMarks={};actor.lubuMarks={};spreadReflux(actor,tickRefluxEntries,s.units,()=>random(s),events);onDeathRules(actor,s.units,events);}
    drainControlBursts(actor);syncBuffs(actor);events.push(...tick.events.map(e=>actor.name+' · '+e));
    if(actor.hp>0&&actor.actions>before.actions){if(before.passiveAwakenActive)consumePassiveAwakeningTurn(actor);if(actor.awakenMax&&!actor.awakenUsed)actor.awakenGauge=Math.min(actor.awakenMax,actor.awakenGauge+15);}
  }
  refreshPassiveAwakenings(s.units,events);
  return finishStep(s,events,{kind,source:actor.id,code});
}
