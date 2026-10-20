create function private.my_guild_battle_statistics() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare caller uuid=auth.uid(); cutoff timestamptz; reset_time timestamptz; stats jsonb;
begin
 if caller is null or not private.valid_session() or not exists(
  select 1 from public.profiles p where p.auth_user_id=caller and p.status='approved' and not p.must_change_password and p.role in ('guest','member','admin')
 ) then raise exception '승인된 회원만 본인 통계를 볼 수 있습니다.' using errcode='42501';end if;
 select since_at,reset_at into strict cutoff,reset_time from private.member_battle_stats_state where singleton;
 select to_jsonb(s)-'auth_user_id' into stats from private.member_battle_statistics_rows(cutoff) s where s.auth_user_id=caller;
 return jsonb_build_object('stats',coalesce(stats,'{}'::jsonb),'resetAt',reset_time);
end$$;
revoke all on function private.my_guild_battle_statistics() from public,anon;
grant execute on function private.my_guild_battle_statistics() to authenticated;
create function public.my_guild_battle_statistics() returns jsonb
language sql stable security invoker set search_path='' as $$select private.my_guild_battle_statistics();$$;
revoke all on function public.my_guild_battle_statistics() from public,anon;
grant execute on function public.my_guild_battle_statistics() to authenticated;
