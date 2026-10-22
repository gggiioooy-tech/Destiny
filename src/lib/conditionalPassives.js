import {heroSkills,heroProfile} from './simulationSkills.js';
import {calculateRecovery,calculateShield} from './combatDamage.js';

function heal(unit,base){
  if(unit.healBlock||unit.indomitableHits>0||unit.hp<=0)return 0;
  const amount=Math.min(unit.maxHp-unit.hp,calculateRecovery({base,regeneration:unit.regeneration||0,increase:unit.healingIncrease||0,decrease:unit.healingReduction||0}));
  unit.hp+=amount;return amount;
}
function shield(unit,base,turns){unit.barrier=Math.max(unit.barrier||0,calculateShield({base,regeneration:unit.regeneration||0}));unit.barrierTurns=Math.max(unit.barrierTurns||0,turns);}
export function afterControl(unit,events){
  const raw=heroSkills(unit.name).find(s=>s.code===4)?.raw;
  if(!/자신이 행동 제어에 걸릴 시/.test(raw?.text||'')||!unit.hp)return;
  for(const key of ['control','sleep','silence','blind'])unit[key]=0;
  unit.controlImmune=Math.max(unit.controlImmune||0,1);events.push(unit.name+' · 행동 제어 해제');
  if(unit.name==='젠이츠'){
    unit.awakenGauge=Math.min(unit.awakenMax,unit.awakenGauge+25);
    for(const key of Object.keys(unit.readyAt||{}))unit.readyAt[key]=Math.max(0,unit.readyAt[key]-26000);
    shield(unit,unit.attack*.95,3);
  }
  if(unit.name==='실베스타'){
    const old=unit.cleanseAttackStacks||0,next=Math.min(4,old+1);
    unit.cleanseAttackBase??=unit.attack;unit.attack+=unit.cleanseAttackBase*.1*(next-old);unit.cleanseAttackStacks=next;
  }
}
export function afterSkillPassive(unit,events){
  const text=heroSkills(unit.name).find(s=>s.code===4)?.raw.text||'';
  const rule=text.match(/자신의 스킬 1회 발동 시 시전자 (?:물리 |마법 )?(공격력|최대 생명력)의\s*([\d.]+)%/);
  if(rule){const amount=heal(unit,unit[rule[1]==='최대 생명력'?'maxHp':'attack']*Number(rule[2])/100);if(amount)events.push(unit.name+' · 스킬 사용 회복 '+amount);}
}
export function afterHitPassive(unit,units,events){
  if(unit.hp<=0)return;
  unit.passiveHits=(unit.passiveHits||0)+1;
  if(unit.name==='라드그리드'&&unit.passiveHits%3===0){heal(unit,unit.defense*.4);shield(unit,unit.defense*.55,2);events.push('라드그리드 · 3회 피격 회복·보호막');}
  if(unit.name==='스쿨드'){
    if(units.filter(u=>u.side===unit.side&&heroProfile(u.name)?.role===2).length>=3){
      unit.fateThreadDurations=[...(unit.fateThreadDurations||[]),3];unit.fateThreads=unit.fateThreadDurations.length;
      if(unit.fateThreads>=3){unit.fateThreadDurations=[];unit.fateThreads=0;unit.nullify=Math.max(unit.nullify,4);for(const key of ['control','sleep','silence'])unit[key]=0;events.push('스쿨드 · 운명의 실 3개 소모');}
    }
    if(unit.hp<=unit.maxHp*.5&&(unit.skuldHeals||0)<2){unit.skuldHeals=(unit.skuldHeals||0)+1;heal(unit,unit.attack*1.65);events.push('스쿨드 · 절반 HP 회복');}
  }
  for(const caster of units.filter(u=>u.side===unit.side&&u.name==='하연'&&u.hp>0)){
    if(unit.hp<=unit.maxHp*.5&&!unit.hayeonRescueUsed){unit.hayeonRescueUsed=true;heal(unit,caster.maxHp*.22);shield(unit,caster.maxHp*.25,2);events.push(unit.name+' · 하연 절반 HP 회복·보호막');}
  }
}
