begin;
alter table public.enemy_defense_teams add column trash_source_team_id uuid;
create index enemy_defense_trash_source_idx on public.enemy_defense_teams(trash_source_team_id) where is_temporary;

create function private.recycle_counter_deck(team_id uuid, deck_id uuid, restore boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare source public.enemy_defense_teams; target public.enemy_defense_teams;
  snapshot jsonb; incoming jsonb; remaining jsonb; combined jsonb; source_key text[];
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception '관리자만 카운터덱을 폐기하거나 승급할 수 있습니다.' using errcode='42501';
  end if;
  if restore is null or (not restore and deck_id is null) then raise exception '카운터덱을 선택해 주세요.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('temporary-attack-promotion',0));
  select * into source from public.enemy_defense_teams where id=team_id for update;
  if not found or source.is_temporary is distinct from restore then
    raise exception '이미 이동했거나 삭제된 카운터덱입니다.';
  end if;
  select coalesce(jsonb_agg(deck order by position),'[]'::jsonb) into incoming
    from jsonb_array_elements(private.counter_array(source.counter_decks)) with ordinality as decks(deck,position)
    where deck_id is null or deck->>'counter_id'=deck_id::text;
  if jsonb_array_length(incoming)=0 then raise exception '이동할 카운터덱을 찾지 못했습니다.'; end if;
  select coalesce(jsonb_agg(deck order by position),'[]'::jsonb) into remaining
    from jsonb_array_elements(private.counter_array(source.counter_decks)) with ordinality as decks(deck,position)
    where not exists(select 1 from jsonb_array_elements(incoming) d where d->>'counter_id'=deck->>'counter_id');
  if restore then
    source_key := private.opponent_hero_key(source.heroes);
    select * into target from public.enemy_defense_teams
      where not is_temporary and (
        id=source.trash_source_team_id or
        (cardinality(source_key)>0 and private.opponent_hero_key(heroes)=source_key))
      order by (id=source.trash_source_team_id) desc nulls last,sort_order nulls last,created_at,id
      limit 1 for update;
  else
    select * into target from public.enemy_defense_teams
      where is_temporary and trash_source_team_id=source.id
      order by created_at,id limit 1 for update;
  end if;
  if not found then
    snapshot := to_jsonb(source) || jsonb_build_object(
      'id',gen_random_uuid(),'is_temporary',not restore,'counter_decks','[]',
      'trash_source_team_id',case when restore then null else source.id end,
      'created_at',now(),'updated_at',now());
    insert into public.enemy_defense_teams
      select (jsonb_populate_record(null::public.enemy_defense_teams,snapshot)).*
      returning * into target;
  end if;
  combined := private.counter_array(target.counter_decks) || incoming;
  -- Move the same counter IDs so attribution, edits and weekly counts survive.
  update public.counter_deck_registry set enemy_team_id=target.id
    where enemy_team_id=source.id
      and counter_id in (select (deck->>'counter_id')::uuid from jsonb_array_elements(incoming) deck);
  update public.enemy_defense_teams set counter_decks=to_jsonb(combined::text),updated_at=now()
    where id=target.id;
  if restore and jsonb_array_length(remaining)=0 then
    delete from public.enemy_defense_teams where id=source.id;
    update public.deleted_counter_records set restored_at=now(),restored_by=auth.uid()
      where kind='enemy_team' and parent_id=source.id and deleted_at=now() and restored_at is null;
  else
    update public.enemy_defense_teams set counter_decks=to_jsonb(remaining::text),updated_at=now()
      where id=source.id;
    -- This is a move to the visible recycle bin, not another deleted-deck copy.
    update public.deleted_counter_records set restored_at=now(),restored_by=auth.uid()
      where kind='counter' and parent_id=source.id and deleted_at=now() and restored_at is null
        and exists(select 1 from jsonb_array_elements(incoming) d
          where d->>'counter_id'=payload->'counter'->>'counter_id');
  end if;
  return jsonb_build_object('team_id',target.id,'moved_count',jsonb_array_length(incoming),
    'remaining_count',jsonb_array_length(remaining),'restored',restore);
end $$;
revoke all on function private.recycle_counter_deck(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.recycle_counter_deck(uuid,uuid,boolean) to authenticated;
create function public.recycle_counter_deck(team_id uuid, deck_id uuid default null, restore boolean default false)
returns jsonb language sql security invoker set search_path='' as $$
  select private.recycle_counter_deck(team_id,deck_id,restore);
$$;
revoke all on function public.recycle_counter_deck(uuid,uuid,boolean) from public,anon;
grant execute on function public.recycle_counter_deck(uuid,uuid,boolean) to authenticated;
commit;
