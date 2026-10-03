-- All verification fixtures and mutations are rolled back.
begin;
do $$
declare actor uuid; actor_session uuid; regular_id uuid; bin_id uuid; deck_a uuid:=gen_random_uuid();
  deck_b uuid:=gen_random_uuid(); deck_c uuid:=gen_random_uuid(); decks jsonb; result jsonb;
  registry_before jsonb; registry_after jsonb; rejected boolean:=false;
begin
  select p.auth_user_id,s.id into actor,actor_session from public.profiles p
    join auth.sessions s on s.user_id=p.auth_user_id
    where p.role='admin' and p.status='approved' and not p.must_change_password
      and (s.not_after is null or s.not_after>now()) limit 1;
  if actor is null then raise exception 'No active admin session for verification'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'session_id',actor_session,'role','authenticated')::text,true);
  decks:=jsonb_build_array(
    jsonb_build_object('counter_id',deck_a,'title','keep A','heroes','여포','power','9'),
    jsonb_build_object('counter_id',deck_b,'title','discard B','heroes','하연','power','8'),
    jsonb_build_object('counter_id',deck_c,'title','discard C','heroes','오목','power','7'));
  insert into public.enemy_defense_teams(title,heroes,note,counter_decks,is_temporary)
    values('recycle test','__recycle_a,__recycle_b,__recycle_c','keep metadata',to_jsonb(decks::text),false)
    returning id into regular_id;
  select jsonb_agg(to_jsonb(r)-'enemy_team_id' order by counter_id) into registry_before
    from public.counter_deck_registry r where enemy_team_id=regular_id;
  insert into public.counter_deck_edits(counter_id,editor_auth_id,editor_nickname) values(deck_b,actor,'test editor');
  result:=public.recycle_counter_deck(regular_id,deck_b,false);
  bin_id:=(result->>'team_id')::uuid;
  if (select private.counter_array(counter_decks) from public.enemy_defense_teams where id=regular_id)
      <> jsonb_build_array(decks->0,decks->2) then raise exception 'Discard changed other active decks'; end if;
  if not (select is_temporary and trash_source_team_id=regular_id from public.enemy_defense_teams where id=bin_id)
      or (select private.counter_array(counter_decks) from public.enemy_defense_teams where id=bin_id)
        <>jsonb_build_array(decks->1) then raise exception 'Discarded deck not isolated in recycle bin'; end if;
  begin
    perform public.recycle_counter_deck(regular_id,deck_b,false);
  exception when raise_exception then rejected:=true;
  end;
  if not rejected then raise exception 'Repeated discard allowed'; end if;
  result:=public.recycle_counter_deck(regular_id,deck_c,false);
  if (result->>'team_id')::uuid<>bin_id then raise exception 'Same opponent not grouped'; end if;
  result:=public.recycle_counter_deck(bin_id,deck_b,true);
  if (result->>'team_id')::uuid<>regular_id
      or (select private.counter_array(counter_decks) from public.enemy_defense_teams where id=regular_id)
        <>jsonb_build_array(decks->0,decks->1)
      or (select private.counter_array(counter_decks) from public.enemy_defense_teams where id=bin_id)
        <>jsonb_build_array(decks->2) then raise exception 'Individual restore overwrote existing decks or restored extra decks'; end if;
  result:=public.recycle_counter_deck(bin_id,null,true);
  if exists(select 1 from public.enemy_defense_teams where id=bin_id)
      or (select private.counter_array(counter_decks) from public.enemy_defense_teams where id=regular_id)<>decks
    then raise exception 'Bulk restore or bin cleanup failed'; end if;
  -- Discard every deck, then ensure the original empty opponent can be restored.
  perform public.recycle_counter_deck(regular_id,deck_a,false);
  perform public.recycle_counter_deck(regular_id,deck_b,false);
  result:=public.recycle_counter_deck(regular_id,deck_c,false);
  bin_id:=(result->>'team_id')::uuid;
  if (select private.counter_array(counter_decks) from public.enemy_defense_teams where id=regular_id)<>'[]'::jsonb
    then raise exception 'Last discarded deck still active'; end if;
  result:=public.recycle_counter_deck(bin_id,null,true);
  if (result->>'team_id')::uuid<>regular_id then raise exception 'Original opponent ID not preserved'; end if;
  select jsonb_agg(to_jsonb(r)-'enemy_team_id' order by counter_id) into registry_after
    from public.counter_deck_registry r where enemy_team_id=regular_id;
  if registry_after is distinct from registry_before
      or (select count(*) from public.counter_deck_edits where counter_id=deck_b)<>1
      or (select note from public.enemy_defense_teams where id=regular_id)<>'keep metadata'
    then raise exception 'Author, edit history, counts or opponent metadata changed'; end if;
  if exists(select 1 from public.deleted_counter_records
      where parent_id in (regular_id,bin_id) and restored_at is null)
    then raise exception 'Move created an extra restorable deletion copy'; end if;
  -- Recreate a matching active opponent if the original opponent is unavailable.
  result:=public.recycle_counter_deck(regular_id,deck_b,false);
  bin_id:=(result->>'team_id')::uuid;
  delete from public.enemy_defense_teams where id=regular_id;
  result:=public.recycle_counter_deck(bin_id,deck_b,true);
  if not exists(select 1 from public.enemy_defense_teams
      where id=(result->>'team_id')::uuid and not is_temporary
        and private.counter_array(counter_decks)=jsonb_build_array(decks->1))
    then raise exception 'Restore without original opponent failed'; end if;
  rejected:=false;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  begin
    perform public.recycle_counter_deck((result->>'team_id')::uuid,deck_b,false);
  exception when insufficient_privilege then rejected:=true;
  end;
  if not rejected then raise exception 'Unauthorized discard allowed'; end if;
end $$;
select 'PASS: single discard, opponent grouping, individual/bulk restore, original deck preservation, empty opponent, missing opponent, identity/history/count preservation, repeat and authorization checks' as result;
rollback;
