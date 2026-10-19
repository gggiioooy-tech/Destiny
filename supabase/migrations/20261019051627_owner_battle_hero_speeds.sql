-- Highest administrator is the existing protected site-owner tier (admin + is_owner).
-- Keep per-hero measurements out of the generally readable battle JSON.
create table public.guild_war_hero_speeds (
  observation_id uuid primary key references public.guild_war_observations(id) on delete cascade,
  speeds jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.guild_war_hero_speeds enable row level security;
revoke all on public.guild_war_hero_speeds from public, anon, authenticated;
grant select on public.guild_war_hero_speeds to authenticated;
create policy owner_read_hero_speeds on public.guild_war_hero_speeds for select to authenticated
using ((select private.is_owner()) and exists (
  select 1 from public.guild_war_observations o where o.id=observation_id
));

do $$
declare definition text;
begin
 select pg_get_functiondef('private.submit_guild_war_observation(text,text,timestamp with time zone,jsonb)'::regprocedure) into definition;
 if position('insert into public.guild_war_observations' in definition)=0 then raise exception 'Unexpected ingestion function'; end if;
 definition=replace(definition,'side_name text;', 'side_name text; private_speeds jsonb; measurement jsonb;');
 definition=replace(definition,'  insert into public.guild_war_observations', $patch$
  private_speeds=p_payload->'heroSpeeds';
  p_payload=p_payload-'heroSpeeds';
  if private_speeds is not null then
    if p_kind<>'battle' or jsonb_typeof(private_speeds)<>'object' then raise exception 'Invalid hero speeds' using errcode='22023'; end if;
    foreach side_name in array array['attacker','defender'] loop
      if jsonb_typeof(private_speeds->side_name) is distinct from 'array' then raise exception 'Invalid speed side' using errcode='22023'; end if;
      if jsonb_array_length(private_speeds->side_name)>3 then raise exception 'Too many hero speeds' using errcode='22023'; end if;
      for measurement in select value from jsonb_array_elements(private_speeds->side_name) loop
        if jsonb_typeof(measurement->'heroId') is distinct from 'number'
          or jsonb_typeof(measurement->'value') is distinct from 'number'
          or (measurement->>'value')::numeric not between 0 and 1000000
          or (measurement->>'value')::numeric<>trunc((measurement->>'value')::numeric)
          or not coalesce(p_payload->side_name->'heroIds' @> jsonb_build_array(measurement->'heroId'),false)
        then raise exception 'Invalid hero speed measurement' using errcode='22023'; end if;
      end loop;
      if (select count(*)<>count(distinct value->>'heroId') from jsonb_array_elements(private_speeds->side_name)) then raise exception 'Duplicate hero speed' using errcode='22023'; end if;
    end loop;
  end if;
  insert into public.guild_war_observations$patch$);
 definition=replace(definition,'  select exists(select 1 from public.guild_war_tabs', $patch$
  if private_speeds is not null and guild is not null then
    insert into public.guild_war_hero_speeds(observation_id,speeds)
    select o.id,private_speeds from public.guild_war_observations o
    where o.guild_name=guild and o.kind='battle' and o.source_key=p_source_key
      and o.payload->'attacker'->'heroIds'=p_payload->'attacker'->'heroIds'
      and o.payload->'defender'->'heroIds'=p_payload->'defender'->'heroIds'
      and (jsonb_array_length(private_speeds->'attacker')>0 or jsonb_array_length(private_speeds->'defender')>0)
    on conflict(observation_id) do nothing;
  end if;
  select exists(select 1 from public.guild_war_tabs$patch$);
 execute definition;
end $$;
