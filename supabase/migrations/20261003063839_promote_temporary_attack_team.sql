begin;
-- Hero order and spacing do not change the identity of an opponent team.
create function private.opponent_hero_key(heroes text) returns text[]
language sql immutable set search_path='' as $$
  select coalesce(array_agg(hero order by hero),array[]::text[])
  from (
    select lower(regexp_replace(normalize(part, NFC),'[[:space:]]','','g')) as hero
    from regexp_split_to_table(coalesce(heroes,''),'[,，/、;\n\r]+') part
  ) names where hero <> '';
$$;
revoke all on function private.opponent_hero_key(text) from public,anon,authenticated;

create function private.promote_temporary_attack_team(team_id uuid, team_kind text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare source public.enemy_defense_teams; target public.enemy_defense_teams;
  source_key text[]; incoming jsonb; combined jsonb; moved_id uuid;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception '관리자만 승급할 수 있습니다.' using errcode='42501';
  end if;
  -- Serializes promotions, including two temporary teams with the same opponent.
  perform pg_advisory_xact_lock(hashtextextended('temporary-attack-promotion',0));
  if team_kind='attack' then
    update public.attack_teams set is_temporary=false,updated_at=now()
      where id=team_id and is_temporary returning id into moved_id;
    if moved_id is null then raise exception '승급할 임시 공격팀을 찾지 못했습니다.'; end if;
    return jsonb_build_object('team_id',moved_id,'merged',false);
  elsif team_kind <> 'enemy' or team_kind is null then
    raise exception '잘못된 팀 종류입니다.';
  end if;
  select * into source from public.enemy_defense_teams where id=team_id for update;
  if not found or not source.is_temporary then
    raise exception '이미 승급했거나 삭제된 임시 공격팀입니다.';
  end if;
  source_key := private.opponent_hero_key(source.heroes);
  select * into target from public.enemy_defense_teams
    where not is_temporary and cardinality(source_key)>0
      and private.opponent_hero_key(heroes)=source_key
    order by sort_order nulls last,created_at,id limit 1 for update;
  if not found then
    update public.enemy_defense_teams set is_temporary=false,updated_at=now() where id=source.id;
    return jsonb_build_object('team_id',source.id,'merged',false);
  end if;
  incoming := private.counter_array(source.counter_decks);
  combined := private.counter_array(target.counter_decks) || incoming;
  -- Keep the counter IDs, original authors, creation dates and edit history.
  update public.counter_deck_registry set enemy_team_id=target.id
    where enemy_team_id=source.id
      and counter_id in (select (deck->>'counter_id')::uuid from jsonb_array_elements(incoming) deck);
  update public.enemy_defense_teams set counter_decks=to_jsonb(combined::text),updated_at=now()
    where id=target.id;
  delete from public.enemy_defense_teams where id=source.id;
  -- The archived snapshot is already moved, so it must not be restored as a duplicate.
  update public.deleted_counter_records set restored_at=now(),restored_by=auth.uid()
    where kind='enemy_team' and parent_id=source.id and deleted_at=now() and restored_at is null;
  return jsonb_build_object('team_id',target.id,'merged',true,'added_count',jsonb_array_length(incoming));
end $$;
revoke all on function private.promote_temporary_attack_team(uuid,text) from public,anon,authenticated;
grant execute on function private.promote_temporary_attack_team(uuid,text) to authenticated;
create function public.promote_temporary_attack_team(team_id uuid, team_kind text default 'enemy')
returns jsonb language sql security invoker set search_path='' as $$
  select private.promote_temporary_attack_team(team_id,team_kind);
$$;
revoke all on function public.promote_temporary_attack_team(uuid,text) from public,anon;
grant execute on function public.promote_temporary_attack_team(uuid,text) to authenticated;
commit;
