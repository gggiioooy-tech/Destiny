import test from 'node:test';
import assert from 'node:assert/strict';
import { createTabHistory, readTab } from '../src/lib/tabHistory.js';
function fakeBrowser(url='https://example.test/?keep=1') {
  const entries=[{url,state:{other:'kept'}}]; let position=0; const listeners=new Set();
  const browser={ location:{href:url},history:{state:entries[0].state,
   replaceState(state,_,url){entries[position]={state,url};sync();},
   pushState(state,_,url){entries.splice(position+1);entries.push({state,url});position++;sync();},
   back(){if(position>0){position--;sync();for(const f of listeners)f();}},
   forward(){if(position<entries.length-1){position++;sync();for(const f of listeners)f();}},
  }, addEventListener(type,fn){if(type==='popstate')listeners.add(fn);}, removeEventListener(type,fn){if(type==='popstate')listeners.delete(fn);}, length:()=>entries.length };
  function sync(){browser.location.href=entries[position].url;browser.history.state=entries[position].state;}
  return browser;
}
test('tab navigation goes back and forward without duplicating entries',()=>{
 const browser=fakeBrowser();let active='attack';const tabs=createTabHistory(browser,value=>active=value);
 assert.equal(browser.length(),1);
 tabs.navigate('historyCounter'); assert.equal(active,'historyCounter'); assert.equal(browser.length(),2);
 browser.history.back(); assert.equal(active,'attack'); assert.equal(browser.length(),2);
 browser.history.forward(); assert.equal(active,'historyCounter');
 tabs.navigate('historyCounter');assert.equal(browser.length(),2);
 assert.equal(new URL(browser.location.href).searchParams.get('keep'),'1');assert.equal(browser.history.state.other,'kept');tabs.destroy();
});
test('guild tabs survive reload and inaccessible tabs can be replaced',()=>{
 const browser=fakeBrowser('https://example.test/?tab='+encodeURIComponent('guildWar:서리'));
 assert.equal(readTab(browser),'guildWar:서리');let active;const tabs=createTabHistory(browser,value=>active=value);
 tabs.replace('attack'); assert.equal(active,'attack');assert.equal(browser.length(),1);
 tabs.navigate('total');browser.history.back();tabs.navigate('members');browser.history.forward();assert.equal(active,'members');tabs.destroy();
});
