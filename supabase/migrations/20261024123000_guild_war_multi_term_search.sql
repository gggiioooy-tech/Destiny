-- Match all whitespace-separated terms before pagination; preserve guild authorization.
create or replace function private.guild_war_battle_page(p_guild text,p_war_date date,p_direction text,p_castle text default '',p_search text default '',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare result jsonb;off integer=greatest(coalesce(p_offset,0),0);begin
 if not private.can_read_guild_war(p_guild) then raise exception '이 길드전 열람 권한이 없습니다.' using errcode='42501';end if;
 if off>=150 then return jsonb_build_object('records','[]'::jsonb,'hasMore',false);end if;
 with page as materialized (
 select o.id,o.occurred_at,o.payload from public.guild_war_observations o
 where o.guild_name=p_guild and o.kind='battle' and o.war_date=p_war_date and o.direction=p_direction
 and (coalesce(p_castle,'')='' or o.payload->>'castle'=p_castle)
 and not exists (
   select 1 from regexp_split_to_table(lower(btrim(coalesce(p_search,''))), '[[:space:],，/、;]+') as terms(term)
   where term<>'' and position(term in lower(regexp_replace(concat_ws(' ',o.payload->>'castle',o.payload->'attacker'->>'nickname',o.payload->'defender'->>'nickname',o.payload->'attacker'->>'heroes',o.payload->'defender'->>'heroes',o.payload->'attacker'->>'pet',o.payload->'defender'->>'pet'),'[[:space:]]','','g')))=0
 )
 order by o.occurred_at desc,o.id limit least(31,150-off) offset off
 ), rows as (select * from page limit 30)
 select jsonb_build_object('records',coalesce((select jsonb_agg(to_jsonb(rows)) from rows),'[]'),'hasMore',off+30<150 and (select count(*) from page)>30) into result;
 return result;
end$$;
revoke all on function private.guild_war_battle_page(text,date,text,text,text,integer) from public,anon;
grant execute on function private.guild_war_battle_page(text,date,text,text,text,integer) to authenticated;
