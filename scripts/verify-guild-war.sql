begin;
create temp table guild_test_identity(kind text,uid uuid,sid uuid);
grant select on guild_test_identity to authenticated;
insert into guild_test_identity select 'owner',p.auth_user_id,s.id from public.profiles p join auth.sessions s on s.user_id=p.auth_user_id where p.is_owner and (s.not_after is null or s.not_after>now()) limit 1;
insert into guild_test_identity select 'member',p.auth_user_id,s.id from public.profiles p join auth.sessions s on s.user_id=p.auth_user_id where not p.is_owner and (s.not_after is null or s.not_after>now()) limit 1;
do $$begin if (select count(*) from guild_test_identity)<>2 then raise exception 'Missing test sessions';end if;end$$;
update public.profiles set role='member',status='approved',must_change_password=false,memo='서리' where auth_user_id=(select uid from guild_test_identity where kind='member');
select set_config('request.jwt.claims',(select json_build_object('sub',uid,'session_id',sid,'role','authenticated')::text from guild_test_identity where kind='member'),true);
set local role authenticated;
do $$declare r jsonb;begin
 r=public.submit_guild_war_observation('battle','QA-guild-routing-test',now(),'{"warDate":"2026-10-15","direction":"attack","attacker":{},"defender":{},"guild":"철폐"}');
 if r->>'guild'<>'서리' or r->>'status'<>'recorded' then raise exception 'Profile routing failed';end if;
 r=public.submit_guild_war_observation('battle','QA-guild-routing-test',now(),'{"warDate":"2026-10-15","direction":"attack","attacker":{},"defender":{}}');
 if r->>'status'<>'duplicate' then raise exception 'Duplicate failed';end if;
 begin perform public.add_guild_war_tab('서리');raise exception 'MEMBER_ADD_ALLOWED';exception when insufficient_privilege then null;end;
 begin insert into public.guild_war_tabs(name) values('QA-forged');raise exception 'DIRECT_ADD_ALLOWED';exception when insufficient_privilege then null;end;
 begin insert into public.guild_war_observations(guild_name,reporter_id,kind,source_key,occurred_at,payload) values('철폐',auth.uid(),'battle','forged',now(),'{}');raise exception 'DIRECT_INSERT_ALLOWED';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.profiles set memo='QA보류길드' where auth_user_id=(select uid from guild_test_identity where kind='member');
set local role authenticated;
do $$declare r jsonb;begin
 r=public.submit_guild_war_observation('battle','QA-held-test',now(),'{"warDate":"2026-10-15","direction":"attack","attacker":{},"defender":{}}');
 if r->>'status'<>'held' then raise exception 'Unregistered not held';end if;
 if exists(select 1 from public.guild_war_observations where source_key='QA-held-test') then raise exception 'Held record leaked';end if;
end$$;
reset role;
select set_config('request.jwt.claims',(select json_build_object('sub',uid,'session_id',sid,'role','authenticated')::text from guild_test_identity where kind='owner'),true);
set local role authenticated;
select public.add_guild_war_tab('QA보류길드');
select public.add_guild_war_tab('QA보류길드');
do $$begin
 if (select count(*) from public.guild_war_tabs where name='QA보류길드')<>1 then raise exception 'Tab duplicated';end if;
 if not exists(select 1 from public.guild_war_observations where source_key='QA-held-test') then raise exception 'Held record not released';end if;
 begin perform public.add_guild_war_tab('QA메모에없는길드');raise exception 'UNKNOWN_MEMO_ALLOWED';exception when invalid_parameter_value then null;end;
end$$;
reset role;
update public.profiles set memo='서리,철폐' where auth_user_id=(select uid from guild_test_identity where kind='member');
select set_config('request.jwt.claims',(select json_build_object('sub',uid,'session_id',sid,'role','authenticated')::text from guild_test_identity where kind='member'),true);
set local role authenticated;
do $$declare r jsonb;begin
 r=public.submit_guild_war_observation('battle','QA-ambiguous-test',now(),'{"warDate":"2026-10-15","direction":"attack","attacker":{},"defender":{}}');
 if r->>'status'<>'held' or r->>'guild' is not null then raise exception 'Ambiguous memo routed';end if;
end$$;
reset role;
update public.profiles set role='guest' where auth_user_id=(select uid from guild_test_identity where kind='member');
set local role authenticated;
do $$begin
 if exists(select 1 from public.guild_war_tabs) or exists(select 1 from public.guild_war_observations) then raise exception 'Guest read allowed';end if;
 begin perform public.submit_guild_war_observation('battle','QA-guest',now(),'{"warDate":"2026-10-15","direction":"attack","attacker":{},"defender":{}}');raise exception 'Guest submit allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
set local role authenticated;
do $$begin
 begin perform public.submit_guild_war_observation('battle','QA-no-session',now(),'{"warDate":"2026-10-15","direction":"attack","attacker":{},"defender":{}}');raise exception 'Missing session allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
select 'PASS routing, spoofing prevention, duplicate, pending, registration, member/guest/session permissions; rolled back' as result;
