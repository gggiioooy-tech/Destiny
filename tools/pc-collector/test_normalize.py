import unittest
from normalize import normalize
class Records(unittest.TestCase):
 def setUp(self):
  self.periods=[{'from':'2026-10-14T00:00:00+09:00','until':'2026-10-16T00:00:00+09:00','warDate':'2026-10-14','guild':'철폐','opponent':'MadDay'}]
  self.row={'CreateTimeMS':'1791990000000','PlaceID':21,'IsWin':False,'PlayerInfo':{'AccountUID':'100','PlayerName':'우리','GuildSimpleInfo':{'GuildName':'철폐'}},'TargetPlayerInfo':{'AccountUID':'200','PlayerName':'상대','GuildSimpleInfo':{'GuildName':'LuckyDay'}},'PlayerDeckPeek':{'Heros':[{'HeroTID':1},{'HeroTID':2},{'HeroTID':3}],'Pet':{'PetTID':4}},'TargetPlayerDeckPeek':{'Heros':[{'HeroTID':5},{'HeroTID':6},{'HeroTID':7}],'Pet':{'PetTID':8}}}
 def test_defense(self):
  x=normalize(self.row,2,self.periods)['payload'];self.assertEqual(x['attacker']['nickname'],'상대');self.assertTrue(x['attackerWon']);self.assertEqual(x['opponentGuild'],'MadDay');self.assertEqual(x['warDate'],'2026-10-14')
 def test_unknown_preserved(self):
  x=normalize(self.row,1,self.periods)['payload']['attacker'];self.assertEqual(x['heroIds'],[1,2,3]);self.assertEqual(x['heroes'][0],'영웅 #1');self.assertFalse(x['namesResolved'])
 def test_no_invented_period(self):
  with self.assertRaises(ValueError):normalize(self.row,1,[])
 def test_duplicate_key(self):self.assertEqual(normalize(self.row,1,self.periods)['sourceKey'],normalize(dict(self.row),1,self.periods)['sourceKey'])
if __name__=='__main__':unittest.main()
