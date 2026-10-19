begin;
create temp table speed_test_identity as
select distinct on(p.is_owner) p.auth_user_id uid,s.id sid,p.is_owner
from public.profiles p join auth.sessions s on s.user_id=p.auth_user_id
where p.status='approved' and p.role='admin' and not p.must_change_password
and (s.not_after is null or s.not_after>now());
do $$begin
 if (select count(*) from speed_test_identity)<>2 then raise exception 'Missing test sessions'; end if;
 perform set_config('request.jwt.claims',(select json_build_object('sub',uid,'session_id',sid,'role','authenticated')::text from speed_test_identity where is_owner),true);
end$$;
set local role authenticated;
do $$declare payload jsonb; guild text; result jsonb; begin
 if not private.is_owner() then raise exception 'Owner test identity rejected'; end if;
 select btrim(memo) into guild from public.profiles where auth_user_id=auth.uid();
 payload=jsonb_build_object('sourceGuild',guild,'warDate','2026-10-19','direction','attack','attacker',jsonb_build_object('heroIds',jsonb_build_array(1,2,3)),'defender',jsonb_build_object('heroIds',jsonb_build_array(4,5,6)),
 'heroSpeeds','{"attacker":[{"heroId":1,"value":29}],"defender":[{"heroId":4,"value":33}]}'::jsonb);
 result=public.submit_guild_war_observation('battle','QA-speed-private',now(),payload);
 if not exists(select 1 from public.guild_war_hero_speeds s join public.guild_war_observations o on o.id=s.observation_id where o.source_key='QA-speed-private') then raise exception 'Owner speed read failed'; end if;
 if exists(select 1 from public.guild_war_observations o where o.source_key='QA-speed-private' and o.payload ? 'heroSpeeds') then raise exception 'Public JSON leaked speeds'; end if;
 result=public.submit_guild_war_observation('battle','QA-speed-private',now(),payload);
 if result->>'status'<>'duplicate' then raise exception 'Duplicate failed'; end if;
 begin
  perform public.submit_guild_war_observation('battle','QA-speed-invalid',now(),jsonb_set(payload,'{heroSpeeds,attacker,0,heroId}','99'));
  raise exception 'Wrong roster accepted';
 exception when invalid_parameter_value then null; end;
end$$;
reset role;
do $$begin perform set_config('request.jwt.claims',(select json_build_object('sub',uid,'session_id',sid,'role','authenticated')::text from speed_test_identity where not is_owner),true);end$$;
set local role authenticated;
do $$begin
 if not private.is_admin() or private.is_owner() then raise exception 'Admin test identity rejected'; end if;
 if exists(select 1 from public.guild_war_hero_speeds) then raise exception 'Admin leaked speeds'; end if;
 begin update public.profiles set is_owner=true where auth_user_id=auth.uid();raise exception 'Self-promotion accepted';exception when insufficient_privilege then null;end;
 begin insert into public.guild_war_hero_speeds(observation_id,speeds) values(gen_random_uuid(),'{}');raise exception 'Direct write accepted';exception when insufficient_privilege then null;end;
end$$;
reset role;
update public.profiles set role='member' where auth_user_id=(select uid from speed_test_identity where not is_owner);
set local role authenticated;
do $$begin if exists(select 1 from public.guild_war_hero_speeds) then raise exception 'Member leaked speeds';end if;end$$;
reset role;
update public.profiles set role='guest' where auth_user_id=(select uid from speed_test_identity where not is_owner);
set local role authenticated;
do $$begin if exists(select 1 from public.guild_war_hero_speeds) then raise exception 'Guest leaked speeds';end if;end$$;
reset role;
set local role anon;
do $$begin begin perform 1 from public.guild_war_hero_speeds;raise exception 'Anonymous read accepted';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
select 'PASS owner read, admin/member/guest/anonymous denial, private storage, roster validation, duplicate, self-promotion and direct write denied; rolled back' result;

