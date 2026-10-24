import {applyShield} from './shieldEffects.js';
import {grantNullification} from './nullificationEffects.js';
import roster from './simulationRoster.json' with {type:'json'};
import {calculateRecovery,rollEffect,casterEffect} from './combatDamage.js';
import {setTimedBuff,setTimedDebuff} from './timedEffects.js';
import {startingShieldRules,passiveShieldRules} from './passiveShields.js';
import {extendBuffDurations,grantDelayedBuff} from './buffEffects.js';

const profiles=new Map(roster.heroes.map(h=>[h.name,h]));
export const passiveText=name=>{const p=profiles.get(name)?.skills.find(s=>s.code===4);return [p?.text,p?.enhanced,p?.upgrades].filter(Boolean).join('\n');};
export function roleCount(units,side,role){const team=units.filter(u=>u.side===side),count=team.filter(u=>profiles.get(u.name)?.role===role).length,minimum=team.length>3?3:2;return count+(count>=minimum&&team.some(u=>['하연','클레미스'].includes(u.name))?1:0);}
export function initializePassives(units){
  for(const unit of units){
    const text=passiveText(unit.name);
    // Reset the legacy regex result: a conditional guts shield is never initial.
    unit.barrier=0;unit.barrierTurns=0;unit.barrierProtected=false;
    for(const rule of startingShieldRules(unit.name))grantShield(unit,(rule.scale==='attack'&&Number.isFinite(unit.nativeShieldAttack)?unit.nativeShieldAttack:unit[rule.scale])*rule.value,rule.turns);
    for(const rule of passiveShieldRules(unit.name).filter(r=>r.trigger==='guts'&&r.group==='self'&&r.scale==='attack'&&!r.conditional))unit.gutsShieldPercent=Math.max(unit.gutsShieldPercent||0,rule.value*100);
    const stealth=passiveSections(unit.name).find(r=>r.group==='self'&&r.text.includes('위장')&&!/부활|발동|경우/.test(r.text));if(stealth)unit.stealth=Number(stealth.text.match(/(\d+)턴/)?.[1]||2);
    if(unit.name==='여포')unit.blessing=roleCount(units,unit.side,1)>=3?25:0;
    if(unit.name==='카일'&&roleCount(units,unit.side,1)>=3)unit.nullify=Math.max(unit.nullify,4);
    if(['프레이야','멜키르','실베스타'].includes(unit.name))unit.blessing=25;
    if(unit.name==='기유')unit.cooldownImmune=3;
    if(unit.name==='밀리아')unit.controlImmune=roleCount(units,unit.side,2)>=4?3:0;
    if(unit.name==='선란')unit.seonStacks??=3;
    if(units.some(u=>u.side===unit.side&&u.name==='카르마')){unit.reductionHits=3;unit.hitReduction=20;}
    if(profiles.get(unit.name)?.role===2&&units.some(u=>u.side===unit.side&&u.name==='동영'&&u.battleRow===unit.battleRow))unit.immunity=Math.max(unit.immunity,1);
    if(text.includes('고통 감내'))unit.endurePain=true;
    if(units.some(u=>u.side===unit.side&&u.name==='루디'))unit.linkTurns=2;
    if(units.some(u=>u.side===unit.side&&u.name==='아킬라'))unit.linkTurns=Math.max(unit.linkTurns||0,3);
    if(profiles.get(unit.name)?.role===1&&units.some(u=>u.side===unit.side&&u.name==='탄지로'))grantDelayedBuff(unit,2);
    for(const {text:line,group} of passiveSections(unit.name)){
      const immunity=line.match(/^- (기절|마비|빙결|석화|감전|수면|침묵|화상|중독) 면역\s*\[(\d+)턴/);if(!immunity)continue;
      for(const target of group==='team'?units.filter(u=>u.side===unit.side):[unit]){target.statusImmunities??={};target.statusImmunities[immunity[1]]=Number(immunity[2]);}
    }
    unit.battleRow=unit.battleRow||(unit.battleSeat<=2?'front':'back');
  }
  for(const caster of units.filter(u=>u.name==='칼 헤론'&&roleCount(units,u.side,1)>=3)){
    const target=units.filter(u=>u.side!==caster.side).sort((a,b)=>b.attack-a.attack||a.id-b.id)[0];
    if(target){target.thunderMarkSource=caster.id;target.crit-=50;target.weakPoint-=50;}
  }
}
export function passiveSections(name){
  const raw=profiles.get(name)?.skills.find(s=>s.code===4);let group=[2,3].includes(raw?.targetType)?'team':'self';const rows=[];
  for(const text of passiveText(name).split('\n')){
    const label=text.replace(/^[\[\s]+/,'');
    if(/^자신/.test(label)&&!text.startsWith('-'))group='self';
    else if(/^(?:모든 |단일 )?아군/.test(label)&&!text.startsWith('-'))group='team';
    else if(/^(?:모든 |단일 )?적군/.test(label)&&!text.startsWith('-'))group='enemy';
    if(text.startsWith('-'))rows.push({text,group});
  }return rows;
}
export function restoreHp(unit,base){
  if(unit.hp<=0||unit.healBlock||unit.indomitableHits>0||unit.immortal>0)return 0;
  const amount=Math.min(unit.maxHp-unit.hp,calculateRecovery({base,regeneration:unit.regeneration||0,increase:unit.healingIncrease||0,decrease:Math.max(unit.healingReduction||0,unit.awakeningHealingReduction||0)}));unit.hp+=amount;return amount;
}
export function grantShield(unit,base,turns){return applyShield(unit,base,turns);}
export function addStack(unit,key,stat,step,max,initial=0){
  const previous=unit[key]??initial,next=Math.min(max,previous+1);
  unit.stackBases??={};unit.stackBases[key]??=unit.panelStackBase?.[stat]??(unit[stat]/(1+initial*step/100));
  unit[stat]+=unit.stackBases[key]*(next-previous)*step/100;unit[key]=next;
}
export function addArisRage(unit,count){
  const old=unit.arisStacks||0;
  for(let i=0;i<count;i++)addStack(unit,'arisStacks','attack',6,30);
  unit.damageIncrease=(unit.damageIncrease||0)+(unit.arisStacks-old)*6;
}
export function onHealthThreshold(unit,units,events){
  if(unit.hp<=0)return;
  const text=passiveText(unit.name);unit.thresholdUses??={};
  for(const {text:line,group} of passiveSections(unit.name)){
    if(group!=='self'||!line.includes('자신의 생명력')||!line.includes('이하')||/효과 추가.*부활/.test(line))continue;
    if(unit.name==='스쿨드'||unit.name==='연희')continue; // existing dedicated handlers
    const threshold=Number(line.match(/([\d.]+)%\s*이하/)?.[1]||0);if(!threshold||unit.hp/unit.maxHp>threshold/100)continue;
    const condition=line.match(/(공격형|마법형|만능형) 영웅이?\s*(\d+)명/);
    if(condition&&roleCount(units,unit.side,({'공격형':1,'마법형':2,'만능형':5}[condition[1]]))<Number(condition[2]))continue;
    const max=Number(text.match(/횟수 상승.*?전투당\s*(\d+)회/)?.[1]||line.match(/전투당\s*(\d+)회/)?.[1]||1),key=line.replace(/효과 추가\s*[:：]\s*/,''),used=unit.thresholdUses[key]||0;
    if(used>=max)continue;
    const amount=line.match(/(?:공격력|방어력|최대 생명력)(?:의)?\s*([\d.]+)%/);
    const scale=line.includes('방어력의')?'defense':line.includes('최대 생명력')?'maxHp':'attack';
    let changed=false;
    if(amount&&line.includes('회복')){const upgrade=text.match(/회복량이?\s*(?:방어력|공격력)의\s*([\d.]+)%/);restoreHp(unit,unit[scale]*Number(upgrade?.[1]||amount[1])/100);changed=true;}
    if(amount&&line.includes('보호막')){grantShield(unit,unit[scale]*Number(amount[1])/100,Number(line.match(/(\d+)턴/)?.[1]||3));changed=true;}
    if(line.includes('모든 피해 면역')){const turns=Number(text.match(/턴 상승.*모든 피해 면역 지속\s*(\d+)턴/)?.[1]||line.match(/(\d+)턴/)?.[1]||2);unit.immunity=Math.max(unit.immunity,turns);changed=true;}
    const nullify=line.match(/모든 피해 무효화.*?피격\s*(\d+)회/);if(nullify){grantNullification(unit,Number(nullify[1]));changed=true;}
    if(changed){unit.thresholdUses[key]=used+1;events.push(unit.name+' · 체력 조건 패시브');}
  }
}
export function onAttackStacks(unit,units,events){
  if(unit.name==='윤건'&&unit.lastAttackBasic&&roleCount(units,unit.side,2)>=3)grantNullification(unit,1,{add:true,cap:6});
  if(profiles.get(unit.name)?.role===2)for(const caster of units.filter(u=>u.side===unit.side&&u.hp>0&&u.name==='밀리아'&&roleCount(units,u.side,2)>=5))grantShield(unit,caster.defense*.45,2);
  if(unit.name==='초선'&&unit.lastAttackBasic)for(const ally of units.filter(u=>u.side===unit.side&&u.id!==unit.id&&u.hp>0&&[1,2].includes(profiles.get(u.name)?.role))){grantShield(ally,unit.maxHp*.22,2);if(!ally.buffBlock)ally.controlImmune=Math.max(ally.controlImmune||0,2);}
  if(unit.lastAttackBasic)for(const {text:line,group} of passiveSections(unit.name)){const immunity=line.match(/자신의 기본 공격 1회 발동 시 (기절|마비|빙결|석화|감전|수면|침묵|화상|중독) 면역\s*\[(\d+)턴/);if(immunity)for(const target of group==='team'?units.filter(u=>u.side===unit.side):[unit]){target.statusImmunities??={};target.statusImmunities[immunity[1]]=Number(immunity[2]);target.statusImmunityEpochs??={};target.statusImmunityEpochs[immunity[1]]=(target.statusImmunityEpochs[immunity[1]]||0)+1;}}
  unit.passiveAttackCount=(unit.passiveAttackCount||0)+1;
  if(unit.name==='발리스타'&&unit.passiveAttackCount%2===0)grantNullification(unit,1,{add:true,cap:6});
  if(unit.name==='관우'&&unit.passiveAttackCount%2===0)for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0&&u.battleRow==='back')){if(profiles.get(ally.name)?.skills.find(s=>s.code===1)?.text.includes('물리 공격력'))setTimedBuff(ally,'damageIncrease',20,3,{source:'관우'});setTimedBuff(ally,'critDamage',40,3,{source:'관우'});}
  if(unit.name==='성진우'){unit.jinwooBasics=(unit.jinwooBasics||0)+(unit.lastAttackBasic?1:0);if(!unit.lastAttackBasic||unit.jinwooBasics%2===0)addStack(unit,'jinwooLevels','attack',3,40);}
  if(unit.name==='카르마'&&unit.passiveAttackCount%2===0)for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0)){ally.reductionHits=3;ally.hitReduction=20;}
  if(unit.name==='시노부'&&unit.lastAttackBasic)addStack(unit,'poisonStacks','attack',5,6,3);
  if(unit.name==='프레이야'){addStack(unit,'divinityStacks','attack',5,6,4);events.push('프레이야 · 신성 중첩');}
  if(unit.name==='기유'){unit.damageIncrease=(unit.damageIncrease||0)+((unit.giyuDamageStacks||0)<10?5:0);unit.giyuDamageStacks=Math.min(10,(unit.giyuDamageStacks||0)+1);}
  if(unit.name==='쥬리'&&unit.passiveAttackCount%3===0){extendBuffDurations(unit,1);events.push('쥬리 · 3회 공격 턴제 버프 연장');}
  if(unit.name==='헤브니아'&&unit.passiveAttackCount%2===0)for(const ally of units.filter(u=>u.side===unit.side))restoreHp(ally,unit.attack*.35);
}
export function beforeSkillRules(unit,units,events,rng=()=>0){
  if(unit.name==='윤건'&&roleCount(units,unit.side,2)>=3)grantNullification(unit,2,{add:true,cap:6});
  if(unit.name==='연희')grantShield(unit,unit.attack*1.35,3);
  if(unit.name==='린')grantNullification(unit,2,{add:true,cap:6});
  if(unit.name==='바네사')for(const target of units.filter(u=>u.side!==unit.side&&u.hp>0))if(rollEffect(casterEffect(unit,target,100),rng))setTimedDebuff(target,'magicVulnerability',24,2);
  if(unit.name==='클레미스')for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0&&!u.buffBlock))ally.regenBuff={base:unit.maxHp*.15,remaining:1};
  if(unit.name==='아리스')for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0&&u.battleRow==='front'))grantShield(ally,unit.attack*.52,2);
}
export function onSkillRules(unit,units,events,rng=()=>0,{includeBefore=true}={}){
  if(includeBefore)beforeSkillRules(unit,units,events,rng);
  const text=passiveText(unit.name);
  if(unit.name==='미호'&&unit.skillActions%2===0)for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0))setTimedBuff(ally,'vampirism',20,2,{source:'미호'});
  if(unit.name==='나타')for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0))grantShield(ally,unit.attack*.55,2);
  if(unit.name==='오를리')for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0&&(u.id===unit.id||profiles.get(u.name)?.role===2)))grantNullification(ally,1,{add:true,cap:6});
  const debuff={'스쿨드':['shieldReduction',60,3],'카구라':['physicalVulnerability',24,2]}[unit.name];
  if(debuff)for(const target of units.filter(u=>u.side!==unit.side&&u.hp>0))if(rollEffect(casterEffect(unit,target,100),rng)){
    const [stat,value,remaining]=debuff;setTimedDebuff(target,stat,value,remaining);
  }
  if(unit.name==='선란'&&unit.skillActions%2===0)unit.superiority=unit.superiority?Math.min(3,unit.superiority+1):1;
  if(!['윤건','린'].includes(unit.name))for(const {text:line,group} of passiveSections(unit.name)){
    if(group!=='self'||!line.includes('자신의 스킬 1회 발동 시'))continue;
    const n=line.match(/모든 피해 무효화.*?피격\s*(\d+)회/);if(n)grantNullification(unit,Number(n[1]),{add:true,cap:Number(line.match(/최대\s*(\d+)회/)?.[1]||6)});
    if(line.includes('불굴 효과의 피격 횟수')&&unit.indomitableHits>0)unit.indomitableHits=Math.min(8,unit.indomitableHits+1);
  }
  if(!['나타','윤건','연희'].includes(unit.name))for(const r of passiveShieldRules(unit.name).filter(r=>r.trigger==='skill'&&!r.conditional&&unit.skillActions%r.every===0))for(const target of r.group==='team'?units.filter(u=>u.side===unit.side&&u.hp>0):[unit])grantShield(target,unit[r.scale]*r.value,r.turns);
  for(const caster of units.filter(u=>u.side===unit.side&&u.hp>0)){
    caster.partySkillCount=(caster.partySkillCount||0)+1;
    if(caster.name==='시노부'&&caster.partySkillCount%2===0)for(const ally of units.filter(u=>u.side===unit.side))restoreHp(ally,caster.attack*.3);
    if(caster.name==='오르카'&&caster.partySkillCount%2===0)for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0&&u.id!==caster.id&&profiles.get(u.name)?.role===1)){
      if(ally.battleRow==='front'){for(const key of [2,3])if(!ally.cooldownImmune)ally.readyAt[key]=Math.max(ally.readyAt[key]||0,0)+18000;restoreHp(ally,caster.attack*.6);}
      else if(!ally.buffBlock){const existing=ally.panelTimedBuffs?.find(b=>b.source==='불공정 계약');if(existing)existing.remaining=2;else{const delta=(ally.panelStackBase?.attack||ally.attack)*.25;ally.attack+=delta;ally.panelTimedBuffs=[...(ally.panelTimedBuffs||[]),{stat:'attack',delta,remaining:2,source:'불공정 계약'}];}ally.nullify=Math.min(6,ally.nullify+1);}
    }
    if(caster.id===unit.id&&caster.name==='손오공')for(const ally of units.filter(u=>u.side===unit.side))restoreHp(ally,caster.attack*.55);


    if(caster.id===unit.id&&caster.name==='미스트'&&unit.skillActions%2===0)for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0))ally.controlImmune=Math.max(ally.controlImmune,2);
  }
  if(text.includes('불굴')&&unit.indomitableHits>0&&unit.name==='동영')unit.indomitableHits=Math.min(8,unit.indomitableHits);
}
export function onRevivalRules(unit,units,events){
  if(unit.name==='쥬리'&&unit.immortal>0)setTimedBuff(unit,'assistChanceBonus',24,3,{source:'신의 저울'});
  for(const r of passiveShieldRules(unit.name).filter(r=>r.trigger==='revive'&&r.group==='self'&&!r.conditional))grantShield(unit,unit[r.scale]*r.value,r.turns);
  if(unit.name==='성진우'){for(let i=0;i<10;i++)addStack(unit,'jinwooLevels','attack',3,40);for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0))grantNullification(ally,ally.id===unit.id?3:1,{add:true,cap:6});}
  if(unit.name==='선란')unit.superiority=2;
  if(unit.name==='여포')unit.readyAt={};
  if(unit.name==='아리스')addArisRage(unit,10);
  if(unit.name==='아일린')unit.immunity=Math.max(unit.immunity,3);
  if(unit.name==='동영'&&unit.indomitableHits>0){unit.awakenGauge=Math.min(unit.awakenMax,unit.awakenGauge+40);for(const ally of units.filter(u=>u.side===unit.side))restoreHp(ally,unit.attack*.65);}
  if(unit.name==='칼 헤론'&&!unit.calReviveUsed){unit.calReviveUsed=true;for(const ally of units.filter(u=>u.side===unit.side&&u.hp>0&&profiles.get(u.name)?.role===1)){grantNullification(ally,2,{add:true,cap:6});for(const key of ['control','sleep'])ally[key]=0;setTimedBuff(ally,'damageIncrease',19,3,{source:'칼 헤론 부활'});}}
  if(unit.name==='오르카'&&unit.immortal>0)unit.awakenGauge=Math.min(unit.awakenMax,unit.awakenGauge+40);
  if(unit.name==='탄지로'&&unit.indomitableHits>0){unit.critDamage+=49;unit.panelTimedBuffs=[...(unit.panelTimedBuffs||[]),{stat:'critDamage',remaining:3,delta:49,source:'불굴'}];}
  if(unit.name==='레긴레이프'&&unit.immortal>0){unit.resist+=49;unit.panelTimedBuffs=[...(unit.panelTimedBuffs||[]),{stat:'resist',remaining:2,delta:49,source:'최후의 심판'}];unit.judgment=2;unit.readyAt={};}
  if(unit.name==='태오'&&unit.immortal>0){const delta=unit.attack*.39;unit.attack+=delta;unit.panelTimedBuffs=[...(unit.panelTimedBuffs||[]),{stat:'attack',remaining:2,delta,source:'불사'}];unit.readyAt={};}
  for(const {text:line,group} of passiveSections(unit.name)){
    if(group!=='self'||!/(?:자신 )?부활 시/.test(line)||/효과 상승/.test(line))continue;
    const n=line.match(/모든 피해 무효화.*?피격\s*(\d+)회/);if(n&&unit.name!=='성진우')grantNullification(unit,Number(n[1]),{add:true,cap:6});
    if(line.includes('위장'))unit.stealth=Number(line.match(/(\d+)턴/)?.[1]||2);
    if(line.includes('독 축적')&&!unit.poisonReviveUsed){unit.poisonReviveUsed=true;for(let i=0;i<3;i++)addStack(unit,'poisonStacks','attack',5,6,3);}
  }events.push(unit.name+' · 부활 패시브');
}
export function onGutsRules(unit,units,events,rng){
  if(unit.name==='미호')restoreHp(unit,unit.maxHp*.3);
  if(unit.name==='스파이크')restoreHp(unit,unit.maxHp*.6);
  if(unit.name==='브란즈&브란셀')unit.immunity=Math.max(unit.immunity,2);
  if(!['하연','팔라누스'].includes(unit.name))return;
  const target=units.filter(u=>u.side!==unit.side&&u.hp>0).sort((a,b)=>b.hp-a.hp||a.id-b.id)[0];
  if(!target||target.hp<unit.hp||unit.immortal>0||unit.indomitableHits>0)return;
  const hp=unit.hp;unit.hp=Math.min(unit.maxHp,target.hp);target.hp=target.immortal>0||target.indomitableHits>0?1:Math.min(target.maxHp,hp);
  events.push(unit.name+' · '+target.name+' 생명력 교환');
  if(unit.name==='팔라누스')unit.immunity=Math.max(unit.immunity,2);
  if(unit.name==='하연')for(const key of ['healBlock','buffBlock'])if(rollEffect(casterEffect(unit,target,100),rng))target[key]=Math.max(target[key]||0,2);
}
export function onDeathRules(dead,units,events){
  if(dead.name==='아리스'){
    dead.attack-=(dead.stackBases?.arisStacks||0)*.06*(dead.arisStacks||0);
    dead.damageIncrease=(dead.damageIncrease||0)-6*(dead.arisStacks||0);dead.arisStacks=0;
  }
  if(dead.name==='루디'){dead.defense-=(dead.stackBases?.rudyStance||0)*.15*(dead.rudyStance||0);dead.rudyStance=0;}
  if(dead.name==='선란'){const count=dead.seonStacks??3,base=dead.stackBases?.seonStacks??dead.panelStackBase?.attack??dead.attack/(1+count*.07);dead.attack-=base*.07*count;dead.critDamage-=10*count;dead.seonStacks=0;}
  for(const unit of units.filter(u=>u.hp>0&&u.id!==dead.id)){
    const ally=unit.side===dead.side,text=passiveText(unit.name);
    if(unit.name==='하연')unit.awakenGauge=Math.min(unit.awakenMax,unit.awakenGauge+11);
    if(!ally){
      if(unit.name==='브란즈&브란셀'&&roleCount(units,unit.side,1)>=3)for(const r of passiveShieldRules(unit.name).filter(r=>r.trigger==='death'&&r.group==='self'))grantShield(unit,unit[r.scale]*r.value,r.turns);
      if(unit.name==='성진우')for(let i=0;i<2;i++)addStack(unit,'jinwooLevels','attack',3,40);
      if(unit.indomitableHits>0)unit.indomitableHits=Math.min(8,unit.indomitableHits+(unit.name==='탄지로'?2:1));
      for(const {text:line,group} of passiveSections(unit.name)){
        if(!/적(?:군)? 사망\s*(?:시|후)/.test(line))continue;
        const cd=line.match(/쿨타임 감소\s*(\d+)초/);if(cd)for(const key of Object.keys(unit.readyAt||{}))unit.readyAt[key]=Math.max(0,unit.readyAt[key]-Number(cd[1])*1000);
        const gauge=line.match(/게이지 증가\s*(\d+)/);if(gauge&&unit.name!=='하연')unit.awakenGauge=Math.min(unit.awakenMax,unit.awakenGauge+Number(gauge[1]));
        const heal=line.match(/공격력의\s*([\d.]+)%.*회복/);if(heal)for(const target of group==='team'?units.filter(u=>u.side===unit.side):[unit])restoreHp(target,unit.attack*Number(heal[1])/100);
      }
    }else if(unit.name==='동영'&&unit.indomitableHits>0)unit.indomitableHits=Math.min(8,unit.indomitableHits+1);
  }
  if(dead.name==='시노부')for(const target of units.filter(u=>u.side!==dead.side&&u.hp>0))target.dots=[...(target.dots||[]),...Array.from({length:2},()=>({name:'극독',source:dead.id,attack:dead.attack,remaining:2,value:.3,scale:'targetHp',cap:1.5,pierce:false,unremovable:true}))];
}
