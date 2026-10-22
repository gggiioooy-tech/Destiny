import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
  const {default:Arena}=await vite.ssrLoadModule('/src/components/BattleArena.jsx');
  const {default:Simulation}=await vite.ssrLoadModule('/src/components/ExperimentalBattle.jsx');
  const {prepareHeroes,createBattle,advanceBattle}=await vite.ssrLoadModule('/src/lib/experimentalBattle.js');
  const draft=prepareHeroes(),battle=advanceBattle(createBattle(draft));
  const html=renderToStaticMarkup(React.createElement(Arena,{draft,battle,running:true}));
  assert.equal((html.match(/class="battle-fighter battle-slot-/g)||[]).length,6);
  assert.equal((html.match(/role="progressbar"/g)||[]).length,6);
  assert.ok(html.includes('battle-floating'));assert.ok(html.includes('battle-skill-banner'));
  assert.ok(html.includes('aria-valuenow='));assert.ok(html.includes('no-referrer'));
  for(const currentUser of [null,{role:'member'},{role:'admin',isOwner:false}])assert.equal(renderToStaticMarkup(React.createElement(Simulation,{currentUser})), '');
  const owner=renderToStaticMarkup(React.createElement(Simulation,{currentUser:{role:'admin',isOwner:true}}));
  assert.ok(owner.includes('176종 영웅 선택'));assert.ok(owner.includes('전투 종료'));assert.ok(owner.includes('스킬·패시브 자료'));
  const stopped=renderToStaticMarkup(React.createElement(Arena,{draft,battle:{...battle,done:true,stopped:true,winner:null},running:false}));
  assert.ok(stopped.includes('사용자가 전투를 종료했습니다'));assert.ok(stopped.includes('전투 중단'));
  console.log('PASS six fighters, HP bars, action/impact markup, manual stop, roster setup and tier-four UI guard');
}finally{await vite.close();}
