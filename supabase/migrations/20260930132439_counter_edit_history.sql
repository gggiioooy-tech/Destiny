begin;
create table public.counter_deck_edits (
  id bigint generated always as identity primary key,
  counter_id uuid not null references public.counter_deck_registry(counter_id),
  editor_auth_id uuid not null,
  editor_nickname text not null,
  edited_at timestamptz not null default now()
);
create index counter_deck_edits_counter_idx on public.counter_deck_edits(counter_id,id);
alter table public.counter_deck_edits enable row level security;
revoke all on public.counter_deck_edits from public,anon,authenticated;
grant all on public.counter_deck_edits to service_role;
create function private.record_counter_edits() returns trigger
language plpgsql security definer set search_path='' as $$
declare before_deck jsonb; after_deck jsonb; nickname text;
  fields text[] := array['title','power','heroes','rings','pet','formation','speed_order','team_speed','skill_order','gear_1','gear_2','gear_3','note'];
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Approved administrator required' using errcode='42501';
  end if;
  select coalesce(nullif(btrim(p.game_nickname),''),'닉네임 미등록') into nickname
    from public.profiles p where p.auth_user_id=auth.uid();
  for after_deck in select value from jsonb_array_elements(private.counter_array(new.counter_decks)) loop
    select value into before_deck from jsonb_array_elements(private.counter_array(old.counter_decks))
      where value->>'counter_id'=after_deck->>'counter_id';
    -- New and restored decks have no previous entry. Reordering and unchanged saves are not edits.
    if before_deck is not null and length(btrim(coalesce(before_deck->>'heroes','')))>0
      and exists(select 1 from unnest(fields) f
        where coalesce(before_deck->>f,'') is distinct from coalesce(after_deck->>f,'')) then
      insert into public.counter_deck_edits(counter_id,editor_auth_id,editor_nickname)
        values((after_deck->>'counter_id')::uuid,auth.uid(),coalesce(nickname,'닉네임 미등록'));
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.record_counter_edits() from public,anon,authenticated;
create trigger record_counter_edits after update of counter_decks on public.enemy_defense_teams
for each row execute function private.record_counter_edits();
create function private.counter_attribution(team_id uuid)
returns table(counter_id uuid,nickname text,edits jsonb)
language sql stable security definer set search_path='' as $$
  select a.counter_id,a.nickname,
    coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'nickname',e.editor_nickname) order by e.id)
      from public.counter_deck_edits e where e.counter_id=a.counter_id),'[]'::jsonb)
  from private.counter_author_nicknames(team_id) a;
$$;
revoke all on function private.counter_attribution(uuid) from public,anon;
grant execute on function private.counter_attribution(uuid) to authenticated;
create function public.counter_attribution(team_id uuid)
returns table(counter_id uuid,nickname text,edits jsonb)
language sql stable security invoker set search_path='' as $$
  select * from private.counter_attribution(team_id);
$$;
revoke all on function public.counter_attribution(uuid) from public,anon;
grant execute on function public.counter_attribution(uuid) to authenticated;
commit;
