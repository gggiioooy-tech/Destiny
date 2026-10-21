import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const file=process.argv[2]||'tmp/replay-analysis-20261019-224354/timeline.html';
const html=fs.readFileSync(file,'utf8');
const embedded=html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1];
const script=html.match(/<\/script><script>([\s\S]*?)<\/script>/)[1];
const data=JSON.parse(embedded),nodes=new Map();
function element(tag){const el={tag,children:[],textContent:'',attributes:{},style:{},append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},setAttribute(k,v){this.attributes[k]=v},classList:{toggle(){}}};Object.defineProperty(el,'id',{get(){return this._id},set(id){this._id=id;nodes.set(id,this)}});return el;}
for(const id of ['meta','attacker','defender','seek','events','position','prev','next','play','reset','details','stats','data','arena','battle-turn','attacker-status','defender-status','action-name','action-caption','outcome','event-count','speed']){const el=element('div');el.id=id;}
nodes.get('data').textContent=embedded;
vm.runInNewContext(script,{document:{getElementById:id=>nodes.get(id),createElement:element},Date,Map,Number,JSON,Math,setInterval:()=>1,clearInterval(){}},{timeout:2000});
assert.equal(nodes.get('events').children.length,data.timeline.length);
assert.equal(nodes.get('attacker').children.length,3);assert.equal(nodes.get('defender').children.length,3);
assert.equal(nodes.get('position').textContent,'00 / '+data.timeline.length);
nodes.get('next').onclick();assert.equal(nodes.get('position').textContent,'01 / '+data.timeline.length);
nodes.get('seek').oninput({target:{value:String(data.timeline.length)}});
assert.equal(nodes.get('next').disabled,true);
assert.equal(nodes.get('defender-status').textContent,'방어팀 · 생존 0 / 3');
assert.equal(nodes.get('outcome').textContent,'공격팀 승리');
for(const h of data.heroes.filter(h=>h.side==='defender'))assert.ok(nodes.get('hp-'+h.objectId).textContent.startsWith('0 / '));
nodes.get('reset').onclick();assert.equal(nodes.get('prev').disabled,true);
assert.ok(!/https?:\/\//.test(html),'standalone HTML must make no external requests');
assert.equal(data.replayWinner,1);assert.equal(data.attackerWon,true);
assert.equal(data.unknownTargetCount,0);
console.log('PASS local timeline: six heroes, complete action navigation, final HP, winner, no external dependencies');
