create table public.guild_war_replay_analyses (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique check(length(source_key) between 1 and 200),
  title text not null check(length(title) between 1 and 200),
  occurred_at timestamptz not null,
  report jsonb not null check(jsonb_typeof(report)='object' and report->>'mode'='observed_replay' and octet_length(report::text)<=2097152),
  created_at timestamptz not null default now()
);
alter table public.guild_war_replay_analyses enable row level security;
revoke all on public.guild_war_replay_analyses from public, anon, authenticated;
grant select on public.guild_war_replay_analyses to authenticated;
create policy tier_four_replay_read on public.guild_war_replay_analyses
  for select to authenticated using ((select private.is_owner()));
