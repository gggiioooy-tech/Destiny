"""Decode only locally captured guild history. Emit counts, never raw records.
Runtime schema and protobuf come from the local prototype, not this repository.
"""
import sys,json,base64,hashlib
from pathlib import Path
from datetime import datetime,timezone,timedelta
config=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
sys.path.insert(0,config['protobufPath'])
from google.protobuf import descriptor_pb2,descriptor_pool,message_factory
pool=descriptor_pool.DescriptorPool()
pool.Add(descriptor_pb2.FileDescriptorProto.FromString(Path(config['schemaPath']).read_bytes()))
T=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.ACGuildWarBattleHistoryAck'))
unique={}
for value in json.load(sys.stdin):
    message=T.FromString(base64.b64decode(value))
    if not message.IsInitialized() or message.AttackType not in (1,2):continue
    for row in message.GuildWarBattleHistory:
        key=(message.AttackType,row.CreateTimeMS,row.PlayerInfo.AccountUID,row.TargetPlayerInfo.AccountUID,row.PlaceID)
        unique[key]=message.AttackType
attack=sum(x==1 for x in unique.values());defense=sum(x==2 for x in unique.values())
print(json.dumps({'attack':attack,'defense':defense,'held':len(unique),'reason':'길드전 회차와 영웅·펫 이름 확인 대기 · 이전 길드전 기록도 보관합니다.','groups':[],'records':[]},ensure_ascii=True))
