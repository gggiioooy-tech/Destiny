import {hitProbabilities,calculateHit,rollEffect,calculateShield,convertedHealth,HERO_GROWTH} from './combatDamage.js';
import {receiveDamage,tickPersonalTurn} from './battleSurvival.js';
// Experimental community model; action scheduling is still a prototype.
export const SIM_HEROES=['연희','쥬리','윤건'];
export const MODEL_LIMITS='6초월·5강·풀스킬 강화 실험판입니다. 팀 속공 합으로 선스킬을 정하고 스킬 → 평타 2회 → 상대 스킬로 진행합니다. 개인 지속 턴은 평타 차례에 감소합니다. 쿨타임·자동 스킬 선택·동시 생존 효과 우선순위·재생 합산은 검증 중이며 각성기·협공·일부 추가타·펫/장비 전체 효과는 미구현입니다. 입력 스탯에 상시 증가를 중복 가산하지 않습니다.';
export function prepareHeroes(report){
  return Array.from({length:6},(_,i)=>{
    const side=i<3?'attacker':'defender',name=SIM_HEROES[i%3];
    const source=report?.heroes.find(h=>h.side===side&&h.name===name);
    const s=source?.stats;
    return {id:i,name,side,attack:s?Math.max(s['1']||0,s['3']||0):8000,defense:s?.['5']??1800,maxHp:s?.['7']??10000,speed:s?.['9']??(100-i),crit:(s?.['10']??750)/10,critDamage:(s?.['11']??1500)/10,accuracy:(s?.['13']??0)/10,resist:(s?.['14']??0)/10,block:(s?.['17']??0)/10,shred:(s?.['22']??0)/10,elasticity:(s?.['23']??0)/10,weakPoint:(s?.['12']??0)/10,damageReduction:(s?.['18']??0)/10,amplification:(s?.['21']??0)/10,regeneration:(s?.['24']??0)/10,damageIncrease:0,vulnerability:0,weakBonus:0,missChance:0,blockBuff:0,blockDebuff:0,blockReduction:50,origin:source?'수집된 시작 스탯':'테스트 기본값'};
  });
}
export function defaultSkillPlans(){return {attacker:[{id:0,code:3},{id:2,code:2},{id:2,code:3}],defender:[{id:3,code:3},{id:5,code:2},{id:5,code:3}]};}
export function createBattle(heroes,{seed=1,plans=defaultSkillPlans()}={}){
  if(heroes.length!==6||heroes.filter(h=>h.side==='attacker').length!==3||heroes.filter(h=>h.side==='defender').length!==3||heroes.some(h=>!SIM_HEROES.includes(h.name)))throw Error('지원 영웅을 양 팀에 3명씩 배치해 주세요.');
  for(const h of heroes)for(const k of ['attack','defense','maxHp','speed','crit','critDamage','accuracy','resist','block','shred','elasticity','blockBuff','blockDebuff','blockReduction','weakPoint','damageReduction','amplification','regeneration','damageIncrease','vulnerability','weakBonus','missChance'])if(!Number.isFinite(h[k])||Math.abs(h[k])>1000000||(h[k]<0&&k!=='resist')||(k==='maxHp'&&h[k]<1)||(k==='blockReduction'&&h[k]>100))throw Error('스탯은 유효한 숫자로 입력해 주세요. 막기 피해감소는 0~100%입니다.');
  for(const side of ['attacker','defender'])if(!Array.isArray(plans[side])||plans[side].length!==3||plans[side].some(p=>!Number.isInteger(p.id)||heroes[p.id]?.side!==side||![2,3].includes(p.code)))throw Error('팀마다 사용할 스킬 3개를 선택해 주세요.');
  const state={growth:HERO_GROWTH,units:heroes.map((h,i)=>({...h,id:i,hp:h.maxHp,barrier:h.name==='윤건'?calculateShield({base:h.attack*1.85,regeneration:h.regeneration}):0,barrierTurns:h.name==='윤건'?3:0,damageBuffTurns:h.name==='연희'?3:0,blessing:h.name==='윤건'?25:0,reviveImmortalTurns:h.name==='쥬리'?3:0,controlImmune:h.name==='쥬리'?3:0,nullify:h.name==='쥬리'?3:0,sleep:0,defDown:0,defTurns:0,immortal:0,immunity:0,annihilation:0,revived:false,triggered:false,actions:0,skillActions:0})),seed:(Number(seed)>>>0)||1,step:0,turn:0,round:0,phase:0,plans:structuredClone(plans),queue:[],log:[],done:false,winner:null,active:null,targets:[]};
  const sum=side=>heroes.filter(h=>h.side===side).reduce((n,h)=>n+h.speed,0),a=sum('attacker'),b=sum('defender');
  state.skillSide=a===b?(random(state)<.5?'attacker':'defender'):a>b?'attacker':'defender';return state;
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function scheduled(s){
  if(s.phase===0){
    const side=s.skillSide,ready=s.units.filter(u=>u.side===side&&u.hp>0&&!u.sleep),plan=s.plans[side];
    const index=plan.findIndex(p=>ready.some(u=>u.id===p.id));
    const reserved=index>=0?plan.splice(index,1)[0]:null;
    const actor=reserved?s.units[reserved.id]:ready.sort((a,b)=>a.skillActions-b.skillActions||a.id-b.id)[0];
    s.phase=1;s.skillSide=side==='attacker'?'defender':'attacker';
    return {actor,code:reserved?.code||(actor?.skillActions%2?2:3),kind:'skill',side};
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
  if(!a||!b||s.step>=180){s.done=true;s.winner=a&&!b?'attacker':b&&!a?'defender':null;events.push(s.winner?(s.winner==='attacker'?'공격팀':'방어팀')+' 승리 (추정 모델)':'행동 제한 또는 무승부 · 판정 보류');}
  s.log=[{step:s.step,turn:s.turn,round:s.round,...meta,text:events.join(' / ')},...s.log].slice(0,180);return s;
}
export function advanceBattle(previous){
  if(previous.done)return previous;
  const s=structuredClone(previous),events=[];s.targets=[];
  const alive=side=>s.units.filter(u=>u.side===side&&u.hp>0),action=scheduled(s),{actor,code,kind}=action;
  s.step++;s.active=actor?.id??null;
  if(!actor)return finishStep(s,[`${action.side==='attacker'?'공격':'방어'}팀 · 사용 가능한 스킬 없음`],{kind:'skip'});
  const before={...actor};
  const enemies=alive(actor.side==='attacker'?'defender':'attacker');
  const weak=random(s)<Math.min(1,actor.weakPoint/100);
  const targetsFor=n=>n===1&&weak?[...enemies].sort((a,b)=>(a.immortal>0)-(b.immortal>0)||a.hp/a.maxHp-b.hp/b.maxHp).slice(0,1):enemies.slice(0,n);
  function hit(target,base,{ignore=0,pierce=false}={}){
    if(target.hp<=0)return;
    s.targets.push(target.id);
    const chances=hitProbabilities({crit:actor.crit,block:target.block,blockBuff:target.blockBuff,blockDebuff:target.blockDebuff,shred:actor.shred});
    const missed=!weak&&random(s)<Math.min(1,actor.missChance/100),roll=random(s),critical=!missed&&(target.sleep>0||roll<chances.critical),isBlock=!critical&&roll<chances.critical+chances.blocked;
    const damage=calculateHit({base,defense:target.defense,defenseDecrease:target.defDown,ignore,critDamage:actor.critDamage,elasticity:target.elasticity,critical,blocked:isBlock,blockReduction:target.blockReduction,weak,weakBonus:actor.weakBonus,damageIncrease:actor.damageIncrease+(actor.name==='연희'&&actor.damageBuffTurns>0?35:0),amplification:actor.amplification,vulnerability:target.vulnerability,damageReduction:target.damageReduction,missed});
    const outcome=receiveDamage(target,damage,{pierce});Object.assign(target,outcome.target);
    events.push(`${target.name} ${outcome.kind==='damage'?'−'+outcome.damage.toLocaleString()+(critical?' 치명타':'')+(isBlock?' 막기':'')+(weak?' 약점':'')+(missed?' 빗나감':''):outcome.events.join(' · ')}${outcome.absorbed?' · 보호막 '+outcome.absorbed.toLocaleString():''}`);
    if(outcome.kind==='damage'&&outcome.events.length)events.push(...outcome.events.map(e=>target.name+' · '+e));
    if(target.sleep&&outcome.damage>=target.maxHp*.3)target.sleep=0;
    if(target.name==='연희'&&!target.triggered&&target.hp>0&&target.hp<=target.maxHp*.7){target.nullify=4;target.triggered=true;events.push('연희 · 피해 무효화 4회');}
  }
  const effect=(target,chance)=>rollEffect({baseChance:chance,accuracy:actor.accuracy,resistance:target.resist},()=>random(s));
  if(actor.sleep>0){events.push(`${actor.name} · 수면으로 행동 불가`);}
  else {
    actor.actions++;if(kind==='skill')actor.skillActions++;
    let skill='기본 공격';
    if(actor.name==='연희'){
      skill=code===3?'종말의 영면':code===2?'파괴의 손짓':'기본 공격';
      const targets=targetsFor(code===1?2:3);
      for(const t of targets){for(let i=0;i<(code===1?1:3);i++)hit(t,actor.attack*(code===3?.55:code===2?.51:1.3)+(code===2?Math.min(t.maxHp*.07,actor.attack):0),{ignore:code===3?.4:0,pierce:code!==1});if(t.hp>0&&!t.controlImmune&&code!==2&&effect(t,code===3?50:40))t.sleep=code===3?2:1;}
      if(code!==1){actor.barrier=Math.max(actor.barrier,calculateShield({base:actor.attack*1.35,regeneration:actor.regeneration}));actor.barrierTurns=3;}
    } else if(actor.name==='쥬리'){
      skill=code===3?'최고 판결':code===2?'천상의 심판':'기본 공격';
      for(const t of targetsFor(code===1?2:3)){if(code===3&&effect(t,70))t.annihilation=2;for(let i=0;i<(code===1?1:2);i++)hit(t,actor.attack*(code===3?.87:code===2?.77:.7)+(code===1?Math.min(t.maxHp*.08,actor.attack*1.5):0),{pierce:code===2});if(code===2&&t.hp>0&&effect(t,100)){t.defDown=.29;t.defTurns=3;}}
    } else {
      skill=code===3?'신속연사':code===2?'십연자포':'기본 공격';
      const targets=targetsFor(code===1?1:3);
      if(code===3)for(const t of targets){const hp=convertedHealth({hp:t.hp,maxHp:t.maxHp,percent:39,immortal:t.immortal>0});events.push(`${t.name} 생명력 전환 ${t.hp} → ${hp}`);t.hp=hp;}
      for(const t of targets)for(let i=0;i<(code===1?1:3);i++)hit(t,actor.attack*(code===3?.58:code===2?.5:1.45)*(code===3?1+.5*t.hp/t.maxHp:1),{ignore:code!==1?.4:0,pierce:code===3});
      actor.nullify=Math.min(6,actor.nullify+(code===1?1:2));
    }
    events.unshift(`${actor.side==='attacker'?'공격':'방어'} ${actor.name} · ${skill}`);
  }
  if(kind==='basic'){const tick=tickPersonalTurn(actor,before);Object.assign(actor,tick.target);events.push(...tick.events.map(e=>actor.name+' · '+e));}
  return finishStep(s,events,{kind,source:actor.id,code});
}
