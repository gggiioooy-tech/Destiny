"""Offline aggregate only; never prints player or replay identifiers.

Usage: python audit-replay-result-metadata.py PRIVATE_CONFIG PRIVATE_REPLAYS OUTPUT
"""
import importlib.util
import json
from pathlib import Path
import sys


def audit(config_path, root):
    config = json.loads(Path(config_path).read_text(encoding='utf-8-sig'))
    sys.path.insert(0, config['protobufPath'])
    from google.protobuf import descriptor_pb2, descriptor_pool, message_factory
    pool = descriptor_pool.DescriptorPool()
    pool.Add(descriptor_pb2.FileDescriptorProto.FromString(Path(config['schemaPath']).read_bytes()))
    cls = lambda name: message_factory.GetMessageClass(pool.FindMessageTypeByName('re.' + name))
    spec = importlib.util.spec_from_file_location('local_analysis', Path(__file__).resolve().parents[1]/'tools/replay-analysis/analyze_local.py')
    analysis = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(analysis)
    types = {cls(n)().MessageID: n for n in ['ACUseSkillNoti', 'ACTurnRecordNoti']}
    result = {'replays': 0, 'resultRows': 0, 'rowsWithAppliedModules': 0, 'rowsWithRepeatedModuleIds': 0,
              'calcScorePresent': 0, 'totalScorePresent': 0, 'positiveDamageWithZeroCalcScore': 0}
    for directory in sorted(Path(root).iterdir()):
        if not (directory/'battle.replay').exists():
            continue
        result['replays'] += 1
        pack = cls('MReplayDataPack').FromString((directory/'battle.replay').read_bytes())
        for packet in pack.Packet:
            name = types.get(packet.MessageID)
            if not name:
                continue
            for action in analysis.recorded_actions(name, cls(name).FromString(packet.Data)):
                for row in action.SkillResults:
                    data = analysis.result_metadata(row)
                    result['resultRows'] += 1
                    result['rowsWithAppliedModules'] += bool(data['appliedModuleIds'])
                    result['rowsWithRepeatedModuleIds'] += len(data['appliedModuleIds']) != len(set(data['appliedModuleIds']))
                    result['calcScorePresent'] += data['calcDamageScore'] is not None
                    result['totalScorePresent'] += data['totalBattleScore'] is not None
                    result['positiveDamageWithZeroCalcScore'] += row.Damage > 0 and data['calcDamageScore'] == 0
    result['limitation'] = 'Module lists and scores are attribution hints only. They do not by themselves distinguish direct hits from link/guard routing, or certify score/clock semantics.'
    return result


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    output = audit(sys.argv[1], sys.argv[2])
    Path(sys.argv[3]).write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(output))
