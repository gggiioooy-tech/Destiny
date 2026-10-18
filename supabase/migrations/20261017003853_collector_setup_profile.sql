create table private.collector_runtime_profile (
  id boolean primary key default true check(id),
  protocol_key text not null check(protocol_key ~ '^[a-f0-9]{64}$'),
  protocol_iv text not null check(protocol_iv ~ '^[a-f0-9]{32}$')
);
alter table private.collector_runtime_profile enable row level security;
revoke all on private.collector_runtime_profile from public,anon,authenticated;
create function private.collector_setup_profile() returns jsonb language plpgsql security definer set search_path='' as $$
declare guilds text[]; result jsonb;
begin
  if not private.is_approved_member() then raise exception '승인된 회원만 연결할 수 있습니다.' using errcode='42501';end if;
  select array_agg(distinct btrim(x)) filter(where btrim(x)<>'') into guilds from public.profiles p cross join lateral regexp_split_to_table(coalesce(p.memo,''),',') x where p.auth_user_id=auth.uid();
  if cardinality(guilds) is distinct from 1 then raise exception '회원 메모에 길드 하나를 지정해 주세요.' using errcode='22023';end if;
  select jsonb_build_object('key',protocol_key,'iv',protocol_iv,'guild',guilds[1]) into result from private.collector_runtime_profile where id;
  if result is null then raise exception '수집 설정이 준비되지 않았습니다.';end if;
  return result;
end $$;
revoke all on function private.collector_setup_profile() from public,anon;
grant execute on function private.collector_setup_profile() to authenticated;
create function public.collector_setup_profile() returns jsonb language sql security invoker set search_path='' as $$select private.collector_setup_profile()$$;
revoke all on function public.collector_setup_profile() from public,anon;
grant execute on function public.collector_setup_profile() to authenticated;
