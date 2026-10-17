// Reads an existing, bounded Npcap capture. Experimental protocol parameters are
// private local config. Nothing from the captured stream is sent to a service.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createDecipheriv} from 'node:crypto';import {spawn} from 'node:child_process';
const here=path.dirname(fileURLToPath(import.meta.url));
const home=process.env.COLLECTOR_STATE_DIR||path.join(process.env.LOCALAPPDATA,'15month-collector');
const configPath=path.join(home,'config.json');let config=JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
let previous=-1,running=false,lastSignature='';
async function update(){
 if(running)return;running=true;
 try{
  const next=JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
  if(next.capturePath!==config.capturePath){previous=-1;lastSignature='';}config=next;
  const stat=fs.statSync(config.capturePath);if(stat.size===previous)return;
  if(stat.size>16*1024*1024)throw new Error('capture limit');previous=stat.size;
  const b=fs.readFileSync(config.capturePath);if(b.length<24||b.readUInt32LE(0)!==0xa1b2c3d4||b.readUInt32LE(20)!==1)throw new Error('pcap format');
  const chunks=new Map();let pos=24;
  while(pos+16<=b.length){
   const n=b.readUInt32LE(pos+8);if(n>65535)throw new Error('pcap length');if(pos+16+n>b.length)break;
   const r=b.subarray(pos+16,pos+16+n);pos+=16+n;
   if(r.length<54||r.readUInt16BE(12)!==0x800||r[23]!==6)continue;
   if(r.readUInt16BE(20)&0x3fff)throw new Error('fragmented IP unsupported');
   const tcp=14+(r[14]&15)*4;if(tcp+20>r.length||r.readUInt16BE(tcp)!==config.serverPort)continue;
   const seq=r.readUInt32BE(tcp+4),start=tcp+(r[tcp+12]>>4)*4,end=14+r.readUInt16BE(16);
   if(end>r.length||start>end)throw new Error('truncated TCP');const data=r.subarray(start,end);if(!data.length)continue;
   if(!chunks.has(seq)||chunks.get(seq).length<data.length)chunks.set(seq,data);
  }
  const parts=[];let end;
  for(const [seq,data] of [...chunks].sort((a,b)=>a[0]-b[0])){
   if(end!==undefined&&seq>end)throw new Error('TCP gap');const skip=Math.max(0,(end??seq)-seq);if(skip<data.length)parts.push(data.subarray(skip));end=Math.max(end||0,seq+data.length);
  }
  const stream=Buffer.concat(parts),frames=[];pos=0;
  while(pos+8<=stream.length){const n=stream.readUInt32BE(pos),id=stream.readUInt32BE(pos+4);if(n<4||n>8*1024*1024)throw new Error('frame length');if(pos+4+n>stream.length)break;
   if([16837,16841,16849,16857].includes(id)){const c=createDecipheriv('chacha20',Buffer.from(config.key,'hex'),Buffer.from(config.iv,'hex'));frames.push({id,data:Buffer.concat([c.update(stream.subarray(pos+8,pos+4+n)),c.final()]).toString('base64')});}pos+=4+n;
  }
  const signature=JSON.stringify(frames);if(signature===lastSignature)return;
  const result=await new Promise((resolve,reject)=>{const child=spawn(config.python,[path.join(here,'summarize.py'),configPath],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=x);child.stderr.resume();child.on('error',reject);child.on('exit',code=>code?reject(new Error('decode failed')):resolve(output));child.stdin.end(JSON.stringify(frames));});
  const data=JSON.parse(result);data.updatedAt=stat.mtime.toISOString();
  fs.writeFileSync(path.join(home,'status.json.tmp'),JSON.stringify(data));fs.renameSync(path.join(home,'status.json.tmp'),path.join(home,'status.json'));
  lastSignature=signature;
  console.log(`수신: 공격 ${data.attack}건, 방어 ${data.defense}건 (확인 대기)`);
 }catch(e){console.error('수집 데이터 확인 대기:',e.message);}finally{running=false;}
}
await update();setInterval(update,2000);
