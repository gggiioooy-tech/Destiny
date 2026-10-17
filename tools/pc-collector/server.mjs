// Local-only prototype. No site credentials, game login, packet injection or remote service.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const stateDir=process.env.COLLECTOR_STATE_DIR || path.join(process.env.LOCALAPPDATA || here,'15month-collector');
const host='127.0.0.1:15150';
const cookie=randomBytes(32).toString('hex');
fs.mkdirSync(stateDir,{recursive:true});
let capture=null,captureStatus='수집 시작 버튼을 눌러 주세요.';
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
  if(url.pathname==='/capture' && req.method==='POST'){
    if(!localAuthorized || req.headers['x-collector-action']!=='start')return send(403,'text/plain','Forbidden');
    if(capture)return send(200,'application/json',JSON.stringify({message:captureStatus}));
    try{
      const config=JSON.parse(fs.readFileSync(path.join(stateDir,'config.json'),'utf8').replace(/^\uFEFF/,''));
      if(!config.python || !fs.existsSync(config.python))throw new Error();
      captureStatus='게임 연결 확인 중…';
      const child=spawn(config.python,['-u',path.join(here,'capture.py'),stateDir],{windowsHide:true,stdio:['ignore','pipe','pipe']});capture=child;
      child.stdout.on('data',b=>{if(b.toString().includes('CAPTURE_READY'))captureStatus='수집 중 · 게임에서 전장과 기록 목록을 열어 주세요. (최대 10분)';});
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
      return send(200,'application/json; charset=utf-8',JSON.stringify(data));
    }catch{return send(200,'application/json; charset=utf-8',JSON.stringify({attack:0,defense:0,held:0,reason:fs.existsSync(path.join(stateDir,'config.json'))?'수집 대기':'연결 프로그램 설치 완료 · 이 PC의 게임 수집 설정이 아직 필요합니다.',updatedAt:null,groups:[],records:[]}));}
  }
  const assets={'/connect':['connect.html','text/html; charset=utf-8'],'/connect.js':['connect.js','text/javascript; charset=utf-8'],'/connect.css':['connect.css','text/css; charset=utf-8']};
  const asset=assets[url.pathname];
  if(!asset)return send(404,'text/plain','Not found');
  if(url.pathname==='/connect')res.setHeader('Set-Cookie',`collector=${cookie}; HttpOnly; SameSite=Strict; Path=/`);
  send(200,asset[1],fs.readFileSync(path.join(here,asset[0])));
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'이미 PC 연결 창이 실행 중입니다.':'PC 연결 창을 시작하지 못했습니다.');process.exitCode=1;});
server.listen(15150,'127.0.0.1',()=>console.log('15월 PC 연결 준비: http://127.0.0.1:15150/connect'));
