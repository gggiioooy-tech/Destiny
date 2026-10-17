import ctypes as c, os, time, json, struct
from pathlib import Path
import subprocess,sys,uuid
state=Path(sys.argv[1]);config_path=state/'config.json'
script="""$g=Get-Process ProjectRE-Win64-Shipping -ErrorAction Stop; $c=@(Get-NetTCPConnection -State Established | Where-Object {$_.OwningProcess -in $g.Id -and $_.RemotePort -ge 30000 -and $_.RemotePort -le 39999}); if($c.Count -ne 1){throw '게임 연결을 하나로 확인할 수 없습니다.'}; $ip=Get-NetIPAddress -IPAddress $c[0].LocalAddress -ErrorAction Stop; $a=Get-NetAdapter -InterfaceIndex $ip.InterfaceIndex; @{remote=$c[0].RemoteAddress;port=$c[0].RemotePort;localPort=$c[0].LocalPort;adapter=$a.InterfaceGuid.ToString()}|ConvertTo-Json -Compress"""
r=subprocess.run(['powershell.exe','-NoProfile','-Command',script],capture_output=True,text=True,timeout=20)
if r.returncode:raise SystemExit(75)
conn=json.loads(r.stdout);capture_path=state/('capture-'+uuid.uuid4().hex+'.pcap')
config=json.loads(config_path.read_text(encoding='utf-8-sig'));config['capturePath']=str(capture_path);config['serverPort']=int(conn['port'])

os.add_dll_directory(r'C:\Windows\System32\Npcap')
p=c.CDLL(r'C:\Windows\System32\Npcap\wpcap.dll')
class Bpf(c.Structure): _fields_=[('len',c.c_uint),('insns',c.c_void_p)]
class Header(c.Structure): _fields_=[('sec',c.c_long),('usec',c.c_long),('caplen',c.c_uint),('len',c.c_uint)]
p.pcap_open_live.argtypes=[c.c_char_p,c.c_int,c.c_int,c.c_int,c.c_char_p];p.pcap_open_live.restype=c.c_void_p
p.pcap_compile.argtypes=[c.c_void_p,c.POINTER(Bpf),c.c_char_p,c.c_int,c.c_uint]
p.pcap_setfilter.argtypes=[c.c_void_p,c.POINTER(Bpf)];p.pcap_freecode.argtypes=[c.POINTER(Bpf)]
p.pcap_close.argtypes=[c.c_void_p];p.pcap_geterr.argtypes=[c.c_void_p];p.pcap_geterr.restype=c.c_char_p
p.pcap_setnonblock.argtypes=[c.c_void_p,c.c_int,c.c_char_p]
p.pcap_next_ex.argtypes=[c.c_void_p,c.POINTER(c.POINTER(Header)),c.POINTER(c.POINTER(c.c_ubyte))]
p.pcap_datalink.argtypes=[c.c_void_p];p.pcap_datalink.restype=c.c_int
err=c.create_string_buffer(256)
h=p.pcap_open_live(('\\Device\\NPF_'+conn['adapter']).encode(),65535,0,100,err)
if not h: raise SystemExit('CAPTURE_OPEN_FAILED: '+err.value.decode(errors='replace'))
try:
    b=Bpf();rule=f"tcp and host {conn['remote']} and port {conn['port']} and port {conn['localPort']}".encode()
    if p.pcap_compile(h,c.byref(b),rule,1,0xffffffff)!=0: raise RuntimeError(p.pcap_geterr(h))
    try:
        if p.pcap_setfilter(h,c.byref(b))!=0: raise RuntimeError(p.pcap_geterr(h))
    finally:p.pcap_freecode(c.byref(b))
    if p.pcap_setnonblock(h,1,err)!=0:raise RuntimeError(err.value)
    path=capture_path;count=0;size=0;prefixes={}
    with path.open('wb', buffering=0) as out:
        out.write(struct.pack('<IHHIIII',0xa1b2c3d4,2,4,0,0,65535,p.pcap_datalink(h)))
        temp=config_path.with_suffix('.tmp');temp.write_text(json.dumps(config),encoding='utf8');os.replace(temp,config_path)
        print('CAPTURE_READY',flush=True)
        end=time.monotonic()+min(600,int(sys.argv[2]))
        check=None;next_check=time.monotonic()+10
        while time.monotonic()<end and size<16_000_000:
            if check is not None and check.poll() is not None:
                output=check.communicate()[0]
                try:latest=json.loads(output)
                except (ValueError,TypeError):latest=None
                if latest!=conn:raise SystemExit(75)
                check=None;next_check=time.monotonic()+10
            if check is None and time.monotonic()>=next_check:
                check=subprocess.Popen(['powershell.exe','-NoProfile','-Command',script],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
            hdr=c.POINTER(Header)();data=c.POINTER(c.c_ubyte)();ret=p.pcap_next_ex(h,c.byref(hdr),c.byref(data))
            if ret==0:time.sleep(.01);continue
            if ret<0:raise RuntimeError('capture read failed')
            raw=c.string_at(data,hdr.contents.caplen);out.write(struct.pack('<IIII',hdr.contents.sec,hdr.contents.usec,len(raw),hdr.contents.len));out.write(raw);count+=1;size+=len(raw)
    print(json.dumps({'packets':count,'bytes':size,'saved_local':str(path)}))
finally:
    p.pcap_close(h)
    if 'check' in locals() and check is not None and check.poll() is None:check.terminate();check.wait(timeout=5)



