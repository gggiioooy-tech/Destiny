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


if __name__ == '__main__':
    unittest.main()
