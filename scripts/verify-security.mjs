import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const source = await readFile(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
const url = source.match(/const SUPABASE_URL = "([^"]+)"/)[1];
const key = source.match(/const SUPABASE_ANON_KEY = "([^"]+)"/)[1];
assert.equal(url, 'https://kqygrszkbuzxmmfndhye.supabase.co');
const stateFile = new URL('../tmp/security-test.json', import.meta.url);
async function request(path, { token=key, method='GET', body, headers={} }={}) {
  const response = await fetch(url+path, { method, headers: {apikey:key, Authorization:`Bearer ${token}`,
    'Content-Type':'application/json', Prefer:'return=representation', ...headers}, body:body===undefined?undefined:JSON.stringify(body) });
  const data = await response.json().catch(()=>null);
  return {status:response.status,data};
}
const auth = (body,token) => request('/functions/v1/site-auth',{method:'POST',body,token});
function denied(result) { assert.ok([401,403].includes(result.status),`Expected denial; got ${result.status}`); }
function pass(name) { console.log(`PASS ${name}`); }
const phase=process.argv[2]||'anonymous';
if(phase==='recover-rotation') {
  const s=JSON.parse(await readFile(stateFile,'utf8'));
  const login=await auth({action:'login',userId:s.userId,password:s.nextPassword});
  assert.equal(login.status,200);
  s.password=s.nextPassword;s.nextPassword=`Qc!${randomBytes(14).toString('hex')}`;
  s.token=login.data.accessToken;s.refreshToken=login.data.refreshToken;
  await writeFile(stateFile,JSON.stringify(s),{mode:0o600});
  pass('recovered test session after successful password rotation');
}
if (phase==='anonymous') {
  for(const table of ['profiles','defense_teams','enemy_defense_teams','attack_teams','notices','total_war_teams','arena_teams','attack_guides']) {
    denied(await request(`/rest/v1/${table}?select=*&limit=1`));
  }
  pass('anonymous cannot read private tables');
  denied(await request('/rest/v1/site_settings?key=eq.site_title',{method:'PATCH',body:{value:'unauthorized-test'}}));
  denied(await request('/rest/v1/rpc/consume_auth_budget',{method:'POST',body:{p_key_hash:'0'.repeat(64),p_limit:1}}));
  pass('anonymous cannot change settings or call service RPCs');
  const settings=await request('/rest/v1/site_settings?select=key,value');
  assert.equal(settings.status,200);
  assert.ok(settings.data.every(row=>!/[운]명|길드/.test(row.value)));
  assert.ok(settings.data.some(row=>row.key==='guild_name'&&row.value==='15월'));
  pass('public branding contains only new site wording');
  const legacy=await auth({action:'login',userId:'admin',password:'1234'});
  assert.equal(legacy.status,401); pass('legacy default admin login rejected');
}
if(phase==='prepare') {
  const state={userId:`qa_security_${randomBytes(5).toString('hex')}`,password:`Qa!${randomBytes(14).toString('hex')}`,nextPassword:`Qb!${randomBytes(14).toString('hex')}`};
  await mkdir(new URL('../tmp/',import.meta.url),{recursive:true});
  await writeFile(stateFile,JSON.stringify(state),{mode:0o600});
  const signup=await auth({action:'signup',userId:state.userId,password:state.password,gameNickname:'보안검증임시계정',role:'admin',status:'approved',is_owner:true});
  assert.equal(signup.status,200); assert.equal(signup.data.created,true);
  const login=await auth({action:'login',userId:state.userId,password:state.password});
  assert.equal(login.status,200);
  state.token=login.data.accessToken; state.refreshToken=login.data.refreshToken;
  await writeFile(stateFile,JSON.stringify(state),{mode:0o600});
  const profiles=await request('/rest/v1/profiles?select=*',{token:state.token});
  assert.equal(profiles.status,200); assert.equal(profiles.data.length,1);
  const profile=profiles.data[0]; assert.equal(profile.role,'member'); assert.equal(profile.status,'pending'); assert.equal(profile.is_owner,false); assert.ok(!('password' in profile));
  state.authId=profile.auth_user_id;
  await writeFile(stateFile,JSON.stringify(state),{mode:0o600});
  const content=await request('/rest/v1/defense_teams?select=*',{token:state.token});
  assert.deepEqual(content.data,[]);
  pass('signup cannot grant its own privileges; pending user sees only self and no content');
  console.log(JSON.stringify({testUserId:state.userId,authId:state.authId}));
}
if(phase==='member') {
  const s=JSON.parse(await readFile(stateFile,'utf8'));
  const profiles=await request('/rest/v1/profiles?select=*',{token:s.token});
  assert.equal(profiles.data.length,1); assert.equal(profiles.data[0].role,'member');
  const promotion=await request(`/rest/v1/profiles?user_id=eq.${s.userId}`,{token:s.token,method:'PATCH',body:{role:'admin'}});
  assert.ok([200,403].includes(promotion.status)); if(promotion.status===200) assert.deepEqual(promotion.data,[]);
  denied(await request(`/rest/v1/profiles?user_id=eq.${s.userId}`,{token:s.token,method:'PATCH',body:{is_owner:true}}));
  denied(await request('/rest/v1/notices',{token:s.token,method:'POST',body:{title:'unauthorized',body:'test'}}));
  const content=await request('/rest/v1/defense_teams?select=*',{token:s.token});
  assert.equal(content.status,200); assert.ok(content.data.length>0);
  assert.ok(content.data.every(row=>row.is_public!==false));
  pass('approved member reads published content, cannot promote self or write admin data');
}
if(phase==='admin') {
  const s=JSON.parse(await readFile(stateFile,'utf8'));
  const profiles=await request('/rest/v1/profiles?select=*',{token:s.token});
  assert.equal(profiles.status,200); assert.ok(profiles.data.some(row=>row.user_id==='15month'));
  assert.ok(profiles.data.every(row=>!('password' in row)));
  const deletedOwner=await request('/rest/v1/profiles?user_id=eq.15month',{token:s.token,method:'DELETE'});
  assert.deepEqual(deletedOwner.data,[]);
  const changedOwner=await request('/rest/v1/profiles?user_id=eq.15month',{token:s.token,method:'PATCH',body:{role:'member'}});
  assert.ok(changedOwner.status>=400);
  denied(await request(`/rest/v1/profiles?user_id=eq.${s.userId}`,{token:s.token,method:'PATCH',body:{must_change_password:false,is_owner:true}}));
  const notice=await request('/rest/v1/notices',{token:s.token,method:'POST',body:{title:'Temporary security verification',body:'Disposable QA data',is_public:false}});
  assert.equal(notice.status,201);
  s.noticeId=notice.data[0].id; await writeFile(stateFile,JSON.stringify(s),{mode:0o600});
  const changed=await request(`/rest/v1/notices?id=eq.${s.noticeId}`,{token:s.token,method:'PATCH',body:{body:'Verified update'}});
  assert.equal(changed.data[0].body,'Verified update');
  const removed=await request(`/rest/v1/notices?id=eq.${s.noticeId}`,{token:s.token,method:'DELETE'});
  assert.equal(removed.data.length,1);
  pass('admin CRUD works; owner cannot be removed or demoted; protected auth fields cannot be edited');
}
if(phase==='rotation') {
  const s=JSON.parse(await readFile(stateFile,'utf8'));
  const content=await request('/rest/v1/defense_teams?select=*',{token:s.token});
  assert.deepEqual(content.data,[]);
  const changed=await auth({action:'change-password',currentPassword:s.password,newPassword:s.nextPassword},s.token);
  assert.equal(changed.status,200); assert.equal(changed.data.changed,true);
  const oldSession=await request('/rest/v1/profiles?select=*',{token:s.token});
  assert.ok(oldSession.status===401||JSON.stringify(oldSession.data)==='[]');
  assert.equal((await auth({action:'login',userId:s.userId,password:s.password})).status,401);
  const login=await auth({action:'login',userId:s.userId,password:s.nextPassword});
  assert.equal(login.status,200);
  s.password=s.nextPassword; s.token=login.data.accessToken; s.refreshToken=login.data.refreshToken;
  await writeFile(stateFile,JSON.stringify(s),{mode:0o600});
  const profile=await request(`/rest/v1/profiles?user_id=eq.${s.userId}`,{token:s.token});
  assert.equal(profile.data[0].must_change_password,false);
  pass('password change unlocks account, revokes old session, rejects old password');
}
