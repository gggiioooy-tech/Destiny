alter table public.guild_war_observations add constraint guild_war_first_skill_side check (payload->>'firstSkillSide' is null or payload->>'firstSkillSide' in ('attacker','defender'));
do $$
declare definition text;
begin
 select pg_get_functiondef('private.submit_guild_war_observation(text,text,timestamp with time zone,jsonb)'::regprocedure) into definition;
 definition=replace(definition,'  select exists(select 1 from public.guild_war_tabs', $patch$
  if p_kind='battle' and guild is not null and p_payload->>'firstSkillSide' in ('attacker','defender') then
    update public.guild_war_observations o
    set payload=jsonb_set(o.payload,'{firstSkillSide}',p_payload->'firstSkillSide')
    where o.guild_name=guild and o.kind='battle' and o.source_key=p_source_key
      and o.payload->'attacker'->'heroIds'=p_payload->'attacker'->'heroIds'
      and o.payload->'defender'->'heroIds'=p_payload->'defender'->'heroIds'
      and o.payload->>'firstSkillSide' is null;
  end if;
  select exists(select 1 from public.guild_war_tabs$patch$);
 execute definition;
end $$;
