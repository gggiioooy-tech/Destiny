import sys,json,base64
from pathlib import Path
from normalize import normalize
config=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'));sys.path.insert(0,config['protobufPath'])
from google.protobuf import descriptor_pb2,descriptor_pool,message_factory
from google.protobuf.json_format import MessageToDict
pool=descriptor_pool.DescriptorPool();pool.Add(descriptor_pb2.FileDescriptorProto.FromString(Path(config['schemaPath']).read_bytes()))
T=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.ACGuildWarBattleHistoryAck'));unique={};records=[];held=0
frames=json.load(sys.stdin)
for value in frames:
 if isinstance(value,dict):
  if value['id']!=16857:continue
  value=value['data']
 message=T.FromString(base64.b64decode(value))
 if not message.IsInitialized() or message.AttackType not in (1,2):continue
 for row in message.GuildWarBattleHistory:
  key=(message.AttackType,row.CreateTimeMS,row.PlayerInfo.AccountUID,row.TargetPlayerInfo.AccountUID,row.PlaceID)
  unique[key]=(message.AttackType,MessageToDict(row,preserving_proto_field_name=True))
jobs=[]
for direction,row in unique.values():
 try:
  record=normalize(row,direction,config.get('periods',[]),config.get('catalog',{}));records.append(record);jobs.append((direction,row,record))
 except (ValueError,KeyError,TypeError):held+=1
from replay_skills import enrich
enrich(pool,jobs,Path(sys.argv[1]).parent)
from battlefield import snapshot
field=snapshot(pool,frames,config)
if field:records.append(field)
attack=sum(x[0]==1 for x in unique.values());defense=sum(x[0]==2 for x in unique.values())
print(json.dumps({'attack':attack,'defense':defense,'held':held,'reason':'확인된 길드전 기록을 저장합니다. 미확인 영웅·펫 이름은 번호로 표시합니다.','groups':[],'records':records},ensure_ascii=True))
