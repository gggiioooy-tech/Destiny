import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareHeroes,changeHero,createBattle,advanceBattle} from '../src/lib/experimentalBattle.js';
import {SIM_ROSTER} from '../src/lib/simulationSkills.js';
import {BASE_STATS,PETS,FORMATIONS,calculatePrebattle,defaultPrebattleSettings,normalizePrebattleSettings,reducePanelTimedBuffs,incomingModifiers} from '../src/lib/prebattleStats.js';
import {setupDocument,readSetupFile} from '../src/lib/simulationWorkspace.js';
function fixture(names=['선란','여포','하연','하연','루디','윤건']){
  let h=prepareHeroes();names.forEach((name,i)=>h=changeHero(h,i,name));
  return h.map(u=>({...u,attack:1000,defense:100,maxHp:1000,crit:5,critDamage:150,weakPoint:0,accuracy:0,resist:0,block:0,origin:'정보창 수치',exampleStats:false}));
}
function settings(){const s=defaultPrebattleSettings();return s;}
test('panel + pet growth + base times potential and formation precede strongest team buffs and initial stacks',()=>{
  const h=fixture(),s=settings();s.attacker.pet='제오';s.attacker.formation='protection';s.attacker.formationAttack=42;s.attacker.formationDefense=10.5;s.attacker.positions=['back','front','front'];s.attacker.potentials=[18,15,15,15].map(value=>({stat:'attack',value}));
  const before=structuredClone(h),result=calculatePrebattle(h,s),seon=result.heroes[0];
  assert.equal(seon.attack,Math.round((1000+564+1712*1.05)*1.67));
  assert.equal(seon.critDamage,180);assert.equal(seon.weakPoint,100);assert.equal(seon.damageIncrease,14);
  assert.deepEqual(h,before);assert.ok(result.breakdown[0].rows.some(r=>r.bonuses.some(b=>b.source==='여포'&&b.value===31)));
});
test('same physical attack aura uses the strongest, never adds Seon and Aileen to Lubu',()=>{
  const h=fixture(['선란','여포','아일린','연희','쥬리','윤건']),r=calculatePrebattle(h,settings());
  assert.equal(r.heroes[0].attack,Math.round((1000+1712*.14)*1.52));
  assert.equal(r.breakdown[0].rows.find(r=>r.stat==='attack').bonuses.filter(b=>b.value===25).length,0);
});
test('pet potential is based on codex base, not equipped panel attack; formation follows each row',()=>{
  const h=fixture(['쥬리','윤건','연희','쥬리','윤건','연희']),s=settings();s.attacker.potentials[0]={stat:'defense',value:15};s.attacker.formation='attack';s.attacker.formationDefense=42;s.attacker.formationAttack=10.5;s.attacker.positions=['front','back','back'];
  const r=calculatePrebattle(h,s);assert.equal(r.heroes[0].defense,Math.round(100+BASE_STATS['쥬리'].defense*.57));
  assert.equal(r.breakdown[0].rows.find(row=>row.stat==='defense').formation,42);
  assert.equal(r.breakdown[0].rows.find(row=>row.stat==='attack').formation,0);
});
test('Yun self crit and weak, Juri resistance, and role-qualified Tan accuracy are automatic',()=>{
  const h=fixture(['윤건','쥬리','탄지로','시노부','젠이츠','하연']),r=calculatePrebattle(h,settings());
  assert.equal(r.heroes[0].crit,55);assert.equal(r.heroes[0].weakPoint,50);
  assert.equal(r.heroes[1].resist,15); // 49 own resistance minus strongest enemy 34, not 68.
  assert.equal(r.heroes[2].accuracy,37);assert.equal(r.heroes[0].accuracy,0);
});
test('battle-start mode bypasses all pet, formation and aura conversion',()=>{
  const h=fixture(),s=settings();s.attacker.pet='제오';const r=calculatePrebattle(h,s,{basis:'battle'});
  assert.deepEqual(r.heroes,h);assert.notEqual(r.heroes,h);assert.equal(r.breakdown.length,0);
});
test('timed pet attack expires independently from permanent buffs and never gets applied twice',()=>{
  const s=settings();s.attacker.pet='제오';const r=calculatePrebattle(fixture(),s),unit=r.heroes[0],before=unit.attack;
  let u=unit;for(let i=0;i<4;i++)u=reducePanelTimedBuffs(u);
  assert.ok(Math.abs(u.attack-(before-(1000+564+1712*.14)*.37))<1e-8);assert.equal(unit.attack,before);
  assert.deepEqual(reducePanelTimedBuffs(u),u);
});
test('panel values, input basis and both pet contexts round-trip; legacy v1 remains battle-start input',()=>{
  const draft=fixture(['윤건','쥬리','연희','탄지로','시노부','젠이츠']),s=settings();s.attacker.pet='제오';
  const plans={attacker:[{id:0,code:2},{id:1,code:2},{id:2,code:2}],defender:[{id:3,code:2},{id:4,code:2},{id:5,code:2}]};
  const doc=setupDocument({draft,plans,inputBasis:'panel',teamSettings:s});const loaded=readSetupFile(JSON.stringify(doc));
  assert.equal(loaded.inputBasis,'panel');assert.equal(loaded.draft[0].attack,1000);assert.deepEqual(loaded.teamSettings,s);
  doc.version=1;assert.equal(readSetupFile(JSON.stringify(doc)).inputBasis,'battle');
});
test('invalid pet settings and blank/negative panel primary stats fail before simulation',()=>{
  const s=settings();s.attacker.pet='not-a-pet';assert.throws(()=>normalizePrebattleSettings(s));
  const h=fixture();h[0].attack=-1;assert.throws(()=>calculatePrebattle(h,settings()));h[0].attack='';assert.throws(()=>calculatePrebattle(h,settings()));
});
test('every selectable hero has public base stats and finite starting conversions',()=>{
  for(const profile of SIM_ROSTER){assert.ok(BASE_STATS[profile.name],profile.name);const h=fixture([profile.name,'쥬리','연희','탄지로','시노부','젠이츠']);const s=settings();s.attacker.pet='제오';const r=calculatePrebattle(h,s);assert.ok(r.heroes.every(h=>Number.isFinite(h.attack)&&Number.isFinite(h.maxHp)&&h.maxHp>0),profile.name);}
});
test('panel Yeon damage buff is included once in the engine rather than double counted',()=>{
  const h=fixture(['연희','쥬리','윤건','탄지로','시노부','젠이츠']),r=calculatePrebattle(h,settings());
  assert.equal(r.heroes[0].damageIncrease,35);const b=createBattle(r.heroes),after=advanceBattle(b);assert.equal(after.units[0].damageIncrease,35);assert.equal(after.units[0].panelComputed,true);
});
test('pet skill level stays fixed at full enhancement and +5 growth does not stop at public table +4',()=>{
  const h=fixture(['연희','쥬리','윤건','탄지로','시노부','젠이츠']),s=settings();s.attacker.pet='루';s.attacker.petSkillLevel=3;
  assert.equal(calculatePrebattle(h,s).heroes[0].defense,Math.round((100+344)*1.28));
  s.attacker.petSkillLevel=0;assert.equal(calculatePrebattle(h,s).heroes[0].defense,Math.round((100+344)*1.28));
  assert.deepEqual(PETS.find(p=>p.name==='제오').growth.attack,[404,564]);
});
test('physical vulnerability from Tan affects physical hits regardless of defender damage type',()=>{
  const r=calculatePrebattle(fixture(['윤건','쥬리','연희','탄지로','시노부','젠이츠']),settings());
  assert.equal(incomingModifiers({name:'선란'},r.heroes[0]).vulnerability,20);
  assert.equal(incomingModifiers({name:'윤건'},r.heroes[0]).vulnerability,0);
});

test('only requested pets are selectable, old aliases normalize and pet upgrades stay fixed',()=>{
 assert.deepEqual(PETS.map(p=>p.name),['루','이린','리첼','크리','파이크','델로','윈디','제브','유','요랑','연지','카람','제오','멜페로','네즈코']);
 const s=settings();s.attacker.pet='멜패로';s.attacker.petEnhancement=0;s.attacker.petSkillLevel=0;
 const n=normalizePrebattleSettings(s);assert.equal(n.attacker.pet,'멜페로');assert.equal(n.attacker.petEnhancement,5);assert.equal(n.attacker.petSkillLevel,3);
});
test('four formation presets derive bonuses and enforce row capacity',()=>{
 assert.deepEqual(FORMATIONS.map(f=>[f.back,f.front,f.attack,f.defense]),[[3,2,14,21],[2,3,21,14],[4,1,10.5,42],[1,4,42,10.5]]);
 for(const f of FORMATIONS){const s=settings();s.attacker.formation=f.id;s.attacker.positions=f.back>=3?['back','back','back']:f.back===2?['back','back','front']:['back','front','front'];s.attacker.formationAttack=999;
 const n=normalizePrebattleSettings(s);assert.equal(n.attacker.formationAttack,f.attack);assert.equal(n.attacker.formationDefense,f.defense);
 const r=calculatePrebattle(fixture(),s);assert.equal(r.breakdown[0].rows.find(r=>r.stat==='attack').formation,f.attack);}
 const s=settings();s.attacker.formation='protection';assert.throws(()=>normalizePrebattleSettings(s),/정원/);
});

test('Karam full skill damage reduction is 10 rather than its separate block bonus',()=>{
 const s=settings();s.attacker.pet='카람';const r=calculatePrebattle(fixture(),s);assert.equal(r.heroes[0].damageReduction,10);
});
test('Nezuko affiliation aura does not buff unrelated heroes',()=>{
 const s=settings();s.attacker.pet='네즈코';const r=calculatePrebattle(fixture(['연희','쥬리','윤건','탄지로','시노부','젠이츠']),s);
 assert.ok(!r.breakdown[0].rows.some(row=>row.bonuses?.some(b=>b.source==='네즈코')));
});
