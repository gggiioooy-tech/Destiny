"""Build a local simulation snapshot from public fan-database and wiki research.
Never contacts game/replay servers. Cache is ignored; no player data is imported.
"""
import concurrent.futures
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'tmp/hub'
CACHE.mkdir(parents=True, exist_ok=True)
BASE = 'https://7knightshub.com'

def get_json(route):
    file = CACHE / route.replace('/', '_')
    if file.exists():
        return json.loads(file.read_text(encoding='utf-8'))
    with urllib.request.urlopen(BASE + '/data/' + route, timeout=25) as response:
        result = json.load(response)
    file.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    return result

def clean(value):
    if isinstance(value, dict):
        value = value.get('ko') or value.get('en') or ''
    return re.sub(r'\[\[/?c[^\]]*\]\]', '', value or '').strip()

ALIASES = {'아가츠마 젠이츠':'젠이츠', '카마도 탄지로':'탄지로', '코쵸우 시노부':'시노부', '토미오카 기유':'기유', '밀리야':'밀리아'}
def canonical(name):
    name = re.split(r'[(/]', name)[0].strip()
    return ALIASES.get(name, name)

def import_hero(hero):
    detail = get_json(f"characters/{hero['tid']}.json")
    skills = []
    for s in detail.get('skills', []):
        text = clean(s.get('description'))
        enhanced = clean(s.get('enhancedDescription'))
        upgrades = '\n'.join(clean(u.get('description')) for u in s.get('transcendUpgrades', []) if u.get('step', 99) <= 6)
        code = 4 if s.get('isPassive') else 7 if s.get('isAwakenSkill') else s['skillType']
        skills.append({'code':code, 'name':clean(s.get('name')), 'text':text,
                       'enhanced':enhanced, 'upgrades':upgrades, 'targets':s.get('targetCount', 1),
                       'targetType':s.get('targetType'), 'cooldown':s.get('coolTime', 0)/1000,
                       'icon':BASE+'/game-assets/'+s['icon'] if s.get('icon') else ''})
    return {'name':canonical(clean(hero['name'])), 'tid':hero['tid'], 'role':hero['role'],
            'rarity':hero['rarity'], 'awakened':False, 'source':BASE+f"/character.html?tid={hero['tid']}",
            'basis':'공개 DB · 한국 서버 최신 수치와 차이 가능',
            'portrait':BASE+'/game-assets/'+(hero.get('portrait', {}).get('big') or ''), 'skills':skills}

def wiki_skills(hero):
    if 'structuredDetails' in hero:
        d = hero['structuredDetails']
        result = []
        for code, key in [(1,'basic'),(2,'skill1'),(3,'skill2'),(7,'awakening')]:
            s = d[key]
            text = ('단일 적군' if s.get('targetCount') == 1 else '모든 적군')+'\n'
            text += f"- 물리 공격력의 {s['physicalAttackPercent']}%만큼 {s['hits']}회 피해"
            if code in (2,3):
                text += '\n- 효과 추가: 관통'
            for e in s.get('perHit', []):
                if e['effect'] == '감전':
                    text += f"\n- 각 공격마다 감전 [{e['chancePercent']}% 확률] [{e['turns']}턴 지속]"
            result.append({'code':code,'name':s.get('name','기본 공격'),'text':text,'enhanced':'','upgrades':'','targets':s.get('targetCount',3),'cooldown':s.get('cooldown',0),'icon':''})
        result.append({'code':4,'name':d['passive']['name'],'text':'자신\n- 모든 피해 무효화 [피격 4회]\n- 사망 시 생명력 100%로 부활 (전투당 1회 발동)','enhanced':'','upgrades':'','targets':1,'cooldown':0,'icon':''})
        return result
    sections = []
    for line in hero['lines']:
        text = line['text'].strip()
        if re.match(r'^#{3,5}\s+\d+\.\d+\.\d+\.', text):
            sections.append({'name':re.sub(r'^#+\s+\d+(?:\.\d+)*\.\s*', '', text), 'lines':[]})
        elif sections:
            sections[-1]['lines'].append(text)
    skills = []
    for i, section in enumerate(sections):
        code = 1 if i == 0 else 4 if '고유 지속' in section['name'] else 7 if '각성' in section['name'] or i >= 4 else i+1
        lines = section['lines']
        # Keep numerical rules and target labels, exclude quotes/art and editorial prose.
        rules = [t for t in lines if t.startswith('- ') or re.match(r'^[\[(]?(?:모든 |단일 |적군|아군|자신|스킬 강화|[26]\s*초월|쿨타임)', t)]
        cooldown = re.search(r'쿨타임[^\d]*(\d+)', '\n'.join(lines))
        skills.append({'code':code, 'name':section['name'].split(' - ')[-1], 'text':'\n'.join(rules),
                       'enhanced':'', 'upgrades':'', 'targets':None,
                       'cooldown':int(cooldown[1]) if cooldown else 0, 'icon':''})
    return skills

def main():
    index = get_json('index.json')
    representatives = {}
    for h in index:
        if not h.get('playable') or not h.get('isMaxStar') or not clean(h.get('name')):
            continue
        name = canonical(clean(h['name']))
        if name not in representatives or h['rarity'] > representatives[name]['rarity']:
            representatives[name] = h
    heroes, errors = {}, []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(import_hero, h):name for name, h in representatives.items()}
        for f in concurrent.futures.as_completed(futures):
            try:
                hero = f.result(); heroes[hero['name']] = hero
            except Exception as e:
                errors.append({'name':futures[f], 'error':str(e)})
    research = json.loads((ROOT/'tmp/wiki-research/skill-reference.json').read_text(encoding='utf-8'))
    for h in research['heroes']:
        name = canonical(h['title'])
        previous = heroes.get(name, {'name':name,'tid':0,'role':0,'rarity':4,'portrait':''})
        heroes[name] = {**previous, 'awakened':h['awakened'], 'source':h['sourceUrl'],
                        'basis':'사용자 지정 한국판 나무위키 기준', 'skills':wiki_skills(h)}
    output = {'checkedAt':'2026-10-22', 'growth':'6초월·5강·풀스킬 강화',
              'sources':[BASE+'/heroes.html', '나무위키 각 문서 기여자 · CC BY-NC-SA 2.0 KR'],
              'heroes':sorted(heroes.values(), key=lambda h:h['name']), 'unavailable':errors}
    (ROOT/'src/lib/simulationRoster.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'heroes':len(heroes),'wikiOverrides':len(research['heroes']),'failed':errors},ensure_ascii=True))

if __name__ == '__main__':
    main()
