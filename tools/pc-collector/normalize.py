"""Preserve unknown IDs; never guess hero names or an opponent from player guilds."""
import hashlib,json
from datetime import datetime,timezone,timedelta
KST=timezone(timedelta(hours=9))
CASTLES={1:'본성',**{10+i:f'내성{i}' for i in range(1,4)},**{20+i:f'외성{i}' for i in range(1,6)}}
def normalize(row,direction,periods,catalog=None):
    if direction not in (1,2):raise ValueError('방향 미확인')
    instant=datetime.fromtimestamp(int(row['CreateTimeMS'])/1000,timezone.utc)
    matches=[p for p in periods if p['from']<=instant.astimezone(KST).isoformat()<p['until']]
    if len(matches)!=1:raise ValueError('길드전 날짜 미확인')
    period=matches[0];catalog=catalog or {};names=catalog.get('heroes',{});pets=catalog.get('pets',{})
    own=row['PlayerInfo'];enemy=row['TargetPlayerInfo'];guild=own.get('GuildSimpleInfo',{}).get('GuildName','')
    if not guild or guild!=period['guild']:raise ValueError('소속 길드 미확인')
    castle=CASTLES.get(row.get('PlaceID'))
    if not castle:raise ValueError('성 위치 미확인')
    def side(player,deck):
        ids=[h['HeroTID'] for h in sorted(deck.get('Heros',[]),key=lambda h:h.get('Position',0))];pet=deck.get('Pet',{}).get('PetTID',0)
        if len(ids)!=3 or any(not isinstance(x,int) or x<=0 for x in ids):raise ValueError('영웅 정보 미확인')
        return {'nickname':player.get('PlayerName',''),'heroIds':ids,'heroes':[names.get(str(i),f'영웅 #{i}') for i in ids],'petId':pet,'pet':pets.get(str(pet),f'펫 #{pet}') if pet else '펫 없음','skills':[],'namesResolved':all(str(i) in names for i in ids) and (not pet or str(pet) in pets)}
    us=side(own,row['PlayerDeckPeek']);them=side(enemy,row['TargetPlayerDeckPeek'])
    attacker,defender=(us,them) if direction==1 else (them,us)
    attacker_id,defender_id=(own['AccountUID'],enemy['AccountUID']) if direction==1 else (enemy['AccountUID'],own['AccountUID'])
    key=hashlib.sha256(json.dumps([period['warDate'],str(row['CreateTimeMS']),str(attacker_id),str(defender_id),row['PlaceID']],separators=(',',':')).encode()).hexdigest()
    if not isinstance(row.get('IsWin'),bool):raise ValueError('승패 미확인')
    return {'kind':'battle','sourceKey':'pc-v1:'+key,'occurredAt':instant.isoformat(),'payload':{'warDate':period['warDate'],'direction':'attack' if direction==1 else 'defense','sourceGuild':guild,'opponentGuild':period['opponent'],'periodSource':'game-match' if period.get('matchKey') else 'owner-confirmed','castle':castle,'attackerWon':row['IsWin'] if direction==1 else not row['IsWin'],'attacker':attacker,'defender':defender}}
