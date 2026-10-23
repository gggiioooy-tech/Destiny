import catalog from './battleTimingCatalog.json' with {type:'json'};
import {canonicalHero} from './simulationSkills.js';
export const BATTLE_LIMIT_MS=210000;
export const TIMING_CATALOG=catalog;
export function skillCooldownMs(name,code,publishedSeconds=0){
  const observed=catalog.entries[canonicalHero(name)+'|skill|'+code]?.cooldown;
  return observed?.count>=5?observed.medianMs:publishedSeconds*1000;
}
export function actionTiming(name,code,kind='skill'){
  const key=canonicalHero(name)+'|'+kind+'|'+code,profile=catalog.entries[key];
  if(profile)return {...profile,estimated:false,source:'observed_stage_interval'};
  const comparable=Object.entries(catalog.entries).filter(([key])=>key.split('|')[1]===kind).map(([,p])=>p.medianMs).sort((a,b)=>a-b);
  return {count:0,medianMs:comparable[Math.floor(comparable.length/2)]||1000,estimated:true,source:'cross_hero_fallback'};
}
export function resolveTimeout(units){
  const team=side=>units.filter(u=>u.side===side),a=team('attacker'),d=team('defender');
  const alive=rows=>rows.filter(u=>u.hp>0),aa=alive(a),dd=alive(d);
  if(!aa.length||!dd.length)return {winner:aa.length?'attacker':dd.length?'defender':null,basis:'elimination'};
  const allImmortal=rows=>rows.every(u=>u.immortal>0),allIndomitable=rows=>rows.every(u=>u.indomitableHits>0);
  if(allImmortal(aa)&&allIndomitable(dd))return {winner:'attacker',basis:'immortal_over_indomitable'};
  if(allImmortal(dd)&&allIndomitable(aa))return {winner:'defender',basis:'immortal_over_indomitable'};
  if(allImmortal(aa)&&allImmortal(dd)){
    const turns=rows=>Math.max(...rows.map(u=>u.immortal)),difference=turns(aa)-turns(dd);
    return {winner:difference>0?'attacker':difference<0?'defender':null,basis:'remaining_immortal_turns'};
  }
  const ratio=rows=>rows.reduce((n,u)=>n+Math.max(0,u.hp),0)/rows.reduce((n,u)=>n+u.maxHp,0),difference=ratio(a)-ratio(d);
  return {winner:Math.abs(difference)<1e-12?null:difference>0?'attacker':'defender',basis:'remaining_team_hp_ratio',attackerHpRatio:ratio(a),defenderHpRatio:ratio(d)};
}
export function formatBattleTime(ms){const seconds=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
