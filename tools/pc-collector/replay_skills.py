"""Read initial reservations only; replay URLs and account IDs stay local."""
import json,re,urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from google.protobuf import message_factory

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def extract(pool,data,row,direction,record):
    def parse(name,data):
        m=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.'+name)).FromString(data)
        if not m.IsInitialized():raise ValueError('incomplete replay')
        return m
    pack=parse('MReplayDataPack',data);events={}
    names={15156:'ACStartReplayNoti',20053:'ACSpawnRoundPlayerNoti',20007:'ACNextRoundEnemyNoti',20021:'ACReserveSkillAck'}
    for p in pack.Packet:
        if p.Size!=len(p.Data):raise ValueError('packet size')
        if p.MessageID in names and p.MessageID not in events:events[p.MessageID]=parse(names[p.MessageID],p.Data)
    accounts={t.Team:str(t.Player.PlayerInfo.AccountUID) for t in events[15156].TeamDatas}
    own=str(row['PlayerInfo']['AccountUID']);enemy=str(row['TargetPlayerInfo']['AccountUID'])
    if accounts.get(1)!=(own if direction==1 else enemy) or accounts.get(2)!=(enemy if direction==1 else own):raise ValueError('team mismatch')
    reserve=events[20021]
    if reserve.StageTime!=0:raise ValueError('not initial reservation')
    objects={h.ObjectId:(h.Team,h.TemplateId) for mid in (20053,20007) for h in events[mid].Datas}
    result={'attacker':[],'defender':[]}
    for s in sorted(reserve.ReserveSkills,key=lambda s:s.Sequence):
        team,hero=objects[s.ObjectId]
        if team not in (1,2):raise ValueError('unknown team')
        side='attacker' if team==1 else 'defender';roster=record['payload'][side]
        if hero not in roster['heroIds']:raise ValueError('hero mismatch')
        result[side].append({'hero':roster['heroes'][roster['heroIds'].index(hero)],'heroId':hero,'skill':f'스킬 코드 {s.SkillType}','skillType':s.SkillType,'order':s.Sequence})
    if any(len(v)>3 for v in result.values()):raise ValueError('reservation count')
    return result

def enrich(pool,jobs,state_dir):
    cache=Path(state_dir)/'replay-skills-v1';cache.mkdir(exist_ok=True)
    def run(job):
        direction,row,record=job
        try:
            file=cache/(record['sourceKey'].split(':')[1]+'.json')
            if file.exists():result=json.loads(file.read_text(encoding='utf8'))
            else:
                ref=row.get('ReplayUrl','')
                if not re.fullmatch(r'guildwar/[a-zA-Z0-9_./-]+\.replay',ref) or any(x in ('','.','..') for x in ref.split('/')):return
                with urllib.request.build_opener(NoRedirect).open('https://tskgb-replay.netmarble.com/'+ref,timeout=10) as response:
                    if response.status!=200:return
                    data=response.read(8*1024*1024+1)
                if len(data)>8*1024*1024:return
                result=extract(pool,data,row,direction,record)
                file.write_text(json.dumps(result,ensure_ascii=True),encoding='utf8')
            for side in result:record['payload'][side]['skills']=result[side]
        except Exception:
            pass # Missing/expired replay must not prevent the battle itself being saved.
    with ThreadPoolExecutor(max_workers=4) as executor:list(executor.map(run,jobs))
