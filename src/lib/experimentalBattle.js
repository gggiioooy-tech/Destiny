import {hitProbabilities,calculateHit} from './combatDamage.js';
// Experimental community model; action scheduling is still a prototype.
export const SIM_HEROES=['연희','쥬리','윤건'];
export const MODEL_LIMITS='실험 모델: 사용자 제공 방어 계수 0.00214 및 탄성·막기·파쇄 차감 규칙을 적용합니다. 확률 판정 순서는 독립 검증 전입니다. 행동 순서·쿨타임은 임시 규칙이며 펫·장비 개별 효과, 각성기, 협공·추가타·일부 패시브는 미구현입니다. 입력 스탯에 포함된 상시 증가는 다시 적용하지 않습니다.';
export function prepareHeroes(report){
  return Array.from({length:6},(_,i)=>{
    const side=i<3?'attacker':'defender',name=SIM_HEROES[i%3];
    const source=report?.heroes.find(h=>h.side===side&&h.name===name);
    const s=source?.stats;
    return {id:i,name,side,attack:s?Math.max(s['1']||0,s['3']||0):8000,defense:s?.['5']??1800,maxHp:s?.['7']??10000,speed:s?.['9']??(100-i),crit:(s?.['10']??750)/10,critDamage:(s?.['11']??1500)/10,accuracy:(s?.['13']??0)/10,resist:(s?.['14']??0)/10,block:(s?.['17']??0)/10,shred:(s?.['22']??0)/10,elasticity:(s?.['23']??0)/10,blockBuff:0,blockDebuff:0,blockReduction:50,origin:source?'수집된 시작 스탯':'테스트 기본값'};
  });
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createBattle(heroes,{seed=1}={}){
  if(heroes.length!==6||heroes.filter(h=>h.side==='attacker').length!==3||heroes.filter(h=>h.side==='defender').length!==3||heroes.some(h=>!SIM_HEROES.includes(h.name)))throw Error('지원 영웅을 양 팀에 3명씩 배치해 주세요.');
  for(const h of heroes)for(const k of ['attack','defense','maxHp','speed','crit','critDamage','accuracy','resist','block','shred','elasticity','blockBuff','blockDebuff','blockReduction'])if(!Number.isFinite(h[k])||Math.abs(h[k])>1000000||(h[k]<0&&k!=='resist')||(k==='maxHp'&&h[k]<1)||(k==='blockReduction'&&h[k]>100))throw Error('스탯은 유효한 숫자로 입력해 주세요. 막기 피해감소는 0~100%입니다.');
  return {units:heroes.map((h,i)=>({...h,id:i,hp:h.maxHp,barrier:h.name==='윤건'?Math.round(h.attack*1.85):0,nullify:h.name==='쥬리'?3:0,sleep:0,defDown:0,defTurns:0,immortal:0,revived:false,triggered:false,actions:0})),seed:(Number(seed)>>>0)||1,step:0,round:0,queue:[],log:[],done:false,winner:null,active:null,targets:[]};
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function advanceBattle(previous){
  if(previous.done)return previous;
  const s=structuredClone(previous),events=[];s.targets=[];
  const alive=side=>s.units.filter(u=>u.side===side&&u.hp>0);
  if(!s.queue.length){s.round++;s.queue=s.units.filter(u=>u.hp>0).sort((a,b)=>b.speed-a.speed||a.id-b.id).map(u=>u.id);}
  let actor;while(s.queue.length&&!actor){const unit=s.units[s.queue.shift()];if(unit.hp>0)actor=unit;}
  if(!actor){s.queue=[];return s;}
  s.step++;s.active=actor.id;
  if(actor.defTurns>0&&!--actor.defTurns)actor.defDown=0;
  if(actor.immortal>0)actor.immortal--;
  const enemies=alive(actor.side==='attacker'?'defender':'attacker');
  function hit(target,base,{ignore=0,pierce=false}={}){
    if(target.hp<=0)return;
    s.targets.push(target.id);
    if(target.nullify>0&&!pierce){target.nullify--;events.push(`${target.name} 피해 무효화`);return;}
    const chances=hitProbabilities({crit:actor.crit,block:target.block,blockBuff:target.blockBuff,blockDebuff:target.blockDebuff,shred:actor.shred});
    const roll=random(s),critical=roll<chances.critical,isBlock=roll>=chances.critical&&roll<chances.critical+chances.blocked;
    let damage=calculateHit({base,defense:target.defense,defenseDecrease:target.defDown,ignore,critDamage:actor.critDamage,elasticity:target.elasticity,critical,blocked:isBlock,blockReduction:target.blockReduction});
    const blocked=Math.min(target.barrier,damage);target.barrier-=blocked;damage-=blocked;
    target.hp=Math.max(target.immortal>0?1:0,target.hp-damage);
    events.push(`${target.name} −${damage.toLocaleString()}${critical?' 치명타':''}${isBlock?' 막기':''}${blocked?' · 보호막 '+blocked.toLocaleString():''}`);
    if(target.sleep&&damage>0)target.sleep=0;
    if(target.name==='연희'&&!target.triggered&&target.hp>0&&target.hp<=target.maxHp*.7){target.nullify=4;target.triggered=true;events.push('연희 · 피해 무효화 4회');}
    if(target.name==='쥬리'&&target.hp===0&&!target.revived){target.hp=1;target.immortal=3;target.revived=true;events.push('쥬리 · 불사 3회 행동');}
  }
  const effect=(target,chance)=>random(s)<clamp(chance/100*(1+(actor.accuracy-target.resist)/100),0,1);
  if(actor.sleep>0){actor.sleep--;events.push(`${actor.name} · 수면으로 행동 불가`);}
  else {
    // Prototype schedule: 2-skill → 1-skill → basic, once per speed-ordered round.
    const code=[3,2,1][actor.actions%3];actor.actions++;
    let skill='기본 공격';
    if(actor.name==='연희'){
      skill=code===3?'종말의 영면':code===2?'파괴의 손짓':'기본 공격';
      const targets=code===1?enemies.slice(0,1):enemies;
      for(const t of targets){for(let i=0;i<(code===1?1:3);i++)hit(t,actor.attack*(code===3?.41:code===2?.43:1)+(code===2?Math.min(t.maxHp*.06,actor.attack):0),{ignore:code===3?1:0});if(t.hp>0&&code!==2&&effect(t,code===3?50:40))t.sleep=code===3?2:1;}
      if(code!==1)actor.barrier=Math.max(actor.barrier,Math.round(actor.attack*1.35));
    } else if(actor.name==='쥬리'){
      skill=code===3?'최고 판결':code===2?'천상의 심판':'기본 공격';
      for(const t of code===1?enemies.slice(0,1):enemies){for(let i=0;i<(code===1?1:2);i++)hit(t,actor.attack*(code===3?.75:code===2?.65:.55)+(code===1?Math.min(t.maxHp*.07,actor.attack*1.5):0),{pierce:code===2});if(code===2&&t.hp>0&&effect(t,100)){t.defDown=.29;t.defTurns=3;}}
    } else {
      skill=code===3?'신속연사':code===2?'십연자포':'기본 공격';
      const targets=code===1?enemies.slice(0,1):enemies;
      for(const t of targets)for(let i=0;i<(code===1?1:3);i++)hit(t,actor.attack*(code===3?.58:code===2?.5:1.45)*(code===3?1+.5*t.hp/t.maxHp:1),{ignore:code!==1?.4:0,pierce:code===3});
      actor.nullify=Math.min(6,actor.nullify+(code===1?1:2));
    }
    events.unshift(`${actor.side==='attacker'?'공격':'방어'} ${actor.name} · ${skill}`);
  }
  s.targets=[...new Set(s.targets)];
  const attack=alive('attacker').length,defense=alive('defender').length;
  if(!attack||!defense||s.step>=180){s.done=true;s.winner=!defense?'attacker':!attack?'defender':null;events.push(s.winner?(s.winner==='attacker'?'공격팀':'방어팀')+' 승리 (추정 모델)':'행동 제한 도달 · 판정 보류');}
  s.log=[{step:s.step,round:s.round,text:events.join(' / ')},...s.log].slice(0,180);return s;
}
