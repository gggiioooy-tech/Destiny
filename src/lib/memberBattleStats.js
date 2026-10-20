const count = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const rate = value => value == null || !Number.isFinite(Number(value)) ? '—' : `${Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
export function battleStatLabels(stats) {
  const unknown = count(stats.attack_unknown) + count(stats.defense_unknown);
  return {
    attackCount: `${count(stats.attack_count)}회`,
    attackResults: `${count(stats.attack_wins)}승 ${count(stats.attack_losses)}패`,
    attackRate: rate(stats.attack_win_rate),
    defenseRate: rate(stats.defense_win_rate),
    defenseResults: `${count(stats.defense_wins)}승 ${count(stats.defense_losses)}패 · ${count(stats.defense_count)}회`,
    unknown: unknown ? `승패 미확인 ${unknown}건은 승률에서 제외` : '',
  };
}
