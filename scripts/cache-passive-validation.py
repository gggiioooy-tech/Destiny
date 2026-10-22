"""Owner-authorized bounded replay sampling from privately archived history frames.
Never queries game APIs, guesses replay paths or uploads any battle data.
"""
import base64, importlib.util, json, re, sys, time, urllib.request
from pathlib import Path

root=Path(__file__).resolve().parents[1]
archive=Path(sys.argv[1]).resolve()
limit=min(40,max(1,int(sys.argv[2]) if len(sys.argv)>2 else 30))
config=json.loads((archive/'config.private.json').read_text(encoding='utf8'))
sys.path.insert(0,config['protobufPath']);sys.path.insert(0,str(root/'tools/pc-collector'))
from google.protobuf import descriptor_pb2,descriptor_pool,message_factory
from google.protobuf.json_format import MessageToDict
from normalize import normalize
from replay_skills import NoRedirect,extract
spec=importlib.util.spec_from_file_location('local_analysis',root/'tools/replay-analysis/analyze_local.py')
analysis=importlib.util.module_from_spec(spec);spec.loader.exec_module(analysis)
pool=descriptor_pool.DescriptorPool();pool.Add(descriptor_pb2.FileDescriptorProto.FromString(Path(config['schemaPath']).read_bytes()))
T=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.ACGuildWarBattleHistoryAck'))
periods=json.loads((archive/'match-periods.json').read_text(encoding='utf8'))
jobs={}
for frame in json.loads((archive/'frames.json').read_text(encoding='utf8')):
    if frame['id']!=16857:continue
    event=T.FromString(base64.b64decode(frame['data']))
    if event.AttackType not in (1,2):continue
    for item in event.GuildWarBattleHistory:
        row=MessageToDict(item,preserving_proto_field_name=True)
        try:record=normalize(row,event.AttackType,periods,config.get('catalog',{}))
        except (ValueError,KeyError,TypeError):continue
        jobs[record['sourceKey']]=(event.AttackType,row,record)

# Cover distinct heroes first, then diversify by date, result and both teams.
selected=[];covered=set();signatures=set()
while jobs and len(selected)<limit:
    def score(job):
        p=job[2]['payload'];heroes=set(p['attacker'].get('heroes',[])+p['defender'].get('heroes',[]))
        signature=(p['warDate'],p['attackerWon'],tuple(p['attacker'].get('heroes',[])),tuple(p['defender'].get('heroes',[])))
        return (len(heroes-covered),signature not in signatures)
    key=max(sorted(jobs),key=lambda k:score(jobs[k]));job=jobs.pop(key);selected.append((key,job))
    p=job[2]['payload'];covered.update(p['attacker'].get('heroes',[])+p['defender'].get('heroes',[]))
    signatures.add((p['warDate'],p['attackerWon'],tuple(p['attacker'].get('heroes',[])),tuple(p['defender'].get('heroes',[]))))

out=archive/'replays';out.mkdir(exist_ok=True)
counts={'selected':len(selected),'heroCoverage':len(covered),'downloaded':0,'cached':0,'analyzed':0,'failed':0}
records=[]
for index,(key,(direction,row,record)) in enumerate(selected):
    ref=row.get('ReplayUrl','')
    if not re.fullmatch(r'guildwar/[a-zA-Z0-9_./-]+\.replay',ref) or any(p in ('','.','..') for p in ref.split('/')):counts['failed']+=1;continue
    folder=out/key.split(':')[1];folder.mkdir(exist_ok=True);rawfile=folder/'battle.replay'
    try:
        if rawfile.exists():raw=rawfile.read_bytes();counts['cached']+=1
        else:
            with urllib.request.build_opener(NoRedirect).open('https://tskgb-replay.netmarble.com/'+ref,timeout=15) as response:raw=response.read(8*1024*1024+1)
            if len(raw)>8*1024*1024:raise ValueError('size')
            rawfile.write_bytes(raw);counts['downloaded']+=1;time.sleep(.5)
        decoded=extract(pool,raw,row,direction,record)
        for side in ('attacker','defender'):record['payload'][side]['skills']=decoded[side]
        record['payload']['heroStats']=decoded['heroStats']
        report=analysis.analyze(pool,raw,record,{'direction':direction,'row':row})
        (folder/'timeline.json').write_text(json.dumps(report,ensure_ascii=True),encoding='utf8')
        (folder/'record.json').write_text(json.dumps(record,ensure_ascii=True),encoding='utf8')
        records.append(record);counts['analyzed']+=1
    except Exception as error:
        counts['failed']+=1;(folder/'failure.txt').write_text(type(error).__name__,encoding='utf8')
    (archive/'sample-status.json').write_text(json.dumps(counts),encoding='utf8')
    if index%5==0:print(json.dumps(counts),flush=True)
(archive/'sample-records.json').write_text(json.dumps({'records':records}),encoding='utf8')
print(json.dumps(counts),flush=True)
