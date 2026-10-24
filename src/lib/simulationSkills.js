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
  const lines=text.split('\n').map(v=>v.trim().replace(/^[-•]\s*효과 추가\s*[:：]\s*/,'- ')).filter(Boolean);
  const damage=lines.find(v=>/^[-•]?\s*(?:(?:물리|마법) 공격력|(?:시전자 )?방어력|시전자 최대 생명력|대상 최대 생명력)의\s*[\d.]+%.*?\d+회.*피해/.test(v));
  const match=damage?.match(/((?:물리|마법) 공격력|(?:시전자 )?방어력|시전자 최대 생명력)의\s*([\d.]+)%.*?(\d+)회/);
  const strength=lines.find(v=>/피해량 상승/.test(v)&&!/(?:경우|상태|대상 최대|추가 피해)/.test(v));
  const stronger=strength?.match(/(?:(?:물리|마법) 공격력|방어력|최대 생명력)(?:의)?\s*([\d.]+)%/);
  const beforeDamage=damage?text.slice(0,text.indexOf(damage)):text;
  const targetLabels=[...beforeDamage.matchAll(/(?:모든 적군|단일 적군|적군\s*(\d+)명)/g)];
  const target=targetLabels.at(-1);
  const targets=target?target[0].includes('모든')?3:target[0].includes('단일')?1:Number(target[1]):Math.min(3,raw.targets||1);
  const compact=lines.filter(v=>!v.includes('피해량 상승')).join('\n');
  const definitions=raw.definitions||{};
  const definedValue=name=>{
    const upgraded=lines.filter(l=>/(효과|회복량|보호막) 상승/.test(l)&&l.includes(name)).at(-1);
    const definition=Object.entries(definitions).find(([key])=>key===name||key.startsWith(name+'(')||key.startsWith(name+'（'))?.[1]?.join(' ')||'';
    return Number((upgraded||definition).match(/([\d.]+)%/)?.[1]||0);
  };
  const hp=damage?.match(/대상 최대 생명력의\s*([\d.]+)%/);
  const cap=(text+' '+Object.values(definitions).flat().join(' ')).match(/(?:생명력 비례 피해는|피해량은)\s*시전자(?:의)? 공격력의\s*([\d.]+)%/);
  const skill={name:raw.name,code:raw.code,coefficient:match?Number(stronger?.[1]||match[2])/100:0,
    hits:match?Number(match[3]):Number(damage?.match(/(\d+)회/)?.[1]||0),targets,scale:match?.[1]?.includes('방어력')?'defense':match?.[1]?.includes('생명력')?'maxHp':'attack',
    defenseCoefficient:match?.[1]?.includes('공격력')?Number((stronger?strength:damage)?.match(/방어력의\s*([\d.]+)%/)?.[1]||0)/100:0,
    selfHpCoefficient:match?.[1]?.includes('공격력')?Number((stronger?strength:damage)?.match(/시전자 최대 생명력의\s*([\d.]+)%/)?.[1]||0)/100:0,
    pierce:/관통/.test(compact),ignore:/방어 무시/.test(compact)?.4:0,
    hpRatio:hp?Number(hp[1])/100:0,hpCap:cap?Number(cap[1])/100:0,
    cooldown:raw.cooldown||0,effects:[],extraDamage:[],unsupported:[],raw};
  skill.requiresTargetBuff=/대상에게 해제 가능한 버프가 있어야 사용 가능/.test(text);
  skill.requiresAllyDebuff=/아군에게 해제 가능한 디버프가 있어야 사용 가능/.test(text);
  skill.allyTargets=Number(text.match(/대상 수 변경\s*[:：]\s*아군\s*(\d+)명/)?.[1]||raw.targets||3);
  skill.targetPreference=/버프가 많은 순/.test(beforeDamage)?'buffs':/공격력이 높은 순/.test(beforeDamage)?'attack':/후열 우선/.test(beforeDamage)?'back':/전열 우선/.test(beforeDamage)?'front':null;
  if(skill.ignore){const rule=definitions['방어 무시']?.join(' ')||'';skill.ignore=Number(rule.match(/([\d.]+)%/)?.[1]||40)/100;}
  skill.critBonus=Number([...text.matchAll(/치명타 확률\s*([\d.]+)%\s*추가 적용/g)].at(-1)?.[1]||0);
  skill.weakBonus=Number([...text.matchAll(/약점 공격 확률\s*([\d.]+)%\s*추가 적용/g)].at(-1)?.[1]||0);
  const fewer=text.match(/피해 대상이 1명 줄어들 때마다(?: 각 공격마다)?\s*([\d.]+)%만큼 피해량 증가/);if(fewer)skill.missingTargetMultiplier=Number(fewer[1])/100;
  if(/처치\s*시.*연속 발동/.test(text)){skill.repeatOnKill=true;skill.repeatLimit=/최대 1회/.test(text)?1:3;}
  const execute=text.match(/생명력\s*([\d.]+)%\s*이하의 적을 즉시 처형/);if(execute){skill.executeRatio=Number(execute[1])/100;skill.executeCap=Infinity;}
  if(raw.variantsOmitted)skill.unsupported.push('변신 후 스킬 분기는 미반영입니다.');
  const ratioBoost=damage?.match(/대상(?:이|의)?\s*(현재|잃은) 생명력.*?최대\s*([\d.]+)%/);
  skill.hpBoost=ratioBoost?{kind:ratioBoost[1]==='잃은'?'lost':'current',value:Number(ratioBoost[2])/100}:null;
  // Effect lines are read only before explanatory definitions. Conditional mechanics
  // need dedicated handlers and are surfaced in the battle report rather than guessed.
  let group=raw.targetType===1?'self':[2,3].includes(raw.targetType)?'team':'enemy',details=false,roles=null,row=null,excludeSelf=false,targetCount=null,targetPreference=null;
  for(const sourceLine of lines){
    let line=sourceLine,targetCondition=null,effectRoles=null;
    if(line.startsWith('- 대상이 공격형, 마법형일 경우 ')){effectRoles=[1,2];line='- '+line.slice('- 대상이 공격형, 마법형일 경우 '.length);}
    const conditional=line.match(/^- 대상이 \[마법 취약\] 상태일 경우 (.+)$/);
    if(conditional){targetCondition={stat:'magicVulnerability',above:0};line='- '+conditional[1];}
    if(/부가효과 상세|\[ 펼치기/.test(line))details=true;
    if(details)continue;
    const label=line.replace(/^[\[(]\s*/,'');
    if(/^(?:현재 생명력이 가장 낮은 )?(?:모든 |단일 )?아군/.test(label)){group='team';excludeSelf=label.includes('자신 제외');targetCount=Number(label.match(/아군\s*(\d+)명/)?.[1]||0)||(/현재 생명력이 가장 낮은|단일/.test(label)?1:null);targetPreference=label.includes('현재 생명력이 가장 낮은')?'lowestHp':null;roles=[['공격형',1],['마법형',2],['방어형',3],['지원형',4],['만능형',5]].filter(([name])=>label.includes(name)).map(([,id])=>id);row=label.includes('전열')?'front':label.includes('후열')&&!label.includes('우선')?'back':null;}
    else if(/^자신/.test(label)){group='self';roles=null;row=null;excludeSelf=false;targetCount=null;targetPreference=null;}
    else if(/^(?:모든 |단일 )?적군/.test(label)){group='enemy';roles=null;row=null;excludeSelf=false;targetCount=null;targetPreference=null;}
    if(!line.startsWith('-'))continue;
    if(/해제 가능한 (?:버프|디버프)가 있어야 사용 가능/.test(line))continue;
    if(/(?:피해량|회복량|보호막|효과|확률|턴) 상승\s*[:：]|대상 수 변경/.test(line))continue;
    const hpConvert=line.match(/생명력 전환\s*([\d.]+)%/);
    if(hpConvert&&!/경우|이상|이하|소모/.test(line)){skill.effects.push({type:'healthConvert',group,targetCondition,duration:0,chance:100,value:Number(hpConvert[1]),before:Boolean(damage)&&lines.indexOf(sourceLine)<lines.indexOf(damage)});continue;}
    const drain=line.match(/피해량의\s*([\d.]+)%\s*만큼 생명력 회복/);
    if(drain&&!/경우|이상|이하/.test(line)){skill.effects.push({type:'drain',group,duration:0,chance:100,value:Number(drain[1])/100,before:false});continue;}
    if(line!==damage&&/추가.*피해/.test(line)&&!/(?:중첩당|버프 1개당|디버프 1개당|무한의 탑|스킬로|해당 스킬|피해량 추가)/.test(line)){
      const coefficient=line.match(/(?:물리|마법) 공격력의\s*([\d.]+)%/);
      let condition=null;
      if(/치명타 발생 시/.test(line))condition={type:'critical'};
      else if(/약점 공격 피해 발생 시/.test(line))condition={type:'weak'};
      else if(/대상이?\s*\[([^\]]+)\]\s*상태/.test(line))condition={type:'status',status:line.match(/\[([^\]]+)\]/)[1]};
      else if(/현재 생명력/.test(line)){const m=line.match(/현재 생명력이\s*([\d.]+)%\s*(이상|이하)/);if(m)condition={type:m[2]==='이상'?'hpAbove':'hpBelow',value:Number(m[1])/100};}
      else if(/속공이 자신의 속공보다 낮/.test(line))condition={type:'slower'};
      else if(/공격력이 자신의 공격력보다 낮/.test(line))condition={type:'weaker'};
      else if(!/경우|상태|발동/.test(line))condition={type:'always'};
      if(coefficient&&condition){const upgraded=lines.find(l=>l.includes('피해량 상승')&&l.includes(condition.type==='weak'?'약점':condition.type==='critical'?'치명타':'미사용표식'));skill.extraDamage.push({condition,coefficient:Number(upgraded?.match(/공격력의\s*([\d.]+)%/)?.[1]||coefficient[1])/100,each:/각 공격마다/.test(line),fixed:/고정 피해/.test(line),ignore:/방어 무시/.test(line)?skill.ignore||.4:0,pierce:/관통/.test(line),key:line});continue;}
    }
    if(/(?:경우|발동 시|사망 시|이하|이상|마다.*기본 공격|연속|해당 스킬|횟수)/.test(line)){
      if(!/피해량 상승/.test(line))skill.unsupported.push(line);continue;
    }
    const duration=Number(line.match(/(\d+)\s*턴/)?.[1]||(/중첩/.test(line)?999:1));
    const chance=Number(line.match(/([\d.]+)%\s*확률/)?.[1]||100);
    const each=/각 공격마다/.test(line);
    const add=(type,extra={})=>skill.effects.push({type,group,targetCondition,roles:effectRoles|| (roles?.length?roles:null),row,excludeSelf,targetCount,targetPreference,duration,chance,each,before:!each&&Boolean(damage)&&lines.indexOf(sourceLine)<lines.indexOf(damage),...extra});
    const dot=line.match(/(?:^[- ]*|각 공격마다\s*|해제한 버프 개수만큼\s*)(화상|극독|중독|출혈)\s*\[/);
    if(dot){
      const rule=definitions[dot[1]]?.join(' ')||'',ratio=rule.match(/(?:공격력|최대 생명력)의?\s*([\d.]+)%/),cap=rule.match(/공격력의\s*([\d.]+)%.*(?:넘|초과)/);
      const fallback={화상:{value:.8,scale:'attack'},중독:{value:.06,scale:'targetHp',cap:1.5},출혈:{value:.6,scale:'attack',pierce:true}}[dot[1]];
      if(ratio||fallback){add('dot',{status:dot[1],value:ratio?Number(ratio[1])/100:fallback.value,scale:rule.includes('최대 생명력')?'targetHp':fallback?.scale||'attack',cap:cap?Number(cap[1])/100:fallback?.cap||null,pierce:dot[1]==='출혈',perDispel:line.includes('해제한 버프'),...(line.includes('해제한 버프')?{chance:100,instanceChance:chance}:{})});continue;}
    }
    const cc=line.match(/(?:^[- ]*|각 공격마다\s*)(감전|오라|기절|마비|수면|깊은 수면|빙결|빙극|석화|침묵|공포|실명)(?:\s*\d+턴 지속)?\s*\[/);
    if(cc){const upgraded=lines.find(l=>l.includes('확률 상승')&&l.includes(cc[1]));add('control',{status:cc[1],chance:Number(upgraded?.match(/([\d.]+)%/)?.[1]||chance)});continue;}
    if(/절멸\s*\[/.test(line)){add('annihilation');continue;}
    const instantDown=line.match(/즉사 턴 감소\s*(\d+)턴/);
    if(instantDown){const upgraded=lines.find(l=>l.includes('확률 상승')&&l.includes('즉사 턴 감소'));add('instantDeathDown',{status:'즉사 턴 감소',value:Number(instantDown[1]),chance:Number(upgraded?.match(/([\d.]+)%/)?.[1]||chance)});continue;}
    if(/즉사\s*\[/.test(line)){const upgraded=lines.find(l=>l.includes('확률 상승')&&l.includes('즉사')&&!l.includes('턴 감소'));const applies=upgraded&&lines.indexOf(sourceLine)<lines.indexOf(upgraded);add('instantDeath',{status:'즉사',chance:Number(applies?upgraded.match(/([\d.]+)%/)?.[1]||chance:chance)});continue;}
    if(/버프 차단\s*\[/.test(line)){add('buffBlock');continue;}
    if(/각성 게이지 감소/.test(line)){const upgraded=lines.find(v=>v.includes('효과 상승')&&v.includes('각성 게이지 감소'));add('gaugeDown',{value:Number((upgraded||line).match(/게이지 감소\s*(\d+)/)?.[1]||0)});continue;}
    if(/링크\s*\[/.test(line)){const upgraded=lines.find(v=>v.includes('턴 상승')&&v.includes('링크'));add('link',{duration:Number((upgraded||line).match(/(\d+)턴/)?.[1]||duration)});continue;}
    if(/위장\s*\[/.test(line)){add('stealth');continue;}
    if(/도발\s*\[/.test(line)){add('taunt');continue;}
    if(/분신\s*\[/.test(line)){add('clone');continue;}
    if(/지연 버프\s*\[/.test(line)&&definitions['지연 버프']?.some(v=>v.includes('물리 공격력 증가 25%'))) {add('delayedTan');continue;}
    const modifiers=[['협공 확률 증가','assistChanceBonus'],['물리 취약','physicalVulnerability'],['마법 취약','magicVulnerability'],['물리 감쇄','physicalReduction'],['마법 감쇄','magicReduction'],['받는 회복량 감소','healingReduction'],['받는 회복량 증가','healingIncrease'],['받는 보호막 감소','shieldReduction'],['빗나감 확률 증가','missChance'],['치명타 피해 증가','critDamage'],['치명타 확률 증가','crit'],['약점 공격 확률 증가','weakPoint'],['효과 적중 증가','accuracy'],['효과 저항 증가','resist'],['막기 확률 증가','block'],['감쇄','damageReduction'],['물리 피해량 증가','damageIncrease'],['마법 피해량 증가','damageIncrease'],['피해량 증가','damageIncrease'],['물리 공격력 증가','attack'],['마법 공격력 증가','attack'],['모든 공격력 증가','attack'],['방어력 증가','defense']];
    const modifier=modifiers.find(([label])=>line.includes(label));
    if(modifier){const [label,stat]=modifier,value=Number(line.match(new RegExp(label+'\\s*([\\d.]+)%'))?.[1]||definedValue(label));if(value){add('statTimed',{stat,value,ratio:['attack','defense'].includes(stat),family:/^물리/.test(label)?'physical':/^마법/.test(label)?'magic':'all',debuff:group==='enemy'});continue;}}
    const decreases=[['모든 공격력 감소','attack'],['물리 공격력 감소','attack'],['마법 공격력 감소','attack'],['치명타 확률 감소','crit'],['효과 저항 감소','resist'],['약점 공격 확률 감소','weakPoint'],['피해량 감소','damageIncrease'],['효과 적용 확률 감소','effectChanceBonus']];
    const decrease=decreases.find(([label])=>line.includes(label));if(decrease){const [label,stat]=decrease,value=Number(line.match(new RegExp(label+'\\s*([\\d.]+)%'))?.[1]||definedValue(label));if(value){add('statDecrease',{stat,value,ratio:stat==='attack'});continue;}}
    if(/^(?:- )?(?:모든 )?스킬 쿨타임 초기화$/.test(line)){add('cooldownReset');continue;}
    const cooldown=line.match(/스킬 쿨타임 (증가|감소)(?: 효과)?\s*(\d+)초/);
    if(cooldown){const upgraded=lines.find(l=>l.includes('확률 상승')&&l.includes('스킬 쿨타임 '+cooldown[1]));add(cooldown[1]==='증가'?'cooldownUp':'cooldownDown',{value:Number(cooldown[2]),chance:Number(upgraded?.match(/([\d.]+)%/)?.[1]||chance)});continue;}
    const extend=line.match(/턴제 버프 증가\s*(\d+)턴/);
    if(extend){add('extendBuff',{value:Number(extend[1])});continue;}
    const extendDebuff=line.match(/턴제 디버프 증가\s*(\d+)턴/);
    if(extendDebuff){add('extendDebuff',{value:Number(extendDebuff[1])});continue;}
    if(/지속 회복\s*\[/.test(line)){const rule=definitions['지속 회복']?.join(' ')||'',value=rule.match(/최대 생명력의\s*([\d.]+)%/);if(value){add('regen',{value:Number(value[1])/100,perCleanse:line.includes('해제한 디버프')});continue;}}
    const revive=line.match(/사망한 대상.*?생명력\s*([\d.]+)%.*부활/);
    if(revive){const upgraded=text.match(/효과 상승\s*[:：]\s*부활 시 생명력\s*([\d.]+)%/);add('revive',{value:Number(upgraded?.[1]||revive[1])});continue;}
    const def=line.match(/방어력 감소(?:\(중첩\))?(?:\s*([\d.]+)%)?/);
    if(def&&(def[1]||definedValue('방어력 감소'))){add('defDown',{value:Number(def[1]||definedValue('방어력 감소'))/100,maxStacks:Number(line.match(/최대\s*(\d+)중첩/)?.[1]||1)});continue;}
    const shield=line.match(/(?:공격력|방어력|최대 생명력)의\s*([\d.]+)%.*보호막/);
    if(shield){const upgraded=lines.find(l=>/(?:보호막|효과) 상승/.test(l)&&l.includes('보호막'));add('shield',{value:Number(upgraded?.match(/(?:공격력|방어력|최대 생명력)의\s*([\d.]+)%/)?.[1]||shield[1])/100,scale:line.includes('최대 생명력')?'maxHp':line.includes('방어력')?'defense':'attack'});continue;}
    const heal=line.match(/(?:공격력|방어력|최대 생명력)의\s*([\d.]+)%.*(?:회복|생명력 회복)/);
    if(heal){const upgraded=lines.find(l=>/회복량 상승/.test(l));add('heal',{value:Number(upgraded?.match(/(?:공격력|방어력|최대 생명력)의\s*([\d.]+)%/)?.[1]||heal[1])/100,scale:line.includes('최대 생명력')?'maxHp':line.includes('방어력')?'defense':'attack'});continue;}
    const nullify=line.match(/모든 피해 무효화\s*\[피격\s*(\d+)회/);
    if(nullify){add('nullify',{value:Number(nullify[1])});continue;}
    if(/물리 피해 면역\s*\[/.test(line)){add('physicalImmunity');continue;}
    if(/마법 피해 면역\s*\[/.test(line)){add('magicImmunity');continue;}
    if(/모든 피해 면역\s*\[/.test(line)){add('immunity');continue;}
    if(/행동 제어 면역\s*\[/.test(line)){add('controlImmune');continue;}
    if(/디버프 해제/.test(line)){add('cleanse',{value:Number(line.match(/디버프 해제\s*(\d+)개/)?.[1]||0)||Infinity,controlOnly:/행동 제어/.test(line)});continue;}
    if(/회복 불가\s*\[/.test(line)){add('healBlock');continue;}
    const blockDown=line.match(/막기 확률 감소(?:\s*([\d.]+)%)?/);
    if(blockDown&&(blockDown[1]||definedValue('막기 확률 감소'))){add('blockDown',{value:Number(blockDown[1]||definedValue('막기 확률 감소'))});continue;}
    const remove=line.match(/버프 해제\s*(\d+)개/);
    if(remove){add('dispel',{value:Number(remove[1])});continue;}
    const reduce=line.match(/턴제 버프 감소\s*(\d+)턴/);
    if(reduce){add('reduceBuff',{value:Number(reduce[1])});continue;}
    if(line===damage||/^[- ]*(?:효과 추가\s*[:：]\s*)?(?:관통|방어 무시)$/.test(line))continue;
    if(line.length>5)skill.unsupported.push(line);
  }
  // HP-based damage without a published cap is not guessed.
  if(skill.hpRatio&&!skill.hpCap){skill.unsupported.push('생명력 비례 피해 상한 미확인');skill.hpRatio=0;}
  return skill;
}
export function coverageIssues(name){
  const skills=heroSkills(name);
  const notes=skills.flatMap(s=>s.unsupported.map(text=>({skill:s.name,code:s.code,text})));
  if(!DETAILED_HEROES.has(canonicalHero(name)))notes.unshift({skill:'고유 패시브',code:4,text:'조건부 발동과 중첩을 포함한 고유 패시브 전체 동작은 미완성입니다.'});
  const awakened=skills.find(s=>s.code===7);
  if(awakened)notes.push({skill:'각성기',code:7,text:awakened.raw.passiveAwakening?'자동 활성화·게이지 소모·막기 대응을 계산합니다. 동시 발동 순서는 추가 검증 중입니다.':awakened.raw.gauge?'게이지와 1회 사용을 계산합니다. 각성기 고유 부가 효과는 일부 미반영입니다.':'필요 게이지 미확인으로 각성기 자동 사용은 제외됩니다.'});
  return notes;
}
const compiled=new Map();
export function heroSkills(name){
  name=canonicalHero(name);
  if(!compiled.has(name))compiled.set(name,(heroProfile(name)?.skills||[]).map(raw=>{const skill=compileSkill(raw);if(name==='델론즈')skill.unsupported=skill.unsupported.filter(t=>!t.includes('변신 후')&&!t.includes('연속 발동'));if(name==='아리스'&&raw.code===7)skill.unsupported=skill.unsupported.filter(t=>!t.includes('자신이 막기 성공')&&!t.includes('모든 피해가 방어 무시'));return skill;}));
  return compiled.get(name);
}
export const skillFor=(name,code)=>heroSkills(name).find(s=>s.code===code);
export function coverageFor(name){
  if(DETAILED_HEROES.has(canonicalHero(name)))return '개별 효과 구현 · 검증 중';
  const skills=heroSkills(name),attacks=skills.filter(s=>[1,2,3].includes(s.code)&&s.hits>0).length;
  return attacks?`공통 계산 · 공격 ${attacks}개 · 고유 효과 일부 미구현`:'공통 효과 계산 · 공격 계수 미확인';
}
