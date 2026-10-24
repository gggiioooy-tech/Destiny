import {heroProfile} from './simulationSkills.js';

function guardingAllies(target,allies){
  return allies.filter(u=>u.id!==target.id&&(
    ['기유','라드그리드'].includes(u.name)&&target.battleRow==='back'&&heroProfile(target.name)?.role===5||
    u.name==='헬레니아'&&allies.slice().sort((a,b)=>a.hp-b.hp||a.id-b.id).slice(0,3).some(a=>a.id===target.id)
  ));
}
// Secondary shares do not recursively create another link/guard share.
export function damageShares(target,units,amount){
  const allies=units.filter(u=>u.side===target.side&&u.hp>0);
  const guards=guardingAllies(target,allies);
  if(guards.length){const guard=guards.sort((a,b)=>a.id-b.id)[0];return [{id:target.id,amount:amount*.65},{id:guard.id,amount:amount*.35*.5}];}
  if(target.linkTurns>0){
    const linked=allies.filter(u=>u.linkTurns>0&&!guardingAllies(u,allies).length);
    if(linked.length>1&&linked.some(u=>u.id===target.id))return linked.map(u=>({id:u.id,amount:amount*.8/linked.length}));
  }
  return [{id:target.id,amount}];
}
export function deferPain(target,amount){
  if(!target.endurePain||amount<target.maxHp*.1)return amount;
  const delayed=amount*.75;target.deferredPain=[...(target.deferredPain||[]),{remaining:5,perTurn:delayed/5}];
  return amount-delayed;
}
