import test from 'node:test';
import assert from 'node:assert/strict';
import {groupDefenses,heroKey,memoGuilds,uniqueBattles} from '../src/lib/guildWar.js';
test('defenses group by castle, unordered heroes, and pet',()=>{
 const rows=[{castle:'외성1',heroes:['선란','하연','칼 헤론'],pet:'연지'},{castle:'외성1',heroes:['칼헤론','선란','하연'],pet:'연지'},{castle:'외성1',heroes:['하연','선란','칼 헤론'],pet:'다른 펫'},{castle:'내성1',heroes:['선란','하연','칼 헤론'],pet:'연지'}];
 const grouped=groupDefenses(rows);assert.equal(grouped.length,3);assert.equal(grouped.find(g=>g.castle==='외성1'&&g.pet==='연지').count,2);
 assert.equal(heroKey('선란, 하연, 칼 헤론'),heroKey(['칼헤론','선란','하연']));
});
test('memo choices are exact trimmed distinct names',()=>assert.deepEqual(memoGuilds(' 서리,철폐,서리, '),['서리','철폐']));
test('duplicate battle observations across reporters are displayed once',()=>assert.equal(uniqueBattles([{source_key:'same'},{source_key:'same'},{source_key:'other'}]).length,2));
