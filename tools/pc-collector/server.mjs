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
let capture=null,captureStatus='수집 시작 버튼을 눌러 주세요.';
let settingUp=false;
const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self'; frame-ancestors 'none'; form-action 'none'; base-uri 'none'");
  const send=(status,type,body)=>{res.writeHead(status,{'Content-Type':type});res.end(body);};
  // Reject DNS rebinding, cross-origin API reads and all writes.
  if(req.headers.host!==host)return send(403,'text/plain','Forbidden');
  const url=new URL(req.url,`http://${host}`);
  const localAuthorized=req.headers.cookie===`collector=${cookie}` && (!req.headers.origin || req.headers.origin===`http://${host}`) && (!req.headers['sec-fetch-site'] || req.headers['sec-fetch-site']==='same-origin');
  if(url.pathname==='/setup' && req.method==='POST'){
    if(!localAuthorized || req.headers['x-collector-action']!=='setup')return send(403,'text/plain','Forbidden');
    if(fs.existsSync(path.join(stateDir,'config.json')))return send(200,'application/json','{"ready":true}');
    if(settingUp)return send(409,'application/json','{"message":"자동 설정 진행 중"}');
    let body='';req.on('data',b=>{body+=b;if(body.length>2048)req.destroy();});
    req.on('end',()=>{
      let profile;try{profile=JSON.parse(body);if(!/^[a-f0-9]{64}$/.test(profile.key)||!/^[a-f0-9]{32}$/.test(profile.iv)||typeof profile.guild!=='string'||!profile.guild.trim()||profile.guild.length>80)throw new Error();}catch{return send(400,'application/json','{"message":"설정 정보 오류"}');}
      const python=path.join(here,'python','python.exe');
      if(!fs.existsSync(python))return send(400,'application/json',JSON.stringify({message:'최신 설치 파일을 다시 실행해 주세요.'}));
      settingUp=true;captureStatus='설치된 게임에서 수집 설정을 준비하는 중…';
      const child=spawn(python,[path.join(here,'setup_game.py'),stateDir],{windowsHide:true,stdio:['pipe','ignore','ignore']});
      child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({key:profile.key,iv:profile.iv,guild:profile.guild}));
      let finished=false;const finish=ok=>{if(finished)return;finished=true;settingUp=false;captureStatus=ok?'자동 설정 완료 · 수집 시작 가능':'자동 설정 실패 · 게임 실행 후 다시 연결해 주세요.';if(ok){const watcher=spawn(process.execPath,[path.join(here,'watch.mjs')],{windowsHide:true,stdio:'ignore'});watcher.on('error',()=>{});}send(ok?200:400,'application/json',JSON.stringify({ready:ok,message:captureStatus}));};
      child.on('error',()=>finish(false));child.on('exit',code=>finish(code===0));
    });return;
  }
  if(url.pathname==='/periods' && req.method==='POST'){
    if(!localAuthorized||req.headers['x-collector-action']!=='periods')return send(403,'text/plain','Forbidden');
    let body='';req.on('data',b=>{body+=b;if(body.length>65536)req.destroy();});
    req.on('end',()=>{try{
      const periods=JSON.parse(body);const file=path.join(stateDir,'config.json');const config=JSON.parse(fs.readFileSync(file,'utf8'));
      if(!Array.isArray(periods)||periods.length>60||periods.some(p=>p.guild!==config.guild||!/^\d{4}-\d{2}-\d{2}$/.test(p.warDate)||typeof p.opponent!=='string'||p.opponent.length>80||!Number.isFinite(Date.parse(p.from))||!Number.isFinite(Date.parse(p.until))||Date.parse(p.until)<=Date.parse(p.from)||Date.parse(p.until)-Date.parse(p.from)>172800000))throw new Error();
      const merged=new Map((config.periods||[]).map(p=>[p.warDate,p]));for(const p of periods)merged.set(p.warDate,p);
      config.periods=[...merged.values()].sort((a,b)=>a.warDate.localeCompare(b.warDate)).slice(-60);
      if(JSON.stringify(config.periods)!==JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8')).periods)){
        fs.writeFileSync(file+'.tmp',JSON.stringify(config));fs.renameSync(file+'.tmp',file);
      }
      send(200,'application/json','{"ready":true}');
    }catch{send(400,'application/json','{"message":"매칭 정보 동기화 실패"}');}});return;
  }
  if(url.pathname==='/capture' && req.method==='POST'){
    if(!localAuthorized || req.headers['x-collector-action']!=='start')return send(403,'text/plain','Forbidden');
    if(capture)return send(200,'application/json',JSON.stringify({message:captureStatus}));
    try{
      const config=JSON.parse(fs.readFileSync(path.join(stateDir,'config.json'),'utf8').replace(/^\uFEFF/,''));
      if(!config.python || !fs.existsSync(config.python))throw new Error();
      captureStatus='게임 연결 확인 중…';
      const child=spawn(config.python,['-u',path.join(here,'capture.py'),stateDir],{windowsHide:true,stdio:['ignore','pipe','pipe']});capture=child;
      child.stdout.on('data',b=>{if(b.toString().includes('CAPTURE_RECONNECT'))captureStatus='게임 연결 대기 · 재접속하면 자동으로 다시 수집합니다.';if(b.toString().includes('CAPTURE_READY'))captureStatus='수집 중 · 게임에서 전장과 기록 목록을 열어 주세요. (최대 10분)';});
      child.stderr.on('data',()=>{captureStatus='수집 실패 · 게임 실행, Npcap 및 PC 설정을 확인해 주세요.';});
      child.on('error',()=>{captureStatus='수집 프로그램 실행 실패';capture=null;});
      child.on('exit',code=>{capture=null;captureStatus=code===0?'수집 완료 · 다시 수집하려면 수집 시작을 누르세요.':'수집 실패 · 게임 실행, Npcap 및 PC 설정을 확인해 주세요.';});
      return send(200,'application/json',JSON.stringify({message:captureStatus}));
    }catch{return send(400,'application/json',JSON.stringify({message:'이 PC의 게임 수집 설정이 필요합니다.'}));}
  }
  if(req.method!=='GET')return send(403,'text/plain','Forbidden');
  if(url.pathname==='/status'){
    if(req.headers.cookie!==`collector=${cookie}` || (req.headers.origin && req.headers.origin!==`http://${host}`) || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site']!=='same-origin'))return send(403,'text/plain','Forbidden');
    try {
      const data=JSON.parse(fs.readFileSync(path.join(stateDir,'status.json'),'utf8'));
      data.captureStatus=captureStatus;
      try{data.periods=JSON.parse(fs.readFileSync(path.join(stateDir,'match-periods.json'),'utf8'));}catch{data.periods=[];}
      data.supportsPeriods=true;
      data.needsSetup=!fs.existsSync(path.join(stateDir,'config.json'));
      const field=(data.records||[]).find(r=>r.kind==='defense_snapshot')?.payload;
      if(field){const castles=['외성1','외성2','외성3','외성4','외성5','내성1','내성2','내성3','본성'];const missing=castles.filter(c=>!field.defenses.some(d=>d.castle===c));data.captureStatus+=` · 상대 방어팀 ${field.defenses.length}/${field.total}개${missing.length?' · 미수집: '+missing.join(', '):''}`;}
      try{const error=fs.readFileSync(path.join(stateDir,'decode-error.txt'),'utf8');if(error)data.captureStatus+=' · '+error;}catch{}
      return send(200,'application/json; charset=utf-8',JSON.stringify(data));
    }catch{return send(200,'application/json; charset=utf-8',JSON.stringify({attack:0,defense:0,held:0,supportsPeriods:true,periods:[],needsSetup:!fs.existsSync(path.join(stateDir,'config.json')),captureStatus,reason:'게임을 실행하고 사이트에 연결하면 자동으로 설정합니다.',updatedAt:null,groups:[],records:[]}));}
  }
  const assets={'/connect':['connect.html','text/html; charset=utf-8'],'/connect.js':['connect.js','text/javascript; charset=utf-8'],'/connect.css':['connect.css','text/css; charset=utf-8']};
  const asset=assets[url.pathname];
  if(!asset)return send(404,'text/plain','Not found');
  if(url.pathname==='/connect')res.setHeader('Set-Cookie',`collector=${cookie}; HttpOnly; SameSite=Strict; Path=/`);
  send(200,asset[1],fs.readFileSync(path.join(here,asset[0])));
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'이미 PC 연결 창이 실행 중입니다.':'PC 연결 창을 시작하지 못했습니다.');process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`15월 PC 연결 준비: http://${host}/connect`));
