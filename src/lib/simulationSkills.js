import roster from './simulationRoster.json' with {type:'json'};

const aliases={'아가츠마 젠이츠':'젠이츠','카마도 탄지로':'탄지로','코쵸우 시노부':'시노부','토미오카 기유':'기유','밀리야':'밀리아'};
export const canonicalHero=name=>aliases[name]||name;
export const SIM_ROSTER=roster.heroes;
const profiles=new Map(SIM_ROSTER.map(h=>[h.name,h]));
export const heroProfile=name=>profiles.get(canonicalHero(name));
export const DETAILED_HEROES=new Set(['연희','쥬리','윤건']);

// Conservative conversion of published Korean rules. Unrecognised conditions remain
// explicitly unsupported; they never inherit another hero's skills or invented damage.
export function compileSkill(raw){
  const text=[raw.text,raw.enhanced,raw.upgrades].filter(Boolean).join('\n');
  const lines=text.split('\n').map(v=>v.trim()).filter(Boolean);
  const damage=lines.find(v=>/^[-•]?\s*(?:(?:물리|마법) 공격력|(?:시전자 )?방어력|시전자 최대 생명력)의\s*[\d.]+%.*?\d+회.*피해/.test(v));
  const match=damage?.match(/((?:물리|마법) 공격력|(?:시전자 )?방어력|시전자 최대 생명력)의\s*([\d.]+)%.*?(\d+)회/);
  const strength=lines.find(v=>/피해량 상승/.test(v)&&!/(?:경우|상태|대상 최대|추가 피해)/.test(v));
  const stronger=strength?.match(/(?:(?:물리|마법) 공격력|방어력|최대 생명력)(?:의)?\s*([\d.]+)%/);
  const beforeDamage=damage?text.slice(0,text.indexOf(damage)):text;
  const targetLabels=[...beforeDamage.matchAll(/(?:모든 적군|단일 적군|적군\s*(\d+)명)/g)];
  const target=targetLabels.at(-1);
  const targets=target?target[0].includes('모든')?3:target[0].includes('단일')?1:Number(target[1]):Math.min(3,raw.targets||1);
  const compact=lines.filter(v=>!v.includes('피해량 상승')).join('\n');
  const hp=damage?.match(/대상 최대 생명력의\s*([\d.]+)%/);
  const cap=text.match(/생명력 비례 피해는 시전자 공격력의\s*([\d.]+)%/);
  const skill={name:raw.name,code:raw.code,coefficient:match?Number(stronger?.[1]||match[2])/100:0,
    hits:match?Number(match[3]):0,targets,scale:match?.[1]?.includes('방어력')?'defense':match?.[1]?.includes('생명력')?'maxHp':'attack',
    defenseCoefficient:match?.[1]?.includes('공격력')?Number((stronger?strength:damage)?.match(/방어력의\s*([\d.]+)%/)?.[1]||0)/100:0,
    pierce:/관통/.test(compact),ignore:/방어 무시/.test(compact)?.4:0,
    hpRatio:hp?Number(hp[1])/100:0,hpCap:cap?Number(cap[1])/100:0,
    cooldown:raw.cooldown||0,effects:[],unsupported:[],raw};
  // Effect lines are read only before explanatory definitions. Conditional mechanics
  // need dedicated handlers and are surfaced in the battle report rather than guessed.
  let group=raw.targetType===1?'self':[2,3].includes(raw.targetType)?'team':'enemy',details=false;
  for(const line of lines){
    if(/부가효과 상세|\[ 펼치기/.test(line))details=true;
    if(details)continue;
    const label=line.replace(/^[\[(]\s*/,'');
    if(/^(?:모든 |단일 )?아군/.test(label))group='team';
    else if(/^자신/.test(label))group='self';
    else if(/^(?:모든 |단일 )?적군/.test(label))group='enemy';
    if(!line.startsWith('-'))continue;
    if(/(?:피해량|회복량|보호막|효과|확률|턴) 상승\s*[:：]|대상 수 변경/.test(line))continue;
    if(/(?:경우|발동 시|사망 시|이하|이상|마다.*기본 공격|최대 \d+중첩|연속|해당 스킬|횟수|게이지)/.test(line)){
      if(!/피해량 상승/.test(line))skill.unsupported.push(line);continue;
    }
    const duration=Number(line.match(/(\d+)\s*턴/)?.[1]||1);
    const chance=Number(line.match(/([\d.]+)%\s*확률/)?.[1]||100);
    const each=/각 공격마다/.test(line);
    const add=(type,extra={})=>skill.effects.push({type,group,duration,chance,each,...extra});
    const cc=line.match(/(?:^[- ]*|각 공격마다\s*)(감전|기절|마비|수면|깊은 수면|빙결|침묵|속박)\s*\[/);
    if(cc){const upgraded=lines.find(l=>l.includes('확률 상승')&&l.includes(cc[1]));add('control',{status:cc[1],chance:Number(upgraded?.match(/([\d.]+)%/)?.[1]||chance)});continue;}
    if(/절멸\s*\[/.test(line)){add('annihilation');continue;}
    const revive=line.match(/사망한 대상.*?생명력\s*([\d.]+)%.*부활/);
    if(revive){add('revive',{value:Number(revive[1])});continue;}
    const def=line.match(/방어력 감소\s*([\d.]+)%/);
    if(def){add('defDown',{value:Number(def[1])/100});continue;}
    const shield=line.match(/(?:공격력|최대 생명력)의\s*([\d.]+)%.*보호막/);
    if(shield){const upgraded=lines.find(l=>/(?:보호막|효과) 상승/.test(l)&&l.includes('보호막'));add('shield',{value:Number(upgraded?.match(/(?:공격력|최대 생명력)의\s*([\d.]+)%/)?.[1]||shield[1])/100,scale:line.includes('최대 생명력')?'maxHp':'attack'});continue;}
    const heal=line.match(/(?:공격력|최대 생명력)의\s*([\d.]+)%.*(?:회복|생명력 회복)/);
    if(heal){const upgraded=lines.find(l=>/회복량 상승/.test(l));add('heal',{value:Number(upgraded?.match(/(?:공격력|최대 생명력)의\s*([\d.]+)%/)?.[1]||heal[1])/100,scale:line.includes('최대 생명력')?'maxHp':'attack'});continue;}
    const nullify=line.match(/모든 피해 무효화\s*\[피격\s*(\d+)회/);
    if(nullify){add('nullify',{value:Number(nullify[1])});continue;}
    if(/모든 피해 면역\s*\[/.test(line)){add('immunity');continue;}
    if(/행동 제어 면역\s*\[/.test(line)){add('controlImmune');continue;}
    if(/디버프 해제/.test(line)){add('cleanse');continue;}
    if(/회복 불가\s*\[/.test(line)){add('healBlock');continue;}
    if(/피해|효과 추가|효과 상승|확률 상승/.test(line)&&!line.includes('피해량 상승')&&!line.includes('방어 무시')&&!line.includes('관통'))skill.unsupported.push(line);
  }
  // HP-based damage without a published cap is not guessed.
  if(skill.hpRatio&&!skill.hpCap){skill.unsupported.push('생명력 비례 피해 상한 미확인');skill.hpRatio=0;}
  return skill;
}
const compiled=new Map();
export function heroSkills(name){
  name=canonicalHero(name);
  if(!compiled.has(name))compiled.set(name,(heroProfile(name)?.skills||[]).map(compileSkill));
  return compiled.get(name);
}
export const skillFor=(name,code)=>heroSkills(name).find(s=>s.code===code);
export function coverageFor(name){
  if(DETAILED_HEROES.has(canonicalHero(name)))return '개별 효과 구현 · 검증 중';
  const skills=heroSkills(name),attacks=skills.filter(s=>[1,2,3].includes(s.code)&&s.hits>0).length;
  return attacks?`공통 계산 · 공격 ${attacks}개 · 고유 효과 일부 미구현`:'공통 효과 계산 · 공격 계수 미확인';
}
