begin;
create function private.is_owner() returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_admin() and exists(select 1 from public.profiles where auth_user_id=auth.uid() and is_owner);
$$;
revoke all on function private.is_owner() from public,anon;
grant execute on function private.is_owner() to authenticated,service_role;
create or replace function private.protect_profile() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.is_owner then raise exception 'Owner cannot be deleted'; end if;
    if current_user not in ('postgres','service_role','supabase_admin') and old.role='admin' and not private.is_owner() then
      raise exception 'Only the owner can delete an administrator' using errcode='42501';
    end if;
    return old;
  end if;
  if old.is_owner and (new.is_owner is distinct from true or new.role is distinct from 'admin' or new.status is distinct from 'approved') then
    raise exception 'Owner privileges cannot be removed';
  end if;
  if current_user not in ('postgres','service_role','supabase_admin') then
    if new.auth_user_id is distinct from old.auth_user_id or new.user_id is distinct from old.user_id or
       new.is_owner is distinct from old.is_owner or new.must_change_password is distinct from old.must_change_password then
      raise exception 'Protected account field';
    end if;
    if not private.is_owner() then
      if new.memo is distinct from old.memo then raise exception 'Only the owner can edit admin notes' using errcode='42501'; end if;
      if old.role='admin' and (new.role is distinct from old.role or new.status is distinct from old.status) then
        raise exception 'Only the owner can change administrator access' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end $$;

-- The registry survives removal of a deck/team so re-saving or restoring it is not counted twice.
create table public.counter_deck_registry (
  counter_id uuid primary key,
  enemy_team_id uuid not null,
  author_auth_id uuid,
  created_at timestamptz,
  is_legacy boolean not null default false
);
create index counter_deck_registry_week_idx on public.counter_deck_registry(created_at,author_auth_id) where created_at is not null;
alter table public.counter_deck_registry enable row level security;
revoke all on public.counter_deck_registry from public,anon,authenticated;
grant select on public.counter_deck_registry to authenticated;
grant all on public.counter_deck_registry to service_role;
create policy counter_registry_admin_read on public.counter_deck_registry for select to authenticated using ((select private.is_admin()));
create function private.counter_array(value jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
begin
  if value is null or value='null'::jsonb then return '[]'::jsonb; end if;
  if jsonb_typeof(value)='string' then value := (value #>> '{}')::jsonb; end if;
  if jsonb_typeof(value) <> 'array' then raise exception 'Counter decks must be an array'; end if;
  return value;
end $$;
revoke all on function private.counter_array(jsonb) from public,anon,authenticated;
-- Existing decks have no trustworthy author/time; preserve them without inventing historical counts.
do $$ declare team record; deck jsonb; decks jsonb; cid uuid; begin
  for team in select id,counter_decks from public.enemy_defense_teams loop
    decks := '[]'::jsonb;
    for deck in select value from jsonb_array_elements(private.counter_array(team.counter_decks)) loop
      cid := gen_random_uuid();
      decks := decks || jsonb_build_array(deck || jsonb_build_object('counter_id',cid));
      insert into public.counter_deck_registry(counter_id,enemy_team_id,is_legacy) values(cid,team.id,true);
    end loop;
    update public.enemy_defense_teams set counter_decks=to_jsonb(decks::text) where id=team.id;
  end loop;
end $$;
create function private.track_counter_creation() returns trigger
language plpgsql security definer set search_path='' as $$
declare deck jsonb; old_decks jsonb := '[]'::jsonb; result jsonb := '[]'::jsonb; cid uuid; bound_team uuid;
  used uuid[] := '{}'; old_deck jsonb; position integer := 0; existing_actor uuid;
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Approved administrator required' using errcode='42501'; end if;
  if tg_op='UPDATE' then old_decks := private.counter_array(old.counter_decks); end if;
  for deck in select value from jsonb_array_elements(private.counter_array(new.counter_decks)) loop
    if jsonb_typeof(deck)<>'object' then raise exception 'Invalid counter deck'; end if;
    cid := nullif(deck->>'counter_id','')::uuid;
    if cid is null then
      -- Compatibility with a tab that was already open before this update.
      select value into old_deck from jsonb_array_elements(old_decks)
        where value - 'counter_id' = deck - 'counter_id' and not ((value->>'counter_id')::uuid=any(used)) limit 1;
      cid := (old_deck->>'counter_id')::uuid;
      if cid is null and position < jsonb_array_length(old_decks) then
        cid := (old_decks->position->>'counter_id')::uuid;
        if cid=any(used) then cid:=null; end if;
      end if;
      cid := coalesce(cid,gen_random_uuid());
    end if;
    if cid=any(used) then raise exception 'Duplicate counter ID'; end if;
    used := array_append(used,cid);
    insert into public.counter_deck_registry(counter_id,enemy_team_id) values(cid,new.id) on conflict do nothing;
    select enemy_team_id into bound_team from public.counter_deck_registry where counter_id=cid;
    if bound_team is distinct from new.id then raise exception 'Counter belongs to another team'; end if;
    if length(trim(coalesce(deck->>'heroes',''))) > 0 then
      update public.counter_deck_registry set author_auth_id=auth.uid(),created_at=now()
      where counter_id=cid and not is_legacy and created_at is null;
    end if;
    result := result || jsonb_build_array(deck || jsonb_build_object('counter_id',cid));
    position := position+1;
  end loop;
  new.counter_decks := to_jsonb(result::text);
  return new;
end $$;
revoke all on function private.track_counter_creation() from public,anon,authenticated;
create trigger track_counter_creation before insert or update of counter_decks on public.enemy_defense_teams
for each row execute function private.track_counter_creation();
create function public.weekly_counter_counts() returns table(auth_user_id uuid,counter_count bigint)
language sql stable security invoker set search_path='' as $$
  select author_auth_id,count(*) from public.counter_deck_registry
  where (select private.is_admin()) and created_at >= (date_trunc('week',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
    and created_at < ((date_trunc('week',now() at time zone 'Asia/Seoul') + interval '7 days') at time zone 'Asia/Seoul')
  group by author_auth_id;
$$;
revoke all on function public.weekly_counter_counts() from public,anon;
grant execute on function public.weekly_counter_counts() to authenticated,service_role;
commit;
