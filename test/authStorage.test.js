import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuthStorage,KEEP_LOGIN_KEY} from '../src/lib/authStorage.js';
import {createClient} from '@supabase/supabase-js';
const store=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const key='15month_secure_auth';
test('default sessions stay temporary and do not survive a new browser session',()=>{
 const local=store(),session=store(),auth=createAuthStorage(local,session);
 auth.setItem(key,'token');assert.equal(session.getItem(key),'token');assert.equal(local.getItem(key),null);
 assert.equal(createAuthStorage(local,store()).getItem(key),null);
});
test('opted-in login survives reopening and logout removes both copies and preference',()=>{
 const local=store(),session=store(),auth=createAuthStorage(local,session);
 auth.setKeeping(true);auth.setItem(key,'token');
 const reopened=createAuthStorage(local,store());assert.equal(reopened.getItem(key),'token');
 reopened.removeItem(key);assert.equal(local.getItem(key),null);assert.equal(local.getItem(KEEP_LOGIN_KEY),null);
 assert.equal(createAuthStorage(local,store()).getItem(key),null);
});
test('turning persistence on and off migrates an existing session without leaving another copy',()=>{
 const local=store(),session=store(),auth=createAuthStorage(local,session);
 auth.setItem(key,'token');auth.setKeeping(true);
 assert.equal(local.getItem(key),'token');assert.equal(session.getItem(key),null);
 auth.setKeeping(false);assert.equal(session.getItem(key),'token');assert.equal(local.getItem(key),null);
});
test('blocked durable storage cannot silently pretend to keep a login or erase the temporary session',()=>{
 const blocked={setItem(){throw Error('blocked');}},session=store();
 const auth=createAuthStorage(blocked,session);auth.setItem(key,'token');
 assert.throws(()=>auth.setKeeping(true),/저장소/);assert.equal(auth.getItem(key),'token');
});
test('unavailable browser storage can still hold a temporary in-memory session',()=>{
 const auth=createAuthStorage();auth.setItem(key,'token');assert.equal(auth.getItem(key),'token');
 auth.removeItem(key);assert.equal(auth.getItem(key),null);
});
test('Supabase SDK saves, restores and signs out an opted-in session through the adapter',async()=>{
 const local=store(),adapter=createAuthStorage(local,store());adapter.setKeeping(true);
 const sub='00000000-0000-4000-8000-000000000001';
 const token=[{alg:'HS256',typ:'JWT'},{sub,exp:Math.floor(Date.now()/1000)+3600},'synthetic-signature'].map((v,i)=>i===2?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
 const fetch=async url=>String(url).includes('/logout')?new Response(null,{status:204}):new Response(JSON.stringify({id:sub,aud:'authenticated',role:'authenticated',created_at:'2026-01-01T00:00:00Z',app_metadata:{},user_metadata:{}}),{status:200,headers:{'content-type':'application/json'}});
 const client=storage=>createClient('https://auth-test.example','synthetic-public-key',{auth:{storage,storageKey:key,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch}});
 const first=client(adapter);
 assert.equal((await first.auth.setSession({access_token:token,refresh_token:'synthetic-refresh'})).error,null);
 assert.ok(local.getItem(key));
 const reopened=client(createAuthStorage(local,store()));
 const restored=await reopened.auth.getSession();assert.equal(restored.error,null);assert.equal(restored.data.session.user.id,sub);
 assert.equal((await reopened.auth.signOut({scope:'local'})).error,null);
 assert.equal(local.getItem(key),null);assert.equal(local.getItem(KEEP_LOGIN_KEY),null);
});
