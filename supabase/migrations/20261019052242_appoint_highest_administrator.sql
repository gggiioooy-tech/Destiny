create function private.appoint_highest_administrator(p_user_id text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_owner() then
    raise exception '최고관리자만 최고관리자를 임명할 수 있습니다.' using errcode='42501';
  end if;
  update public.profiles set role='admin',is_owner=true
  where user_id=p_user_id and status='approved' and auth_user_id is not null;
  if not found then raise exception '승인된 회원만 임명할 수 있습니다.' using errcode='22023'; end if;
end $$;
revoke all on function private.appoint_highest_administrator(text) from public,anon;
grant execute on function private.appoint_highest_administrator(text) to authenticated;
create function public.appoint_highest_administrator(p_user_id text) returns void
language sql security invoker set search_path='' as $$
  select private.appoint_highest_administrator(p_user_id);
$$;
revoke all on function public.appoint_highest_administrator(text) from public,anon;
grant execute on function public.appoint_highest_administrator(text) to authenticated;
