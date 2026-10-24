"""Offline replay timeline. Reads an existing file; contains no download operation."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace


def status_snapshot(effect):
    """Preserve effect identity and duration encoding without inventing defaults.

    SeqID separates concurrent instances of the same module. DurationType is a
    protocol value, not a documented conversion to personal or global turns.
    """
    row = {'moduleId': effect.ModuleId, 'turns': effect.RemainTurn,
           'stacks': effect.StackCount, 'state': effect.State}
    for field, key in [('SeqID', 'sequenceId'), ('DurationType', 'durationType')]:
        row[key] = getattr(effect, field) if effect.HasField(field) else None
    return row


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

    def tagged(action, kind):
        return SimpleNamespace(SkillResults=action.SkillResults,
                               StatusEffectResults=action.StatusEffectResults,
                               SourceObjectId=action.SourceObjectId,
                               SkillGroupId=action.SkillGroupId,
                               StageTime=action.StageTime, SkillEndTime=action.SkillEndTime,
                               ActionType=action.ActionType, SkillCooltime=action.SkillCooltime,
                               actionKind=kind)

    def turn_action(row, time):
        if row.SkillResults or row.AppliedStatusEffect:
            yield synthetic(row.SkillResults, row.AppliedStatusEffect, 'turn_effect', time=time)
        for action in row.EffectSkills:
            yield tagged(action, 'additional_skill')

    if name == 'ACUseSkillNoti':
        for action in event.SkillResult:
            yield tagged(action, 'active_skill')
        for row in rows('AdditionalAction'):
            yield from turn_action(row, 0)
    elif name == 'ACTurnRecordNoti':
        for row in rows('ExcuteStatusEffect'):
            yield synthetic(row.ExcuteStatusEffects, [], 'status_tick', time=event.StartStageTime)
        for action in event.NormalAttack:
            yield tagged(action, 'normal_attack')
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
                status_snapshot(effect)
                for effect in row.StatusEffects]} for row in action.StatusEffectResults]
            timeline.append({'index': len(timeline)+1, 'packet': packet_order,
                             'actionKind': getattr(action, 'actionKind', 'skill_action'),
                             'actionType': getattr(action, 'ActionType', None),
                             'skillCooltime': getattr(action, 'SkillCooltime', None),
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


HTML = Path(__file__).with_name('player.html').read_text(encoding='utf8').replace('__PORTRAITS__', Path(__file__).with_name('portraits.json').read_text(encoding='utf8').replace('<', r'\u003c'))


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
