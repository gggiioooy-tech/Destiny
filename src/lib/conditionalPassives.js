import {addStack,roleCount} from './passiveRules.js';
import {heroSkills,heroProfile} from './simulationSkills.js';
import {calculateRecovery,calculateShield} from './combatDamage.js';
import {cleanseDebuffs} from './statusEffects.js';

function heal(unit,base){
  if(unit.healBlock||unit.indomitableHits>0||unit.immortal>0||unit.hp<=0)return 0;
  const amount=Math.min(unit.maxHp-unit.hp,calculateRecovery({base,regeneration:unit.regeneration||0,increase:unit.healingIncrease||0,decrease:unit.healingReduction||0}));
  unit.hp+=amount;return amount;
}
function shield(unit,base,turns){if(unit.buffBlock||unit.hp<=0)return;unit.barrier=Math.max(unit.barrier||0,calculateShield({base,regeneration:unit.regeneration||0})*(1-(unit.shieldReduction||0)/100));unit.barrierTurns=Math.max(unit.barrierTurns||0,turns);}
export function afterControl(unit,events,units=[]){
  if(!unit.hp)return;
  const sources=[unit,...units.filter(u=>u.id!==unit.id&&u.side===unit.side&&u.hp>0&&u.name==='란드그리드')];
  const source=sources.find(owner=>{
    const text=heroSkills(owner.name).find(s=>s.code===4)?.raw.text||'';
    return /자신이 행동 제어에 걸릴 시/.test(text)&&(!['윤건','란드그리드'].includes(owner.name)||!unit.controlCleanseUses?.[owner.name]);
  });if(!source)return;
  unit.controlCleanseUses={...unit.controlCleanseUses,[source.name]:true};
  cleanseDebuffs(unit,Infinity,{controlOnly:source.name!=='윤건'});
  unit.controlImmune=Math.max(unit.controlImmune||0,['윤건','란드그리드'].includes(source.name)?2:1);events.push(unit.name+' · 행동 제어 해제');
  if(source.name==='젠이츠'){
    unit.awakenGauge=Math.min(unit.awakenMax,unit.awakenGauge+25);
    for(const key of Object.keys(unit.readyAt||{}))unit.readyAt[key]=Math.max(0,unit.readyAt[key]-26000);
    shield(unit,unit.attack*.95,3);
  }
  if(source.name==='실베스타'){
    const old=unit.cleanseAttackStacks||0,next=Math.min(4,old+1);
    unit.cleanseAttackBase??=unit.attack;unit.attack+=unit.cleanseAttackBase*.1*(next-old);unit.cleanseAttackStacks=next;
  }
}
export function afterSkillPassive(unit,events){
  const text=heroSkills(unit.name).find(s=>s.code===4)?.raw.text||'';
  const line=text.split('\n').find(l=>l.includes('자신의 스킬 1회 발동 시')&&/생명력 회복|만큼 회복/.test(l));
  const rule=line?.match(/자신의 스킬 1회 발동 시 시전자 (?:물리 |마법 )?(공격력|최대 생명력)의\s*([\d.]+)%/);
  if(rule){const amount=heal(unit,unit[rule[1]==='최대 생명력'?'maxHp':'attack']*Number(rule[2])/100);if(amount)events.push(unit.name+' · 스킬 사용 회복 '+amount);}
}
export function afterHitPassive(unit,units,events,{attackToken}={}){
  if(unit.hp<=0)return;
  unit.passiveHits=(unit.passiveHits||0)+1;
  const giyu=units.find(u=>u.side===unit.side&&u.hp>0&&u.name==='기유');
  if(giyu&&giyu.id===unit.id&&unit.passiveHits%4===0)for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0)){cleanseOne(ally);ally.awakenGauge=Math.min(ally.awakenMax||0,(ally.awakenGauge||0)+10);}
  if(unit.passiveHits%3===0&&unit.battleRow==='front'&&units.some(u=>u.side===unit.side&&u.hp>0&&u.name==='루디')){unit.reductionHits=2;unit.hitReduction=23;}
  if(unit.name==='헬레니아'&&unit.passiveHits%3===0)heal(unit,unit.defense*.4);
  const rad=units.find(u=>u.side===unit.side&&u.hp>0&&u.name==='라드그리드');
  if(rad&&unit.id!==rad.id&&unit.battleRow==='back'&&heroProfile(unit.name)?.role===5&&unit.passiveHits%3===0)shield(unit,rad.defense*.45,2);
  if(unit.name==='라드그리드'&&unit.passiveHits%3===0){heal(unit,unit.defense*.4);shield(unit,unit.defense*.55,2);events.push('라드그리드 · 3회 피격 회복·보호막');}
  if(unit.name==='스쿨드'){
    if(roleCount(units,unit.side,2)>=3&&(attackToken===undefined||unit.fateAttackToken!==attackToken)){
      unit.fateAttackToken=attackToken;
      unit.fateThreadDurations=[...(unit.fateThreadDurations||[]),3];unit.fateThreads=unit.fateThreadDurations.length;
      if(unit.fateThreads>=3){unit.fateThreadDurations=[];unit.fateThreads=0;unit.nullify=Math.max(unit.nullify,4);for(let i=0;i<3;i++)cleanseOne(unit);events.push('스쿨드 · 운명의 실 3개 소모');}
    }

  }

  if(unit.name==='시노부'&&unit.passiveHits%2===0){addStack(unit,'poisonStacks','attack',5,6,3);heal(unit,unit.attack*.35);}
  if(unit.name==='선란'&&unit.passiveHits%3===0&&roleCount(units,unit.side,1)>=3){const old=unit.seonStacks??3;addStack(unit,'seonStacks','attack',7,6,3);unit.critDamage+=(unit.seonStacks-old)*10;events.push('선란 · 귀면 중첩');}
  if(unit.name==='아리스'){const old=unit.arisStacks||0;unit.arisStacks=Math.min(30,old+1);unit.damageIncrease+=(unit.arisStacks-old)*2;unit.awakenGauge=Math.min(unit.awakenMax,unit.awakenGauge+3);}
  if(unit.name==='손오공')for(const key of Object.keys(unit.readyAt||{}))unit.readyAt[key]=Math.max(0,unit.readyAt[key]-10000);
  if(unit.name==='카르마')addStack(unit,'patienceStacks','defense',13,4);

}

export function afterHpChange(unit,units,events){if(unit.hp<=0)return;
  const pal=units.find(u=>u.side===unit.side&&u.hp>0&&u.name==='팔라누스');
  if(pal&&pal.id===unit.id&&unit.hp<=unit.maxHp*.3&&!unit.palCleanseUsed){unit.palCleanseUsed=true;for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0))while(cleanseOne(ally));events.push('팔라누스 · 체력 조건 아군 디버프 해제');}
  if(unit.name==='손오공'&&unit.hp<=unit.maxHp*.5&&!unit.wukongRescueUsed){unit.wukongRescueUsed=true;for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0))heal(ally,unit.attack*.95);events.push('손오공 · 절반 HP 아군 전체 회복');}
  if(unit.name==='스쿨드'){
    if(unit.hp<=unit.maxHp*.5&&(unit.skuldHeals||0)<2){unit.skuldHeals=(unit.skuldHeals||0)+1;heal(unit,unit.attack*1.65);events.push('스쿨드 · 절반 HP 회복');}
  }
  if(unit.name==='하연'&&unit.hp<=unit.maxHp*.5&&!unit.hayeonRescueUsed){unit.hayeonRescueUsed=true;for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0)){heal(ally,unit.maxHp*.22);shield(ally,unit.maxHp*.25,2);}events.push('하연 · 절반 HP 아군 전체 회복·보호막');}
}

// The shared ledger preserves creation order for instrumented effect paths.
export function cleanseOne(unit){return cleanseDebuffs(unit,1)>0;}
