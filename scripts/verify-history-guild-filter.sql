-- Uses existing valid sessions only inside this rolled-back transaction.
-- Does not change member profiles, memberships, or session state.
begin;
do $$
declare identity record; scope text; tokens jsonb; result jsonb; details jsonb;
 expected integer; tested integer=0;
begin
 if has_function_privilege('anon','public.search_battle_history_by_guild(text,jsonb,text[],text[],text,integer,integer)','EXECUTE')
 or has_function_privilege('anon','public.battle_history_guilds()','EXECUTE') then raise exception 'Anonymous RPC grant';end if;
 select jsonb_build_array(jsonb_agg(name)) into tokens from (select distinct unnest(defense_heroes) name from public.guild_war_observations where kind='battle') n;
 for identity in
  select distinct on (p.role) p.role,p.auth_user_id uid,s.id sid
  from public.profiles p join auth.sessions s on s.user_id=p.auth_user_id
  where p.status='approved' and not p.must_change_password and p.role in ('admin','member')
  and (s.not_after is null or s.not_after>now()) order by p.role,s.created_at desc
 loop
  perform set_config('request.jwt.claims',json_build_object('sub',identity.uid,'session_id',identity.sid,'role','authenticated')::text,true);
  if not private.is_approved_member() then continue;end if;
  tested=tested+1;
  foreach scope in array array['노을','철폐'] loop
   result=public.search_battle_history_by_guild(scope,tokens,p_limit=>30);
   select count(distinct source_key) into expected from public.guild_war_observations o
    where kind='battle' and guild_name=scope and cardinality(attack_heroes)=3
    and exists(select 1 from public.guild_war_tabs t where t.name=o.guild_name);
   if (result->>'totalRecords')::integer<>expected then raise exception 'Guild total mismatch: %',scope;end if;
   if jsonb_array_length(result->'groups')>0 then
    details=public.search_battle_history_by_guild(scope,tokens,p_attack=>array(select jsonb_array_elements_text(result->'groups'->0->'heroes')),p_limit=>1);
    if exists(select 1 from jsonb_array_elements(details->'records') r where
      case when identity.role='admin' then r->>'guild_name' is distinct from scope
      else r->>'guild_name' is not null or r->'payload' ? 'opponentGuild' or r->'payload' ? 'firstSkillSide' or r->'payload'->'attacker' ? 'nickname' end)
    then raise exception 'Detail scope or privacy mismatch';end if;
   end if;
  end loop;
  result=public.search_battle_history_by_guild(null,tokens);
  if result is distinct from public.search_battle_history(tokens) then raise exception 'All-guild behavior changed';end if;
  if not ('노을'=any(public.battle_history_guilds())) then raise exception 'Missing registered guild';end if;
 end loop;
 if tested<>2 then raise exception 'Need valid admin and member sessions to verify both projections';end if;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 begin
  perform public.battle_history_guilds();raise exception 'Unauthenticated guild names allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform public.search_battle_history_by_guild('노을',tokens);raise exception 'Unauthenticated search allowed';
 exception when insufficient_privilege then null;end;
end$$;
rollback;
select 'PASS guild totals, detail scope, member anonymity, all-guild compatibility and authorization; rolled back' result;
