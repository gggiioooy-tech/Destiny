"""Build a local simulation snapshot from public fan-database and wiki research.
Never contacts game/replay servers. Cache is ignored; no player data is imported.
"""
import argparse
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
        entry = {'code':code, 'name':clean(s.get('name')), 'text':text,
                       'enhanced':enhanced, 'upgrades':upgrades, 'targets':s.get('targetCount', 1),
                       'targetType':s.get('targetType'), 'cooldown':s.get('coolTime', 0)/1000,
                       'icon':BASE+'/game-assets/'+s['icon'] if s.get('icon') else ''}
        previous = next((v for v in skills if v['code']==code), None)
        if previous:
            if any(previous.get(key)!=entry.get(key) for key in ['name','text','enhanced','upgrades']):
                previous['variantsOmitted'] = True
        else:
            skills.append(entry)
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
                elif e['effect'] == '방어력 감소':
                    text += f"\n- 각 공격마다 방어력 감소 {e['percentPerStack']}% [100% 확률] 1중첩 [최대 {e['maxStacks']}중첩]"
            result.append({'code':code,'name':s.get('name','기본 공격'),'text':text,'enhanced':'','upgrades':'','targets':s.get('targetCount',3),'cooldown':s.get('cooldown',0),'gauge':s.get('gauge',0),'icon':''})
        result.append({'code':4,'name':d['passive']['name'],'text':'자신\n- 모든 피해 무효화 [피격 4회]\n- 사망 시 생명력 100%로 부활 (전투당 1회 발동)','enhanced':'','upgrades':'','targets':1,'cooldown':0,'icon':''})
        return result
    sections = []
    nested = False
    for line in hero['lines']:
        text = line['text'].strip()
        heading = re.match(r'^#{3,5}\s+\d+\.\d+\.(\d+)\.(?:\s|$)', text)
        if heading:
            nested = False
            sections.append({'name':re.sub(r'^#+\s+\d+(?:\.\d+)*\.\s*', '', text), 'number':int(heading[1]), 'lines':[], 'variantsOmitted':False})
        elif re.match(r'^#+\s+\d+\.\d+\.\d+\.\d+',text):
            nested = True
            if sections:
                sections[-1]['variantsOmitted'] = True
        elif sections and not nested:
            sections[-1]['lines'].append(text)
    skills = []
    for i, section in enumerate(sections):
        code = 4 if '고유 지속' in section['name'] else 7 if section['number'] >= 5 else section['number']
        lines = section['lines']
        # Keep numerical rules and target labels, exclude quotes/art and editorial prose.
        detail_start = next((j for j,t in enumerate(lines) if t.startswith('부가효과 상세')), len(lines))
        main_lines = lines[:detail_start]
        rules = [t for t in main_lines if t.startswith('- ') or re.match(r'^[\[(]?(?:모든 |단일 |적군|아군|자신|스킬 강화|[26]\s*초월|쿨타임)', t)]
        definitions = {}
        label = None
        for t in lines[detail_start:]:
            if t.startswith('- '):
                label = t[2:].strip()
            elif label and re.search(r'(?:감소|증가|피해|회복|초과|넘을|무시|적용|해제|수 없|고정|감전|중독)',t) and not re.search(r'평가|PVP|PVE|기댓값|추천|편이다|좋다|나쁘다|유저',t):
                definitions.setdefault(label, []).append(t)
                label = None
        cooldown = re.search(r'^\[쿨타임\][ \t]*:[ \t]*(\d+)[ \t]*$', '\n'.join(lines), re.M)
        gauge = re.search(r'^\[각성\s*게이지\]\s*:[ \t]*(\d+)[ \t]*$', '\n'.join(lines), re.M)
        skills.append({'code':code, 'name':section['name'].split(' - ')[-1], 'text':'\n'.join(rules),
                       'enhanced':'', 'upgrades':'', 'targets':None, 'definitions':definitions,
                       'cooldown':int(cooldown[1]) if cooldown else 0, 'gauge':int(gauge[1]) if gauge else 0, 'variantsOmitted':section['variantsOmitted'], 'icon':''})
    return skills

def preserve_reviewed(heroes, snapshot, refresh=False):
    if refresh:
        return heroes
    for hero in snapshot.get('heroes', []):
        if hero.get('reviewedAt') or hero.get('basis') == '사용자 지정 한국판 나무위키 기준':
            heroes[hero['name']] = hero
    return heroes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh-reviewed', action='store_true', help='Explicitly replace reviewed Korean snapshots with the research import; inspect the resulting diff before release.')
    args = parser.parse_args()
    snapshot_file = ROOT/'src/lib/simulationRoster.json'
    snapshot = json.loads(snapshot_file.read_text(encoding='utf8')) if snapshot_file.exists() else {'heroes': []}
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
    research_file = ROOT/'tmp/wiki-research/skill-reference.json'
    overrides = 0
    if research_file.exists():
        research = json.loads(research_file.read_text(encoding='utf-8'))
        for h in research['heroes']:
            name = canonical(h['title'])
            previous = heroes.get(name, {'name':name,'tid':0,'role':0,'rarity':4,'portrait':''})
            heroes[name] = {**previous, 'awakened':h['awakened'], 'source':h['sourceUrl'],
                            'basis':'사용자 지정 한국판 나무위키 기준', 'skills':wiki_skills(h)}
            overrides += 1
    else:
        # A clean checkout retains the reviewed Korean snapshot instead of replacing
        # awakened skills with the public database's normal/global versions.
        existing = json.loads((ROOT/'src/lib/simulationRoster.json').read_text(encoding='utf-8'))
        for h in existing['heroes']:
            if h.get('basis') == '사용자 지정 한국판 나무위키 기준':
                heroes[h['name']] = h
                overrides += 1
    heroes = preserve_reviewed(heroes, snapshot, args.refresh_reviewed)
    output = {'checkedAt':'2026-10-22', 'growth':'6초월·5강·풀스킬 강화',
              'sources':[BASE+'/heroes.html', '나무위키 각 문서 기여자 · CC BY-NC-SA 2.0 KR'],
              'heroes':sorted(heroes.values(), key=lambda h:h['name']), 'unavailable':errors}
    (ROOT/'src/lib/simulationRoster.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'heroes':len(heroes),'wikiOverrides':overrides,'failed':errors},ensure_ascii=True))

if __name__ == '__main__':
    main()
