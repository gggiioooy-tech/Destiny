begin;
create policy counter_registry_self_read on public.counter_deck_registry for select to authenticated
using ((select private.is_approved_member()) and author_auth_id=(select auth.uid()));
create function public.my_weekly_counter_count() returns bigint
language sql stable security invoker set search_path='' as $$
  select count(*) from public.counter_deck_registry
  where author_auth_id=(select auth.uid())
    and created_at >= (date_trunc('week',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
    and created_at < ((date_trunc('week',now() at time zone 'Asia/Seoul') + interval '7 days') at time zone 'Asia/Seoul');
$$;
revoke all on function public.my_weekly_counter_count() from public,anon;
grant execute on function public.my_weekly_counter_count() to authenticated;
create table public.deleted_counter_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('counter','enemy_team','attack_team')),
  parent_id uuid not null,
  payload jsonb not null,
  deleted_by uuid,
  deleted_by_name text not null default '',
  deleted_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by uuid
);
create index deleted_counter_records_active_idx on public.deleted_counter_records(deleted_at desc,id) where restored_at is null;
alter table public.deleted_counter_records enable row level security;
revoke all on public.deleted_counter_records from public,anon,authenticated;
grant select on public.deleted_counter_records to authenticated;
grant all on public.deleted_counter_records to service_role;
create policy deleted_counters_owner_read on public.deleted_counter_records for select to authenticated using ((select private.is_owner()));
-- Audit trigger only: snapshot data and identity are derived from the actual affected row/session.
create function private.archive_deleted_counters() returns trigger
language plpgsql security definer set search_path='' as $$
declare deck jsonb; new_decks jsonb; actor_name text;
begin
  select game_nickname into actor_name from public.profiles where auth_user_id=auth.uid();
  if tg_op='DELETE' then
    insert into public.deleted_counter_records(kind,parent_id,payload,deleted_by,deleted_by_name)
    values(case when tg_table_name='attack_teams' then 'attack_team' else 'enemy_team' end,old.id,
      jsonb_build_object('team',to_jsonb(old)),auth.uid(),coalesce(actor_name,'시스템'));
    return old;
  end if;
  new_decks := private.counter_array(new.counter_decks);
  for deck in select value from jsonb_array_elements(private.counter_array(old.counter_decks)) loop
    if not exists(select 1 from jsonb_array_elements(new_decks) d where d->>'counter_id'=deck->>'counter_id') then
      insert into public.deleted_counter_records(kind,parent_id,payload,deleted_by,deleted_by_name)
      values('counter',old.id,jsonb_build_object('team',to_jsonb(old),'counter',deck),auth.uid(),coalesce(actor_name,'시스템'));
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.archive_deleted_counters() from public,anon,authenticated;
create trigger archive_removed_counters after update of counter_decks on public.enemy_defense_teams
for each row execute function private.archive_deleted_counters();
create trigger archive_deleted_enemy_team after delete on public.enemy_defense_teams
for each row execute function private.archive_deleted_counters();
create trigger archive_deleted_attack_team after delete on public.attack_teams
for each row execute function private.archive_deleted_counters();
-- Kept in private schema; caller must be the authenticated owner even through the public wrapper.
create function private.restore_counter_record(record_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare archived public.deleted_counter_records; snapshot jsonb; existing public.enemy_defense_teams;
  desired jsonb; combined jsonb; deck jsonb;
begin
  if auth.uid() is null or not private.is_owner() then raise exception 'Only the site owner can restore deleted counters' using errcode='42501'; end if;
  select * into archived from public.deleted_counter_records where id=record_id for update;
  if not found then raise exception 'Deletion record not found'; end if;
  if archived.restored_at is not null then return archived.parent_id; end if;
  perform pg_advisory_xact_lock(hashtextextended('counter-restore:'||archived.parent_id::text,0));
  snapshot := archived.payload->'team';
  if archived.kind='attack_team' then
    insert into public.attack_teams select (jsonb_populate_record(null::public.attack_teams,snapshot)).* on conflict(id) do nothing;
  else
    desired := case when archived.kind='counter' then jsonb_build_array(archived.payload->'counter') else private.counter_array(snapshot->'counter_decks') end;
    select * into existing from public.enemy_defense_teams where id=archived.parent_id for update;
    if found then
      combined := private.counter_array(existing.counter_decks);
      for deck in select value from jsonb_array_elements(desired) loop
        if not exists(select 1 from jsonb_array_elements(combined) d where d->>'counter_id'=deck->>'counter_id') then
          combined := combined || jsonb_build_array(deck);
        end if;
      end loop;
      update public.enemy_defense_teams set counter_decks=to_jsonb(combined::text),updated_at=now() where id=archived.parent_id;
    else
      snapshot := jsonb_set(snapshot,'{counter_decks}',to_jsonb(desired::text));
      insert into public.enemy_defense_teams select (jsonb_populate_record(null::public.enemy_defense_teams,snapshot)).*;
    end if;
  end if;
  update public.deleted_counter_records set restored_at=now(),restored_by=auth.uid() where id=record_id;
  return archived.parent_id;
end $$;
revoke all on function private.restore_counter_record(uuid) from public,anon;
grant execute on function private.restore_counter_record(uuid) to authenticated;
create function public.restore_deleted_counter(record_id uuid) returns uuid
language sql security invoker set search_path='' as $$ select private.restore_counter_record(record_id); $$;
revoke all on function public.restore_deleted_counter(uuid) from public,anon;
grant execute on function public.restore_deleted_counter(uuid) to authenticated;
commit;
