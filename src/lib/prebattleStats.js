import catalog from './prebattleCatalog.json' with {type:'json'};
import {heroProfile,heroSkills} from './simulationSkills.js';

const PET_REFERENCES=[['루','루'],['이린','이린'],['리첼','리첼'],['크리','크리'],['파이크','파이크'],['델로','델로'],['윈디','윈디'],['제브','제브'],['유','유'],['요랑','요랑'],['연지','연지'],['카람','카람'],['제오','제오'],['멜페로','멜패로'],['네즈코','카마도 네즈코']];
const petAliases={'멜패로':'멜페로','카마도 네즈코':'네즈코'};
export const PETS=PET_REFERENCES.map(([name,reference])=>({...catalog.pets.find(p=>p.name===reference),name}));
export const BASE_STATS=catalog.bases;
export const FORMATIONS=[
  {id:'basic',name:'기본진형',back:3,front:2,attack:14,defense:21},
  {id:'balance',name:'밸런스진형',back:2,front:3,attack:21,defense:14},
  {id:'attack',name:'공격진형',back:4,front:1,attack:10.5,defense:42},
  {id:'protection',name:'보호진형',back:1,front:4,attack:42,defense:10.5},
];
const primary=['attack','defense','maxHp'];
export const defaultPetPotentials=pet=>Array.from({length:4},()=>({stat:['루','파이크','카람'].includes(pet)?'defense':'attack',value:pet==='없음'?0:15}));
export const hasManualPotentials=team=>team.potentialsManual===true||(team.potentialsManual===undefined&&team.potentials?.some(p=>p.value!==0));
export function selectPet(team,pet){const manual=hasManualPotentials(team);return {...team,pet,potentialsManual:manual,potentials:manual?team.potentials:defaultPetPotentials(pet)};}

export const defaultTeamSettings=()=>({pet:'없음',petEnhancement:5,petSkillLevel:3,formation:'basic',formationAttack:14,formationDefense:21,potentialsManual:false,potentials:defaultPetPotentials('없음'),positions:['back','back','back']});
export const defaultPrebattleSettings=()=>({attacker:defaultTeamSettings(),defender:defaultTeamSettings()});
export function formationSeats(team){
  if(team.seats)return [...team.seats];
  const f=FORMATIONS.find(f=>f.id===team.formation)||FORMATIONS[0];let front=0,back=f.front;
  return team.positions.map(p=>p==='front'?++front:++back);
}
export function placeHero(team,index,seat){
  const f=FORMATIONS.find(f=>f.id===team.formation)||FORMATIONS[0],seats=formationSeats(team),other=seats.indexOf(seat);
  if(other!==-1)seats[other]=seats[index];seats[index]=seat;
  return {...team,seats,positions:seats.map(n=>n<=f.front?'front':'back')};
}
export function normalizePrebattleSettings(value){
  const output={};
  for(const side of ['attacker','defender']){
    const v=value?.[side]||defaultTeamSettings(),d=defaultTeamSettings();
    const petName=petAliases[v.pet]||v.pet;
    if(!['없음',...PETS.map(p=>p.name)].includes(petName))throw Error('지원하는 펫 15종 중에서 선택해 주세요.');
    const pet=PETS.find(p=>p.name===petName);
    const formation=FORMATIONS.find(f=>f.id===v.formation)||FORMATIONS.find(f=>f.attack===v.formationAttack&&f.defense===v.formationDefense)||FORMATIONS[0];
    if(v.formation&&!FORMATIONS.some(f=>f.id===v.formation))throw Error('진형을 선택해 주세요.');
    if(pet&&primary.some(k=>!pet.growth[k]))throw Error(pet.name+'의 성장 능력치 자료가 없어 현재 자동 계산할 수 없습니다.');
    if(!Array.isArray(v.potentials)||v.potentials.length!==4||v.potentials.some(p=>!primary.includes(p?.stat)||!Number.isFinite(p.value)||p.value<0||p.value>100))throw Error('펫 잠재 4줄을 확인해 주세요.');
    if(!Array.isArray(v.positions)||v.positions.length!==3||v.positions.some(p=>!['front','back'].includes(p)))throw Error('영웅의 전열·후열을 확인해 주세요.');
    if(v.seats&&(!Array.isArray(v.seats)||v.seats.length!==3||new Set(v.seats).size!==3||v.seats.some(n=>!Number.isInteger(n)||n<1||n>5)))throw Error('자리번호는 중복 없이 1~5번을 선택해 주세요.');
    const positions=v.seats?v.seats.map(n=>n<=formation.front?'front':'back'):v.positions;
    if(positions.filter(p=>p==='back').length>formation.back||positions.filter(p=>p==='front').length>formation.front)throw Error(formation.name+'의 전열·후열 정원을 초과했습니다. 영웅 위치를 확인해 주세요.');
    output[side]={...d,pet:petName,petEnhancement:5,petSkillLevel:3,formation:formation.id,formationAttack:formation.attack,formationDefense:formation.defense,potentialsManual:Boolean(hasManualPotentials(v)),potentials:hasManualPotentials(v)?v.potentials.map(p=>({stat:p.stat,value:p.value})):defaultPetPotentials(petName),positions:[...positions],...(v.seats?{seats:[...v.seats]}:{})};
  }
  return output;
}
export function heroDamageType(name){return /마법 공격력/.test(heroSkills(name).find(s=>s.code===1)?.raw.text||'')?'magic':'physical';}
function petReference(team){
  const pet=PETS.find(p=>p.name===team.pet);if(!pet)return null;
  const definitions={};const detail=pet.text.split('부가효과 상세내용')[1]||'';
  for(const match of detail.matchAll(/-\s*([^\n]+)\n([\s\S]*?)(?=\n-\s|$)/g))definitions[match[1].trim()]=[match[2].trim()];
  const text=pet.text.split('부가효과 상세내용')[0].split('스킬 강화 효과')[0];
  const levels=pet.text.split('스킬 강화 효과')[1]?.split('부가효과 상세내용')[0]||'';
  const upgrades=levels.split('\n').filter(l=>Number(l.match(/(\d)레벨/)?.[1]||99)<=team.petSkillLevel).join('\n');
  const overrides=team.pet==='제오'?{attack:[29,32,34,37][team.petSkillLevel],damage:[12,12,13,14][team.petSkillLevel]}:['이린','연지'].includes(team.pet)?{attack:[21,22,24,26][team.petSkillLevel]}:null;
  return {pet,raw:{text,definitions,upgrades},overrides};
}
const names=[['물리 공격력','attack','physical'],['마법 공격력','attack','magic'],['모든 공격력','attack','all'],['방어력','defense','all'],['최대 생명력','maxHp','all'],['생명력','maxHp','all'],['치명타 확률','crit','all'],['치명타 피해','critDamage','all'],['약점 공격 확률','weakPoint','all'],['막기 확률','block','all'],['효과 적중','accuracy','all'],['효과 저항','resist','all'],['피해량','damageIncrease','all'],['마법 피해량','damageIncrease','magic'],['물리 피해량','damageIncrease','physical'],['받는 피해량','damageReduction','all'],['받는 피해','damageReduction','all'],['피해 증폭','amplification','all']];
const namedStats=[['물리 취약','physicalVulnerability'],['마법 취약','magicVulnerability'],['물리 감쇄','physicalReduction'],['마법 감쇄','magicReduction'],['감쇄','damageReduction'],['감전 효과 적용 확률 증가','shockChanceBonus'],['효과 적용 확률 증가','effectChanceBonus'],['받는 회복량 감소','healingReduction'],['받는 회복량 증가','healingIncrease']];
function parseAuras(raw,source,isPet=false){
  const lines=[raw.text,raw.enhanced,raw.upgrades].filter(Boolean).join('\n').split('\n').map(l=>l.trim());
  let group=isPet?'team':'self',role=null,row=null,affiliation=null;const effects=[],warnings=[];
  for(const line of lines){
    const heading=line.replace(/^[\[|\s]+/,'');
    if(/^\d초월 효과/.test(heading)){group='self';role=null;row=null;affiliation=null;continue;}
    if(/^(?:모든 |단일 )?(?:아군|적군)|^자신/.test(heading)&&!line.startsWith('-')){
      group=/적군/.test(heading)?'enemy':/^자신/.test(heading)?'self':'team';
      role=[['공격형',1],['마법형',2],['방어형',3],['지원형',4],['만능형',5]].filter(([s])=>heading.includes(s)).map(([,id])=>id);
      affiliation=heading.includes('귀멸의 칼날')?'demon-slayer':null;
      row=heading.includes('후열')?'back':heading.includes('전열')?'front':null;continue;
    }
    if(!line.startsWith('-')||/(?:효과|피해량|확률) 상승\s*[:：]|레벨:/.test(line))continue;
    if(/만큼.*피해|회 피해/.test(line))continue;
    const named=namedStats.find(([label])=>line.includes(label));
    if(named){
      if(/발동 시|사망|경우|이하|이상|중첩/.test(line)){warnings.push(source+' · '+line);continue;}
      const definition=Object.entries(raw.definitions||{}).find(([k])=>k===named[0])?.[1]?.join(' ')||'';
      const upgrade=lines.filter(l=>/(효과 상승|로 변경)/.test(l)&&l.includes(named[0])).at(-1)||'';
      const value=Number(upgrade.match(new RegExp(named[0]+'\\s*([\\d.]+)%'))?.[1]||(definition||line).match(/([\d.]+)%/)?.[1]);
      if(Number.isFinite(value))effects.push({source,group,role:role?.length?role:null,row,affiliation,stat:named[1],family:'all',value,turns:Number(line.match(/(\d+)턴 지속/)?.[1]||0),bucket:isPet?'pet':'hero'});
      else warnings.push(source+' · '+named[0]+' 수치 미확인');
      continue;
    }
    const kind=names.slice().sort((a,b)=>b[0].length-a[0].length).find(([label])=>line.includes(label+' 증가')||line.includes(label+' 감소'));
    if(!kind)continue;
    if(/(?:비례|경우|이하|이상|발동 시|발동마다|사망|적중\s*당|보유|중첩|자신이)/.test(line)){warnings.push(source+' · '+line);continue;}
    const [label,stat,family]=kind,sign=line.includes(label+' 감소')?-1:1;
    const definition=Object.entries(raw.definitions||{}).find(([k])=>k===label+(sign>0?' 증가':' 감소'))?.[1]?.join(' ')||'';
    const upgrades=lines.filter(l=>/(?:효과 상승|로 변경)/.test(l)&&l.includes(label+(sign>0?' 증가':' 감소'))).at(-1)||'';
    const upgradedValue=upgrades.match(new RegExp(label+' '+(sign>0?'증가':'감소')+'\\s*([\\d.]+)%'))?.[1];
    const value=Number(upgradedValue||(line.match(/[\d.]+%/)?.[0]||definition).match(/([\d.]+)%/)?.[1]);
    if(!Number.isFinite(value)){warnings.push(source+' · '+label+' 수치 미확인');continue;}
    effects.push({source,group,role:role?.length?role:null,row,affiliation,stat:stat==='damageReduction'&&sign>0?'vulnerability':stat,family,value:(stat==='damageReduction'?1:sign)*value,turns:Number(line.match(/(\d+)턴 지속/)?.[1]||0),bucket:isPet?'pet':'hero'});
  }
  return {effects,warnings};
}
function specialAuras(hero){
  const own=(stat,value,extra={})=>({source:hero.name,group:'self',stat,value,family:'all',bucket:'stack',...extra});
  if(hero.name==='선란')return [own('attack',21),own('critDamage',30),own('weakPoint',100)];
  if(hero.name==='시노부')return [own('attack',15),own('crit',100)];
  if(hero.name==='탄지로')return [own('weakPoint',100)];
  if(hero.name==='여포')return [own('attack',31,{group:'team',family:'physical',bucket:'hero'}),own('attack',-7,{group:'team',family:'magic',bucket:'hero'})];
  // This screenshot-verified aura was missing from the original compact entry.
  if(hero.name==='아일린')return [own('attack',25,{group:'team',family:'physical',bucket:'hero'}),own('shockChanceBonus',30,{group:'team',bucket:'hero'})];
  return [];
}
export function calculatePrebattle(draft,settings,{basis='panel'}={}){
  if(basis==='battle')return {heroes:structuredClone(draft).map(h=>settings?.[h.side]?.seats?{...h,battleSeat:settings[h.side].seats[h.id%3]}:h),breakdown:[],warnings:[]};
  if(basis!=='panel')throw Error('입력 기준을 확인해 주세요.');
  const teams=normalizePrebattleSettings(settings),warnings=[],auras=[];
  for(const hero of draft)for(const stat of [...primary,'speed','crit','critDamage','weakPoint','block','accuracy','resist','damageIncrease','damageReduction','amplification','vulnerability'])if(!Number.isFinite(hero[stat])||Math.abs(hero[stat])>1000000||(hero[stat]<0&&!['crit','weakPoint','block','resist'].includes(stat))||(stat==='maxHp'&&hero[stat]<1))throw Error('영웅 정보창 수치를 유효한 숫자로 입력해 주세요.');
  for(const hero of draft){
    const raw=heroSkills(hero.name).find(s=>s.code===4)?.raw||{};
    const parsed=parseAuras(raw,hero.name);warnings.push(...parsed.warnings);
    for(const effect of [...parsed.effects,...specialAuras(hero)]){
      // Special initial stacks replace the ambiguous 2/6-transcendence labels.
      if(['선란','시노부','탄지로'].includes(hero.name)&&effect.bucket!=='stack'&&effect.group==='self'&&['attack','crit','critDamage','weakPoint'].includes(effect.stat))continue;
      auras.push({...effect,ownerId:hero.id,ownerSide:hero.side});
    }
  }
  for(const side of ['attacker','defender']){
    const ref=petReference(teams[side]);if(!ref)continue;
    if(teams[side].petSkillLevel>0&&!ref.overrides&&!ref.pet.text.includes('스킬 강화 효과'))warnings.push(teams[side].pet+' · 스킬 강화 단계별 수치 미확인 · 확보한 기본 설명 적용');
    const parsed=parseAuras(ref.raw,teams[side].pet,true);warnings.push(...parsed.warnings);
    for(const effect of parsed.effects){
      if(ref.overrides&&effect.stat==='attack')effect.value=ref.overrides.attack;
      if(ref.overrides?.damage&&effect.stat==='damageIncrease')effect.value=ref.overrides.damage;
      auras.push({...effect,ownerSide:side,ownerId:null});
    }
  }
  const breakdown=[];
  const heroes=draft.map(h=>{
    const team=teams[h.side],base=BASE_STATS[h.name],role=base?.role||heroProfile(h.name)?.role,type=heroDamageType(h.name),position=team.positions[h.id%3],ref=petReference(team),pet=ref?.pet;
    const applicable=auras.filter(e=>((e.group==='self'&&e.ownerId===h.id)||(e.group==='team'&&e.ownerSide===h.side)||(e.group==='enemy'&&e.ownerSide!==h.side))&&(!e.role||e.role.includes(role))&&(!e.row||e.row===position)&&(!e.affiliation||['탄지로','젠이츠','시노부','기유','네즈코'].includes(h.name))&&['all',type].includes(e.family));
    const output={...h,battleSeat:formationSeats(team)[h.id%3],panelComputed:true,origin:h.origin?.includes('테스트 기본값')?h.origin:'영웅 정보창 → 자동 계산',panelTimedBuffs:[]},rows=[];
    for(const stat of [...primary,'crit','critDamage','weakPoint','block','accuracy','resist','damageIncrease','damageReduction','amplification','vulnerability',...namedStats.map(([,stat])=>stat).filter(stat=>stat!=='damageReduction')]){
      const effects=applicable.filter(e=>e.stat===stat),groups=new Map();
      for(const e of effects){
        const key=e.bucket==='stack'?e.source+'|stack':e.bucket+'|'+(e.value<0?'down':'up')+'|'+(e.turns?'timed':'permanent');
        const old=groups.get(key);if(!old||Math.abs(e.value)>Math.abs(old.value))groups.set(key,e);
      }
      const selected=[...groups.values()];
      const growth=pet?.growth?.[stat]?pet.growth[stat][0]+(pet.growth[stat][1]-pet.growth[stat][0])*team.petEnhancement/5:0;
      const potential=primary.includes(stat)?team.potentials.filter(p=>p.stat===stat).reduce((n,p)=>n+p.value,0):0;
      const formation=stat==='attack'&&position==='back'?team.formationAttack:stat==='defense'&&position==='front'?team.formationDefense:0;
      if(primary.includes(stat)&&!base&&(potential||formation))warnings.push(h.name+' · 도감 기본 능력치 미확인');
      const addition=growth+(base?.[stat]||0)*(potential+formation)/100,subtotal=(h[stat]||0)+addition;
      const bonus=selected.reduce((n,e)=>n+e.value,0);
      output[stat]=primary.includes(stat)?Math.max(stat==='maxHp'?1:0,Math.round(subtotal*(1+bonus/100))):(h[stat]||0)+bonus;
      if(['crit','weakPoint','block'].includes(stat))output[stat]=Math.min(100,h[stat]+selected.filter(e=>e.value>0).reduce((n,e)=>n+e.value,0))+selected.filter(e=>e.value<0).reduce((n,e)=>n+e.value,0);
      for(const e of selected.filter(e=>e.turns))output.panelTimedBuffs.push({stat,remaining:e.turns,delta:primary.includes(stat)?subtotal*e.value/100:e.value,source:e.source});
      if(addition||selected.length)rows.push({stat,panel:h[stat],growth:Math.round(growth),potential,formation,base:base?.[stat]||0,subtotal,bonuses:selected.map(e=>({source:e.source,value:e.value,turns:e.turns||0})),final:output[stat]});
    }
    // Attribute-scaled passives must use the newly calculated stat, not the panel.
    const raw=heroSkills(h.name).find(s=>s.code===4)?.raw;
    const rules=Object.entries(raw?.definitions||{});
    for(const [label,definition]of rules){
      const stat=label.includes('공격력 비례 효과 적중')?'accuracy':label.includes('방어력 비례 막기')?'block':label.includes('생명력 비례 막기')?'block':null;
      if(!stat)continue;
      const rule=definition.join(' '),scale=label.startsWith('공격력')?'attack':label.startsWith('방어력')?'defense':'maxHp';
      const ratio=rule.match(/수치\s*([\d,]+)마다.*?([\d.]+)%/),cap=rule.match(/최대 증가 수치\s*[:：]\s*([\d.]+)%/);
      if(ratio){const value=Math.min(cap?Number(cap[1]):Infinity,Math.floor(output[scale]/Number(ratio[1].replaceAll(',','')))*Number(ratio[2]));output[stat]+=value;rows.push({stat,panel:h[stat],bonuses:[{source:h.name+' 비례 패시브',value}],final:output[stat]});}
    }
    if(h.name==='아일린'&&!rules.some(([k])=>k.includes('공격력 비례 효과 적중'))){const value=Math.min(45,Math.floor(output.attack/300)*5);output.accuracy+=value;rows.push({stat:'accuracy',panel:h.accuracy,bonuses:[{source:'아일린 비례 패시브',value}],final:output.accuracy});}
    breakdown.push({id:h.id,name:h.name,rows});return output;
  });
  return {heroes,breakdown,warnings:[...new Set(warnings)]};
}

export function reducePanelTimedBuffs(unit,turns=1){
  const next={...unit},buffs=[];
  for(const buff of unit.panelTimedBuffs||[]){
    const remaining=Math.max(0,buff.remaining-turns);
    if(remaining)buffs.push({...buff,remaining});else next[buff.stat]-=buff.delta;
  }
  next.panelTimedBuffs=buffs;return next;
}

export function incomingModifiers(source,target){
  const magic=heroDamageType(source.name)==='magic';
  return {vulnerability:(target.vulnerability||0)+(magic?target.magicVulnerability||0:target.physicalVulnerability||0),damageReduction:(target.damageReduction||0)+(magic?target.magicReduction||0:target.physicalReduction||0)};
}
