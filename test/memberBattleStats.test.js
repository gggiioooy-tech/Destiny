import test from 'node:test';
import assert from 'node:assert/strict';
import { battleStatLabels } from '../src/lib/memberBattleStats.js';
test('empty statistics show no percentage instead of a misleading zero percent', () => {
 const labels=battleStatLabels({});
 assert.equal(labels.attackCount,'0회'); assert.equal(labels.attackRate,'—'); assert.equal(labels.defenseRate,'—');
});
test('known zero-percent losses and partial results stay distinct', () => {
 const labels=battleStatLabels({attack_count:3,attack_wins:1,attack_losses:1,attack_unknown:1,attack_win_rate:50,defense_count:2,defense_wins:0,defense_losses:2,defense_win_rate:0});
 assert.equal(labels.attackResults,'1승 1패'); assert.equal(labels.attackRate,'50%'); assert.equal(labels.defenseRate,'0%'); assert.equal(labels.defenseResults,'0승 2패 · 2회'); assert.equal(labels.unknown,'승패 미확인 1건은 승률에서 제외');
});
