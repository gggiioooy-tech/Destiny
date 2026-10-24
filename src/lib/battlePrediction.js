import {createBattle,advanceBattle,prepareHeroes} from './experimentalBattle.js';
import {canonicalHero} from './simulationSkills.js';
import {calculatePrebattle,defaultPrebattleSettings,PETS,FORMATIONS} from './prebattleStats.js';

export const ENGINE_VERSION='2026-10-24.5';
// Frequencies describe this model, not its accuracy against the game.
export function summarizePrediction(counts){
  const {attacker=0,defender=0,unresolved=0}=counts,total=attacker+defender+unresolved;
  const low=total?attacker/total:0,high=total?(attacker+unresolved)/total:1;
  return {...counts,total,attackerRate:total?attacker/total:null,defenderRate:total?defender/total:null,
    attackerBounds:[low,high],winner:low>.5?'attacker':high<.5?'defender':null,
    engineVersion:ENGINE_VERSION,empiricallyValidated:false};
}
export function simulateSample(draft,plans,index,seed=1){
  // An avalanche mixer avoids neighbouring seeds sharing early LCG decisions.
  let mixed=((seed>>>0)+Math.imul(index+1,0x9e3779b9))>>>0;
  mixed=Math.imul(mixed^(mixed>>>16),0x21f0aaad);mixed=Math.imul(mixed^(mixed>>>15),0x735a2d97);mixed=(mixed^(mixed>>>15))>>>0;
  let state=createBattle(draft,{plans,seed:mixed});
  for(let n=0;n<180&&!state.done;n++){state=advanceBattle(state);state.log=[];state.impacts=[];}
  return state.winner==='attacker'?'attacker':state.winner==='defender'?'defender':'unresolved';
}
export function predictBattle(draft,plans,{samples=100,seed=1}={}){
  if(!Number.isInteger(samples)||samples<1||samples>1000)throw Error('반복 횟수는 1~1000회입니다.');
  const counts={attacker:0,defender:0,unresolved:0};
  for(let i=0;i<samples;i++)counts[simulateSample(draft,plans,i,seed)]++;
  return summarizePrediction(counts);
}

const statIds={physicalAttack:1,magicalAttack:3,defence:5,hp:7,attackSpeed:9,critical:10,criticalDamage:11,weakPoint:12,accuracyRate:13,resistRate:14,blockRate:17,takeDamageRate:18,damageIncrease:21,fracture:22,resilience:23,rejuvenation:24};
// Deliberately reads only start stats and time-zero reservations. No timeline,
// winner, damage results, final HP or observed casts enter a prediction.
export function setupFromRecord(record){
  const p=record?.payload;if(!p?.heroStats)throw Error('전투 시작 상세 스탯이 없습니다.');
  const heroes=[],plans={attacker:[],defender:[]};
  for(const side of ['attacker','defender']){
    const team=p[side];if(team?.heroIds?.length!==3||team.heroes?.length!==3)throw Error('정확한 3인 편성이 필요합니다.');
    for(let i=0;i<3;i++){
      const row=p.heroStats[side]?.find(h=>h.heroId===team.heroIds[i]);
      if(!row||!['hp','defence','attackSpeed'].every(k=>Number.isFinite(row.stats[k]))||!['physicalAttack','magicalAttack'].some(k=>Number.isFinite(row.stats[k])))throw Error('시작 스탯 누락');
      heroes.push({side,name:canonicalHero(team.heroes[i]),stats:Object.fromEntries(Object.entries(statIds).filter(([k])=>Number.isFinite(row.stats[k])).map(([k,id])=>[id,row.stats[k]]))});
    }
    if(!Array.isArray(team.skills)||team.skills.length>3)throw Error('초기 예약 스킬 확인 필요');
    plans[side]=team.skills.slice().sort((a,b)=>a.order-b.order).map(s=>{
      const slot=team.heroIds.indexOf(s.heroId);if(slot<0||![2,3].includes(s.skillType))throw Error('초기 예약 스킬 확인 필요');
      return {id:slot+(side==='defender'?3:0),code:s.skillType};
    });
  }
  const raw=prepareHeroes({heroes}),settings=defaultPrebattleSettings();
  for(const side of ['attacker','defender']){
    const context=p.initialContext?.[side],team=p[side];
    if(PETS.some(v=>v.name===team.pet))settings[side].pet=team.pet;
    const initial=team.heroIds.map(id=>context?.heroes?.find(h=>h.heroId===id));
    const formationMap={13200:'basic',12300:'balance',14100:'attack',11400:'protection'},formation=FORMATIONS.find(f=>f.id===formationMap[initial[0]?.formationGroup]);
    if(formation&&initial.every(h=>Number.isInteger(h?.seat)&&h.seat>=1&&h.seat<=5)&&new Set(initial.map(h=>h.seat)).size===3){
      settings[side].formation=formation.id;settings[side].seats=initial.map(h=>h.seat);settings[side].positions=initial.map(h=>h.seat<=formation.front?'front':'back');
    }
  }
  const draft=calculatePrebattle(raw,settings,{basis:'battle'}).heroes;createBattle(draft,{plans});return {draft,plans};
}

export function wilsonInterval(success,total){
  if(!total)return [0,1];const z=1.96,p=success/total,denom=1+z*z/total;
  const center=(p+z*z/(2*total))/denom,margin=z*Math.sqrt(p*(1-p)/total+z*z/(4*total*total))/denom;
  return [Math.max(0,center-margin),Math.min(1,center+margin)];
}
