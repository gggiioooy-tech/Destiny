import base64,json
from pathlib import Path
from datetime import datetime,timezone,timedelta
from google.protobuf import message_factory
KST=timezone(timedelta(hours=9))

def discover(pool,frames,config,state):
    file=Path(state)/'match-periods.json'
    try:periods=json.loads(file.read_text(encoding='utf8'))
    except (OSError,ValueError):periods=[]
    guild=config.get('guild')
    if not guild:
        guilds={p['guild'] for p in config.get('periods',[])}
        if len(guilds)==1:guild=next(iter(guilds))
    if not guild:return []
    periods=[p for p in periods if p.get('guild')==guild]
    T=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.ACGuildWarInfoAck'))
    for f in frames:
        if not isinstance(f,dict) or f['id']!=16837:continue
        m=T.FromString(base64.b64decode(f['data']))
        # Mode 4 is the observed battle phase. Never infer dates from other phases.
        if not m.IsInitialized() or m.ModeType!=4:continue
        opponent=m.TargetGuildInfo.TargetGuildInfo
        if not opponent.GuildID or not opponent.GuildName:continue
        start=datetime.fromtimestamp(m.ModeStartTimeMS/1000,KST);end=datetime.fromtimestamp(m.ModeEndTimeMS/1000,KST)
        if not 0<(end-start).total_seconds()<=172800:continue
        key=f'{m.SeasonStartTimeMS}:{m.RoundCount}:{opponent.GuildID}'
        p={'from':start.isoformat(),'until':end.isoformat(),'warDate':start.date().isoformat(),'guild':guild,'opponent':opponent.GuildName,'matchKey':key,'opponentId':opponent.GuildID}
        periods=[old for old in periods if old.get('matchKey')!=key]+[p]
    periods=sorted(periods,key=lambda p:p['from'])[-60:]
    file.write_text(json.dumps(periods,ensure_ascii=True),encoding='utf8')
    return periods
