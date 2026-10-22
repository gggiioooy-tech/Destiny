import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'collector-modes-'));
const source=path.resolve('tools/pc-collector');
const port=15367, base=`http://127.0.0.1:${port}`;
let child;
try{
 for(const name of ['server.mjs','connect.html','connect.css','connect.js'])fs.copyFileSync(path.join(source,name),path.join(root,name));
 fs.writeFileSync(path.join(root,'watch.mjs'),`import fs from 'node:fs';import {spawn} from 'node:child_process';const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});fs.writeFileSync(${JSON.stringify(path.join(root,'red-started'))},JSON.stringify([process.pid,child.pid]));setInterval(()=>{},1000);`);
 // Isolated fake auth service: never contacts Supabase and never uses a real session.
 fs.writeFileSync(path.join(root,'mock.mjs'),`globalThis.fetch=async(url,options)=>{if(url!=='https://kqygrszkbuzxmmfndhye.supabase.co/rest/v1/rpc/red_collector_access')throw Error('unexpected remote request');if(options.headers.Authorization==='Bearer fixture-owner-slow')await new Promise(r=>setTimeout(r,400));return new Response(JSON.stringify(options.headers.Authorization.startsWith('Bearer fixture-owner')),{status:200});};`);
 const payload={attacker:{skills:[{hero:'fixture'}]},defender:{skills:[]},heroSpeeds:{},heroHealth:{},heroStats:{},firstSkillSide:'attacker'};
 const status={attack:1,defense:0,held:0,records:[{kind:'battle',payload}]};
 for(const name of ['status.json','status-red.json'])fs.writeFileSync(path.join(root,name),JSON.stringify(status));
 const fakePython=path.join(root,'fixture-python');fs.writeFileSync(fakePython,'fixture');
 fs.writeFileSync(path.join(root,'capture-fixture.mjs'),"import fs from 'node:fs';fs.writeFileSync("+JSON.stringify(path.join(root,'capture-started'))+",String(process.pid));console.log('CAPTURE_READY');setInterval(()=>{},1000);");
 fs.appendFileSync(path.join(root,'mock.mjs'),"\nimport cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';const originalSpawn=cp.spawn;cp.spawn=(file,args,options)=>file==="+JSON.stringify(fakePython)+"?originalSpawn(process.execPath,["+JSON.stringify(path.join(root,'capture-fixture.mjs'))+"],options):originalSpawn(file,args,options);syncBuiltinESMExports();");
 fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({python:fakePython}));
 child=spawn(process.execPath,['--import',pathToFileURL(path.join(root,'mock.mjs')).href,path.join(root,'server.mjs')],{env:{...process.env,COLLECTOR_STATE_DIR:root,COLLECTOR_PORT:String(port)},stdio:'ignore',windowsHide:true});
 let initial;
 for(let n=0;n<30;n++){try{initial=await fetch(base+'/connect');break;}catch{await delay(100);}}
 assert.ok(initial?.ok,'fixture server started');
 const cookie=initial.headers.get('set-cookie').split(';')[0];
 const headers={Cookie:cookie,'X-Collector-Action':'start'};
 const owner={...headers,Authorization:'Bearer fixture-owner','X-Supabase-Key':'fixture-public-key'};
 const normal=await (await fetch(base+'/status',{headers})).json();
 for(const name of ['heroSpeeds','heroHealth','heroStats','firstSkillSide'])assert.ok(!(name in normal.records[0].payload));
 assert.deepEqual(normal.records[0].payload.attacker.skills,[]);
 assert.equal((await fetch(base+'/red/start',{method:'POST',headers})).status,403);
 assert.equal((await fetch(base+'/red/status',{headers:{...owner,Authorization:'Bearer fixture-member'}})).status,403);
 assert.ok(!fs.existsSync(path.join(root,'red-started')));
 const html=await (await fetch(base+'/red-connect')).text();assert.ok(html.includes('data-collector-mode="red"'));
 assert.equal((await fetch(base+'/red/start',{method:'POST',headers:owner})).status,200);
 for(let n=0;n<20&&!fs.existsSync(path.join(root,'red-started'));n++)await delay(50);
 assert.ok(fs.existsSync(path.join(root,'red-started')));
 const red=await (await fetch(base+'/red/status',{headers:owner})).json();assert.equal(red.captureActive,true);assert.equal(red.records[0].payload.firstSkillSide,'attacker');
 assert.ok(fs.existsSync(path.join(root,'capture-started')),'red starts passive capture automatically');
 const pids=[...JSON.parse(fs.readFileSync(path.join(root,'red-started'))),Number(fs.readFileSync(path.join(root,'capture-started'),'utf8'))];
 assert.equal((await fetch(base+'/red/stop',{method:'POST',headers:{Cookie:cookie,'X-Collector-Action':'stop'}})).status,200);
 await delay(100);for(const pid of pids)assert.throws(()=>process.kill(pid,0));
 assert.equal((await (await fetch(base+'/red/status',{headers:owner})).json()).captureActive,false);
 fs.unlinkSync(path.join(root,'red-started'));
 const pending=fetch(base+'/red/start',{method:'POST',headers:{...owner,Authorization:'Bearer fixture-owner-slow'}});
 await delay(100);assert.equal((await fetch(base+'/red/stop',{method:'POST',headers:{Cookie:cookie,'X-Collector-Action':'stop'}})).status,200);
 assert.equal((await pending).status,409);assert.ok(!fs.existsSync(path.join(root,'red-started')),'pending auth cannot restart after stop');
 console.log('PASS passive sanitization; unauthorized red blocked; owner red start/status/stop; owned analyzer terminated');
}finally{
 if(child){child.kill();await delay(150);}
 fs.rmSync(root,{recursive:true,force:true});
}
globalThis.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
globalThis.localStorage=globalThis.sessionStorage;
const vite=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try{
 const {default:Collector}=await vite.ssrLoadModule('/src/components/PcCollectorConnection.jsx');
 for(const user of [{role:'guest'},{role:'member'},{role:'admin',isOwner:false}]){
  assert.equal(renderToStaticMarkup(React.createElement(Collector,{currentUser:user,mode:'red'})),'');
  assert.ok(renderToStaticMarkup(React.createElement(Collector,{currentUser:user})).includes('PC 수집기'));
 }
 assert.ok(renderToStaticMarkup(React.createElement(Collector,{currentUser:{role:'admin',isOwner:true},mode:'red'})).includes('빨간약 수집기'));
 const summarize=fs.readFileSync(path.join(source,'summarize.py'),'utf8');assert.match(summarize,/if red_mode:\s+from replay_skills import enrich\s+enrich\(/);
 const watch=fs.readFileSync(path.join(source,'watch.mjs'),'utf8');assert.ok(watch.includes("...(redMode?['--allow-replay']:[])"));
 console.log('PASS tier 1/2/3 red UI absent; tier 4 allowed; replay import and enrichment require explicit red mode');
}finally{await vite.close();}
