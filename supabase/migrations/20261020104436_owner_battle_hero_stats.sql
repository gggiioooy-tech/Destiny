-- All measurement columns remain protected by the existing tier-four-only RLS.
alter table public.guild_war_hero_speeds add column stats jsonb;
do $$
declare definition text;
begin
 select pg_get_functiondef('private.submit_guild_war_observation(text,text,timestamp with time zone,jsonb)'::regprocedure) into definition;
 if position('private_health=p_payload' in definition)=0 or position('private_stats' in definition)>0 then raise exception 'Unexpected ingestion definition'; end if;
 definition=replace(definition,'private_health jsonb;', 'private_health jsonb; private_stats jsonb; stat_pair record;');
 definition=replace(definition,'  private_health=p_payload',$patch$
  private_stats=p_payload->'heroStats';
  p_payload=p_payload-'heroStats';
  if private_stats is not null then
    if p_kind<>'battle' or jsonb_typeof(private_stats)<>'object' then raise exception 'Invalid hero stats' using errcode='22023'; end if;
    foreach side_name in array array['attacker','defender'] loop
      if jsonb_typeof(private_stats->side_name) is distinct from 'array' then raise exception 'Invalid stats side' using errcode='22023'; end if;
      if jsonb_array_length(private_stats->side_name)>3 then raise exception 'Too many hero stats' using errcode='22023'; end if;
      for measurement in select value from jsonb_array_elements(private_stats->side_name) loop
        if jsonb_typeof(measurement->'heroId') is distinct from 'number'
          or not coalesce(p_payload->side_name->'heroIds' @> jsonb_build_array(measurement->'heroId'),false)
          or jsonb_typeof(measurement->'stats') is distinct from 'object'
        then raise exception 'Invalid hero stat measurement' using errcode='22023'; end if;
        if (select count(*) from jsonb_object_keys(measurement->'stats'))>16 then raise exception 'Too many stats' using errcode='22023'; end if;
        for stat_pair in select key,value from jsonb_each(measurement->'stats') loop
          if stat_pair.key not in ('physicalAttack','magicalAttack','defence','hp','attackSpeed','critical','criticalDamage','weakPoint','accuracyRate','resistRate','blockRate','takeDamageRate','damageIncrease','fracture','resilience','rejuvenation')
            or jsonb_typeof(stat_pair.value) is distinct from 'number'
            or abs((stat_pair.value#>>'{}')::numeric)>2147483647
            or (stat_pair.value#>>'{}')::numeric<>trunc((stat_pair.value#>>'{}')::numeric)
          then raise exception 'Invalid stat value' using errcode='22023'; end if;
        end loop;
      end loop;
      if (select count(*)<>count(distinct value->>'heroId') from jsonb_array_elements(private_stats->side_name)) then raise exception 'Duplicate hero stats' using errcode='22023'; end if;
    end loop;
  end if;
  private_health=p_payload$patch$);
 definition=replace(definition,'  select exists(select 1 from public.guild_war_tabs',$patch$
  if private_stats is not null and guild is not null and (jsonb_array_length(private_stats->'attacker')>0 or jsonb_array_length(private_stats->'defender')>0) then
    insert into public.guild_war_hero_speeds(observation_id,speeds,stats)
    select o.id,coalesce(private_speeds,'{"attacker":[],"defender":[]}'::jsonb),private_stats from public.guild_war_observations o
    where o.guild_name=guild and o.kind='battle' and o.source_key=p_source_key
      and o.payload->'attacker'->'heroIds'=p_payload->'attacker'->'heroIds'
      and o.payload->'defender'->'heroIds'=p_payload->'defender'->'heroIds'
    on conflict(observation_id) do update set stats=excluded.stats
    where guild_war_hero_speeds.stats is null;
  end if;
  select exists(select 1 from public.guild_war_tabs$patch$);
 execute definition;
end $$;
