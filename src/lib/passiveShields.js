import roster from './simulationRoster.json' with {type:'json'};
const profiles=new Map(roster.heroes.map(h=>[h.name,h]));
const cache=new Map();
// Only explicit shield grants are compiled. Conditional modifiers and phrases
// such as 'received shield reduction' must not become starting shields.
export function passiveShieldRules(name){
  if(cache.has(name))return cache.get(name);
  const raw=profiles.get(name)?.skills.find(s=>s.code===4);if(!raw)return [];
  const rules=[];let group=raw.targetType===1?'self':'team';
  for(const text of [raw.text,raw.enhanced,raw.upgrades].filter(Boolean))for(let line of text.split('\n')){
    line=line.trim();const label=line.replace(/^[\[(]+/,'');
    if(/^\d+초월 효과|^스킬 강화 효과/.test(line))group='self';
    if(!line.startsWith('-')&&!/효과 (?:추가|상승)/.test(line)){
      if(/^자신/.test(label))group='self';else if(/^(?:모든 )?아군/.test(label))group='team';else if(/적군/.test(label))group='enemy';
    }
    if(/보호막 흡수량/.test(line)){
      const m=line.match(/(최대 생명력|방어력|(?:물리 |마법 )?공격력)의\s*([\d.]+)%/);
      if(m){const scale=m[1]==='최대 생명력'?'maxHp':m[1]==='방어력'?'defense':'attack';let matching=rules.filter(r=>r.group===group&&r.scale===scale);const sameScale=rules.filter(r=>r.scale===scale);if(!matching.length&&sameScale.length===1&&!text.includes('[아군'))matching=sameScale;for(const r of matching)r.value=Number(m[2])/100;}
      continue;
    }
    const m=line.match(/(?:시전자 )?(최대 생명력|방어력|(?:물리 |마법 )?공격력)(?:의)?\s*([\d.]+)%\s*만큼 보호막\s*\[(\d+)턴/);
    if(!m||group==='enemy')continue;
    let trigger='start',every=1;
    if(/권능 발동\s*시/.test(line))trigger='guts';
    else if(/부활 시/.test(line))trigger='revive';
    else if(/디버프 해제 시/.test(line))trigger='cleanse';
    else if(/사망 시/.test(line))trigger='death';
    else if(/생명력.*이하/.test(line))trigger='threshold';
    else if(/기본 공격\s*\d+회/.test(line)){trigger='basic';every=Number(line.match(/기본 공격\s*(\d+)회/)[1]);}
    else if(/스킬\s*\d+회/.test(line)){trigger='skill';every=Number(line.match(/스킬\s*(\d+)회/)[1]);}
    else if(/적중당|적중 당|피격/.test(line))trigger='hit';
    else if(/모든 공격\s*\d+회/.test(line))trigger='attack';
    const conditional=/경우|이상 편성|결속|영웅.*\d+명|공격형|마법형|만능형|후열|전열/.test(line);
    rules.push({trigger,group,every,conditional,scale:m[1]==='최대 생명력'?'maxHp':m[1]==='방어력'?'defense':'attack',value:Number(m[2])/100,turns:Number(m[3]),text:line});
  }
  cache.set(name,rules);return rules;
}
export function startingShieldRules(name){return passiveShieldRules(name).filter(r=>r.trigger==='start'&&r.group==='self'&&!r.conditional);}
