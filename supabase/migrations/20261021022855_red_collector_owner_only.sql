alter table public.guild_war_hero_speeds add column replay jsonb;
-- Move historical replay-only values out of every generally readable battle.
insert into public.guild_war_hero_speeds(observation_id,speeds,replay)
select id,'{"attacker":[],"defender":[]}'::jsonb,jsonb_build_object('attackerSkills',coalesce(payload->'attacker'->'skills','[]'::jsonb),'defenderSkills',coalesce(payload->'defender'->'skills','[]'::jsonb),'firstSkillSide',payload->'firstSkillSide')
from public.guild_war_observations where kind='battle' and (coalesce(payload->'attacker'->'skills','[]'::jsonb)<>'[]'::jsonb or coalesce(payload->'defender'->'skills','[]'::jsonb)<>'[]'::jsonb or payload->>'firstSkillSide' is not null)
on conflict(observation_id) do update set replay=excluded.replay;
update public.guild_war_observations set payload=jsonb_set(jsonb_set(payload-'firstSkillSide','{attacker,skills}','[]'::jsonb),'{defender,skills}','[]'::jsonb)
where kind='battle' and (payload ? 'firstSkillSide' or coalesce(payload->'attacker'->'skills','[]'::jsonb)<>'[]'::jsonb or coalesce(payload->'defender'->'skills','[]'::jsonb)<>'[]'::jsonb);
create function public.red_collector_access() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and private.is_owner()$$;
revoke all on function public.red_collector_access() from public,anon;
grant execute on function public.red_collector_access() to authenticated;
do $$
declare definition text;
begin
 select pg_get_functiondef('private.submit_guild_war_observation(text,text,timestamp with time zone,jsonb)'::regprocedure) into definition;
 if position('private_defense_skills=p_payload' in definition)=0 then raise exception 'Unexpected ingestion definition'; end if;
 definition=replace(definition,'private_defense_skills jsonb;', 'private_defense_skills jsonb; private_replay jsonb; replay_side text;');
 definition=replace(definition,'  private_defense_skills=p_payload',$patch$
  if p_kind='battle' then
    if (coalesce(p_payload->'attacker'->'skills','[]'::jsonb)<>'[]'::jsonb or coalesce(p_payload->'defender'->'skills','[]'::jsonb)<>'[]'::jsonb or p_payload->>'firstSkillSide' is not null or p_payload ?| array['heroSpeeds','heroHealth','heroStats']) and not private.is_owner() then
      raise exception '빨간약 수집 정보는 권한등급 4등급만 전송할 수 있습니다. PC 수집기를 최신 버전으로 업데이트해 주세요.' using errcode='42501';
    end if;
    foreach replay_side in array array['attacker','defender'] loop
      if p_payload->replay_side ? 'skills' then
        if jsonb_typeof(p_payload->replay_side->'skills') is distinct from 'array' or jsonb_array_length(p_payload->replay_side->'skills')>3 then raise exception 'Invalid replay skills' using errcode='22023'; end if;
        for skill_item in select value from jsonb_array_elements(p_payload->replay_side->'skills') loop
          if jsonb_typeof(skill_item->'heroId') is distinct from 'number' or not coalesce(p_payload->replay_side->'heroIds' @> jsonb_build_array(skill_item->'heroId'),false) or jsonb_typeof(skill_item->'skillType') is distinct from 'number' or jsonb_typeof(skill_item->'order') is distinct from 'number' then raise exception 'Invalid replay skill' using errcode='22023'; end if;
        end loop;
      end if;
    end loop;
    if coalesce(p_payload->'attacker'->'skills','[]'::jsonb)<>'[]'::jsonb or coalesce(p_payload->'defender'->'skills','[]'::jsonb)<>'[]'::jsonb or p_payload->>'firstSkillSide' is not null then
      private_replay=jsonb_build_object('attackerSkills',coalesce(p_payload->'attacker'->'skills','[]'::jsonb),'defenderSkills',coalesce(p_payload->'defender'->'skills','[]'::jsonb),'firstSkillSide',p_payload->'firstSkillSide');
    end if;
    p_payload=jsonb_set(jsonb_set(p_payload-'firstSkillSide','{attacker,skills}','[]'::jsonb),'{defender,skills}','[]'::jsonb);
  end if;
  private_defense_skills=p_payload$patch$);
 definition=replace(definition,'  select exists(select 1 from public.guild_war_tabs',$patch$
  if private_replay is not null and guild is not null then
    insert into public.guild_war_hero_speeds(observation_id,speeds,replay)
    select o.id,coalesce(private_speeds,'{"attacker":[],"defender":[]}'::jsonb),private_replay from public.guild_war_observations o
    where o.guild_name=guild and o.kind='battle' and o.source_key=p_source_key
      and o.payload->'attacker'->'heroIds'=p_payload->'attacker'->'heroIds'
      and o.payload->'defender'->'heroIds'=p_payload->'defender'->'heroIds'
    on conflict(observation_id) do update set replay=excluded.replay where guild_war_hero_speeds.replay is null;
  end if;
  select exists(select 1 from public.guild_war_tabs$patch$);
 execute definition;
end $$;
