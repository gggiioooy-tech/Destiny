create function private.anonymous_battle_side(s jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('heroes',s->'heroes','heroIds',s->'heroIds','pet',s->'pet','petId',s->'petId','skills',s->'skills');
$$;
revoke all on function private.anonymous_battle_side(jsonb) from public,anon,authenticated;
create function private.anonymous_battle_history(p_offset integer default 0,p_limit integer default 500)
returns table(id uuid,source_key text,guild_name text,war_date date,occurred_at timestamptz,payload jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_approved_member() then raise exception '권한등급 2등급 이상만 검색할 수 있습니다.' using errcode='42501';end if;
 return query select d.id,d.id::text,null::text,d.war_date,d.occurred_at,
 jsonb_build_object('attacker',private.anonymous_battle_side(d.payload->'attacker'),'defender',private.anonymous_battle_side(d.payload->'defender'),
 'attackerWon',d.payload->'attackerWon','firstSkillSide',d.payload->'firstSkillSide','castle',d.payload->'castle')
 from (select distinct on(o.source_key) o.* from public.guild_war_observations o
 where o.kind='battle' and exists(select 1 from public.guild_war_tabs t where t.name=o.guild_name)
 order by o.source_key,o.created_at desc,o.id) d
 order by d.occurred_at desc,d.id limit least(greatest(coalesce(p_limit,500),1),500) offset greatest(coalesce(p_offset,0),0);
end$$;
revoke all on function private.anonymous_battle_history(integer,integer) from public,anon;
grant execute on function private.anonymous_battle_history(integer,integer) to authenticated;
create function public.anonymous_battle_history(p_offset integer default 0,p_limit integer default 500)
returns table(id uuid,source_key text,guild_name text,war_date date,occurred_at timestamptz,payload jsonb)
language sql stable security invoker set search_path='' as $$select * from private.anonymous_battle_history(p_offset,p_limit);$$;
revoke all on function public.anonymous_battle_history(integer,integer) from public,anon;
grant execute on function public.anonymous_battle_history(integer,integer) to authenticated;
