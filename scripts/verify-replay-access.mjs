import fs from 'node:fs';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
globalThis.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
globalThis.localStorage=globalThis.sessionStorage;
const vite=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try{
 const {default:Page}=await vite.ssrLoadModule('/src/components/ReplaySimulationPage.jsx');
 const {loadReplayExamples,loadReplayReport,validateReplayReport}=await vite.ssrLoadModule('/src/lib/replaySimulation.js');
 const {replayDocument}=await vite.ssrLoadModule('/src/lib/replayTimelineTemplate.js');
 const {supabase,SUPABASE_ANON_KEY}=await vite.ssrLoadModule('/src/lib/supabase.js');
 let calls=0;const original=supabase.from;
 supabase.from=()=>{calls++;throw Error('unexpected data access');};
 for(const currentUser of [null,{role:'guest'},{role:'member'},{role:'admin',isOwner:false},{role:'member',isOwner:true}]){
  assert.equal(renderToStaticMarkup(React.createElement(Page,{currentUser})),'');
  assert.deepEqual(await loadReplayExamples(currentUser),[]);assert.equal(await loadReplayReport('fixture',currentUser),null);
 }
 assert.equal(calls,0);supabase.from=original;
 assert.ok(renderToStaticMarkup(React.createElement(Page,{currentUser:{id:'fixture',role:'admin',isOwner:true}})).includes('시뮬레이션'));
 const report=JSON.parse(fs.readFileSync('tmp/replay-analysis-20261019-224354/timeline.json','utf8'));
 assert.equal(validateReplayReport(report),report);
 for(const mutate of [r=>r.prediction=true,r=>r.heroes[0].stats=null,r=>r.timeline[0].statuses=[{}],r=>r.timeline[0].results[0].target=-123]){
  const bad=structuredClone(report);mutate(bad);assert.throws(()=>validateReplayReport(bad));
 }
 const malicious=structuredClone(report);malicious.heroes[0].name="</script><script>alert('bad')</script> $& $'";
 const html=replayDocument(malicious);assert.ok(!html.includes("<script>alert('bad')"));
 const data=JSON.parse(html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1]);assert.equal(data.heroes[0].name,malicious.heroes[0].name);
 assert.ok(html.includes('default-src \'none\''));
 const r=await fetch('https://kqygrszkbuzxmmfndhye.supabase.co/rest/v1/guild_war_replay_analyses?select=id',{headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY}});
 assert.equal(r.status,401);
 console.log('PASS lower tiers: no UI and no data fetch; tier 4 UI allowed; malformed data rejected; sandbox injection escaped; anonymous API blocked');
}finally{await vite.close();}
