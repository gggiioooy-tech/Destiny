"""Build public base-stat and pet references. No private stats or game requests."""
import json,re,urllib.parse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
roster=json.loads((ROOT/'src/lib/simulationRoster.json').read_text(encoding='utf8'))
previous=json.loads((ROOT/'src/lib/prebattleCatalog.json').read_text(encoding='utf8')) if (ROOT/'src/lib/prebattleCatalog.json').exists() else {}
aliases={'아가츠마 젠이츠':'젠이츠','카마도 탄지로':'탄지로','코쵸우 시노부':'시노부','토미오카 기유':'기유','밀리야':'밀리아'}
def canonical(v):return aliases.get(re.split(r'[(/]',v)[0].strip(),re.split(r'[(/]',v)[0].strip())
snapshots={}
for p in (ROOT/'tmp/wiki-research').glob('*.txt'):
    if p.name.startswith(('full-','extra-full-')):
        text=p.read_text(encoding='utf8');head=text.splitlines()[0]
        name=canonical(head.split(' (http')[0]);awake='/각성' in urllib.parse.unquote(head)
        stats={}
        for key,label in [('attack','(?:물리|마법) 공격력'),('defense','방어력'),('maxHp','생명력')]:
            m=re.search(label+r'\s*\|\s*[\d,]+\s*\|\s*([\d,]+)',text)
            if m:stats[key]=int(m[1].replace(',',''))
        role=re.search(r'유형\s*\|\s*(공격형|마법형|방어형|지원형|만능형)',text)
        if len(stats)==3:snapshots[(name,awake)]={**stats,'role':{'공격형':1,'마법형':2,'방어형':3,'지원형':4,'만능형':5}.get(role[1],0) if role else 0,'source':'wiki_lv30_plus5'}
bases=dict(previous.get('bases',{}))
for h in roster['heroes']:
    value=snapshots.get((h['name'],h['awakened']))
    if not value and not h['awakened']:
        file=ROOT/f"tmp/hub/characters_{h['tid']}.json"
        if file.exists():
            d=json.loads(file.read_text(encoding='utf8'));r=next((r for r in d['stats'].get('reinforcement',[]) if r['reinforcement']==5),None)
            if r:value={'attack':max(r['physicalAttack'],r['magicalAttack']),'defense':r['defence'],'maxHp':r['hp'],'role':d['role'],'source':'public_db_lv30_plus5'}
    if value:bases[h['name']]=value
# Checked against each awakened wiki's Lv.30 +5 table, not inferred by role.
for name,(attack,defense,hp,role) in {'동영':(1712,668,3836,2),'루디':(727,892,4825,3),'선란':(1712,668,3836,1),'아리스':(1457,728,4565,5),'아일린':(1457,728,4565,5),'젠이츠':(1712,668,3836,1),'헤브니아':(1569,595,3642,1),'헬레니아':(774,930,5254,3)}.items():
    bases[name]={'attack':attack,'defense':defense,'maxHp':hp,'role':role,'source':next(h['source'] for h in roster['heroes'] if h['name']==name)}
pets=json.loads((ROOT/'tmp/wiki-research/pets-reference.json').read_text(encoding='utf8')) if (ROOT/'tmp/wiki-research/pets-reference.json').exists() else {'entries':previous.get('pets',[])}
public_pets={}
for p in (ROOT/'tmp/hub').glob('pets_*.json'):
    detail=json.loads(p.read_text(encoding='utf8'));name=detail.get('name',{}).get('ko')
    if name:public_pets[name]=detail
entries=[]
for p in pets['entries']:
    text=p['text'];ability=text.split('| <nopad>')[-1].split('|  영웅 초상화')[0]
    growth=dict(p.get('growth',{}))
    for key,label in [('attack','모든 공격력'),('defense','방어력'),('maxHp','생명력')]:
        m=re.search(label+r'\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)',text)
        if m:growth[key]=[int(m[1].replace(',','')),int(m[2].replace(',',''))]
    detail=public_pets.get(p['name']);star=p.get('star');max_skill=p.get('maxSkillLevel',3)
    if detail:
        star=detail['star'];max_skill=(detail.get('skill') or {}).get('maxReinforce',0)
        reinforcement=(detail.get('stats') or {}).get('reinforcement',[])
        if len(reinforcement)>=2:
            for key,raw_key in [('attack','allAttack'),('defense','defence'),('maxHp','hp')]:
                # The public table may stop at +4; never mistake its last row
                # for +5 or replace the Korean +5 table with that smaller value.
                if key not in growth:
                    stats=detail.get('stats') or {};step=stats.get('reinforcementLevelUp',{}).get(raw_key)
                    if raw_key in stats and step is not None:growth[key]=[stats[raw_key],stats[raw_key]+5*step]
        enhancement=((detail.get('skill') or {}).get('enhancementText') or {}).get('ko','') or ''
        enhancement=re.sub(r'\[\[/?c[^\]]*\]\]','',enhancement).replace('\\n','\n')
        if enhancement and '스킬 강화 효과' not in ability:
            before,separator,after=ability.partition('부가효과 상세내용')
            ability=before+'\n스킬 강화 효과\n'+enhancement+'\n'+separator+after
    entries.append({'name':p['name'],'growth':growth,'star':star,'maxSkillLevel':max_skill,'text':ability.strip(),'stageSource':'public_pet_db' if detail else p.get('stageSource','wiki_reference')})
output={'checkedAt':'2026-10-22','sources':['https://7knightshub.com','https://www.namu.moe/w/세븐나이츠 리버스/펫'],'license':'Wiki-derived references: CC BY-NC-SA 2.0 KR','bases':bases,'pets':entries}
(ROOT/'src/lib/prebattleCatalog.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
print(json.dumps({'baseCount':len(bases),'awakenedMissing':[h['name'] for h in roster['heroes'] if h['awakened'] and h['name'] not in bases],'pets':len(entries)},ensure_ascii=True))
