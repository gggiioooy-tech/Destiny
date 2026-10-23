import {calculateShield}from './combatDamage.js';
// One active shield pool: a stronger grant replaces its provenance and duration.
export function applyShield(unit,base,turns,{unremovable=false}={}){
 if(unit.hp<=0||unit.buffBlock)return 0;
 const reduction=Math.max(0,Math.min(100,unit.shieldReduction||0)),amount=Math.max(0,Math.round(calculateShield({base,regeneration:unit.regeneration||0})*(1-reduction/100)));
 if(amount<(unit.barrier||0)||amount===(unit.barrier||0)&&unit.barrierProtected&&!unremovable)return 0;
 unit.barrier=amount;unit.barrierTurns=turns;unit.buffMaxTurns={...unit.buffMaxTurns,barrierTurns:turns};unit.barrierProtected=unremovable;unit.barrierEpoch=(unit.barrierEpoch||0)+1;return amount;
}
