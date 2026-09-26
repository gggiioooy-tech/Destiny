import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const source=await fs.readFile(new URL('../src/lib/supabase.js',import.meta.url),'utf8');
const url=source.match(/const SUPABASE_URL = "([^"]+)"/)[1];
const key=source.match(/const SUPABASE_ANON_KEY = "([^"]+)"/)[1];
const stateFile=new URL('../tmp/board-test-state.json',import.meta.url);
async function request(path,{token=key,method='GET',body,headers={}}={}){
 const r=await fetch(url+path,{method,headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation',...headers},body:body===undefined?undefined:typeof body==='string'||body instanceof Buffer?body:JSON.stringify(body)});
 return {status:r.status,data:await r.json().catch(()=>null)};
}
const phase=process.argv[2];
if(phase==='prepare'){
 const state=[];
 for(let i=0;i<2;i++){
  const userId='qa_board_'+randomBytes(5).toString('hex'),password='Qa!'+randomBytes(15).toString('hex');
  const signup=await request('/functions/v1/site-auth',{method:'POST',body:{action:'signup',userId,password,gameNickname:'게시판검증'+i}});assert.equal(signup.status,200);
  const login=await request('/functions/v1/site-auth',{method:'POST',body:{action:'login',userId,password}});assert.equal(login.status,200);
  const token=login.data.accessToken; const profiles=await request('/rest/v1/profiles?select=*',{token});
  state.push({userId,password,token,profile:profiles.data[0]});await fs.writeFile(stateFile,JSON.stringify(state));
 }
 console.log(JSON.stringify(state.map(s=>({userId:s.userId,authId:s.profile.auth_user_id}))));
}
if(phase==='verify'){
 const [a,b]=JSON.parse(await fs.readFile(stateFile,'utf8'));
 for(const table of ['guild_board_posts','guild_board_comments'])assert.ok([401,403].includes((await request('/rest/v1/'+table+'?select=*')).status));
 const uploadPath=a.profile.auth_user_id+'/posts/test.png';
 const upload=await request('/storage/v1/object/guild-board-images/'+uploadPath,{token:a.token,method:'POST',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM3sAAAAASUVORK5CYII=','base64'),headers:{'Content-Type':'image/png'}});assert.equal(upload.status,200,JSON.stringify(upload));
 const post=await request('/rest/v1/guild_board_posts',{token:a.token,method:'POST',body:{title:'[자동검증 임시글]',body:'기능검증 후 삭제됩니다',author_id:b.userId,author_nickname:'위조',image_paths:[uploadPath]}});
 assert.equal(post.status,201,JSON.stringify(post));const p=post.data[0];assert.equal(p.author_id,a.userId);assert.equal(p.author_nickname,a.profile.game_nickname);
 const signed=await request('/storage/v1/object/sign/guild-board-images/'+uploadPath,{token:a.token,method:'POST',body:{expiresIn:60}});assert.equal(signed.status,200,JSON.stringify(signed));
 const forged=await request('/rest/v1/guild_board_posts',{token:b.token,method:'POST',body:{title:'bad',body:'bad',image_paths:[uploadPath]}});assert.ok(forged.status>=400);
 const denial=await request('/rest/v1/guild_board_posts?id=eq.'+p.id,{token:b.token,method:'DELETE'});assert.deepEqual(denial.data,[]);
 const commentPath=b.profile.auth_user_id+'/comments/'+a.profile.auth_user_id+'/test.png';
 assert.equal((await request('/storage/v1/object/guild-board-images/'+commentPath,{token:b.token,method:'POST',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM3sAAAAASUVORK5CYII=','base64'),headers:{'Content-Type':'image/png'}})).status,200);
 const comment=await request('/rest/v1/guild_board_comments',{token:b.token,method:'POST',body:{post_id:p.id,body:'임시 댓글',image_paths:[commentPath]}});assert.equal(comment.status,201,JSON.stringify(comment));
 const list=await request('/rest/v1/guild_board_posts?select=*,guild_board_comments(count)&id=eq.'+p.id,{token:a.token});assert.equal(list.data[0].guild_board_comments[0].count,1);
 assert.equal((await request('/rest/v1/guild_board_posts?id=eq.'+p.id,{token:a.token,method:'DELETE'})).data.length,1);
 assert.deepEqual((await request('/rest/v1/guild_board_comments?post_id=eq.'+p.id,{token:b.token})).data,[]);
 const cleanup=await request('/storage/v1/object/guild-board-images',{token:a.token,method:'DELETE',body:{prefixes:[uploadPath,commentPath]}});assert.equal(cleanup.status,200);assert.equal(cleanup.data.length,2,JSON.stringify(cleanup));
 console.log('PASS private board, server-author identity, cross-member delete denial, image upload/signing, forged attachment denial, comment count, cascade and all image cleanup');
}
