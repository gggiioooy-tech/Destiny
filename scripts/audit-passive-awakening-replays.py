"""Offline aggregate evidence. Private config/replays are never copied to output.

Usage: python audit-passive-awakening-replays.py PRIVATE_CONFIG PRIVATE_REPLAYS OUTPUT
Contains no network request and does not read battle winners.
"""
import json
from collections import Counter
from pathlib import Path
import statistics
import sys


def audit(config_path, replay_root):
    config = json.loads(Path(config_path).read_text(encoding='utf-8-sig'))
    sys.path.insert(0, config['protobufPath'])
    from google.protobuf import descriptor_pb2, descriptor_pool, message_factory
    pool = descriptor_pool.DescriptorPool()
    pool.Add(descriptor_pb2.FileDescriptorProto.FromString(Path(config['schemaPath']).read_bytes()))
    names = ['MReplayDataPack', 'ACUseSkillNoti', 'ACTurnRecordNoti']
    classes = {name: message_factory.GetMessageClass(pool.FindMessageTypeByName('re.' + name)) for name in names}
    mids = {classes[name]().MessageID: name for name in names[1:]}
    values, transitions = Counter(), Counter()
    zero_duration, damage_actions, revival_rows = 0, [], 0
    rage_deltas, responses_per_owner_packet = Counter(), Counter()
    battles = 0
    for folder in sorted(Path(replay_root).iterdir()):
        if not folder.is_dir() or not (folder/'battle.replay').exists():
            continue
        report = json.loads((folder/'timeline.json').read_text(encoding='utf8'))
        ids = {h['objectId'] for h in report['heroes'] if h['name'] == '아리스'}
        if not ids:
            continue
        battles += 1
        packets = {}
        for action in report['timeline']:
            packets.setdefault(action['packet'], []).append(action)
        for object_id in ids:
            rage = 0
            for actions in packets.values():
                before, reset = rage, False
                for action in actions:
                    for row in action['statuses']:
                        if row['target'] != object_id:
                            continue
                        for effect in row['effects']:
                            if effect['moduleId'] == 4018293401:
                                if effect['state'] == 4:
                                    rage, reset = 0, True
                                else:
                                    rage = effect['stacks']
                            if effect['moduleId'] == 4018291410:
                                rage, reset = effect['stacks'], True
                incoming = [a for a in actions if a['source'] != object_id and any(v['target'] == object_id and v['damage'] is not None for v in a['results'])]
                if not reset and incoming and before < rage < 30:
                    rage_deltas[rage - before] += 1
                responses = [a for a in actions if a['source'] == object_id and a['skillCode'] == 7 and any((v['damage'] or 0) > 0 for v in a['results'])]
                if responses:
                    blocked = sum(v['target'] == object_id and v['block'] and v['damage'] is not None for a in actions if a['source'] != object_id for v in a['results'])
                    responses_per_owner_packet[(blocked, len(responses))] += 1
        for action in report['timeline']:
            if action['source'] in ids and action['skillCode'] == 7:
                duration = action['skillEndTime'] - action['stageTime']
                if duration == 0:
                    zero_duration += 1
                if duration > 0 and any((r.get('damage') or 0) > 0 for r in action['results']):
                    damage_actions.append(duration)
            # Separate attack/damage module IDs encode the same rage count.
            # Count only the attack-side grant, not both stat entries.
            revival_rows += sum(e['moduleId'] == 4018291410 and e['stacks'] == 10 and e['state'] in (1, 2)
                                for row in action['statuses'] if row['target'] in ids for e in row['effects'])
        previous = {}
        pack = classes['MReplayDataPack'].FromString((folder/'battle.replay').read_bytes())
        for packet in pack.Packet:
            name = mids.get(packet.MessageID)
            if not name:
                continue
            event = classes[name].FromString(packet.Data)
            own_basic = name == 'ACTurnRecordNoti' and event.ObjectId in ids
            own_skill = name == 'ACUseSkillNoti' and any(a.SourceObjectId in ids and a.SkillGroupId % 100 in (2, 3) for a in event.SkillResult)
            for gauge in event.AwakenGauges:
                if gauge.ObjectId not in ids:
                    continue
                state = (gauge.IsActivatedAwaken, gauge.CurAwakenGauge, gauge.MaxAwakenGauge, gauge.AwakenUseCount)
                values[state] += 1
                old = previous.get(gauge.ObjectId)
                if old:
                    transitions[('own_basic' if own_basic else 'own_skill' if own_skill else 'other', old[0], state[0], state[1] - old[1])] += 1
                previous[gauge.ObjectId] = state
    return {'battles': battles, 'zeroDurationCode7Rows': zero_duration,
            'damagingCode7Rows': len(damage_actions), 'damagingCode7MedianMs': statistics.median(damage_actions) if damage_actions else None,
            'tenStackRevivalGrantRows': revival_rows,
            'ragePacketDeltas': [{'delta': k, 'count': v} for k, v in rage_deltas.most_common()],
            'blockResponsesPerOwnerPacket': [{'blockedDamageRows': k[0], 'responseRows': k[1], 'count': v} for k, v in responses_per_owner_packet.most_common()],
            'gaugeValues': [{'state': list(k), 'count': v} for k, v in values.most_common(12)],
            'gaugeTransitions': [{'state': list(k), 'count': v} for k, v in transitions.most_common(20)],
            'limitations': ['Net packet transitions may contain other gauge changes.', 'This is archive evidence, not exhaustive same-frame priority verification.']}


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    result = audit(sys.argv[1], sys.argv[2])
    Path(sys.argv[3]).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps({k: result[k] for k in ['battles', 'zeroDurationCode7Rows', 'damagingCode7Rows', 'damagingCode7MedianMs', 'tenStackRevivalGrantRows']}))
