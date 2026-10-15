begin;
alter table public.guild_war_observations add column war_date date;
alter table public.guild_war_observations add column direction text check(direction in ('attack','defense'));
-- Legacy observations retain their KST date; unknown direction is never guessed from a win/loss.
update public.guild_war_observations set war_date=(occurred_at at time zone 'Asia/Seoul')::date;
alter table public.guild_war_observations alter column war_date set not null;
create function private.validate_guild_war_period() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if coalesce(new.payload->>'warDate','') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception '길드전 시작 날짜(warDate)가 필요합니다.' using errcode='22023';
  end if;
  new.war_date=(new.payload->>'warDate')::date;
  if new.war_date>(now() at time zone 'Asia/Seoul')::date or new.war_date>(new.occurred_at at time zone 'Asia/Seoul')::date then
    raise exception '길드전 날짜를 확인해 주세요.' using errcode='22023';
  end if;
  new.direction=null;
  if new.kind='battle' then
    if coalesce(new.payload->>'direction','') not in ('attack','defense') then
      raise exception '소속 길드 기준 공격/방어 구분(direction)이 필요합니다.' using errcode='22023';
    end if;
    new.direction=new.payload->>'direction';
  end if;
  return new;
end $$;
revoke all on function private.validate_guild_war_period() from public,anon,authenticated;
create trigger guild_war_period before insert on public.guild_war_observations for each row execute function private.validate_guild_war_period();
create index guild_war_observations_period on public.guild_war_observations(guild_name,war_date,kind,direction,occurred_at desc);

create function public.guild_war_dates(p_guild text) returns table(war_date date)
language sql stable security invoker set search_path='' as $$
  select distinct o.war_date from public.guild_war_observations o where o.guild_name=p_guild order by o.war_date desc;
$$;
create function public.guild_war_battles(p_guild text,p_war_date date,p_direction text,p_castle text default '',p_search text default '')
returns setof public.guild_war_observations language sql stable security invoker set search_path='' as $$
  select d.* from (
    select distinct on (o.source_key) o.* from public.guild_war_observations o
    where o.guild_name=p_guild and o.war_date=p_war_date and o.kind='battle' and o.direction=p_direction
    order by o.source_key,o.created_at desc,o.id
  ) d where (coalesce(p_castle,'')='' or d.payload->>'castle'=p_castle)
  and (coalesce(btrim(p_search),'')='' or position(
    lower(regexp_replace(btrim(p_search),'\s','','g')) in
    lower(regexp_replace(concat_ws(' ',d.payload->>'castle',d.payload->'attacker'->>'nickname',d.payload->'defender'->>'nickname',d.payload->'attacker'->>'heroes',d.payload->'defender'->>'heroes',d.payload->'attacker'->>'pet',d.payload->'defender'->>'pet'),'\s','','g'))
  )>0)
  order by d.occurred_at desc,d.id limit 150;
$$;
revoke all on function public.guild_war_dates(text),public.guild_war_battles(text,date,text,text,text) from public,anon;
grant execute on function public.guild_war_dates(text),public.guild_war_battles(text,date,text,text,text) to authenticated;
commit;
