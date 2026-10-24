import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {SecureAuth}=await vite.ssrLoadModule('/src/components/SecureAuth.jsx');
 const {default:NicknameButton,NicknameChange}=await vite.ssrLoadModule('/src/components/NicknameChange.jsx');
 const auth=renderToStaticMarkup(React.createElement(SecureAuth,{settings:{site_title:'15월'}}));
 assert.ok(auth.includes('로그인 유지'));assert.ok(auth.includes('아이디 기억하기'));
 assert.equal((auth.match(/type="checkbox"/g)||[]).length,2);
 const user={id:'qa-user',gameNickname:'이전닉'};
 const button=renderToStaticMarkup(React.createElement(NicknameButton,{user}));
 assert.ok(button.includes('닉네임 변경'));
 for(const admin of [false,true]){
  const dialog=renderToStaticMarkup(React.createElement(NicknameChange,{user,admin,onClose(){}}));
  assert.ok(dialog.includes(admin?'이전닉 · 닉네임 변경':'내 닉네임 변경'));
  assert.ok(dialog.includes('새 게임 닉네임'));assert.ok(dialog.includes('maxLength="40"'));
  assert.ok(dialog.includes('공격·방어 통계'));assert.ok(dialog.includes('닉네임 저장'));
 }
 const source=await import('node:fs/promises');
 const members=await source.readFile('src/components/MemberManagementPage.jsx','utf8');
 assert.ok(members.includes('<NicknameChangeButton user={u} admin'));
 console.log('PASS remember-login checkbox, separate ID preference, self/admin nickname dialogs and management entry');
}finally{await vite.close();}
