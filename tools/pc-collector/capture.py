"""One bounded session; reconnect only to the running game, never other traffic."""
import subprocess,sys,time
from pathlib import Path
end=time.monotonic()+600
while time.monotonic()<end:
    remaining=max(1,int(end-time.monotonic()))
    result=subprocess.run([sys.executable,'-u',str(Path(__file__).with_name('capture_worker.py')),sys.argv[1],str(remaining)])
    if result.returncode==0:break
    if result.returncode!=75:raise SystemExit(result.returncode)
    print('CAPTURE_RECONNECT',flush=True)
    time.sleep(min(5,max(0,end-time.monotonic())))
