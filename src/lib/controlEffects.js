export function controlBurst(target,status,source){
  if(!source)return null;
  if(status==='빙결')return {base:Math.min(target.maxHp*.4,source.attack*3),ignore:.4,source:source.id,name:status};
  if(status==='빙극')return {base:target.maxHp*.6,ignore:.4,source:source.id,name:status};
  if(status==='석화')return {base:source.attack*1.2,ignore:0,source:source.id,name:status};
  return null;
}
export function releaseControl(target){
  const burst=controlBurst(target,target.controlName,target.controlSource);
  target.control=0;delete target.controlName;delete target.controlSource;delete target.shockSource;
  if(burst)target.pendingControlBursts=[...(target.pendingControlBursts||[]),burst];
}
