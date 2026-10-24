import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesGuildWarSearch as matches} from '../src/lib/guildWarSearch.js';
test('guild war search requires every hero in any order',()=>{
 const fields=['탄지로','하연','선란','제오','길드원'];
 assert.equal(matches(fields,'하연 선란'),true);
 assert.equal(matches(fields,'선란 하연'),true);
 assert.equal(matches(fields,'  하연\t\n선란  '),true);
 assert.equal(matches(fields,'하연 루디'),false);
});
test('guild war search preserves nickname/pet and blank searches',()=>{
 assert.equal(matches(['길드원','제오','하연'],'길드원 제오'),true);
 assert.equal(matches(['길드원','제오','하연'],'하연,제오'),true);
 assert.equal(matches(['길드원'],'  '),true);
 assert.equal(matches(['ABC'],'abc'),true);
});
