-- Reuse the owner-only measurement table and its existing RLS policy.
alter table public.guild_war_hero_speeds add column health jsonb;
do $$
declare definition text;
begin
 select pg_get_functiondef('private.submit_guild_war_observation(text,text,timestamp with time zone,jsonb)'::regprocedure) into definition;
 if position('private_speeds=p_payload' in definition)=0 or position('private_health' in definition)>0 then raise exception 'Unexpected ingestion definition'; end if;
 definition=replace(definition,'private_speeds jsonb;', 'private_speeds jsonb; private_health jsonb;');
 definition=replace(definition,'  private_speeds=p_payload', $patch$
  private_health=p_payload->'heroHealth';
  p_payload=p_payload-'heroHealth';
  if private_health is not null then
    if p_kind<>'battle' or jsonb_typeof(private_health)<>'object' then raise exception 'Invalid hero health' using errcode='22023'; end if;
    foreach side_name in array array['attacker','defender'] loop
      if jsonb_typeof(private_health->side_name) is distinct from 'array' then raise exception 'Invalid health side' using errcode='22023'; end if;
      if jsonb_array_length(private_health->side_name)>3 then raise exception 'Too many hero health values' using errcode='22023'; end if;
      for measurement in select value from jsonb_array_elements(private_health->side_name) loop
        if jsonb_typeof(measurement->'heroId') is distinct from 'number'
          or jsonb_typeof(measurement->'value') is distinct from 'number'
          or (measurement->>'value')::numeric not between 1 and 2147483647
          or (measurement->>'value')::numeric<>trunc((measurement->>'value')::numeric)
          or not coalesce(p_payload->side_name->'heroIds' @> jsonb_build_array(measurement->'heroId'),false)
        then raise exception 'Invalid hero health measurement' using errcode='22023'; end if;
      end loop;
      if (select count(*)<>count(distinct value->>'heroId') from jsonb_array_elements(private_health->side_name)) then raise exception 'Duplicate hero health' using errcode='22023'; end if;
    end loop;
  end if;
  private_speeds=p_payload$patch$);
 definition=replace(definition,'  select exists(select 1 from public.guild_war_tabs', $patch$
  if private_health is not null and guild is not null and (jsonb_array_length(private_health->'attacker')>0 or jsonb_array_length(private_health->'defender')>0) then
    insert into public.guild_war_hero_speeds(observation_id,speeds,health)
    select o.id,coalesce(private_speeds,'{"attacker":[],"defender":[]}'::jsonb),private_health from public.guild_war_observations o
    where o.guild_name=guild and o.kind='battle' and o.source_key=p_source_key
      and o.payload->'attacker'->'heroIds'=p_payload->'attacker'->'heroIds'
      and o.payload->'defender'->'heroIds'=p_payload->'defender'->'heroIds'
    on conflict(observation_id) do update set health=excluded.health
    where guild_war_hero_speeds.health is null;
  end if;
  select exists(select 1 from public.guild_war_tabs$patch$);
 execute definition;
end $$;
