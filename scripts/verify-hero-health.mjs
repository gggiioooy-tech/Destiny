import {createServer} from 'vite';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import assert from 'node:assert/strict';
globalThis.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try{const {BattleSide}=await server.ssrLoadModule('/src/components/GuildWarPage.jsx');const {collectorRecord}=await server.ssrLoadModule('/src/lib/collectorRecords.js');
 const side={nickname:'test',heroIds:[400597,401997,401987],heroes:['아일린','젠이츠','탄지로'],petId:0,pet:'없음',skills:[]};const props={side,showHeroSpeeds:true,heroSpeeds:[{heroId:400597,value:25}],heroHealth:[{heroId:400597,value:123456}]};
 const owner=renderToStaticMarkup(React.createElement(BattleSide,props));assert.ok(owner.includes('빨간약'));assert.ok(owner.includes('빨간약닫기'));assert.ok(!owner.includes('영웅별 속공'));assert.ok(!owner.includes('영웅별 생명력'));assert.ok(owner.includes('123,456'));
 for(const extra of [{showHeroSpeeds:false},{hideSpeed:true}]){const html=renderToStaticMarkup(React.createElement(BattleSide,{...props,...extra}));assert.ok(!html.includes('빨간약'));assert.ok(!html.includes('123,456'));}
 const row={kind:'battle',sourceKey:'pc-v1:'+ 'a'.repeat(64),occurredAt:'2026-10-19T04:00:00Z',payload:{sourceGuild:'서리',warDate:'2026-10-19',direction:'attack',castle:'본성',attackerWon:true,opponentGuild:'fixture',attacker:side,defender:side,heroHealth:{attacker:[{heroId:400597,value:123456}],defender:[]}}};assert.equal(collectorRecord(row,'서리').p_payload.heroHealth.attacker[0].value,123456);
 for(const bad of [-1,1.5,2147483648]){const copy=structuredClone(row);copy.payload.heroHealth.attacker[0].value=bad;assert.throws(()=>collectorRecord(copy,'서리'));}
 row.payload.heroStats={attacker:[{heroId:400597,stats:{physicalAttack:3116,critical:230,hp:5589}}],defender:[]};assert.equal(collectorRecord(row,'서리').p_payload.heroStats.attacker[0].stats.physicalAttack,3116);for(const bad of [{heroId:99},{stats:{injected:1}},{stats:{hp:1.5}},{stats:{hp:2147483648}}]){const copy=structuredClone(row);Object.assign(copy.payload.heroStats.attacker[0],bad);assert.throws(()=>collectorRecord(copy,'서리'));}
 const saved=structuredClone(row);
 row.payload.firstSkillSide='attacker';
 row.payload.attacker={...side,skills:[{hero:side.heroes[0],heroId:side.heroIds[0],skill:'1스',skillType:2,order:1}]};
 const ordinary=collectorRecord(row,'서리',{includeReplay:false}).p_payload;
 for(const key of ['heroStats','heroHealth','heroSpeeds'])assert.ok(!(key in ordinary));
 assert.equal(ordinary.firstSkillSide,null);assert.deepEqual(ordinary.attacker.skills,[]);
 assert.deepEqual(row.payload.heroStats,saved.payload.heroStats);
 assert.equal(collectorRecord(row,'서리',{includeReplay:true}).p_payload.heroStats.attacker[0].stats.physicalAttack,3116);
 assert.ok(owner.includes('이전 분석 정보는 유지됩니다'));
 console.log('PASS owner display, lower tier privacy, stat validation, ordinary upload strips replay fields without mutating source');
}finally{await server.close();}
