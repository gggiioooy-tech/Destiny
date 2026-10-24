"""Offline report fidelity; no private schema or replay required."""
import importlib.util
from pathlib import Path
import unittest

from google.protobuf import descriptor_pb2, descriptor_pool, message_factory

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('analyze_local', ROOT/'tools/replay-analysis/analyze_local.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StatusIdentityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        schema = descriptor_pb2.FileDescriptorProto(name='status_test.proto', syntax='proto2')
        message = schema.message_type.add(name='Effect')
        for number, name in enumerate(['ModuleId', 'RemainTurn', 'StackCount', 'State', 'SeqID', 'DurationType'], 1):
            message.field.add(name=name, number=number, type=5, label=1)
        pool = descriptor_pool.DescriptorPool()
        pool.Add(schema)
        cls.effect = message_factory.GetMessageClass(pool.FindMessageTypeByName('Effect'))

    def test_same_module_instances_keep_distinct_identity(self):
        first = module.status_snapshot(self.effect(ModuleId=11, SeqID=5, DurationType=2))
        second = module.status_snapshot(self.effect(ModuleId=11, SeqID=6, DurationType=3))
        self.assertEqual(first['moduleId'], second['moduleId'])
        self.assertEqual([first['sequenceId'], second['sequenceId']], [5, 6])
        self.assertEqual([first['durationType'], second['durationType']], [2, 3])

    def test_absent_identity_is_not_an_explicit_zero(self):
        absent = module.status_snapshot(self.effect())
        zero = module.status_snapshot(self.effect(SeqID=0, DurationType=0))
        self.assertIsNone(absent['sequenceId'])
        self.assertIsNone(absent['durationType'])
        self.assertEqual(zero['sequenceId'], 0)
        self.assertEqual(zero['durationType'], 0)


class ResultAttributionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        schema = descriptor_pb2.FileDescriptorProto(name='result_test.proto', syntax='proto2')
        cooldown = schema.message_type.add(name='Cooldown')
        cooldown.field.add(name='SkillGroupId', number=1, type=5, label=1)
        cooldown.field.add(name='CoolTime', number=2, type=3, label=1)
        message = schema.message_type.add(name='Result')
        message.field.add(name='AppliedModuleIds', number=1, type=3, label=3)
        message.field.add(name='CalcDamageScore', number=2, type=3, label=1)
        message.field.add(name='TotalBattleScore', number=3, type=3, label=1)
        message.field.add(name='ChangedCoolTime', number=4, type=11, type_name='.Cooldown', label=3)
        pool = descriptor_pool.DescriptorPool()
        pool.Add(schema)
        cls.result = message_factory.GetMessageClass(pool.FindMessageTypeByName('Result'))

    def test_module_order_and_repeated_attribution_are_not_collapsed(self):
        row = module.result_metadata(self.result(AppliedModuleIds=[11, 22, 11], CalcDamageScore=71))
        self.assertEqual(row['appliedModuleIds'], [11, 22, 11])
        self.assertEqual(row['calcDamageScore'], 71)
        self.assertIsNone(row['totalBattleScore'])

    def test_cooldown_changes_preserve_order_reset_zero_and_absence(self):
        result = self.result()
        result.ChangedCoolTime.add(SkillGroupId=103, CoolTime=0)
        result.ChangedCoolTime.add(SkillGroupId=102, CoolTime=12345)
        result.ChangedCoolTime.add()
        self.assertEqual(module.result_metadata(result)['changedCooldowns'], [
            {'skillGroupId': 103, 'coolTime': 0},
            {'skillGroupId': 102, 'coolTime': 12345},
            {'skillGroupId': None, 'coolTime': None}])
        self.assertEqual(module.result_metadata(self.result())['changedCooldowns'], [])

    def test_absent_scores_are_not_explicit_zero_scores(self):
        absent = module.result_metadata(self.result())
        zero = module.result_metadata(self.result(CalcDamageScore=0, TotalBattleScore=0))
        self.assertIsNone(absent['calcDamageScore'])
        self.assertIsNone(absent['totalBattleScore'])
        self.assertEqual(zero['calcDamageScore'], 0)
        self.assertEqual(zero['totalBattleScore'], 0)


if __name__ == '__main__':
    unittest.main()
