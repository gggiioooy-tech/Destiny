"""Offline replay timeline. Reads an existing file; contains no download operation."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace


def recorded_actions(name, event):
    """Keep packet/container order; standalone HP updates are not skill casts."""
    def rows(field):
        descriptor = event.DESCRIPTOR.fields_by_name[field]
        if descriptor.is_repeated:
            return getattr(event, field)
        return [getattr(event, field)] if event.HasField(field) else []
    def synthetic(results, statuses, kind, source=0, time=0):
        return SimpleNamespace(SkillResults=results, StatusEffectResults=statuses,
                               SourceObjectId=source, SkillGroupId=0, StageTime=time,
                               SkillEndTime=time, actionKind=kind)

    def turn_action(row, time):
        if row.SkillResults or row.AppliedStatusEffect:
            yield synthetic(row.SkillResults, row.AppliedStatusEffect, 'turn_effect', time=time)
        yield from row.EffectSkills

    if name == 'ACUseSkillNoti':
        yield from event.SkillResult
        for row in rows('AdditionalAction'):
            yield from turn_action(row, 0)
    elif name == 'ACTurnRecordNoti':
        for row in rows('ExcuteStatusEffect'):
            yield synthetic(row.ExcuteStatusEffects, [], 'status_tick', time=event.StartStageTime)
        yield from event.NormalAttack
        for row in rows('TurnAction'):
            yield from turn_action(row, event.StartStageTime)


def analyze(pool, raw, record, history):
    from google.protobuf import message_factory

    def cls(name):
        return message_factory.GetMessageClass(pool.FindMessageTypeByName('re.'+name))

    pack = cls('MReplayDataPack').FromString(raw)
    if not pack.IsInitialized():
        raise ValueError('Incomplete replay')
    starts = [cls('ACStartReplayNoti').FromString(p.Data) for p in pack.Packet
              if p.MessageID == cls('ACStartReplayNoti')().MessageID]
    if len(starts) != 1:
        raise ValueError('Expected one replay start')
    accounts = {t.Team: str(t.Player.PlayerInfo.AccountUID) for t in starts[0].TeamDatas}
    own, enemy = (str(history['row'][k]['AccountUID']) for k in ('PlayerInfo', 'TargetPlayerInfo'))
    attacker, defender = (own, enemy) if history['direction'] == 1 else (enemy, own)
    if accounts.get(1) != attacker or accounts.get(2) != defender:
        raise ValueError('Replay participants do not match the selected battle')
    kinds = {cls(n)().MessageID: n for n in (
        'ACSpawnRoundPlayerNoti', 'ACNextRoundEnemyNoti', 'ACUseSkillNoti',
        'ACBattleRoomCharacterStatNoti', 'ACReserveSkillAck', 'ACTurnRecordNoti',
        'ACEndReplayNoti')}
    parsed = []
    for packet in pack.Packet:
        if packet.Size != len(packet.Data):
            raise ValueError('Invalid replay packet size')
        if packet.MessageID in kinds:
            name = kinds[packet.MessageID]
            message = cls(name).FromString(packet.Data)
            if not message.IsInitialized():
                raise ValueError('Incomplete '+name)
            parsed.append((name, message))
    heroes = {}
    for name, event in parsed:
        if name not in ('ACSpawnRoundPlayerNoti', 'ACNextRoundEnemyNoti'):
            continue
        for hero in event.Datas:
            side = {1: 'attacker', 2: 'defender'}.get(hero.Team)
            if not side:
                continue
            roster = record['payload'][side]
            if hero.TemplateId not in roster['heroIds']:
                continue
            index = roster['heroIds'].index(hero.TemplateId)
            item = {'objectId': hero.ObjectId, 'heroId': hero.TemplateId,
                    'side': side, 'name': roster['heroes'][index],
                    'hp': hero.CurHP if hero.HasField('CurHP') else None,
                    'maxHp': hero.MaxHP if hero.HasField('MaxHP') else None,
                    'barrier': hero.Barrier if hero.HasField('Barrier') else None,
                    'stats': {}}
            if hero.ObjectId in heroes:
                raise ValueError('Duplicate hero object')
            heroes[hero.ObjectId] = item
    if len(heroes) != 6:
        raise ValueError('Expected the exact six battle heroes')
    for name, event in parsed:
        if name == 'ACBattleRoomCharacterStatNoti':
            for stat in event.Stats:
                if stat.ObjectID in heroes and not heroes[stat.ObjectID]['stats']:
                    heroes[stat.ObjectID]['stats'] = {str(v.StatTID): v.Value for v in stat.Stat.Stats}
    current = {key: {k: h[k] for k in ('hp', 'maxHp', 'barrier')} for key, h in heroes.items()}
    timeline, unknown = [], set()
    first_active_side = None
    packet_order = 0
    replay_winner = None
    for name, event in parsed:
        if name == 'ACEndReplayNoti':
            replay_winner = event.WinTeam
        if name not in ('ACUseSkillNoti', 'ACTurnRecordNoti'):
            continue
        packet_order += 1
        for action in recorded_actions(name, event):
            source = heroes.get(action.SourceObjectId)
            code = action.SkillGroupId % 100
            if first_active_side is None and source and code in (2, 3, 7):
                first_active_side = source['side']
            results = []
            for result in action.SkillResults:
                target = heroes.get(result.ObjectId)
                if not target:
                    unknown.add(result.ObjectId)
                    continue
                before = dict(current[result.ObjectId])
                for field, key in [('CurHP', 'hp'), ('MaxHP', 'maxHp'), ('Barrier', 'barrier')]:
                    if result.HasField(field):
                        current[result.ObjectId][key] = getattr(result, field)
                after = dict(current[result.ObjectId])
                entry = {'target': result.ObjectId, 'before': before, 'after': after,
                         'damage': result.Damage if result.HasField('Damage') else None,
                         'heal': result.Heal if result.HasField('Heal') else None,
                         'dead': result.IsDie if result.HasField('IsDie') else None,
                         'critical': result.IsCritical, 'weakPoint': result.IsWeakPoint,
                         'block': result.IsBlock, 'slip': result.IsSlip,
                         'skillId': result.SkillId, 'moduleId': result.ModuleId,
                         'applyResult': result.ApplyResult}
                if before['hp'] is not None and after['hp'] is not None:
                    entry['hpDelta'] = after['hp']-before['hp']
                results.append(entry)
            statuses = [{'target': row.ObjectId, 'effects': [
                {'moduleId': effect.ModuleId, 'turns': effect.RemainTurn,
                 'stacks': effect.StackCount, 'state': effect.State}
                for effect in row.StatusEffects]} for row in action.StatusEffectResults]
            timeline.append({'index': len(timeline)+1, 'packet': packet_order,
                             'actionKind': getattr(action, 'actionKind', 'skill_action'),
                             'turn': event.TotalTurn, 'source': action.SourceObjectId,
                             'skillGroupId': action.SkillGroupId, 'skillCode': code,
                             'stageTime': action.StageTime, 'skillEndTime': action.SkillEndTime,
                             'results': results, 'statuses': statuses,
                             'state': {str(k): dict(v) for k, v in current.items()}})
    if replay_winner not in (1, 2) or (replay_winner == 1) != record['payload']['attackerWon']:
        raise ValueError('Replay winner does not match selected history')
    return {'mode': 'observed_replay', 'prediction': False, 'replayWinner': replay_winner,
            'replaySha256': hashlib.sha256(raw).hexdigest(),
            'occurredAt': record['occurredAt'], 'attackerWon': record['payload']['attackerWon'],
            'heroes': list(heroes.values()), 'timeline': timeline,
            'firstSkillSide': first_active_side, 'packetCount': len(pack.Packet),
            'actionPacketCount': packet_order, 'unknownTargetCount': len(unknown),
            'notes': ['실제 기록 재생이며 장비 변경에 따른 가상 승패 예측은 아닙니다.',
                      '피해 기록값은 보호막·무효화 등에 따라 실제 HP 감소와 다를 수 있습니다.']}


HTML = r'''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>길드전 리플레이 분석 테스트</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f3f5f8;color:#172337;font:15px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:24px}h1{font-size:26px;margin:0}h2{font-size:18px;margin:0 0 12px}p{margin:8px 0}.muted{color:#536174}.panel{background:white;border:1px solid #cdd5df;border-radius:16px;padding:20px;margin:16px 0}.teams{display:grid;grid-template-columns:1fr 1fr;gap:16px}.roster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.hero{min-width:0;padding:12px;background:#f5f8fc;border:1px solid #c7d3e4;border-radius:12px}.enemy .hero{background:#fff7f5;border-color:#e6cdc7}.bar{height:9px;background:#dbe1e8;border-radius:8px;overflow:hidden;margin:8px 0}.fill{height:100%;background:#267449}.dead{opacity:.5}.health{font-size:12px;font-variant-numeric:tabular-nums}button{border:1px solid #b5c1d0;background:#fff;color:#172337;border-radius:10px;padding:9px 15px;font:inherit;cursor:pointer}button.primary{background:#294d85;color:#fff;border-color:#294d85}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #4c7fc7;outline-offset:3px}.controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}input[type=range]{width:100%;margin:18px 0}#events{max-height:440px;overflow:auto}.event{display:block;width:100%;text-align:left;margin:6px 0;padding:10px 14px}.event[aria-current=true]{border:2px solid #294d85;background:#edf3ff}.result{padding:6px 0;border-bottom:1px solid #e2e7ee}.badge{font-size:12px;background:#edf1f7;padding:3px 7px;border-radius:6px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:6px;text-align:right;border-bottom:1px solid #e3e8ef}th:first-child,td:first-child{text-align:left}.scroll{overflow:auto}#details{overflow-wrap:anywhere}@media(max-width:750px){main{padding:12px}.teams{grid-template-columns:1fr}.panel{padding:14px}.hero{padding:8px}h1{font-size:21px}}
</style><main><h1>길드전 리플레이 분석 테스트</h1><p id="meta"></p><p class="muted">실제 기록 재생 · 장비나 스탯을 바꾼 가상 전투 예측은 아직 포함하지 않습니다.</p><div class="teams"><section class="panel"><h2>공격팀</h2><div id="attacker" class="roster"></div></section><section class="panel enemy"><h2>방어팀</h2><div id="defender" class="roster"></div></section></div>
<section class="panel"><div class="controls"><button id="prev">이전</button><button id="play" class="primary">자동 재생</button><button id="next">다음</button><button id="reset">처음으로</button><strong id="position" role="status"></strong></div><input id="seek" type="range" min="0" value="0" aria-label="기록 단계 이동"><div id="details"></div></section>
<section class="panel"><h2>전투 타임라인</h2><p class="muted">기록 순서대로 표시합니다. 턴 번호는 게임 기록값이며, 같은 턴에 여러 자동 효과·연속 공격이 포함될 수 있습니다.</p><div id="events"></div></section>
<details class="panel"><summary>전투 시작 스탯 · 기록 해석의 한계</summary><div id="stats" class="scroll"></div><p>피해 표시값과 실제 HP 감소량을 구분합니다. 보호막·피해 무효화·생존 효과 등의 원인을 수치 차이만으로 단정하지 않습니다. 상태효과 모듈 번호는 아직 효과 이름과 대조하지 않았습니다. 기록 시각은 StageTime 원시값으로 보존했습니다.</p></details></main>
<script id="data" type="application/json">__DATA__</script><script>
const d=JSON.parse(document.getElementById('data').textContent),byId=new Map(d.heroes.map(h=>[h.objectId,h]));let step=0,timer=null;const $=id=>document.getElementById(id),num=n=>n===null||n===undefined?'미확인':Number(n).toLocaleString('ko-KR');
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el}
function label(a){if(a.actionKind==='status_tick')return '턴 시작 상태효과';if(a.actionKind==='turn_effect')return '턴 상태 갱신';const h=byId.get(a.source);return (h?(h.side==='attacker'?'공격 · ':'방어 · ')+h.name:'출처 미확인')+' · '+({1:'평타',2:'1스킬',3:'2스킬',7:'각성기'}[a.skillCode]||'자동/기타 효과 코드 '+a.skillCode)}
$('meta').textContent=new Date(d.occurredAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · 기록상 공격팀 '+(d.attackerWon?'승리':'패배')+' · '+d.timeline.length+'개 행동 · 첫 예약 스킬 사용: '+(d.firstSkillSide==='attacker'?'공격팀':d.firstSkillSide==='defender'?'방어팀':'미확인');
for(const h of d.heroes){const el=node('div',undefined,'hero');el.id='hero-'+h.objectId;el.append(node('strong',h.name));const bar=node('div',undefined,'bar'),fill=node('div',undefined,'fill');fill.id='fill-'+h.objectId;bar.append(fill);el.append(bar);const hp=node('div',undefined,'health');hp.id='hp-'+h.objectId;el.append(hp);$(h.side).append(el)}
$('seek').max=d.timeline.length;
for(const a of d.timeline){const b=node('button',a.index+'. 턴 '+a.turn+' · '+label(a),'event');b.id='event-'+a.index;b.onclick=()=>{pause();show(a.index)};$('events').append(b)}
function pause(){clearInterval(timer);timer=null;$('play').textContent='자동 재생'}
function show(n){step=Math.max(0,Math.min(d.timeline.length,n));const a=d.timeline[step-1];$('seek').value=step;$('position').textContent=step+' / '+d.timeline.length;$('prev').disabled=!step;$('next').disabled=step===d.timeline.length;
for(const h of d.heroes){const s=a?a.state[h.objectId]:h;const ratio=s.hp!==null&&s.maxHp>0?Math.max(0,Math.min(100,s.hp/s.maxHp*100)):0;$('fill-'+h.objectId).style.width=ratio+'%';$('hp-'+h.objectId).textContent=num(s.hp)+' / '+num(s.maxHp)+' · 보호막 '+num(s.barrier);$('hero-'+h.objectId).classList.toggle('dead',s.hp===0)}
const box=$('details');box.replaceChildren();if(!a)box.append(node('strong','전투 시작 스탯'));else{box.append(node('h2',label(a)));box.append(node('p','게임 턴 '+a.turn+' · 스킬 그룹 '+a.skillGroupId+' · 기록 시각 '+a.stageTime+' → '+a.skillEndTime,'muted'));if(!a.results.length)box.append(node('p','이 행동에는 영웅 HP 결과가 기록되지 않았습니다.'));
for(const r of a.results){const h=byId.get(r.target);const tags=[r.critical?'치명타':'',r.weakPoint?'약점':'',r.block?'막기':'',r.slip?'IsSlip 표시':'',r.dead?'사망 표시':''].filter(Boolean).join(' · ');box.append(node('div',(h?h.name:'미확인')+' — 피해 기록 '+num(r.damage)+' / 회복 기록 '+num(r.heal)+' · HP '+num(r.before.hp)+' → '+num(r.after.hp)+(tags?' · '+tags:''),'result'))}
if(a.statuses.length)box.append(node('p','상태효과 기록 '+a.statuses.reduce((s,r)=>s+r.effects.length,0)+'개 · 모듈명은 추가 대조 필요','muted'));}
for(const e of $('events').children)e.setAttribute('aria-current',String(e.id==='event-'+step));if(step===d.timeline.length)pause();}
$('prev').onclick=()=>{pause();show(step-1)};$('next').onclick=()=>{pause();show(step+1)};$('reset').onclick=()=>{pause();show(0)};$('seek').oninput=e=>{pause();show(+e.target.value)};$('play').onclick=()=>{if(timer)return pause();if(step===d.timeline.length)show(0);$('play').textContent='일시정지';timer=setInterval(()=>show(step+1),1100)};
const statNames={1:'물리 공격력',3:'마법 공격력',5:'방어력',7:'생명력',9:'속공',10:'치명타 확률',11:'치명타 피해',12:'약점 공격 확률',13:'효과 적중',14:'효과 저항',17:'막기 확률',18:'받는 피해 감소',21:'피해 증폭',22:'파쇄',23:'탄성',24:'재생'};const table=node('table'),head=node('tr');head.append(node('th','능력치'));for(const h of d.heroes)head.append(node('th',(h.side==='attacker'?'공 ':'방 ')+h.name));table.append(head);for(const [id,name]of Object.entries(statNames)){const tr=node('tr');tr.append(node('th',name));for(const h of d.heroes){const v=h.stats[id];tr.append(node('td',v===undefined?'미확인':(+id>=10?num(v/10)+'%':num(v))))}table.append(tr)}$('stats').append(table);show(0);
</script></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('schema', 'vendor', 'replay', 'record', 'history', 'output'):
        parser.add_argument('--'+flag, type=Path, required=True)
    args = parser.parse_args()
    sys.path.insert(0, str(args.vendor))
    from google.protobuf import descriptor_pb2, descriptor_pool
    pool = descriptor_pool.DescriptorPool()
    pool.Add(descriptor_pb2.FileDescriptorProto.FromString(args.schema.read_bytes()))
    raw = args.replay.read_bytes()
    if len(raw) > 8*1024*1024:
        raise ValueError('Replay file exceeds 8 MB')
    record = json.loads(args.record.read_text(encoding='utf-8'))
    history = json.loads(args.history.read_text(encoding='utf-8'))
    report = analyze(pool, raw, record, history)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output/'timeline.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    embedded = json.dumps(report, ensure_ascii=False).replace('<', r'\u003c')
    (args.output/'timeline.html').write_text(HTML.replace('__DATA__', embedded), encoding='utf-8')
    print(json.dumps({'actions': len(report['timeline']), 'resultRows': sum(len(a['results']) for a in report['timeline']),
                      'packetCount': report['packetCount'], 'unknownTargets': report['unknownTargetCount']}, ensure_ascii=True))


if __name__ == '__main__':
    main()
