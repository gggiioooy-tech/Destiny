"""Extract the public message schema from the user's installed game executable."""
import sys,json,mmap,subprocess,os
from pathlib import Path
from google.protobuf import descriptor_pb2
state=Path(sys.argv[1]);app=Path(__file__).parent
existing={}
try:existing=json.loads((state/'config.json').read_text(encoding='utf-8-sig'))
except (OSError,ValueError):pass
if '--existing' in sys.argv:
    guild=existing.get('guild')
    guilds={p['guild'] for p in existing.get('periods',[])}
    if not guild and len(guilds)==1:guild=next(iter(guilds))
    if not guild:raise SystemExit('길드 설정을 확인해 주세요.')
    profile={'key':existing['key'],'iv':existing['iv'],'guild':guild}
else:profile=json.load(sys.stdin)
r=subprocess.run(['powershell.exe','-NoProfile','-Command',"(Get-Process ProjectRE-Win64-Shipping -ErrorAction Stop | Select-Object -First 1).Path"],capture_output=True,text=True,timeout=15)
exe=Path(r.stdout.strip())
if exe.name!='ProjectRE-Win64-Shipping.exe' or not exe.is_file():
    # Elevated games can hide their process path. Use the standard installer location,
    # based on this computer's Program Files, never a developer-specific path.
    exe=Path(os.environ.get('ProgramFiles',r'C:\Program Files'))/'Netmarble/Netmarble Game/SevenKnightsRebirth/ProjectRE/Binaries/Win64/ProjectRE-Win64-Shipping.exe'
if not exe.is_file():raise SystemExit('게임 설치 위치를 확인할 수 없습니다. 게임을 실행한 뒤 다시 연결하세요.')
def varint(b,i):
    value=0
    for shift in range(0,70,7):
        v=b[i];i+=1;value|=(v&127)<<shift
        if v<128:return value,i
    raise ValueError()
found=[]
with exe.open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as b:
    pos=b.find(b'\x0a\x0eprotocol.proto')
    while pos>=0:
        i=pos
        try:
            while i<min(len(b),pos+2000000):
                tag,j=varint(b,i)
                if tag==0:break
                if tag>>3>14:raise ValueError()
                if tag&7==2:n,j=varint(b,j);j+=n
                elif tag&7==0:_,j=varint(b,j)
                else:raise ValueError()
                i=j
            d=descriptor_pb2.FileDescriptorProto.FromString(b[pos:i])
            if d.name=='protocol.proto' and d.package=='re':found.append(d)
        except Exception:pass
        pos=b.find(b'\x0a\x0eprotocol.proto',pos+1)
if len(found)!=1:raise SystemExit('게임 버전 확인이 필요합니다. 자동 설정을 중단했습니다.')
schema=state/'game-schema.pb';schema.write_bytes(found[0].SerializeToString())
config={'python':sys.executable,'protobufPath':str(app/'vendor'),'schemaPath':str(schema),'key':profile['key'],'iv':profile['iv'],'guild':profile['guild'],'periods':[p for p in existing.get('periods',[]) if p.get('guild')==profile['guild']],'catalog':json.loads((app/'gameCatalog.json').read_text(encoding='utf8')),'capturePath':str(state/'pending.pcap'),'serverPort':0}
temp=state/'config.tmp';temp.write_text(json.dumps(config),encoding='utf8');os.replace(temp,state/'config.json')
print('SETUP_READY',flush=True)
