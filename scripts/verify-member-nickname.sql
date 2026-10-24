-- Synthetic identities and observations only; every write is rolled back.
begin;
do $$
declare uid uuid=gen_random_uuid(); aid uuid=gen_random_uuid(); sid uuid=gen_random_uuid(); asid uuid=gen_random_uuid();
 login text='qa_rename_'||substr(gen_random_uuid()::text,1,8); admin_login text='qa_rename_admin_'||substr(gen_random_uuid()::text,1,8);
 guild text='QA-rename-'||substr(gen_random_uuid()::text,1,8); old_name text='QA이전닉'; new_name text='QA변경닉';
 result jsonb; before_stats jsonb; after_stats jsonb; rowid uuid; direction text; sequence integer=0;
begin
 insert into auth.users(id) values(uid),(aid);
 insert into auth.sessions(id,user_id) values(sid,uid),(asid,aid);
 insert into public.profiles(user_id,auth_user_id,game_nickname,status,role,memo)
 values(login,uid,old_name,'approved','member',guild),(admin_login,aid,'QA운영진','approved','admin',guild);
 foreach direction in array array['attack','defense'] loop
  sequence=sequence+1;
  insert into public.guild_war_observations(guild_name,reporter_id,kind,source_key,occurred_at,payload)
  values(guild,uid,'battle',login||sequence,now(),jsonb_build_object('warDate',(now() at time zone 'Asia/Seoul')::date,'direction',direction,'castle','본성','opponentGuild','QA다른길드','attackerWon',direction='attack',
   'attacker',jsonb_build_object('nickname',old_name,'heroes',jsonb_build_array('루디','하연','윤건')),
   'defender',jsonb_build_object('nickname',old_name,'heroes',jsonb_build_array('루디','하연','윤건'))));
 end loop;
 -- Same name in another guild must stay untouched. A mirror record of our
 -- member on the opposing side must change using that member's guild.
 insert into public.guild_war_observations(guild_name,reporter_id,kind,source_key,occurred_at,payload)
 values('QA다른길드',uid,'battle',login||'mirror',now(),jsonb_build_object('warDate',(now() at time zone 'Asia/Seoul')::date,'direction','attack','castle','본성','opponentGuild',guild,'attackerWon',true,
  'attacker',jsonb_build_object('nickname',old_name),'defender',jsonb_build_object('nickname',old_name)));
 select to_jsonb(s) into before_stats from private.member_battle_statistics_rows('-infinity') s where auth_user_id=uid;
 perform set_config('request.jwt.claims',json_build_object('sub',uid,'session_id',sid,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.change_member_nickname(new_name);
 execute 'reset role';
 if exists(select 1 from public.guild_war_observations where guild_name=guild and member_nickname<>new_name) then raise exception 'Own historical nickname not updated';end if;
 if exists(select 1 from public.guild_war_observations where source_key=login||'mirror' and (payload#>>'{defender,nickname}'<>new_name or payload#>>'{attacker,nickname}'<>old_name)) then raise exception 'Mirror identity or cross-guild collision';end if;
 select to_jsonb(s) into after_stats from private.member_battle_statistics_rows('-infinity') s where auth_user_id=uid;
 if before_stats is distinct from after_stats or (after_stats->>'attack_wins')::integer<>1 or (after_stats->>'defense_wins')::integer<>1 then raise exception 'Statistics detached after rename';end if;
 -- A second change preserves the entire alias chain.
 perform public.change_member_nickname('QA최신닉');
 insert into public.guild_war_observations(guild_name,reporter_id,kind,source_key,occurred_at,payload)
 values(guild,uid,'battle',login||'future',now(),jsonb_build_object('warDate',(now() at time zone 'Asia/Seoul')::date,'direction','attack','castle','본성','opponentGuild','QA다른길드','attackerWon',true,
 'attacker',jsonb_build_object('nickname',old_name),'defender',jsonb_build_object('nickname','다른사람'))) returning id into rowid;
 if (select member_nickname from public.guild_war_observations where id=rowid)<>'QA최신닉' then raise exception 'Old name reimported without resolution';end if;
 begin perform public.change_member_nickname('탈취',admin_login);raise exception 'Member renamed another user';exception when insufficient_privilege then null;end;
 begin perform public.change_member_nickname('QA운영진');raise exception 'Duplicate guild nickname accepted';exception when unique_violation then null;end;
 begin perform public.change_member_nickname(' ');raise exception 'Empty nickname accepted';exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',aid,'session_id',asid,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 perform public.change_member_nickname('QA운영진변경',login);
 execute 'reset role';
 if (select game_nickname from public.profiles where auth_user_id=uid)<>'QA운영진변경' then raise exception 'Admin rename failed';end if;
 if has_column_privilege('authenticated','public.profiles','game_nickname','UPDATE') then raise exception 'Direct nickname update can bypass history';end if;
 if has_function_privilege('anon','public.change_member_nickname(text,text)','EXECUTE') then raise exception 'Anonymous RPC granted';end if;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 begin perform public.change_member_nickname('미인증');raise exception 'Unauthenticated rename accepted';exception when insufficient_privilege then null;end;
end$$;
rollback;
select 'PASS self/admin rename, all historical stats, opposing-side mirror, cross-guild names, repeat rename/reimport, validation and authorization; rolled back' result;
