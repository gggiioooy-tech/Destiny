create function private.search_battle_history_by_guild(p_guild text default null,p_tokens jsonb default '[]',p_defense text[] default null,p_attack text[] default null,p_sort text default 'count',p_offset integer default 0,p_limit integer default 20) returns jsonb
language plpgsql stable security definer set search_path='' set plan_cache_mode='force_custom_plan' as $$
declare admin boolean; result jsonb; exact_def text[]; exact_atk text[]; lim integer=least(greatest(coalesce(p_limit,20),1),30); off integer=greatest(coalesce(p_offset,0),0);
begin
 if not private.is_approved_member() then raise exception '권한등급 2등급 이상만 검색할 수 있습니다.' using errcode='42501';end if;
 admin=private.is_admin();
 if p_tokens is null or jsonb_typeof(p_tokens)<>'array' or jsonb_array_length(p_tokens)>12 or octet_length(p_tokens::text)>50000 then raise exception '검색어 오류' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_tokens) t where jsonb_typeof(t)<>'array') then raise exception '검색어 오류' using errcode='22023';end if;
 if p_defense is not null and cardinality(p_defense)<>3 or p_attack is not null and cardinality(p_attack)<>3 then raise exception '영웅 조합 오류' using errcode='22023';end if;
 select array_agg(x order by x collate "C") into exact_def from unnest(p_defense) x;
 select array_agg(x order by x collate "C") into exact_atk from unnest(p_attack) x;
 if exact_def is null and jsonb_array_length(p_tokens)=0 then return jsonb_build_object('groups','[]'::jsonb,'records','[]'::jsonb,'totalGroups',0,'totalRecords',0,'hasMore',false);end if;
 if exact_atk is null then
  with matched as materialized (
   select distinct on(o.source_key) o.source_key,o.attack_heroes,o.battle_won
   from public.guild_war_observations o where o.kind='battle' and cardinality(o.attack_heroes)=3
   and exists(select 1 from public.guild_war_tabs t where t.name=o.guild_name)
   and (nullif(btrim(p_guild),'') is null or o.guild_name=btrim(p_guild))
   and (exact_def is null or o.defense_heroes=exact_def)
   and (jsonb_array_length(p_tokens)=0 or o.defense_heroes && array(select jsonb_array_elements_text(p_tokens->0)))
   and private.history_tokens_match(o.defense_heroes,p_tokens)
   order by o.source_key,o.created_at desc,o.id
  ), groups as (
   select attack_heroes heroes,count(*) count,count(*) filter(where battle_won=true) wins,count(*) filter(where battle_won=false) losses,
   count(*) filter(where battle_won=true)::numeric/nullif(count(battle_won),0) rate from matched group by attack_heroes
  ), page as (
   select * from groups order by case when p_sort='rate' then rate end desc nulls last,count desc,heroes limit lim offset off
  ) select jsonb_build_object('groups',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'),
   'totalGroups',(select count(*) from groups),'totalRecords',(select count(*) from matched),'hasMore',off+lim<(select count(*) from groups)) into result;
 else
  with matched as (
   select distinct on(o.source_key) o.id,o.source_key,o.occurred_at
   from public.guild_war_observations o where o.kind='battle' and o.attack_heroes=exact_atk
   and exists(select 1 from public.guild_war_tabs t where t.name=o.guild_name)
   and (nullif(btrim(p_guild),'') is null or o.guild_name=btrim(p_guild))
   and (exact_def is null or o.defense_heroes=exact_def)
   and (jsonb_array_length(p_tokens)=0 or o.defense_heroes && array(select jsonb_array_elements_text(p_tokens->0)))
   and private.history_tokens_match(o.defense_heroes,p_tokens)
   order by o.source_key,o.created_at desc,o.id
  ), page as materialized (select * from matched order by occurred_at desc,id limit lim+1 offset off), rows as (
   select o.id,case when admin then o.source_key else o.id::text end source_key,case when admin then o.guild_name end guild_name,o.war_date,o.occurred_at,
   case when admin then o.payload else jsonb_build_object('attacker',private.anonymous_battle_side(o.payload->'attacker'),'defender',private.anonymous_battle_side(o.payload->'defender'),'attackerWon',o.payload->'attackerWon','castle',o.payload->'castle') end payload
   from page p join public.guild_war_observations o on o.id=p.id order by p.occurred_at desc,p.id limit lim
  ) select jsonb_build_object('records',coalesce((select jsonb_agg(to_jsonb(rows)) from rows),'[]'),'hasMore',(select count(*) from page)>lim) into result;
 end if;
 return result;
end$$;
revoke all on function private.search_battle_history_by_guild(text,jsonb,text[],text[],text,integer,integer) from public,anon;
grant execute on function private.search_battle_history_by_guild(text,jsonb,text[],text[],text,integer,integer) to authenticated;
create function public.search_battle_history_by_guild(p_guild text default null,p_tokens jsonb default '[]',p_defense text[] default null,p_attack text[] default null,p_sort text default 'count',p_offset integer default 0,p_limit integer default 20) returns jsonb
language sql stable security invoker set search_path='' as $$select private.search_battle_history_by_guild(p_guild,p_tokens,p_defense,p_attack,p_sort,p_offset,p_limit);$$;
revoke all on function public.search_battle_history_by_guild(text,jsonb,text[],text[],text,integer,integer) from public,anon;
grant execute on function public.search_battle_history_by_guild(text,jsonb,text[],text[],text,integer,integer) to authenticated;


-- Only registered collection guild names; battle identities remain in the
-- existing permission-aware projection, including anonymous member results.
create function private.battle_history_guilds() returns text[]
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_approved_member() then raise exception '권한등급 2등급 이상만 검색할 수 있습니다.' using errcode='42501';end if;
 return coalesce((select array_agg(t.name order by t.created_at,t.name) from public.guild_war_tabs t),'{}'::text[]);
end$$;
revoke all on function private.battle_history_guilds() from public,anon;
grant execute on function private.battle_history_guilds() to authenticated;
create function public.battle_history_guilds() returns text[]
language sql stable security invoker set search_path='' as $$select private.battle_history_guilds();$$;
revoke all on function public.battle_history_guilds() from public,anon;
grant execute on function public.battle_history_guilds() to authenticated;
