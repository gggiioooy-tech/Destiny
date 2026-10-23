import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('roster_import',Path(__file__).resolve().parents[1]/'scripts/import-simulation-roster.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
class ReviewedImportTest(unittest.TestCase):
 def test_reviewed_awakened_skill_and_role_survive_default_reimport(self):
  reviewed={'name':'기유','role':5,'awakened':True,'basis':'사용자 지정 한국판 나무위키 기준','skills':[{'code':3,'text':'reviewed full enhancement'}]}
  fresh={'기유':{'name':'기유','role':3,'awakened':False,'skills':[]}}
  got=mod.preserve_reviewed(fresh,{'heroes':[reviewed]})['기유'];self.assertEqual(got,reviewed)
 def test_explicit_refresh_can_replace_a_reviewed_snapshot(self):
  fresh={'초선':{'name':'초선','skills':[]}}
  got=mod.preserve_reviewed(fresh,{'heroes':[{'name':'초선','reviewedAt':'2026-10-23','skills':[1]}]},True);self.assertEqual(got['초선']['skills'],[])
if __name__=='__main__':unittest.main()
