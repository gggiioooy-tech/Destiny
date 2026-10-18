const params=new URLSearchParams(location.hash.slice(1));
const nonce=params.get('nonce');
const target=params.get('origin');
const allowed=new Set(['https://xn--15-7l8j.site','https://destiny-lemon-sigma.vercel.app','http://localhost:5178']);
const paired=window.opener && /^[a-f0-9]{64}$/.test(nonce||'') && allowed.has(target);
history.replaceState(null,'','/connect');
if(paired)document.getElementById('connection').textContent='15월사이트와 연결 중입니다.';
const captureButton=document.createElement('button');captureButton.textContent='수집 시작';document.querySelector('main').prepend(captureButton);
const captureInfo=document.createElement('p');captureButton.after(captureInfo);
const syncInfo=document.createElement('p');captureInfo.after(syncInfo);
let syncError='';let setupTask=Promise.resolve();
async function startCapture(){
  captureButton.disabled=true;
  try{await setupTask;const r=await fetch('/capture',{method:'POST',headers:{'X-Collector-Action':'start'}});const d=await r.json();captureInfo.textContent=d.message;}
  catch{captureInfo.textContent='수집기를 다시 연결해 주세요.';}finally{captureButton.disabled=false;}
}
captureButton.addEventListener('click',startCapture);
window.addEventListener('message',event=>{
  if(!paired||event.source!==window.opener||event.origin!==target||event.data?.nonce!==nonce)return;
  if(event.data.type==='15month-collector-setup'){
    setupTask=fetch('/setup',{method:'POST',headers:{'Content-Type':'application/json','X-Collector-Action':'setup'},body:JSON.stringify(event.data.profile)}).then(async r=>{const d=await r.json();if(!r.ok||!d.ready)throw new Error(d.message||'자동 설정 실패');syncError='';syncInfo.textContent=d.message||'자동 설정 완료';});
    setupTask.catch(e=>{syncError=e.message;syncInfo.textContent=syncError;});
  }
  if(event.data.type==='15month-collector-periods')setupTask.then(()=>fetch('/periods',{method:'POST',headers:{'Content-Type':'application/json','X-Collector-Action':'periods'},body:JSON.stringify(event.data.periods)})).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message||`동기화 오류 ${r.status}`);syncError='';}).catch(e=>{syncError=e.message||'매칭 정보 연결 실패';syncInfo.textContent=syncError;});
  if(event.data.type==='15month-collector-start')void startCapture();
  if(event.data.type==='15month-collector-ack')document.getElementById('connection').textContent='15월사이트 연결됨 · 저장 확인 '+(event.data.saved||0)+'건';
});
async function update(){
  try{
    const response=await fetch('/status');if(!response.ok)throw new Error();const data=await response.json();
    syncInfo.textContent=syncError||data.periodSyncStatus||'최신 설치본으로 업데이트해 주세요.';
    if(data.captureStatus)captureInfo.textContent=data.captureStatus;
    document.getElementById('counts').textContent=`공격 ${data.attack||0}건 · 방어 ${data.defense||0}건 · 확인 대기 ${data.held||0}건`;
    document.getElementById('reason').textContent=[data.reason,...Object.entries(data.heldReasons||{}).map(([r,n])=>`${r}: ${n}건`)].filter(Boolean).join(' · ');
    document.getElementById('updated').textContent=data.updatedAt?`마지막 기록 갱신: ${new Date(data.updatedAt).toLocaleString('ko-KR')}`:data.held?'기록은 수신됐지만 매칭 정보 확인 전이라 저장 대기 중입니다.':'아직 수신된 기록이 없습니다.';
    const list=document.getElementById('groups');list.replaceChildren();
    for(const group of (data.groups||[]).slice(0,30)){const li=document.createElement('li');li.textContent=`${group.guild||'미확인'} · ${group.direction==='attack'?'공격':'방어'} ${group.count}건`;list.append(li);}
    if(paired&&!window.opener.closed)window.opener.postMessage({type:'15month-collector-status',nonce,data},target);
  }catch{document.getElementById('connection').textContent='PC 수집기 연결을 확인해 주세요.';}
}
update();setInterval(update,2000);
