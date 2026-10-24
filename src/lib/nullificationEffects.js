// New grants are buffs; blocking them does not remove an existing hit pool.
export function grantNullification(unit,count,{add=false,cap=Infinity}={}){
 if(unit.hp<=0||unit.buffBlock||!(count>0))return 0;
 const before=unit.nullify||0;
 unit.nullify=Math.max(before,Math.min(cap,add?before+count:count));
 return unit.nullify-before;
}
