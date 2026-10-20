-- Index the member on our side, never the opposing guild's similarly named player.
alter table public.guild_war_observations add column member_nickname text
 generated always as (normalize(btrim(case direction when 'attack' then payload#>>'{attacker,nickname}' when 'defense' then payload#>>'{defender,nickname}' end), NFC)) stored;
create index guild_member_battle_stats_idx on public.guild_war_observations(guild_name,member_nickname,occurred_at)
 include(direction,battle_won) where kind='battle';

create table private.member_battle_stats_state (
 singleton boolean primary key default true check(singleton),
 since_at timestamptz not null default '-infinity',
 reset_at timestamptz,
 reset_by uuid references auth.users(id) on delete set null
);
alter table private.member_battle_stats_state enable row level security;
revoke all on private.member_battle_stats_state from public,anon,authenticated;
insert into private.member_battle_stats_state(singleton) values(true);

-- Internal, non-exposed aggregate: no payloads or member details are sent to the browser.
create function private.member_battle_statistics_rows(p_since timestamptz)
returns table(auth_user_id uuid,attack_count bigint,attack_wins bigint,attack_losses bigint,attack_unknown bigint,attack_win_rate numeric,
 defense_count bigint,defense_wins bigint,defense_losses bigint,defense_unknown bigint,defense_win_rate numeric)
language sql stable security invoker set search_path='' as $$
 with memberships as (
  select distinct p.auth_user_id,normalize(btrim(p.game_nickname), NFC) nickname,btrim(g.name) guild
  from public.profiles p cross join lateral regexp_split_to_table(coalesce(p.memo,''),',') g(name)
  where p.auth_user_id is not null and btrim(g.name)<>'' and btrim(coalesce(p.game_nickname,''))<>''
 ), totals as (
  select o.guild_name,o.member_nickname,o.direction,count(*) total,
   count(*) filter(where o.battle_won=(o.direction='attack')) wins,
   count(*) filter(where o.battle_won is not null and o.battle_won<>(o.direction='attack')) losses,
   count(*) filter(where o.battle_won is null) unknown
  from public.guild_war_observations o
  where o.kind='battle' and o.direction in ('attack','defense') and o.occurred_at>p_since
  group by o.guild_name,o.member_nickname,o.direction
 ), member_totals as (
  select m.auth_user_id,
   coalesce(sum(t.total) filter(where t.direction='attack'),0)::bigint ac,
   coalesce(sum(t.wins) filter(where t.direction='attack'),0)::bigint aw,
   coalesce(sum(t.losses) filter(where t.direction='attack'),0)::bigint al,
   coalesce(sum(t.unknown) filter(where t.direction='attack'),0)::bigint au,
   coalesce(sum(t.total) filter(where t.direction='defense'),0)::bigint dc,
   coalesce(sum(t.wins) filter(where t.direction='defense'),0)::bigint dw,
   coalesce(sum(t.losses) filter(where t.direction='defense'),0)::bigint dl,
   coalesce(sum(t.unknown) filter(where t.direction='defense'),0)::bigint du
  from memberships m left join totals t on t.guild_name=m.guild and t.member_nickname=m.nickname group by m.auth_user_id
 )
 select p.auth_user_id,coalesce(m.ac,0),coalesce(m.aw,0),coalesce(m.al,0),coalesce(m.au,0),round(100.0*m.aw/nullif(m.aw+m.al,0),1),
 coalesce(m.dc,0),coalesce(m.dw,0),coalesce(m.dl,0),coalesce(m.du,0),round(100.0*m.dw/nullif(m.dw+m.dl,0),1)
 from public.profiles p left join member_totals m on m.auth_user_id=p.auth_user_id where p.auth_user_id is not null;
$$;
revoke all on function private.member_battle_statistics_rows(timestamptz) from public,anon,authenticated;

create function private.member_guild_battle_statistics() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare state private.member_battle_stats_state; result jsonb;
begin
 if auth.uid() is null or not private.is_admin() then raise exception '관리자만 회원 통계를 볼 수 있습니다.' using errcode='42501';end if;
 select * into strict state from private.member_battle_stats_state where singleton;
 select jsonb_build_object('resetAt',state.reset_at,'members',coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb)) into result
 from private.member_battle_statistics_rows(state.since_at) s;
 return result;
end$$;
revoke all on function private.member_guild_battle_statistics() from public,anon;
grant execute on function private.member_guild_battle_statistics() to authenticated;
create function public.member_guild_battle_statistics() returns jsonb
language sql stable security invoker set search_path='' as $$select private.member_guild_battle_statistics();$$;
revoke all on function public.member_guild_battle_statistics() from public,anon;
grant execute on function public.member_guild_battle_statistics() to authenticated;

create function private.reset_member_guild_battle_statistics() returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare cutoff timestamptz;
begin
 if auth.uid() is null or not private.is_owner() then raise exception '권한등급 4등급만 전체 통계를 초기화할 수 있습니다.' using errcode='42501';end if;
 -- Lock the singleton before choosing the cutoff so concurrent resets cannot move it backwards.
 perform 1 from private.member_battle_stats_state where singleton for update;
 cutoff=clock_timestamp();
 update private.member_battle_stats_state set since_at=cutoff,reset_at=cutoff,reset_by=auth.uid() where singleton;
 return jsonb_build_object('resetAt',cutoff);
end$$;
revoke all on function private.reset_member_guild_battle_statistics() from public,anon;
grant execute on function private.reset_member_guild_battle_statistics() to authenticated;
create function public.reset_member_guild_battle_statistics() returns jsonb
language sql volatile security invoker set search_path='' as $$select private.reset_member_guild_battle_statistics();$$;
revoke all on function public.reset_member_guild_battle_statistics() from public,anon;
grant execute on function public.reset_member_guild_battle_statistics() to authenticated;
analyze public.guild_war_observations;
