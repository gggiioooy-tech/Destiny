const params=new URLSearchParams(location.hash.slice(1));
const nonce=params.get('nonce');
const target=params.get('origin');
const allowed=new Set(['https://xn--15-7l8j.site','https://destiny-lemon-sigma.vercel.app','http://localhost:5178']);
const paired=window.opener && /^[a-f0-9]{64}$/.test(nonce||'') && allowed.has(target);
history.replaceState(null,'','/connect');
if(paired)document.getElementById('connection').textContent='15월사이트와 연결 중입니다.';
const captureButton=document.getElementById('capture-start');
const stopButton=document.getElementById('capture-stop');
let changingCapture=false;
const captureInfo=document.getElementById('capture-info');
const syncInfo=document.getElementById('sync-info');
const video=document.getElementById('mascot-video');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
video.defaultPlaybackRate=2;video.playbackRate=2;
video.addEventListener('loadedmetadata',()=>{video.playbackRate=2;if(reducedMotion.matches)video.pause();});
video.querySelector('source').addEventListener('error',()=>{video.hidden=true;document.getElementById('mascot-fallback').hidden=false;});
if(reducedMotion.matches){video.autoplay=false;video.pause();}
let actionError='',saveError='',lastProblemData={};
function showProblems(data){
  if(data)lastProblemData=data;else data=lastProblemData;
  const issues=[];
  if(actionError)issues.push(actionError);
  if(saveError)issues.push('사이트 저장 실패: '+saveError+'\n사이트의 로그인과 인터넷 연결을 확인해 주세요. 저장은 자동 재시도합니다.');
  if(syncError)issues.push('매칭 정보 연결 문제: '+syncError+'\n사이트에서 PC 수집기를 다시 연결해 주세요.');
  if(data.needsSetup)issues.push('게임 수집 설정이 준비되지 않았어요.\n게임을 켜고 사이트에서 PC 수집기를 다시 연결해 주세요.');
  if(data.captureIssue)issues.push(data.captureIssue);
  else if(/실패|오류|해석 대기|연결 대기 · 재접속/.test(data.captureStatus||''))issues.push(data.captureStatus+'\n게임 연결을 확인한 뒤 수집 시작을 다시 눌러 주세요.');
  if(!syncError&&/실패|오류/.test(data.periodSyncStatus||''))issues.push('매칭 정보 문제: '+data.periodSyncStatus+'\n사이트에서 다시 연결해 주세요.');
  if(/실패/.test(data.updateStatus||''))issues.push('업데이트를 확인하지 못했어요. 기존 버전은 계속 사용할 수 있어요.\n인터넷 연결을 확인하고 수집기를 다시 실행해 주세요.');
  if(paired&&window.opener.closed)issues.push('연결한 사이트 창이 닫혔어요.\n사이트를 열고 PC 수집기를 다시 연결해야 기록이 저장돼요.');
  const box=document.getElementById('problem-info');box.textContent=[...new Set(issues)].join('\n\n');box.hidden=!issues.length;
}
let lastSavedAt=null;let lastSavedCount=0;let syncError='';let setupTask=Promise.resolve();
async function startCapture(restart=false){
  if(changingCapture)return;
  changingCapture=true;actionError='';showProblems();
  captureInfo.textContent='수집을 시작하고 있어요…';
  captureButton.disabled=true;
  try{await setupTask.catch(()=>{});const r=await fetch('/capture',{method:'POST',headers:{'X-Collector-Action':'start','X-Collector-Restart':String(restart)}});const d=await r.json();captureInfo.textContent=d.message;if(!r.ok)throw new Error(d.message||'수집 시작 실패');actionError='';}
  catch(e){actionError=e.message||'수집기를 다시 연결해 주세요.';captureInfo.textContent=actionError;showProblems();}finally{captureButton.disabled=false;changingCapture=false;}
}
captureButton.addEventListener('click',()=>startCapture(true));
async function stopCapture(){
  if(changingCapture)return;changingCapture=true;stopButton.disabled=true;captureInfo.textContent='수집을 종료하고 있어요…';
  try{const r=await fetch('/capture/stop',{method:'POST',headers:{'X-Collector-Action':'stop'}});const d=await r.json();captureInfo.textContent=d.message;if(!r.ok)throw new Error(d.message);actionError='';}
  catch(e){actionError=e.message||'수집 종료에 실패했어요.';captureInfo.textContent=actionError;showProblems();}finally{changingCapture=false;stopButton.disabled=false;void update();}
}
stopButton.addEventListener('click',stopCapture);
window.addEventListener('message',event=>{
  if(!paired||event.source!==window.opener||event.origin!==target||event.data?.nonce!==nonce)return;
  if(event.data.type==='15month-collector-setup'){
    setupTask=fetch('/setup',{method:'POST',headers:{'Content-Type':'application/json','X-Collector-Action':'setup'},body:JSON.stringify(event.data.profile)}).then(async r=>{const d=await r.json();if(!r.ok||!d.ready)throw new Error(d.message||'자동 설정 실패');syncError='';syncInfo.textContent=d.message||'자동 설정 완료';});
    setupTask.catch(e=>{syncError=e.message;syncInfo.textContent=syncError;showProblems();});
  }
  if(event.data.type==='15month-collector-periods')setupTask.then(()=>fetch('/periods',{method:'POST',headers:{'Content-Type':'application/json','X-Collector-Action':'periods'},body:JSON.stringify(event.data.periods)})).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message||`동기화 오류 ${r.status}`);syncError='';}).catch(e=>{syncError=e.message||'매칭 정보 연결 실패';syncInfo.textContent=syncError;showProblems();});
  if(event.data.type==='15month-collector-stop')void stopCapture();
  if(event.data.type==='15month-collector-start')void startCapture(event.data.restart===true);
  if(event.data.type==='15month-collector-ack'){saveError=typeof event.data.error==='string'?event.data.error.slice(0,300):'';showProblems();const count=event.data.saved||0;if(count>lastSavedCount)lastSavedAt=new Date().toLocaleString('ko-KR');lastSavedCount=count;document.getElementById('connection').textContent='15월사이트 연결됨 · 저장 확인 '+count+'건 · 마지막 저장 확인: '+(lastSavedAt||'아직 없음');}
});
async function update(){
  try{
    const response=await fetch('/status');if(!response.ok)throw new Error();const data=await response.json();showProblems(data);
    document.getElementById('update-info').textContent=data.updateStatus||'자동 업데이트를 사용하려면 최신 설치본을 한 번 설치해 주세요.';
    syncInfo.textContent=syncError||data.periodSyncStatus||'최신 설치본으로 업데이트해 주세요.';
    if(data.captureStatus)captureInfo.textContent=data.captureStatus;
    document.getElementById('activity').textContent=data.needsSetup?'설정 대기':data.captureActive?'수집 중':'수집 대기';
    document.getElementById('activity').dataset.active=String(data.captureActive===true);
    for(const key of ['attack','defense','held'])document.getElementById(key+'-count').textContent=data[key]||0;
    document.getElementById('counts').textContent=`공격 ${data.attack||0}건 · 방어 ${data.defense||0}건 · 확인 대기 ${data.held||0}건`;
    document.getElementById('reason').textContent=[data.held?data.reason:'',...Object.entries(data.heldReasons||{}).map(([r,n])=>`${r}: ${n}건`)].filter(Boolean).join(' · ');
    document.getElementById('updated').textContent=(data.lastReceivedAt?'마지막 게임 데이터 수신: '+new Date(data.lastReceivedAt).toLocaleString('ko-KR')+' · ':'')+(data.updatedAt?`마지막 기록 갱신: ${new Date(data.updatedAt).toLocaleString('ko-KR')}`:data.held?'기록은 수신됐지만 매칭 정보 확인 전이라 저장 대기 중입니다.':'아직 수신된 기록이 없습니다. 게임에서 전장 또는 기록 화면을 열어 주세요.');
    const list=document.getElementById('groups');list.replaceChildren();
    for(const group of (data.groups||[]).slice(0,30)){const li=document.createElement('li');li.textContent=`${group.guild||'미확인'} · ${group.direction==='attack'?'공격':'방어'} ${group.count}건`;list.append(li);}
    if(paired&&!window.opener.closed)window.opener.postMessage({type:'15month-collector-status',nonce,data},target);
  }catch{const box=document.getElementById('problem-info');box.hidden=false;box.textContent='PC 수집기와 연결이 끊겼어요.\n프로그램이 켜져 있는지 확인한 뒤 사이트에서 다시 연결해 주세요.';document.getElementById('activity').textContent='연결 확인 필요';document.getElementById('activity').dataset.active='false';document.getElementById('connection').textContent='PC 수집기 연결을 확인해 주세요.';}
}
update();setInterval(update,2000);
