// Local-only prototype. No site credentials, game login, packet injection or remote service.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const stateDir=process.env.COLLECTOR_STATE_DIR || path.join(process.env.LOCALAPPDATA || here,'15month-collector');
const port=Number(process.env.COLLECTOR_PORT||15150);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port');
const host=`127.0.0.1:${port}`;
const cookie=randomBytes(32).toString('hex');
fs.mkdirSync(stateDir,{recursive:true});
function updateInfo(){try{return fs.readFileSync(path.join(here,'update-status.txt'),'utf8').slice(0,300);}catch{return '수집기를 실행할 때 새 버전을 확인합니다.';}}
let capture=null,captureStatus='수집 시작 버튼을 눌러 주세요.';
let captureIssue='';
let settingUp=false,periodSyncStatus='매칭 정보 연결 대기';
function readPeriods(){try{return JSON.parse(fs.readFileSync(path.join(stateDir,'match-periods.json'),'utf8'));}catch{return [];}}

function mergePeriods(periods,config,file){
      if(!Array.isArray(periods)||periods.length>60||periods.some(p=>p.guild!==config.guild||!/^\d{4}-\d{2}-\d{2}$/.test(p.warDate)||typeof p.opponent!=='string'||p.opponent.length>80||!Number.isFinite(Date.parse(p.from))||!Number.isFinite(Date.parse(p.until))||Date.parse(p.until)<=Date.parse(p.from)||Date.parse(p.until)-Date.parse(p.from)>172800000))throw new Error('매칭 날짜 또는 길드 설정이 일치하지 않습니다.');
      const merged=new Map((config.periods||[]).filter(p=>p.guild===config.guild).map(p=>[p.warDate,p]));for(const p of periods)merged.set(p.warDate,p);
      config.periods=[...merged.values()].sort((a,b)=>a.warDate.localeCompare(b.warDate)).slice(-60);
      if(JSON.stringify(config)!==JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')))){
        fs.writeFileSync(file+'.tmp',JSON.stringify(config));fs.renameSync(file+'.tmp',file);
      }

  periodSyncStatus=`${config.guild} 매칭 ${config.periods.length}개 적용됨`;
}
async function stopCapture(){
  const previous=capture;if(!previous)return;
  await new Promise((resolve,reject)=>{const stop=spawn('taskkill.exe',['/PID',String(previous.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});const timeout=setTimeout(()=>{stop.kill();reject(new Error('stop timeout'));},5000);stop.once('error',e=>{clearTimeout(timeout);reject(e);});stop.once('exit',code=>{clearTimeout(timeout);if(code===0||capture!==previous)resolve();else reject(new Error('stop failed'));});});
  if(capture===previous)capture=null;
}

let redAnalyzer=null,redTimer=null,redAuth=null,redStatus='PC 수집기가 받은 전투 기록을 분석합니다.';
let redGeneration=0,redStopping=null;
async function isRedOwner(token,apikey){
 if(typeof token!=='string'||token.length>8192||!token.startsWith('Bearer ')||typeof apikey!=='string'||apikey.length>4096)return false;
 try{const r=await fetch('https://kqygrszkbuzxmmfndhye.supabase.co/rest/v1/rpc/red_collector_access',{method:'POST',headers:{Authorization:token,apikey,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(5000)});return r.ok&&(await r.json())===true;}catch{return false;}
}
async function stopRed(){
 redGeneration++;redAuth=null;clearTimeout(redTimer);
 if(redStopping)return redStopping;
 const child=redAnalyzer;
 redStopping=(async()=>{
  if(child)await new Promise((resolve,reject)=>{
   const stop=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
   const timeout=setTimeout(()=>{stop.kill();reject(new Error('종료 확인 시간이 초과됐습니다. 종료 버튼을 다시 눌러 주세요.'));},5000);
   stop.once('error',()=>{clearTimeout(timeout);reject(new Error('분석기를 종료하지 못했습니다. 종료 버튼을 다시 눌러 주세요.'));});
   stop.once('exit',code=>{clearTimeout(timeout);if(code===0)resolve();else reject(new Error('분석기 종료를 확인하지 못했습니다. 종료 버튼을 다시 눌러 주세요.'));});
  });
  if(redAnalyzer===child)redAnalyzer=null;
  redStatus='빨간약 수집 종료 · 분석과 리플레이 다운로드가 중단됐습니다.';
 })();
 try{await redStopping;}catch(e){redStatus=e.message;throw e;}finally{redStopping=null;}
}
function passiveStatus(data){
 const result=structuredClone(data);
 for(const row of result.records||[]){if(row.kind==='battle'){for(const key of ['heroSpeeds','heroHealth','heroStats','firstSkillSide'])delete row.payload?.[key];for(const side of ['attacker','defender'])if(row.payload?.[side])row.payload[side].skills=[];}}
 return result;
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self'; media-src https://i1.ruliweb.com; frame-ancestors 'none'; form-action 'none'; base-uri 'none'");
  const send=(status,type,body)=>{res.writeHead(status,{'Content-Type':type});res.end(body);};
  // Reject DNS rebinding, cross-origin API reads and all writes.
  if(req.headers.host!==host)return send(403,'text/plain','Forbidden');
  const url=new URL(req.url,`http://${host}`);
  const localAuthorized=req.headers.cookie===`collector=${cookie}` && (!req.headers.origin || req.headers.origin===`http://${host}`) && (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site']==='same-origin');
  if(url.pathname==='/red/stop'&&req.method==='POST'){
    if(!localAuthorized||req.headers['x-collector-action']!=='stop')return send(403,'text/plain','Forbidden');
    try{await stopRed();return send(200,'application/json; charset=utf-8',JSON.stringify({message:redStatus}));}catch(e){return send(500,'application/json; charset=utf-8',JSON.stringify({message:e.message}));}
  }
  if((url.pathname==='/red/start'&&req.method==='POST')||(url.pathname==='/red/status'&&req.method==='GET')){
    if(!localAuthorized||(req.method==='POST'&&req.headers['x-collector-action']!=='start'))return send(403,'text/plain','Forbidden');
    const generation=redGeneration;
    if(!await isRedOwner(req.headers.authorization,req.headers['x-supabase-key'])){await stopRed().catch(()=>{});return send(403,'application/json; charset=utf-8',JSON.stringify({message:'권한등급 4등급만 빨간약 수집기를 사용할 수 있습니다.'}));}
    if(req.method==='POST'&&(generation!==redGeneration||redStopping))return send(409,'application/json; charset=utf-8',JSON.stringify({message:'수집 시작이 취소됐습니다.'}));
    if(redAnalyzer)redAuth={token:req.headers.authorization,apikey:req.headers['x-supabase-key']};
    if(req.method==='POST'){
      if(!fs.existsSync(path.join(stateDir,'config.json')))return send(400,'application/json; charset=utf-8',JSON.stringify({message:'먼저 PC 수집기를 연결해 전투 기록을 수집해 주세요.'}));
      if(!redAnalyzer){
        const child=spawn(process.execPath,[path.join(here,'watch.mjs'),'--red'],{windowsHide:true,stdio:'ignore'});redAnalyzer=child;redStatus='빨간약 수집 중 · PC 수집기가 받은 리플레이를 분석합니다.';
        child.on('error',()=>{if(redAnalyzer===child){redAnalyzer=null;redStatus='빨간약 분석기를 실행하지 못했습니다.';}});
        child.on('exit',()=>{if(redAnalyzer===child&&!redStopping){redAnalyzer=null;redStatus='빨간약 분석이 종료됐습니다.';}});
        redTimer=setTimeout(()=>{void stopRed().catch(()=>{});},600000);
      }
      redAuth={token:req.headers.authorization,apikey:req.headers['x-supabase-key']};
      return send(200,'application/json; charset=utf-8',JSON.stringify({message:redStatus}));
    }
    let data={attack:0,defense:0,held:0,records:[],updatedAt:null};try{data=JSON.parse(fs.readFileSync(path.join(stateDir,'status-red.json'),'utf8'));}catch{}
    data.captureActive=Boolean(redAnalyzer);data.captureStatus=redStatus;data.needsSetup=!fs.existsSync(path.join(stateDir,'config.json'));data.supportsPeriods=true;data.periods=readPeriods();data.periodSyncStatus=periodSyncStatus;data.updateStatus=updateInfo();data.collectorVersion='2026.10.21.4';data.collectorMode='red';
    try{data.captureIssue=fs.readFileSync(path.join(stateDir,'decode-red-error.txt'),'utf8');}catch{}
    return send(200,'application/json; charset=utf-8',JSON.stringify(data));
  }
  if(url.pathname==='/setup' && req.method==='POST'){
    if(!localAuthorized || req.headers['x-collector-action']!=='setup')return send(403,'text/plain','Forbidden');
    if(settingUp)return send(409,'application/json','{"message":"자동 설정 진행 중"}');
    let body='';req.on('data',b=>{body+=b;if(body.length>65536)req.destroy();});
    req.on('end',()=>{
      let profile;try{profile=JSON.parse(body);if(!/^[a-f0-9]{64}$/.test(profile.key)||!/^[a-f0-9]{32}$/.test(profile.iv)||typeof profile.guild!=='string'||!profile.guild.trim()||profile.guild.length>80)throw new Error();}catch{return send(400,'application/json','{"message":"설정 정보 오류"}');}
      try{
        if(fs.existsSync(path.join(stateDir,'config.json'))){
          const file=path.join(stateDir,'config.json');const config=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
          config.guild=profile.guild;
          mergePeriods(profile.periods||[],config,file);
          return send(200,'application/json',JSON.stringify({ready:true,message:periodSyncStatus}));
        }
      }catch(e){periodSyncStatus=e.message;return send(400,'application/json',JSON.stringify({message:periodSyncStatus}));}
      const python=path.join(here,'python','python.exe');
      if(!fs.existsSync(python))return send(400,'application/json',JSON.stringify({message:'최신 설치 파일을 다시 실행해 주세요.'}));
      settingUp=true;captureStatus='설치된 게임에서 수집 설정을 준비하는 중…';
      const child=spawn(python,[path.join(here,'setup_game.py'),stateDir],{windowsHide:true,stdio:['pipe','ignore','ignore']});
      child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({key:profile.key,iv:profile.iv,guild:profile.guild,periods:profile.periods||[]}));
      let finished=false;const finish=ok=>{if(finished)return;finished=true;settingUp=false;captureStatus=ok?'자동 설정 완료 · 수집 시작 가능':'자동 설정 실패 · 게임 실행 후 다시 연결해 주세요.';if(ok){const watcher=spawn(process.execPath,[path.join(here,'watch.mjs')],{windowsHide:true,stdio:'ignore'});watcher.on('error',()=>{});}send(ok?200:400,'application/json',JSON.stringify({ready:ok,message:captureStatus}));};
      child.on('error',()=>finish(false));child.on('exit',code=>finish(code===0));
    });return;
  }
  if(url.pathname==='/periods' && req.method==='POST'){
    if(!localAuthorized||req.headers['x-collector-action']!=='periods')return send(403,'text/plain','Forbidden');
    let body='';req.on('data',b=>{body+=b;if(body.length>65536)req.destroy();});
    req.on('end',()=>{try{
      const periods=JSON.parse(body);const file=path.join(stateDir,'config.json');const config=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
      mergePeriods(periods,config,file);
      send(200,'application/json','{"ready":true}');
    }catch(e){periodSyncStatus='매칭 동기화 실패: '+(e.code||e.message||'설정 확인 필요');send(400,'application/json',JSON.stringify({message:periodSyncStatus}));}});return;
  }
  if(url.pathname==='/capture/stop' && req.method==='POST'){
    if(!localAuthorized||req.headers['x-collector-action']!=='stop')return send(403,'text/plain','Forbidden');
    try{await stopCapture();captureIssue='';captureStatus='수집을 종료했어요. 저장된 기록은 그대로 유지됩니다.';return send(200,'application/json; charset=utf-8',JSON.stringify({message:captureStatus}));}
    catch{return send(409,'application/json; charset=utf-8',JSON.stringify({message:'수집 종료에 실패했어요. 다시 눌러 주세요.'}));}
  }
  if(url.pathname==='/capture' && req.method==='POST'){
    if(!localAuthorized || req.headers['x-collector-action']!=='start')return send(403,'text/plain','Forbidden');
    if(capture&&req.headers['x-collector-restart']==='true'){
      try{await stopCapture();}catch{return send(409,'application/json; charset=utf-8',JSON.stringify({message:'이전 수집을 정리하지 못했어요. 잠시 후 다시 눌러 주세요.'}));}
    }
    if(capture)return send(200,'application/json',JSON.stringify({message:captureStatus}));
    try{
      const config=JSON.parse(fs.readFileSync(path.join(stateDir,'config.json'),'utf8').replace(/^\uFEFF/,''));
      if(!config.python || !fs.existsSync(config.python))throw new Error();
      captureIssue='';captureStatus='게임 연결 확인 중…';
      const child=spawn(config.python,['-u',path.join(here,'capture.py'),stateDir],{windowsHide:true,stdio:['ignore','pipe','pipe']});capture=child;
      child.stdout.on('data',b=>{if(b.toString().includes('CAPTURE_RECONNECT'))captureStatus='게임 연결 대기 · 재접속하면 자동으로 다시 수집합니다.';if(b.toString().includes('CAPTURE_READY'))captureStatus='수집 중 · 게임에서 전장과 기록 목록을 열어 주세요. (최대 10분)';});
      child.stderr.on('data',b=>{if(capture!==child)return;const detail=b.toString();captureIssue=/wpcap|Npcap|DLL|CAPTURE_OPEN_FAILED/i.test(detail)?'Npcap 장치에 접근하지 못했어요. Npcap 설치 상태와 관리자 권한을 확인해 주세요.':/PermissionError|Access is denied|permission denied/i.test(detail)?'수집 파일 또는 장치 접근 권한이 없어요. 프로그램 실행 권한을 확인해 주세요.':/ModuleNotFoundError|No module named/i.test(detail)?'게임 수집에 필요한 라이브러리가 없어요. 최신 설치 파일로 다시 설치해 주세요.':'게임 데이터 수집 중 오류가 발생했어요. 게임 실행 상태를 확인하고 수집 시작을 다시 눌러 주세요.';});
      child.on('error',()=>{if(capture!==child)return;captureStatus='수집 프로그램 실행 실패';capture=null;});
      child.on('exit',code=>{if(capture!==child)return;capture=null;captureStatus=code===0?'수집 완료 · 다시 수집하려면 수집 시작을 누르세요.':'수집 실패 · 게임 실행, Npcap 및 PC 설정을 확인해 주세요.';});
      return send(200,'application/json',JSON.stringify({message:captureStatus}));
    }catch{return send(400,'application/json',JSON.stringify({message:'이 PC의 게임 수집 설정이 필요합니다.'}));}
  }
  if(req.method!=='GET')return send(403,'text/plain','Forbidden');
  if(url.pathname==='/status'){
    if(req.headers.cookie!==`collector=${cookie}` || (req.headers.origin && req.headers.origin!==`http://${host}`) || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site']!=='same-origin'))return send(403,'text/plain','Forbidden');
    try {
      const data=JSON.parse(fs.readFileSync(path.join(stateDir,'status.json'),'utf8'));
      data.captureIssue=captureIssue;data.updateStatus=updateInfo();data.captureStatus=captureStatus;data.captureActive=Boolean(capture);data.settingUp=settingUp;
      data.periods=readPeriods();
      data.supportsPeriods=true;data.collectorVersion='2026.10.21.4';data.periodSyncStatus=periodSyncStatus;
      data.needsSetup=!fs.existsSync(path.join(stateDir,'config.json'));
      const field=(data.records||[]).find(r=>r.kind==='defense_snapshot')?.payload;
      if(field){const castles=['외성1','외성2','외성3','외성4','외성5','내성1','내성2','내성3','본성'];const missing=castles.filter(c=>!field.defenses.some(d=>d.castle===c));data.captureStatus+=` · 상대 방어팀 ${field.defenses.length}/${field.total}개${missing.length?' · 미수집: '+missing.join(', '):''}`;}
      for(const file of ['decode-error.txt','match-warning.txt'])try{const error=fs.readFileSync(path.join(stateDir,file),'utf8');if(error)data.captureStatus+=' · '+error;}catch{}
      return send(200,'application/json; charset=utf-8',JSON.stringify(passiveStatus(data)));
    }catch{return send(200,'application/json; charset=utf-8',JSON.stringify({attack:0,defense:0,held:0,supportsPeriods:true,collectorVersion:'2026.10.21.4',periodSyncStatus,periods:readPeriods(),needsSetup:!fs.existsSync(path.join(stateDir,'config.json')),captureIssue,updateStatus:updateInfo(),captureStatus,captureActive:Boolean(capture),settingUp,lastReceivedAt:null,reason:'게임을 실행하고 사이트에 연결하면 자동으로 설정합니다.',updatedAt:null,groups:[],records:[]}));}
  }
  const assets={'/red-connect':['connect.html','text/html; charset=utf-8'],'/connect':['connect.html','text/html; charset=utf-8'],'/connect.js':['connect.js','text/javascript; charset=utf-8'],'/connect.css':['connect.css','text/css; charset=utf-8']};
  const asset=assets[url.pathname];
  if(!asset)return send(404,'text/plain','Not found');
  if(url.pathname==='/connect'||url.pathname==='/red-connect')res.setHeader('Set-Cookie',`collector=${cookie}; HttpOnly; SameSite=Strict; Path=/`);
  let body=fs.readFileSync(path.join(here,asset[0]));if(url.pathname==='/red-connect')body=body.toString('utf8').replace('<body>','<body data-collector-mode="red">').replace('<title>15월 PC 수집기</title>','<title>15월 빨간약 수집기</title>');send(200,asset[1],body);
});
const redLease=setInterval(async()=>{if(redAnalyzer&&(!redAuth||!await isRedOwner(redAuth.token,redAuth.apikey)))await stopRed().catch(()=>{});},15000);redLease.unref();
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'이미 PC 연결 창이 실행 중입니다.':'PC 연결 창을 시작하지 못했습니다.');process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`15월 PC 연결 준비: http://${host}/connect`));
