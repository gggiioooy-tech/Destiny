// Keep unrelated content out of the initial login/bootstrap requests.
export function pageTables(page, user) {
  if (!user || !['guest', 'member', 'admin'].includes(user.role)) return [];
  const admin = user.role === 'admin';
  if (page === 'members' || page === 'guildWarAdd' || page === 'board') return admin ? ['profiles'] : [];
  if (page === 'attack' || page === 'temporaryAttack') return user?.role === 'guest' ? [] : ['enemy_defense_teams', 'attack_teams'];
  if (page?.startsWith('guildWar:')) return admin ? ['enemy_defense_teams'] : [];
  if (page === 'total') return user.role === 'guest' ? [] : ['total_war_teams'];
  return [];
}
export function pageQuery(client, table, signal) {
  let query = client.from(table).select('*');
  if (table === 'profiles') query = query.order('created_at', { ascending: false });
  else query = query.order('sort_order');
  if (table === 'enemy_defense_teams') query = query.range(0, 5000);
  return query.abortSignal(signal);
}
