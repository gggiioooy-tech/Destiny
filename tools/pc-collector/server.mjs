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
      data.supportsPeriods=true;data.collectorVersion='2026.10.21.1';data.periodSyncStatus=periodSyncStatus;
      data.needsSetup=!fs.existsSync(path.join(stateDir,'config.json'));
      const field=(data.records||[]).find(r=>r.kind==='defense_snapshot')?.payload;
      if(field){const castles=['외성1','외성2','외성3','외성4','외성5','내성1','내성2','내성3','본성'];const missing=castles.filter(c=>!field.defenses.some(d=>d.castle===c));data.captureStatus+=` · 상대 방어팀 ${field.defenses.length}/${field.total}개${missing.length?' · 미수집: '+missing.join(', '):''}`;}
      for(const file of ['decode-error.txt','match-warning.txt'])try{const error=fs.readFileSync(path.join(stateDir,file),'utf8');if(error)data.captureStatus+=' · '+error;}catch{}
      return send(200,'application/json; charset=utf-8',JSON.stringify(data));
    }catch{return send(200,'application/json; charset=utf-8',JSON.stringify({attack:0,defense:0,held:0,supportsPeriods:true,collectorVersion:'2026.10.21.1',periodSyncStatus,periods:readPeriods(),needsSetup:!fs.existsSync(path.join(stateDir,'config.json')),captureIssue,updateStatus:updateInfo(),captureStatus,captureActive:Boolean(capture),settingUp,lastReceivedAt:null,reason:'게임을 실행하고 사이트에 연결하면 자동으로 설정합니다.',updatedAt:null,groups:[],records:[]}));}
  }
  const assets={'/connect':['connect.html','text/html; charset=utf-8'],'/connect.js':['connect.js','text/javascript; charset=utf-8'],'/connect.css':['connect.css','text/css; charset=utf-8']};
  const asset=assets[url.pathname];
  if(!asset)return send(404,'text/plain','Not found');
  if(url.pathname==='/connect')res.setHeader('Set-Cookie',`collector=${cookie}; HttpOnly; SameSite=Strict; Path=/`);
  send(200,asset[1],fs.readFileSync(path.join(here,asset[0])));
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'이미 PC 연결 창이 실행 중입니다.':'PC 연결 창을 시작하지 못했습니다.');process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`15월 PC 연결 준비: http://${host}/connect`));
