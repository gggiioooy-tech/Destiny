-- Target: destiny / kqygrszkbuzxmmfndhye only. Never apply to the Seori project.
begin;
do $$ begin
  if (select count(*) from public.profiles where user_id = '15month') <> 1 then
    raise exception 'Expected exactly one existing owner; aborting migration';
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='auth_user_id') then
    raise exception 'This one-time legacy migration has already been applied';
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
create table private.legacy_credentials (
  user_id text primary key,
  password_hash text not null
);
insert into private.legacy_credentials(user_id,password_hash)
select user_id, extensions.crypt(password,extensions.gen_salt('bf',12))
from public.profiles where user_id='15month' and password is not null;
-- Owner requested removal of every other account; no content tables are deleted.
delete from public.profiles where user_id is distinct from '15month';
alter table public.profiles drop column password;
alter table public.profiles add column auth_user_id uuid unique references auth.users(id) on delete cascade;
alter table public.profiles add column is_owner boolean not null default false;
alter table public.profiles add column must_change_password boolean not null default false;
update public.profiles set role='admin',status='approved',is_owner=true,must_change_password=true where user_id='15month';
create unique index profiles_user_id_lower_unique on public.profiles(lower(user_id));
alter table public.profiles add constraint profiles_role_valid check(role in ('admin','member','guest'));
alter table public.profiles add constraint profiles_status_valid check(status in ('pending','approved','blocked','rejected'));
alter table public.profiles alter column role set default 'member';

create function private.valid_session() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from auth.sessions s
    where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
    and (s.not_after is null or s.not_after>now()));
$$;
create function private.is_approved_member() returns boolean
language sql stable security definer set search_path='' as $$
  select private.valid_session() and exists(select 1 from public.profiles
  where auth_user_id=auth.uid() and status='approved' and not must_change_password and role in ('admin','member'));
$$;
create function private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select private.valid_session() and exists(select 1 from public.profiles
  where auth_user_id=auth.uid() and status='approved' and not must_change_password and role='admin');
$$;
revoke all on function private.valid_session(), private.is_approved_member(), private.is_admin() from public,anon;
grant execute on function private.valid_session(), private.is_approved_member(), private.is_admin() to authenticated,service_role;

create function private.protect_profile() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.is_owner then raise exception 'Owner cannot be deleted'; end if;
    return old;
  end if;
  if old.is_owner and (new.is_owner is distinct from true or new.role is distinct from 'admin' or new.status is distinct from 'approved') then
    raise exception 'Owner privileges cannot be removed';
  end if;
  if current_user not in ('postgres','service_role','supabase_admin') and
    (new.auth_user_id is distinct from old.auth_user_id or new.user_id is distinct from old.user_id or
     new.is_owner is distinct from old.is_owner or new.must_change_password is distinct from old.must_change_password) then
    raise exception 'Protected account field';
  end if;
  return new;
end $$;
revoke all on function private.protect_profile() from public,anon,authenticated;
create trigger protect_profile before update or delete on public.profiles for each row execute function private.protect_profile();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
grant update(role,status,memo,game_nickname) on public.profiles to authenticated;
grant delete on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated
using (((select private.valid_session()) and auth_user_id=(select auth.uid())) or (select private.is_admin()));
create policy profiles_admin_update on public.profiles for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy profiles_admin_delete on public.profiles for delete to authenticated
using (not is_owner and (select private.is_admin()));

do $$ declare t text; begin
  foreach t in array array['defense_teams','enemy_defense_teams','attack_teams','total_war_teams','arena_teams','notices','attack_guides'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    if t='attack_guides' then
      execute format('create policy content_read on public.%I for select to authenticated using ((select private.is_approved_member()))',t);
    else
      execute format('create policy content_read on public.%I for select to authenticated using ((select private.is_admin()) or ((select private.is_approved_member()) and is_public is not false))',t);
    end if;
    execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select private.is_admin()))',t);
    execute format('create policy admin_update on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using ((select private.is_admin()))',t);
  end loop;
end $$;
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon,authenticated;
grant select on public.site_settings to anon,authenticated;
grant insert,update,delete on public.site_settings to authenticated;
create policy settings_public_branding on public.site_settings for select to anon,authenticated
using (key in ('guild_name','site_title','main_subtitle','hero_notice','footer_text'));
create policy settings_member_read on public.site_settings for select to authenticated using ((select private.is_approved_member()));
create policy settings_admin_insert on public.site_settings for insert to authenticated with check ((select private.is_admin()));
create policy settings_admin_update on public.site_settings for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy settings_admin_delete on public.site_settings for delete to authenticated using ((select private.is_admin()));

create table private.auth_budgets (
  key_hash text primary key,
  attempts integer not null,
  window_start timestamptz not null default now()
);
revoke all on all tables in schema private from public,anon,authenticated;
grant all on all tables in schema private to service_role;
create function public.consume_auth_budget(p_key_hash text,p_limit integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare used integer;
begin
  if length(p_key_hash)<>64 or p_limit not between 1 and 100 then raise exception 'Invalid budget'; end if;
  insert into private.auth_budgets as b(key_hash,attempts,window_start) values(p_key_hash,1,now())
  on conflict(key_hash) do update set
    attempts=case when b.window_start<now()-interval '30 minutes' then 1 else b.attempts+1 end,
    window_start=case when b.window_start<now()-interval '30 minutes' then now() else b.window_start end
  returning attempts into used;
  return used<=p_limit;
end $$;
create function public.verify_legacy_password(p_user_id text,p_password text) returns boolean
language sql security invoker set search_path='' as $$
  select coalesce((select password_hash=extensions.crypt(p_password,password_hash)
  from private.legacy_credentials where user_id=p_user_id),false);
$$;
create function public.clear_legacy_password(p_user_id text) returns void
language sql security invoker set search_path='' as $$
  delete from private.legacy_credentials where user_id=p_user_id;
$$;
revoke all on function public.consume_auth_budget(text,integer),public.verify_legacy_password(text,text),public.clear_legacy_password(text) from public,anon,authenticated;
grant execute on function public.consume_auth_budget(text,integer),public.verify_legacy_password(text,text),public.clear_legacy_password(text) to service_role;
alter default privileges in schema public revoke execute on functions from public;

-- Replace site-owned wording without changing account identifiers or game data.
update public.site_settings set value=replace(replace(replace(replace(replace(replace(value,
 '운명','15월'),'길드전','전투'),'길드원','회원'),'길드명','사이트명'),'길드별','그룹별'),'길드',''),updated_at=now()
where value like '%운명%' or value like '%길드%';
insert into public.site_settings(key,value) values ('guild_name','15월'),('site_title','세븐나이츠 리버스 15월 공략 사이트'),('main_subtitle','방어팀 배치와 공격법을 정리한 공략 사이트입니다.'),('hero_notice','승인된 회원만 열람할 수 있습니다.')
on conflict(key) do update set value=excluded.value,updated_at=now();
commit;
