import {roleCount} from './passiveRules.js';

// Separate attacks use their own timing and never consume a reserved skill.
export function queuePassiveAttacks(event,unit,units,queue){
  const push=spec=>queue.push({source:unit.id,code:4,kind:'hero_passive',spec});
  if(unit.hp<=0)return;
  if(event==='attack'){
    const n=unit.passiveAttackCount||0;
    if(unit.name==='윤건'&&n%2===0)push({name:'윤건 · 2회 공격',attack:.75,hp:.22,cap:3,hits:1,pierce:true});
    if(unit.name==='겔리두스'&&n%2===0)push({name:'겔리두스 · 2회 공격',attack:.6,defense:.65,hits:1,control:'빙극',chance:75,turns:2});
    if(unit.name==='카일'&&n%2===0)push({name:'카일 · 2회 공격',hp:.32,cap:1,hits:1,ignore:.4});
    if(unit.name==='여포'){
      unit.lubuBasics=(unit.lubuBasics||0)+(unit.lastAttackBasic?1:0);
      if(!unit.lastAttackBasic||unit.lubuBasics%2===0)push({name:'여포 · 추가 공격',attack:.45,hits:1,mark:roleCount(units,unit.side,1)>=3});
    }
  }
  if(event==='hit'){
    if(unit.name==='플라튼'&&(unit.passiveHits||0)%4===0)push({name:'플라튼 · 4회 피격',fixed:1485,hits:1});
    if(unit.name==='선란'&&unit.seonStacks>=6&&!unit.seonStrikeQueued){unit.seonStrikeQueued=true;push({name:'선란 · 무영비검',attack:.55,hp:.07,cap:1,hits:3,dispel:2});}
  }
  if(event==='partySkill')for(const owner of units.filter(u=>u.side===unit.side&&u.hp>0&&u.name==='동영'))if(owner.partySkillCount%2===0)queue.push({source:owner.id,code:4,kind:'hero_passive',spec:{name:'동영 · 아군 스킬 2회',attack:.5,hits:1,poison:true,healingReduction:20,magicVulnerability:20}});
  if(event==='revive'&&unit.name==='아일린'&&!unit.aileenReviveStrike){unit.aileenReviveStrike=true;push({name:'아일린 · 부활 청천벽력',attack:.75,hits:2,pierce:true,control:'감전',chance:35,turns:2,defDown:.08,maxStacks:4});}
}
