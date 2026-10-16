import sys,json,base64
from pathlib import Path
from normalize import normalize
config=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'));sys.path.insert(0,config['protobufPath'])
from google.protobuf import descriptor_pb2,descriptor_pool,message_factory
from google.protobuf.json_format import MessageToDict
pool=descriptor_pool.DescriptorPool();pool.Add(descriptor_pb2.FileDescriptorProto.FromString(Path(config['schemaPath']).read_bytes()))
T=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.ACGuildWarBattleHistoryAck'));unique={};records=[];held=0
for value in json.load(sys.stdin):
 message=T.FromString(base64.b64decode(value))
 if not message.IsInitialized() or message.AttackType not in (1,2):continue
 for row in message.GuildWarBattleHistory:
  key=(message.AttackType,row.CreateTimeMS,row.PlayerInfo.AccountUID,row.TargetPlayerInfo.AccountUID,row.PlaceID)
  unique[key]=(message.AttackType,MessageToDict(row,preserving_proto_field_name=True))
for direction,row in unique.values():
 try:records.append(normalize(row,direction,config.get('periods',[]),config.get('catalog',{})))
 except (ValueError,KeyError,TypeError):held+=1
attack=sum(x[0]==1 for x in unique.values());defense=sum(x[0]==2 for x in unique.values())
print(json.dumps({'attack':attack,'defense':defense,'held':held,'reason':'확인된 길드전 기록을 저장합니다. 미확인 영웅·펫 이름은 번호로 표시합니다.','groups':[],'records':records},ensure_ascii=True))
