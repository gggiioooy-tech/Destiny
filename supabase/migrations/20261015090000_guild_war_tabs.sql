begin;
create table public.guild_war_tabs (
  name text primary key check (length(name) between 1 and 80 and name=btrim(name)),
  created_at timestamptz not null default now()
);
alter table public.guild_war_tabs enable row level security;
revoke all on public.guild_war_tabs from public,anon,authenticated;
grant select on public.guild_war_tabs to authenticated;
create policy guild_tabs_read on public.guild_war_tabs for select to authenticated using ((select private.is_approved_member()));
insert into public.guild_war_tabs(name) values ('철폐'),('서리');

create table public.guild_war_observations (
  id uuid primary key default gen_random_uuid(),
  guild_name text,
  reporter_id uuid not null references auth.users(id),
  kind text not null check (kind in ('battle','defense_snapshot')),
  source_key text not null check (length(source_key) between 1 and 200),
  occurred_at timestamptz not null,
  payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=524288),
  created_at timestamptz not null default now(),
  unique (reporter_id,kind,source_key)
);
create index guild_war_observations_guild_time on public.guild_war_observations(guild_name,kind,occurred_at desc);
alter table public.guild_war_observations enable row level security;
revoke all on public.guild_war_observations from public,anon,authenticated;
grant select on public.guild_war_observations to authenticated;
create policy guild_observations_read on public.guild_war_observations for select to authenticated
using ((select private.is_approved_member()) and exists(select 1 from public.guild_war_tabs t where t.name=guild_name));

-- Membership comes only from the protected profile memo, never from an upload field.
create function private.submit_guild_war_observation(p_kind text,p_source_key text,p_occurred_at timestamptz,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare names text[]; guild text; registered boolean; inserted_id uuid;
begin
  if auth.uid() is null or not private.is_approved_member() then raise exception '승인된 회원만 기록을 전송할 수 있습니다.' using errcode='42501'; end if;
  select array_agg(distinct btrim(x)) filter(where btrim(x)<>'') into names
  from public.profiles p cross join lateral regexp_split_to_table(coalesce(p.memo,''),',') x
  where p.auth_user_id=auth.uid();
  if cardinality(names)=1 then guild=names[1]; end if;
  if p_kind is null or p_kind not in ('battle','defense_snapshot') or p_source_key is null or length(p_source_key) not between 1 and 200
    or p_occurred_at is null or p_occurred_at>now()+interval '10 minutes'
    or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>524288 then
    raise exception '올바르지 않은 길드전 기록입니다.' using errcode='22023';
  end if;
  if p_kind='battle' and (jsonb_typeof(p_payload->'attacker') is distinct from 'object' or jsonb_typeof(p_payload->'defender') is distinct from 'object') then
    raise exception '공격자와 방어자 정보가 필요합니다.' using errcode='22023';
  end if;
  if p_kind='defense_snapshot' and jsonb_typeof(p_payload->'defenses') is distinct from 'array' then
    raise exception '방어덱 목록이 필요합니다.' using errcode='22023';
  end if;
  insert into public.guild_war_observations(guild_name,reporter_id,kind,source_key,occurred_at,payload)
  values(guild,auth.uid(),p_kind,p_source_key,p_occurred_at,p_payload)
  on conflict(reporter_id,kind,source_key) do nothing returning id into inserted_id;
  select exists(select 1 from public.guild_war_tabs where name=guild) into registered;
  return jsonb_build_object('status',case when inserted_id is null then 'duplicate' when registered then 'recorded' else 'held' end,'guild',guild);
end $$;
create function public.submit_guild_war_observation(p_kind text,p_source_key text,p_occurred_at timestamptz,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.submit_guild_war_observation(p_kind,p_source_key,p_occurred_at,p_payload);
$$;

create function private.add_guild_war_tab(p_name text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_admin() then raise exception '관리자만 길드를 추가할 수 있습니다.' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80 or not exists(
    select 1 from public.profiles p cross join lateral regexp_split_to_table(coalesce(p.memo,''),',') x where btrim(x)=btrim(p_name)
  ) then raise exception '관리자 메모에 등록된 길드를 선택해 주세요.' using errcode='22023'; end if;
  insert into public.guild_war_tabs(name) values(btrim(p_name)) on conflict do nothing;
end $$;
create function public.add_guild_war_tab(p_name text) returns void
language sql security invoker set search_path='' as $$select private.add_guild_war_tab(p_name);$$;
revoke all on function private.submit_guild_war_observation(text,text,timestamptz,jsonb),public.submit_guild_war_observation(text,text,timestamptz,jsonb),private.add_guild_war_tab(text),public.add_guild_war_tab(text) from public,anon,authenticated;
grant execute on function private.submit_guild_war_observation(text,text,timestamptz,jsonb),public.submit_guild_war_observation(text,text,timestamptz,jsonb),private.add_guild_war_tab(text),public.add_guild_war_tab(text) to authenticated;
commit;
