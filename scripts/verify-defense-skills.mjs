import {createServer} from 'vite';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import assert from 'node:assert/strict';
globalThis.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try{
 const {DefenseGroups}=await server.ssrLoadModule('/src/components/GuildWarPage.jsx');const {default:DefenseSkillView}=await server.ssrLoadModule('/src/components/DefenseSkillView.jsx');const {loadDefenseStartSkills}=await server.ssrLoadModule('/src/lib/defenseStartSkills.js');const {supabase}=await server.ssrLoadModule('/src/lib/supabase.js');const {collectorRecord}=await server.ssrLoadModule('/src/lib/collectorRecords.js');
 const defense={castle:'외성1',nickname:'fixture',heroIds:[400597,401997,401987],heroes:['아일린','젠이츠','탄지로'],petId:0,pet:'없음',skills:[{heroId:400597,skillType:2,order:1}]};const snapshot={id:'fixture',occurred_at:'2026-10-21T00:00:00Z',payload:{defenses:[defense],total:1}};
 let calls=0;const original=supabase.from;supabase.from=()=>{calls++;return {select(){return this},eq(){return this},abortSignal(){return this},async maybeSingle(){return {data:{skills:[{index:0,skills:defense.skills}]},error:null}}}};
 try{
  for(const user of [{role:'guest',isOwner:false},{role:'member',isOwner:false},{role:'admin',isOwner:false},{role:'member',isOwner:true}]){
   const html=renderToStaticMarkup(React.createElement(DefenseGroups,{snapshot,counterTeams:[],castle:'',search:'',currentUser:user}));assert.ok(!html.includes('스킬보기'));
   assert.equal(renderToStaticMarkup(React.createElement(DefenseSkillView,{snapshot,currentUser:user})), '');assert.deepEqual(await loadDefenseStartSkills('fixture',user),[]);
  }
  assert.equal(calls,0);const owner={role:'admin',isOwner:true};assert.ok(renderToStaticMarkup(React.createElement(DefenseGroups,{snapshot,counterTeams:[],castle:'',search:'',currentUser:owner})).includes('스킬보기'));assert.equal((await loadDefenseStartSkills('fixture',owner)).length,1);assert.equal(calls,1);
 }finally{supabase.from=original;}
 const args=collectorRecord({kind:'defense_snapshot',sourceKey:'pc-v1:'+'a'.repeat(64),occurredAt:'2026-10-21T00:00:00Z',payload:{sourceGuild:'서리',warDate:'2026-10-21',defenses:[defense],total:1}},'서리');assert.ok(!('skills' in args.p_payload.defenses[0]));assert.deepEqual(args.p_payload.defenseSkills,[{index:0,skills:defense.skills}]);
 console.log('PASS tiers 1/2/3: no button, no content, no fetch; tier 4 allowed; private/public payload separated');
}finally{await server.close();}
