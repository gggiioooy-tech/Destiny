create or replace function private.can_read_guild_war(p_guild text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_admin() or (private.valid_session() and exists(
   select 1 from public.profiles p cross join lateral regexp_split_to_table(coalesce(p.memo,''),',') g
   where p.auth_user_id=auth.uid() and p.status='approved' and not p.must_change_password
   and p.role in ('guest','member') and btrim(g)<>'' and btrim(g)=p_guild
 ));
$$;
