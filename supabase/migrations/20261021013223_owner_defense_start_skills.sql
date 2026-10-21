create table public.guild_war_defense_skills (
 observation_id uuid primary key references public.guild_war_observations(id) on delete cascade,
 skills jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.guild_war_defense_skills enable row level security;
revoke all on public.guild_war_defense_skills from public,anon,authenticated;
grant select on public.guild_war_defense_skills to authenticated;
create policy owner_read_defense_skills on public.guild_war_defense_skills for select to authenticated
using ((select private.is_owner()) and exists(select 1 from public.guild_war_observations o where o.id=observation_id));
do $$
declare definition text;
begin
 select pg_get_functiondef('private.submit_guild_war_observation(text,text,timestamp with time zone,jsonb)'::regprocedure) into definition;
 if position('private_stats=p_payload' in definition)=0 then raise exception 'Unexpected ingestion definition'; end if;
 definition=replace(definition,'private_stats jsonb;', 'private_stats jsonb; private_defense_skills jsonb; skill_row jsonb; skill_item jsonb; defense_index integer;');
 definition=replace(definition,'  private_stats=p_payload',$patch$
  private_defense_skills=p_payload->'defenseSkills';
  p_payload=p_payload-'defenseSkills';
  if private_defense_skills is not null then
    if p_kind<>'defense_snapshot' or jsonb_typeof(private_defense_skills)<>'array' then raise exception 'Invalid defense skills' using errcode='22023'; end if;
    if jsonb_array_length(private_defense_skills)>300 then raise exception 'Too many defense skills' using errcode='22023'; end if;
    for skill_row in select value from jsonb_array_elements(private_defense_skills) loop
      if jsonb_typeof(skill_row->'index') is distinct from 'number' or (skill_row->>'index')::numeric<>trunc((skill_row->>'index')::numeric) then raise exception 'Invalid defense index' using errcode='22023'; end if;
      defense_index=(skill_row->>'index')::integer;
      if defense_index<0 or defense_index>=jsonb_array_length(p_payload->'defenses') or jsonb_typeof(skill_row->'skills') is distinct from 'array' then raise exception 'Invalid defense skill row' using errcode='22023'; end if;
      if jsonb_array_length(skill_row->'skills')>3 then raise exception 'Too many skills' using errcode='22023'; end if;
      for skill_item in select value from jsonb_array_elements(skill_row->'skills') loop
        if jsonb_typeof(skill_item->'heroId') is distinct from 'number' or not coalesce(p_payload->'defenses'->defense_index->'heroIds' @> jsonb_build_array(skill_item->'heroId'),false)
          or jsonb_typeof(skill_item->'skillType') is distinct from 'number' or (skill_item->>'skillType')::numeric not in (2,3,7)
          or jsonb_typeof(skill_item->'order') is distinct from 'number' or (skill_item->>'order')::numeric not in (1,2,3)
        then raise exception 'Invalid defense skill' using errcode='22023'; end if;
      end loop;
      if (select count(*)<>count(distinct value->>'order') from jsonb_array_elements(skill_row->'skills')) then raise exception 'Duplicate skill order' using errcode='22023'; end if;
    end loop;
    if (select count(*)<>count(distinct value->>'index') from jsonb_array_elements(private_defense_skills)) then raise exception 'Duplicate defense index' using errcode='22023'; end if;
  end if;
  -- Only public roster fields may enter the generally readable snapshot JSON.
  if p_kind='defense_snapshot' then
    p_payload=jsonb_set(p_payload,'{defenses}',coalesce((select jsonb_agg(jsonb_build_object('castle',d->'castle','nickname',d->'nickname','heroIds',d->'heroIds','heroes',d->'heroes','petId',d->'petId','pet',d->'pet') order by ord)
      from jsonb_array_elements(p_payload->'defenses') with ordinality as x(d,ord)),'[]'::jsonb));
  end if;
  private_stats=p_payload$patch$);
 definition=replace(definition,'  select exists(select 1 from public.guild_war_tabs',$patch$
  if private_defense_skills is not null and guild is not null and jsonb_array_length(private_defense_skills)>0 then
    insert into public.guild_war_defense_skills(observation_id,skills)
    select o.id,private_defense_skills from public.guild_war_observations o
    where o.guild_name=guild and o.kind='defense_snapshot' and o.source_key=p_source_key
    on conflict(observation_id) do nothing;
  end if;
  select exists(select 1 from public.guild_war_tabs$patch$);
 execute definition;
end $$;
