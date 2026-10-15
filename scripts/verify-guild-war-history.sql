begin;
create temp table war_history_identity as select p.auth_user_id uid,s.id sid from public.profiles p join auth.sessions s on s.user_id=p.auth_user_id where p.is_owner and (s.not_after is null or s.not_after>now()) limit 1;
grant select on war_history_identity to authenticated;
update public.profiles set memo='서리' where auth_user_id=(select uid from war_history_identity);
select set_config('request.jwt.claims',(select json_build_object('sub',uid,'session_id',sid,'role','authenticated')::text from war_history_identity),true);
set local role authenticated;
do $$declare dir text; i integer; total integer;begin
 foreach dir in array array['attack','defense'] loop
  for i in 1..170 loop
   perform public.submit_guild_war_observation('battle','QA-history-'||dir||'-'||i,now()-make_interval(mins=>i),jsonb_build_object(
     'warDate','2026-10-15','direction',dir,'castle',case when i%2=0 then '외성1' else '본성' end,
     'attacker',jsonb_build_object('nickname','QA공격자','heroes',jsonb_build_array(case when i=170 then '특정 영웅' else '루디' end)),
     'defender',jsonb_build_object('nickname','QA방어자'),'attackerWon',true));
  end loop;
 end loop;
 perform public.submit_guild_war_observation('battle','QA-history-old','2026-10-13T12:00:00Z','{"warDate":"2026-10-13","direction":"attack","castle":"외성1","attacker":{},"defender":{}}');
 perform public.submit_guild_war_observation('defense_snapshot','QA-history-snapshot',now(),'{"warDate":"2026-10-15","defenses":[]}');
 select count(*) into total from public.guild_war_battles('서리','2026-10-15','attack');if total<>150 then raise exception 'Attack cap incorrect: %',total;end if;
 select count(*) into total from public.guild_war_battles('서리','2026-10-15','defense');if total<>150 then raise exception 'Defense cap incorrect: %',total;end if;
 select count(*) into total from public.guild_war_battles('서리','2026-10-15','attack','외성1');if total<>85 then raise exception 'Castle filter incorrect: %',total;end if;
 select count(*) into total from public.guild_war_battles('서리','2026-10-15','attack','','특정영웅');if total<>1 then raise exception 'Search must precede cap: %',total;end if;
 if exists(select 1 from public.guild_war_battles('서리','2026-10-15','defense') where direction<>'defense' or war_date<>'2026-10-15') then raise exception 'Mixed directions or dates';end if;
 if not exists(select 1 from public.guild_war_dates('서리') where war_date='2026-10-13') then raise exception 'Missing history date';end if;
 if exists(select 1 from public.guild_war_battles('철폐','2026-10-15','attack')) then raise exception 'Guild filter failed';end if;
 begin perform public.submit_guild_war_observation('battle','QA-bad-direction',now(),'{"warDate":"2026-10-15","attacker":{},"defender":{}}');raise exception 'Missing direction accepted';exception when invalid_parameter_value then null;end;
 begin perform public.submit_guild_war_observation('battle','QA-bad-date',now(),'{"direction":"attack","attacker":{},"defender":{}}');raise exception 'Missing date accepted';exception when invalid_parameter_value then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
set local role authenticated;
do $$begin
 if exists(select 1 from public.guild_war_dates('서리')) or exists(select 1 from public.guild_war_battles('서리','2026-10-15','attack')) then raise exception 'Unauthenticated read';end if;
end$$;
reset role;
rollback;
select 'PASS independent 150 limits, castle/search before limit, guild/date/direction isolation and permissions; rolled back' as result;
