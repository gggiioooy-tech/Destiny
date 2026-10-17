import base64,hashlib,json
from pathlib import Path
from datetime import datetime,timezone,timedelta
from google.protobuf import message_factory
from google.protobuf.json_format import MessageToDict
from normalize import CASTLES

def snapshot(pool,frames,config):
    names={16841:'ACGuildWarEnterBattleFieldAck',16849:'ACGuildWarPlaceInfoAck'};entry=None;places={}
    for f in frames:
        if not isinstance(f,dict) or f['id'] not in names:continue
        m=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.'+names[f['id']])).FromString(base64.b64decode(f['data']))
        if not m.IsInitialized():continue
        d=MessageToDict(m,preserving_proto_field_name=True)
        if f['id']==16841:entry=d;places={}
        else:places[d['PlaceInfo']['PlaceID']]=d
    state=Path(config['capturePath']).parent
    context_file=state/'battlefield-context.json'
    if entry:context_file.write_text(json.dumps({'entry':entry,'date':datetime.now(timezone(timedelta(hours=9))).date().isoformat()}),encoding='utf8')
    else:
        try:
            saved=json.loads(context_file.read_text(encoding='utf8'))
            if saved['date']==datetime.now(timezone(timedelta(hours=9))).date().isoformat():entry=saved['entry']
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
    day=instant.astimezone(timezone(timedelta(hours=9))).date().isoformat()
    roster_key=hashlib.sha256(json.dumps({k:sorted(v) for k,v in target.items()},sort_keys=True).encode()).hexdigest()
    cache=state/('battlefield-'+day+'-'+roster_key+'.json')
    try:previous=json.loads(cache.read_text(encoding='utf8'))
    except (OSError,ValueError):previous=[]
    received={r['castle'] for r in rows}
    rows=[r for r in previous if r['castle'] not in received]+rows
    if not rows:return None
    cache.write_text(json.dumps(rows),encoding='utf8')
    payload={'warDate':day,'sourceGuild':next(iter(guilds)),'defenses':rows,'total':sum(len(x) for x in target.values()),'dateSource':'observed-date'}
    key=hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=True).encode()).hexdigest()
    return {'kind':'defense_snapshot','sourceKey':'pc-v1:'+key,'occurredAt':instant.isoformat(),'payload':payload}
