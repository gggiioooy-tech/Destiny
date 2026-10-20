"""Build the manual installer and the verified code-only auto-update release."""
from pathlib import Path
import zipfile,json,hashlib
root=Path(__file__).resolve().parent.parent
source=root/'tools/pc-collector'
downloads=root/'public/downloads'
names=['start.ps1','desktop.ps1','update.ps1','release.json','server.mjs','watch.mjs','summarize.py','normalize.py','replay_skills.py','capture.py','capture_worker.py','battlefield.py','match_period.py','setup_game.py','prepare.ps1','gameCatalog.json','connect.html','connect.js','connect.css','uninstall.ps1']
for script in source.glob('*.ps1'):
 text=script.read_text(encoding='utf-8-sig')
 assert '\ufeff' not in text, f'Duplicate or embedded BOM: {script.name}'
archive=downloads/'collector-update.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
 for name in names:z.write(source/name,name)
version=json.loads((source/'release.json').read_text(encoding='utf-8'))['version']
manifest={'version':version,'url':'https://xn--15-7l8j.site/downloads/collector-update.zip','sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
(downloads/'collector-release.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
installer=downloads/'15month-pc-connect.zip'
temp=installer.with_suffix('.updated.zip')
with zipfile.ZipFile(installer) as old,zipfile.ZipFile(temp,'w',compression=zipfile.ZIP_DEFLATED) as out:
 for entry in old.infolist():
  if entry.filename not in names+['install.ps1']:out.writestr(entry,old.read(entry.filename))
 for name in names+['install.ps1']:out.write(source/name,name)
with zipfile.ZipFile(temp) as z:
 for name in names+['install.ps1']:assert z.read(name)==(source/name).read_bytes()
temp.replace(installer)
print('Collector release:',version,'Installer and code-only update verified')
