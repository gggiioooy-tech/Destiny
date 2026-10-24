"""Aggregate local replay clock fields without reading winners or printing IDs.

Usage: python audit-replay-clocks.py PRIVATE_CONFIG PRIVATE_REPLAYS OUTPUT
"""
import json
from pathlib import Path
import statistics
import sys


def audit(config_path, root):
    config = json.loads(Path(config_path).read_text(encoding='utf-8-sig'))
    sys.path.insert(0, config['protobufPath'])
    from google.protobuf import descriptor_pb2, descriptor_pool, message_factory
    pool = descriptor_pool.DescriptorPool()
    pool.Add(descriptor_pb2.FileDescriptorProto.FromString(Path(config['schemaPath']).read_bytes()))
    cls = lambda name: message_factory.GetMessageClass(pool.FindMessageTypeByName('re.' + name))
    pack_class, end_class, turn_class = (cls(name) for name in ['MReplayDataPack', 'ACEndRoundNoti', 'ACTurnRecordNoti'])
    ends, clock_gaps = [], []
    for folder in sorted(Path(root).iterdir()):
        if not folder.is_dir() or not (folder/'battle.replay').exists():
            continue
        for packet in pack_class.FromString((folder/'battle.replay').read_bytes()).Packet:
            if packet.MessageID == end_class().MessageID:
                ends.append(end_class.FromString(packet.Data).StageTime)
            if packet.MessageID == turn_class().MessageID:
                turn = turn_class.FromString(packet.Data)
                clock_gaps.append(turn.StageSkillTime - turn.StartStageTime)
    stats = lambda values: {'count': len(values), 'minMs': min(values), 'medianMs': statistics.median(values), 'maxMs': max(values)} if values else None
    return {'roundEndStageClock': stats(ends), 'stageSkillMinusStageClock': stats(clock_gaps),
            'endsBetween149And155Seconds': sum(149000 <= value <= 155000 for value in ends),
            'endsAbove210Seconds': sum(value > 210000 for value in ends),
            'limitation': 'Stage clock fields are not established as displayed or wall time. Do not infer the product limit or a battle winner from this aggregate.'}


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    result = audit(sys.argv[1], sys.argv[2])
    Path(sys.argv[3]).write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
    print(json.dumps(result))
