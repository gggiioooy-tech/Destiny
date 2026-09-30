begin;
create temp table author_test_state(k text primary key,v text);
grant all on author_test_state to authenticated;
select set_config('request.jwt.claims',(select json_build_object('sub',p.auth_user_id,'role','authenticated','session_id',s.id)::text from public.profiles p join auth.sessions s on s.user_id=p.auth_user_id where not p.is_owner and p.role='admin' and p.status='approved' and (s.not_after is null or s.not_after>now()) limit 1),true);
insert into author_test_state values('claims',current_setting('request.jwt.claims')),('author',auth.uid()::text);
insert into author_test_state select 'nickname',coalesce(nullif(btrim(game_nickname),''),'닉네임 미등록') from public.profiles where auth_user_id=auth.uid();
set local role authenticated;
do $$ declare tid uuid; begin
if not private.is_admin() then raise exception 'Missing test admin'; end if;
insert into public.enemy_defense_teams(title,heroes,is_public,counter_decks)
values('QA rollback author','연희',true,'[{"heroes":"동영","author_nickname":"forged"}]'::jsonb) returning id into tid;
insert into author_test_state values('team',tid::text);
if (select nickname from public.counter_author_nicknames(tid)) is distinct from (select v from author_test_state where k='nickname') then raise exception 'Wrong original author'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',(select json_build_object('sub',p.auth_user_id,'role','authenticated','session_id',s.id)::text from public.profiles p join auth.sessions s on s.user_id=p.auth_user_id where p.is_owner and (s.not_after is null or s.not_after>now()) limit 1),true);
set local role authenticated;
do $$ declare tid uuid; begin
tid:=(select v::uuid from author_test_state where k='team');
update public.enemy_defense_teams set counter_decks=counter_decks where id=tid;
if (select nickname from public.counter_author_nicknames(tid)) is distinct from (select v from author_test_state where k='nickname') then raise exception 'Editor overwrote author'; end if;
end $$;
reset role;
update public.profiles set role='member' where auth_user_id=(select v::uuid from author_test_state where k='author');
select set_config('request.jwt.claims',(select v from author_test_state where k='claims'),true);
set local role authenticated;
do $$ begin
if (select nickname from public.counter_author_nicknames((select v::uuid from author_test_state where k='team'))) is distinct from (select v from author_test_state where k='nickname') then raise exception 'Member cannot see public author'; end if;
end $$;
reset role;
update public.enemy_defense_teams set is_public=false where id=(select v::uuid from author_test_state where k='team');
set local role authenticated;
do $$ begin
if exists(select 1 from public.counter_author_nicknames((select v::uuid from author_test_state where k='team'))) then raise exception 'Private team author leaked'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
begin perform public.counter_author_nicknames(gen_random_uuid()); raise exception 'Anonymous allowed';
exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: trusted nickname, immutable creator, member visibility, private-team and anonymous denial' as result;
rollback;
