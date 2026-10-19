-- Do not broaden is_approved_member: guides/counters remain level 2+.
create function private.can_read_guild_war(p_guild text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_approved_member() or (private.valid_session() and exists(
   select 1 from public.profiles p cross join lateral regexp_split_to_table(coalesce(p.memo,''),',') g
   where p.auth_user_id=auth.uid() and p.status='approved' and not p.must_change_password
   and p.role='guest' and btrim(g)<>'' and btrim(g)=p_guild
 ));
$$;
create function private.can_use_collector() returns boolean
language sql stable security definer set search_path='' as $$
 select private.valid_session() and exists(select 1 from public.profiles where auth_user_id=auth.uid()
 and status='approved' and not must_change_password and role in ('guest','member','admin'));
$$;
revoke all on function private.can_read_guild_war(text),private.can_use_collector() from public,anon;
grant execute on function private.can_read_guild_war(text),private.can_use_collector() to authenticated;
alter policy guild_tabs_read on public.guild_war_tabs using (private.can_read_guild_war(name));
alter policy guild_observations_read on public.guild_war_observations using (
 private.can_read_guild_war(guild_name) and exists(select 1 from public.guild_war_tabs t where t.name=guild_name)
);
do $$declare f regprocedure; definition text;begin
 foreach f in array array['private.collector_setup_profile()'::regprocedure,'public.collector_sync_periods(jsonb)'::regprocedure,'private.submit_guild_war_observation(text,text,timestamptz,jsonb)'::regprocedure] loop
  select pg_get_functiondef(f) into definition;
  if position('private.is_approved_member()' in definition)=0 then raise exception 'Unexpected collector authorization';end if;
  execute replace(definition,'private.is_approved_member()','private.can_use_collector()');
 end loop;
end$$;
