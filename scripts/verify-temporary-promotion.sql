-- Production-safe verification: every fixture and change is rolled back.
begin;
do $$
declare actor uuid; actor_session uuid; regular_id uuid; temporary_id uuid; unique_id uuid;
  old_decks jsonb; new_decks jsonb; result jsonb; registry_before jsonb; registry_after jsonb;
  rejected boolean := false;
begin
  select p.auth_user_id,s.id into actor,actor_session from public.profiles p
    join auth.sessions s on s.user_id=p.auth_user_id
    where p.role='admin' and p.status='approved' and not p.must_change_password
      and (s.not_after is null or s.not_after>now()) limit 1;
  if actor is null then raise exception 'No approved admin available for verification'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'session_id',actor_session,'role','authenticated')::text,true);
  old_decks := jsonb_build_array(
    jsonb_build_object('counter_id',gen_random_uuid(),'title','existing 1','heroes','여포','note','keep this'),
    jsonb_build_object('counter_id',gen_random_uuid(),'title','existing 2','heroes','오목'));
  new_decks := jsonb_build_array(
    jsonb_build_object('counter_id',gen_random_uuid(),'title','temporary 1','heroes','하연'),
    jsonb_build_object('counter_id',gen_random_uuid(),'title','temporary 2','heroes','윤건'));
  insert into public.enemy_defense_teams(title,heroes,note,counter_decks,is_temporary)
    values('promotion test regular','__test_a, __test_b, __test_c','original note',to_jsonb(old_decks::text),false)
    returning id into regular_id;
  insert into public.enemy_defense_teams(title,heroes,counter_decks,is_temporary)
    values('promotion test temporary',E'__test_c\n __test_a\n__test_b',to_jsonb(new_decks::text),true)
    returning id into temporary_id;
  select jsonb_agg(to_jsonb(r)-'enemy_team_id' order by counter_id) into registry_before
    from public.counter_deck_registry r where enemy_team_id=temporary_id;
  result := public.promote_temporary_attack_team(temporary_id);
  if not (result->>'merged')::boolean or (result->>'team_id')::uuid<>regular_id
    or (result->>'added_count')::int<>2 then raise exception 'Merge result incorrect'; end if;
  if (select private.counter_array(counter_decks) from public.enemy_defense_teams where id=regular_id)
    <>old_decks || new_decks then raise exception 'Existing decks changed or incoming decks lost'; end if;
  if (select note from public.enemy_defense_teams where id=regular_id)<>'original note'
    then raise exception 'Existing opponent metadata overwritten'; end if;
  if exists(select 1 from public.enemy_defense_teams where id=temporary_id)
    then raise exception 'Promoted temporary entry remains'; end if;
  select jsonb_agg(to_jsonb(r)-'enemy_team_id' order by counter_id) into registry_after
    from public.counter_deck_registry r
    where counter_id in (select (d->>'counter_id')::uuid from jsonb_array_elements(new_decks) d)
      and enemy_team_id=regular_id;
  if registry_after is distinct from registry_before then raise exception 'Attribution or creation dates changed'; end if;
  begin
    perform public.promote_temporary_attack_team(temporary_id);
  exception when raise_exception then rejected := true;
  end;
  if not rejected then raise exception 'Repeated promotion must not append twice'; end if;
  insert into public.enemy_defense_teams(title,heroes,counter_decks,is_temporary)
    values('promotion unique test','__unique_a,__unique_b,__unique_c',to_jsonb('[]'::text),true)
    returning id into unique_id;
  result := public.promote_temporary_attack_team(unique_id);
  if (result->>'merged')::boolean or (result->>'team_id')::uuid<>unique_id
    or (select is_temporary from public.enemy_defense_teams where id=unique_id)
    then raise exception 'Unique opponent was not moved intact'; end if;
  rejected := false;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  begin
    perform public.promote_temporary_attack_team(unique_id);
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Unauthenticated promotion allowed'; end if;
end $$;
select 'PASS: additive merge, order-independent matching, original metadata, attribution, repeat protection, unique move, authorization' as result;
rollback;
