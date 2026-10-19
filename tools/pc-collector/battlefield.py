import base64,hashlib,json
from pathlib import Path
from datetime import datetime,timezone,timedelta
from google.protobuf import message_factory
from google.protobuf.json_format import MessageToDict
from normalize import CASTLES

def overlaps_previous_match(rows,match,old):
    if old.get('sourceGuild')!=match['guild'] or old.get('warDate')==match['warDate'] or old.get('opponentGuild')==match['opponent']:return False
    names={r.get('nickname') for r in rows if r.get('nickname')}
    prior={r.get('nickname') for r in old.get('defenses',[]) if r.get('nickname')}
    return len(names & prior)>=3

def snapshot(pool,frames,config):
    instant=datetime.fromtimestamp(Path(config['capturePath']).stat().st_mtime,timezone.utc)
    matches=[p for p in config.get('periods',[]) if p.get('matchKey') and p['from']<=instant.astimezone(timezone(timedelta(hours=9))).isoformat()<p['until']]
    if len(matches)!=1:return None
    match=matches[0]
    names={16841:'ACGuildWarEnterBattleFieldAck',16849:'ACGuildWarPlaceInfoAck'};entry=None;places={};accept=True
    for f in frames:
        if not isinstance(f,dict):continue
        if f['id']==16837:
            home=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.ACGuildWarInfoAck')).FromString(base64.b64decode(f['data']))
            if home.IsInitialized() and home.ModeType==4:
                key=f'{home.SeasonStartTimeMS}:{home.RoundCount}:{home.TargetGuildInfo.TargetGuildInfo.GuildID}'
                accept=key==match['matchKey'];entry=None;places={}
            continue
        if not accept or f['id'] not in names:continue
        m=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.'+names[f['id']])).FromString(base64.b64decode(f['data']))
        if not m.IsInitialized():continue
        d=MessageToDict(m,preserving_proto_field_name=True)
        if f['id']==16841:entry=d;places={}
        else:places[d['PlaceInfo']['PlaceID']]=d
    state=Path(config['capturePath']).parent
    context_file=state/'battlefield-context.json'
    if entry:context_file.write_text(json.dumps({'entry':entry,'matchKey':match['matchKey']}),encoding='utf8')
    else:
        try:
            saved=json.loads(context_file.read_text(encoding='utf8'))
            if saved.get('matchKey')==match['matchKey']:entry=saved['entry']
        except (OSError,ValueError):pass
    if not entry:return None
    target={p['PlaceID']:{(str(x['AccountUID']),x['DeckType'],x['Seq']) for x in p.get('DetailInfo',[])} for p in entry['TargetGuildPlaceInfo']['PlaceInfo']}
    catalog=config.get('catalog',{});heroes=catalog.get('heroes',{});pets=catalog.get('pets',{});rows=[]
    for place,d in places.items():
        if place not in CASTLES:continue
        players={str(x['PlayerInfo']['AccountUID']):x for x in d.get('DefensePlayerInfos',[])}
        for item in d['PlaceInfo'].get('DetailInfo',[]):
            identity=(str(item['AccountUID']),item['DeckType'],item['Seq'])
            if identity not in target.get(place,set()):continue
            player=players.get(identity[0],{})
            deck=next((v for v in player.get('DefenseDeckInfo',[]) if v['Deck']['DeckType']==item['DeckType']),None)
            if not deck:continue
            ids=[h['HeroTID'] for h in sorted(deck.get('Heroes',[]),key=lambda h:h['Position'])];pet=deck.get('Pet',{}).get('PetTID',0)
            if len(ids)!=3:continue
            rows.append({'castle':CASTLES[place],'nickname':player['PlayerInfo'].get('PlayerName',''),'heroIds':ids,'heroes':[heroes.get(str(i),f'영웅 #{i}') for i in ids],'petId':pet,'pet':pets.get(str(pet),f'펫 #{pet}') if pet else '펫 없음'})
    guilds={p['guild'] for p in config.get('periods',[])}
    if len(guilds)!=1:return None
    instant=datetime.fromtimestamp(Path(config['capturePath']).stat().st_mtime,timezone.utc)
    day=match['warDate']
    roster_key=hashlib.sha256(json.dumps({k:sorted(v) for k,v in target.items()},sort_keys=True).encode()).hexdigest()
    cache=state/('battlefield-'+day+'-'+roster_key+'.json')
    try:previous=json.loads(cache.read_text(encoding='utf8'))
    except (OSError,ValueError):previous=[]
    received={r['castle'] for r in rows}
    rows=[r for r in previous if r['castle'] not in received]+rows
    if not rows:return None
    try:old_status=json.loads((state/'status.json').read_text(encoding='utf8'))
    except (OSError,ValueError):old_status={}
    if any(overlaps_previous_match(rows,match,r.get('payload',{})) for r in old_status.get('records',[]) if r.get('kind')=='defense_snapshot'):
        (state/'match-warning.txt').write_text('이전 매칭과 상대 닉네임 3명 이상이 겹쳐 현재 방어팀 저장을 보류했습니다. 길드전 홈과 전장을 다시 열어 주세요.',encoding='utf8')
        return None
    (state/'match-warning.txt').write_text('',encoding='utf8')
    cache.write_text(json.dumps(rows),encoding='utf8')
    payload={'warDate':day,'sourceGuild':match['guild'],'opponentGuild':match['opponent'],'matchKey':match['matchKey'],'defenses':rows,'total':sum(len(x) for x in target.values()),'dateSource':'game-match'}
    key=hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=True).encode()).hexdigest()
    return {'kind':'defense_snapshot','sourceKey':'pc-v1:'+key,'occurredAt':instant.isoformat(),'payload':payload}
