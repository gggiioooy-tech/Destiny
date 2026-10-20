"""Read initial reservations and first active skill; replay URLs and account IDs stay local."""
import json,re,urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from google.protobuf import message_factory

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def first_active_side(events,objects,rosters):
    for actions in events:
        sides=set()
        for source,skill_group in actions:
            if skill_group%100 not in (2,3,7):continue
            team,hero=objects.get(source,(None,None))
            side={1:'attacker',2:'defender'}.get(team)
            if side and hero in rosters[side]['heroIds']:sides.add(side)
        if sides:return next(iter(sides)) if len(sides)==1 else None
    return None

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
    T=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.ACUseSkillNoti'))
    actions=[]
    for packet in pack.Packet:
        if packet.MessageID==T().MessageID:
            event=parse('ACUseSkillNoti',packet.Data)
            actions.append([(action.SourceObjectId,action.SkillGroupId) for action in event.SkillResult])
    result['firstSkillSide']=first_active_side(actions,objects,record['payload'])
    result['heroHealth']={side:[] for side in ('attacker','defender')}
    result['heroSpeeds']={side:[] for side in ('attacker','defender')}
    for mid in (20053,20007):
        for hero in events[mid].Datas:
            side={1:'attacker',2:'defender'}.get(hero.Team)
            if side and hero.TemplateId in record['payload'][side]['heroIds'] and hero.HasField('MaxHP') and 1<=hero.MaxHP<=2147483647:
                result['heroHealth'][side].append({'heroId':hero.TemplateId,'value':hero.MaxHP})
            if side and hero.TemplateId in record['payload'][side]['heroIds'] and hero.HasField('AttackSpeed') and 0<=hero.AttackSpeed<=1000000:
                result['heroSpeeds'][side].append({'heroId':hero.TemplateId,'value':hero.AttackSpeed})
    result['heroStats']={side:[] for side in ('attacker','defender')}
    stat_type=message_factory.GetMessageClass(pool.FindMessageTypeByName('re.ACBattleRoomCharacterStatNoti'))
    stat_ids={1:'physicalAttack',3:'magicalAttack',5:'defence',7:'hp',9:'attackSpeed',10:'critical',11:'criticalDamage',12:'weakPoint',13:'accuracyRate',14:'resistRate',17:'blockRate',18:'takeDamageRate',21:'damageIncrease',22:'fracture',23:'resilience',24:'rejuvenation'}
    for packet in pack.Packet:
        if packet.MessageID!=stat_type().MessageID:continue
        detail=parse('ACBattleRoomCharacterStatNoti',packet.Data)
        for hero in detail.Stats:
            team,hero_id=objects.get(hero.ObjectID,(None,None))
            side={1:'attacker',2:'defender'}.get(team)
            if not side or hero_id not in record['payload'][side]['heroIds']:continue
            values={stat_ids[v.StatTID]:v.Value for v in hero.Stat.Stats if v.StatTID in stat_ids and abs(v.Value)<=2147483647}
            if values:result['heroStats'][side].append({'heroId':hero_id,'stats':values})
        break
    return result

def enrich(pool,jobs,state_dir):
    cache=Path(state_dir)/'replay-skills-v5';cache.mkdir(exist_ok=True)
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
            for side in ('attacker','defender'):record['payload'][side]['skills']=result[side]
            if result.get('firstSkillSide') in ('attacker','defender'):record['payload']['firstSkillSide']=result['firstSkillSide']
            if result.get('heroSpeeds'):record['payload']['heroSpeeds']=result['heroSpeeds']
            if result.get('heroHealth'):record['payload']['heroHealth']=result['heroHealth']
            if result.get('heroStats'):record['payload']['heroStats']=result['heroStats']
        except Exception:
            # Preserve previously decoded reservations if a replay has expired.
            try:
                name=record['sourceKey'].split(':')[1]+'.json'
                old_file=Path(state_dir)/'replay-skills-v4'/name
                if not old_file.exists():old_file=Path(state_dir)/'replay-skills-v3'/name
                if not old_file.exists():old_file=Path(state_dir)/'replay-skills-v2'/name
                if not old_file.exists():old_file=Path(state_dir)/'replay-skills-v1'/name
                old=json.loads(old_file.read_text(encoding='utf8'))
                for side in ('attacker','defender'):record['payload'][side]['skills']=old[side]
                if old.get('heroHealth'):record['payload']['heroHealth']=old['heroHealth']
                if old.get('heroSpeeds'):record['payload']['heroSpeeds']=old['heroSpeeds']
                if old.get('firstSkillSide') in ('attacker','defender'):record['payload']['firstSkillSide']=old['firstSkillSide']
            except (OSError,ValueError,KeyError):pass
    with ThreadPoolExecutor(max_workers=4) as executor:list(executor.map(run,jobs))
