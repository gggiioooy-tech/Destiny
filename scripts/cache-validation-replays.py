"""Download at most 12 already-observed history replays for owner-authorized validation.
Never issues game API queries, guesses paths, follows redirects, or uploads data.
All private outputs remain under ignored tmp/.
"""
import base64, importlib.util, json, os, re, sys, time, urllib.request
from pathlib import Path

root=Path(__file__).resolve().parents[1]
base=Path(os.environ['LOCALAPPDATA'])/'15month-collector'
config=json.loads((base/'config.json').read_text(encoding='utf-8-sig'))
sys.path.insert(0,config['protobufPath']);sys.path.insert(0,str(root/'tools/pc-collector'))
from google.protobuf import descriptor_pb2,descriptor_pool,message_factory
from google.protobuf.json_format import MessageToDict
from normalize import normalize
from replay_skills import NoRedirect,extract
spec=importlib.util.spec_from_file_location('local_analysis',root/'tools/replay-analysis/analyze_local.py')
analysis=importlib.util.module_from_spec(spec);spec.loader.exec_module(analysis)
pool=descriptor_pool.DescriptorPool();pool.Add(descriptor_pb2.FileDescriptorProto.FromString(Path(config['schemaPath']).read_bytes()))
T=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.ACGuildWarBattleHistoryAck'))
periods=json.loads((base/'match-periods.json').read_text(encoding='utf8'))
jobs={}
for frame in json.loads((base/'diagnostic-frames.json').read_text(encoding='utf8')):
    if frame['id']!=16857:continue
    event=T.FromString(base64.b64decode(frame['data']))
    if event.AttackType not in (1,2):continue
    for item in event.GuildWarBattleHistory:
        row=MessageToDict(item,preserving_proto_field_name=True)
        try:record=normalize(row,event.AttackType,periods,config.get('catalog',{}))
        except (ValueError,KeyError,TypeError):continue
        jobs[record['sourceKey']]=(event.AttackType,row,record)
out=root/'tmp/validation-replays';out.mkdir(parents=True,exist_ok=True)
counts={'available':len(jobs),'downloaded':0,'cached':0,'failed':0,'analyzed':0}
for key,(direction,row,record) in sorted(jobs.items())[:12]:
    ref=row.get('ReplayUrl','')
    if not re.fullmatch(r'guildwar/[a-zA-Z0-9_./-]+\.replay',ref) or any(p in ('','.','..') for p in ref.split('/')):continue
    folder=out/key.split(':')[1];folder.mkdir(exist_ok=True);rawfile=folder/'battle.replay'
    try:
        if rawfile.exists():raw=rawfile.read_bytes();counts['cached']+=1
        else:
            with urllib.request.build_opener(NoRedirect).open('https://tskgb-replay.netmarble.com/'+ref,timeout=12) as response:
                raw=response.read(8*1024*1024+1)
            if len(raw)>8*1024*1024:raise ValueError('size')
            rawfile.write_bytes(raw);counts['downloaded']+=1;time.sleep(.75)
        decoded=extract(pool,raw,row,direction,record)
        for side in ('attacker','defender'):record['payload'][side]['skills']=decoded[side]
        record['payload']['heroStats']=decoded['heroStats']
        report=analysis.analyze(pool,raw,record,{'direction':direction,'row':row})
        (folder/'timeline.json').write_text(json.dumps(report,ensure_ascii=True),encoding='utf8')
        (folder/'record.json').write_text(json.dumps(record,ensure_ascii=True),encoding='utf8');counts['analyzed']+=1
    except Exception as error:
        # Do not expose URLs, account IDs, response bodies or credentials in logs.
        counts['failed']+=1
        (folder/'failure.txt').write_text(type(error).__name__,encoding='utf8')
print(json.dumps(counts))
