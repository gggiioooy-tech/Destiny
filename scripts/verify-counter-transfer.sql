begin;
create temp table transfer_test_state(k text primary key,v jsonb);
grant all on transfer_test_state to authenticated,service_role;
insert into transfer_test_state values('payload',jsonb_build_object(
'source_site','seori','source_team_id',gen_random_uuid(),'author','QA 원작자','sender','QA 전송자',
'team',jsonb_build_object('title','QA rollback transfer','heroes','QA_A,QA_B,QA_C','note','200','is_public',true,'is_temporary',false),
'deck',jsonb_build_object('title','QA counter','heroes','선란,칼 헤론,브란즈&브란셀','rings','["","반지2","반지3"]','speed_order','{"steps":["선란","","칼 헤론"],"note":""}','skill_order','{"steps":[{"hero":"선란","skill":"각성기"}],"note":""}','formation','보호진형','gear_1','원본 장비')));
set local role authenticated;
do $$ begin
 begin perform public.import_shared_counter((select v from transfer_test_state where k='payload')); raise exception 'Authenticated import allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$ declare p jsonb; first_result jsonb; second_result jsonb; existing jsonb; begin
 select v into p from transfer_test_state where k='payload';
 first_result:=public.import_shared_counter(p);
 second_result:=public.import_shared_counter(p);
 if not (second_result->>'duplicate')::boolean or second_result->>'counter_id'<>first_result->>'counter_id' then raise exception 'Duplicate prevention failed'; end if;
 insert into transfer_test_state values('first',first_result);
 p:=jsonb_set(p,'{deck,title}','"QA second"');
 perform public.import_shared_counter(p);
 select ((to_jsonb(t)->'counter_decks')#>>'{}')::jsonb into existing from public.enemy_defense_teams t where id=(first_result->>'team_id')::uuid;
 if jsonb_array_length(existing)<>2 or existing->0->>'gear_1'<>'원본 장비' or existing->0->>'rings'<>'["","반지2","반지3"]' then raise exception 'Append lost original content'; end if;
 insert into transfer_test_state values('deck',existing->0);
 p:=jsonb_set(p,'{team,is_public}','false'); second_result:=public.import_shared_counter(p);
 if second_result->>'team_id'=first_result->>'team_id' then raise exception 'Private counter mixed with public team'; end if;
 p:=jsonb_set(jsonb_set(p,'{team,is_public}','true'),'{team,note}','"999"');
 second_result:=public.import_shared_counter(p);
 if second_result->>'team_id'=first_result->>'team_id' then raise exception 'Opponent speed overwritten'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',(select json_build_object('sub',p.auth_user_id,'role','authenticated','session_id',s.id)::text from public.profiles p join auth.sessions s on s.user_id=p.auth_user_id where p.role='admin' and p.status='approved' and (s.not_after is null or s.not_after>now()) limit 1),true);
set local role authenticated;
do $$ declare exported jsonb; begin
 if not private.is_admin() then raise exception 'No test admin session'; end if;
 exported:=public.export_counter_for_transfer((select (v->>'team_id')::uuid from transfer_test_state where k='first'),(select v from transfer_test_state where k='deck'));
 if (select nickname from public.counter_author_nicknames((select (v->>'team_id')::uuid from transfer_test_state where k='first')) where counter_id=(select (v->>'counter_id')::uuid from transfer_test_state where k='first')) is distinct from 'QA 원작자' then raise exception 'Lost source author'; end if;
 if exists(select 1 from public.counter_deck_registry where counter_id=(select (v->>'counter_id')::uuid from transfer_test_state where k='first') and created_at is not null) then raise exception 'Import counted as new writing'; end if;
 if exported->'deck'->>'gear_1'<>'원본 장비' then raise exception 'Export not faithful'; end if;
 begin
 perform public.export_counter_for_transfer((select (v->>'team_id')::uuid from transfer_test_state where k='first'),jsonb_set((select v from transfer_test_state where k='deck'),'{gear_1}','"forged"'));
 raise exception 'FORGERY_ACCEPTED';
 exception when raise_exception then if sqlerrm='FORGERY_ACCEPTED' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"00000000-0000-0000-0000-000000000001"}',true);
set local role authenticated;
do $$ begin
 begin perform public.export_counter_for_transfer((select (v->>'team_id')::uuid from transfer_test_state where k='first'),(select v from transfer_test_state where k='deck')); raise exception 'Nonadmin export allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS append, deduplication, full contents, visibility isolation, admin source validation and forged-content rejection' as result;
rollback;
