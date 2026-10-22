import {createBattle} from './experimentalBattle.js';
import {canonicalHero,coverageIssues} from './simulationSkills.js';
import {normalizePrebattleSettings,calculatePrebattle} from './prebattleStats.js';

export const STAT_FIELDS=[['attack','공격력'],['defense','방어력'],['maxHp','생명력'],['speed','속공'],['crit','치명타 확률 %'],['critDamage','치명타 피해 %'],['weakPoint','약점 공격 확률 %'],['block','막기 확률 %'],['accuracy','효과 적중 %'],['resist','효과 저항 %'],['shred','파쇄 %'],['elasticity','탄성 %'],['damageReduction','받는 피해 감소 %'],['amplification','피해 증폭 %'],['regeneration','재생 %'],['damageIncrease','별도 피해 증가 %'],['vulnerability','받는 피해 취약 %'],['weakBonus','별도 약점 피해 증가 %'],['missChance','빗나감 확률 %'],['blockBuff','추가 막기 버프 %'],['blockDebuff','막기 디버프 %'],['blockReduction','막기 피해감소 %']];
const aliases={공격력:'attack',물리공격력:'attack',마법공격력:'attack',방어력:'defense',생명력:'maxHp',속공:'speed',치명타확률:'crit',치명타피해:'critDamage',약점공격확률:'weakPoint',막기확률:'block',효과적중:'accuracy',효과저항:'resist',파쇄:'shred',탄성:'elasticity',재생:'regeneration',받는피해감소:'damageReduction',피해증폭:'amplification',피해량증가:'damageIncrease'};
export function parseStatPaste(input,name){
  if(typeof input!=='string'||input.length>16000)throw Error('16KB 이하의 스탯 표를 붙여넣어 주세요.');
  const lines=input.trim().split(/\r?\n/),result={};let column=null;
  const header=lines.find(l=>l.includes('\t')&&!/\d/.test(l));
  if(header){const names=header.split('\t').map(v=>canonicalHero(v.trim()));const index=names.indexOf(canonicalHero(name));if(index>0)column=index-1;}
  for(const line of lines){
    const m=line.match(/^\s*([^\d\t]+?)[\s\t:：]+(-?[\d,]+(?:\.\d+)?%?(?:[\s\t]+-?[\d,]+(?:\.\d+)?%?)*)\s*$/);
    if(!m)continue;
    const label=m[1].replace(/[\s·%]/g,'');if(!Object.hasOwn(aliases,label))continue;
    const key=aliases[label];
    const values=m[2].split(/[\s\t]+/).map(v=>Number(v.replace(/[,%]/g,'')));
    if(values.length>1&&column===null)throw Error('여러 영웅의 표라면 첫 줄에 영웅 이름을 포함해 주세요.');
    const value=values[column??0];
    if(!Number.isFinite(value)||Math.abs(value)>1000000||(value<0&&!['resist','crit','weakPoint','block'].includes(key)))throw Error('스탯 값과 선택한 영웅 열을 확인해 주세요.');
    result[key]=key==='attack'&&result[key]!==undefined?Math.max(result[key],value):value;
  }
  if(!Object.keys(result).length)throw Error('공격력·방어력·생명력처럼 항목 이름과 숫자가 함께 있는 표를 붙여넣어 주세요.');
  return result;
}
export function inspectSetup(draft,plans){
  const errors=[];
  try{createBattle(draft,{plans});}catch(e){errors.push(e.message);}
  for(const side of ['attacker','defender'])if(new Set(draft.filter(h=>h.side===side).map(h=>h.name)).size!==3)errors.push(`${side==='attacker'?'공격':'방어'}팀에 같은 영웅을 중복 배치할 수 없습니다.`);
  return {errors,exampleCount:draft.filter(h=>h.exampleStats===true||h.origin?.includes('테스트 기본값')).length,
    speed:{attacker:draft.filter(h=>h.side==='attacker').reduce((n,h)=>n+Number(h.speed||0),0),defender:draft.filter(h=>h.side==='defender').reduce((n,h)=>n+Number(h.speed||0),0)},
    coverage:draft.map(h=>({id:h.id,name:h.name,side:h.side,issues:coverageIssues(h.name)}))};
}
export function swapTeams(draft,plans){
  const heroes=[...draft.slice(3),...draft.slice(0,3)].map((h,id)=>({...h,id,side:id<3?'attacker':'defender'}));
  return {draft:heroes,plans:{attacker:plans.defender.map(p=>({...p,id:p.id-3})),defender:plans.attacker.map(p=>({...p,id:p.id+3}))}};
}
export function setupDocument({draft,plans,seed=1,inputBasis='battle',teamSettings},name='내 조합'){
  return validateSetupDocument({format:'15month-battle-setup',version:2,name,draft,plans,seed,inputBasis,teamSettings});
}
export function validateSetupDocument(value){
  if(!value||value.format!=='15month-battle-setup'||![1,2].includes(value.version)||!Array.isArray(value.draft)||value.draft.length!==6||typeof value.name!=='string'||value.name.length>80||!Number.isSafeInteger(value.seed)||value.seed<0||value.seed>4294967295)throw Error('지원하는 조합 설정 파일이 아닙니다.');
  const inputBasis=value.version===1?'battle':value.inputBasis;
  if(!['panel','battle'].includes(inputBasis))throw Error('조합 입력 기준이 올바르지 않습니다.');
  const teamSettings=normalizePrebattleSettings(value.version===1?undefined:value.teamSettings);
  const draft=value.draft.map((h,id)=>{
    const example=h?.exampleStats===true||typeof h?.origin==='string'&&h.origin.includes('테스트 기본값');
    const unit={id,side:id<3?'attacker':'defender',name:canonicalHero(h?.name),origin:example?'테스트 기본값 · 저장한 조합':'불러온 조합 · 직접 저장한 수치',exampleStats:example};
    for(const [key]of STAT_FIELDS){const n=h?.[key];if(!Number.isFinite(n))throw Error('조합 스탯이 올바르지 않습니다.');unit[key]=n;}
    return unit;
  });
  const plans={};for(const side of ['attacker','defender']){
    if(!Array.isArray(value.plans?.[side]))throw Error('스킬 순서가 올바르지 않습니다.');
    plans[side]=value.plans[side].map(p=>({id:p?.id,code:p?.code}));
  }
  const result=inspectSetup(calculatePrebattle(draft,teamSettings,{basis:inputBasis}).heroes,plans);if(result.errors.length)throw Error(result.errors[0]);
  return {format:value.format,version:2,name:value.name.trim()||'내 조합',draft,plans,seed:value.seed,inputBasis,teamSettings};
}
export function readSetupFile(text){if(typeof text!=='string'||text.length>131072)throw Error('128KB 이하의 조합 JSON만 열 수 있습니다.');return validateSetupDocument(JSON.parse(text));}
const storageKey=identity=>'15month:simulation:presets:v1:'+encodeURIComponent(identity);
export function loadPresets(storage,identity){
  if(!identity)return [];
  try{const rows=JSON.parse(storage.getItem(storageKey(identity))||'[]');if(!Array.isArray(rows))return [];return rows.slice(0,20).flatMap(r=>{try{return [validateSetupDocument(r)];}catch{return [];}});}catch{return [];}
}
export function savePresets(storage,identity,rows){
  if(!identity)throw Error('로그인 정보를 확인한 뒤 다시 저장해 주세요.');
  if(rows.length>20)throw Error('조합은 최대 20개까지 저장할 수 있습니다.');
  storage.setItem(storageKey(identity),JSON.stringify(rows.map(validateSetupDocument)));
}
export function advanceSession(session,advance){
  if(!session)return session;
  if(session.cursor<session.frames.length-1)return {...session,cursor:session.cursor+1};
  const last=session.frames.at(-1);if(last.done)return session;
  return {frames:[...session.frames,advance(last)],cursor:session.cursor+1};
}
export function finishSession(session,advance){
  if(!session)return session;
  const frames=session.frames.slice(0,session.cursor+1);let current=frames.at(-1);
  for(let i=0;i<180&&!current.done;i++){current=advance(current);frames.push(current);}
  return {frames,cursor:frames.length-1};
}
