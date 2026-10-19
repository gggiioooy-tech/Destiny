create function private.is_founder() returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_owner() and exists(select 1 from public.profiles where auth_user_id=auth.uid() and user_id='15month');
$$;
revoke all on function private.is_founder() from public,anon;
grant execute on function private.is_founder() to authenticated;

do $$declare definition text;begin
 select pg_get_functiondef('private.protect_profile()'::regprocedure) into definition;
 if position('Owner privileges cannot be removed' in definition)=0 then raise exception 'Unexpected profile guard';end if;
 definition=replace(definition,
 'if old.is_owner and (new.is_owner is distinct from true or new.role is distinct from ''admin'' or new.status is distinct from ''approved'') then',
 'if old.is_owner and (new.is_owner is distinct from true or new.role is distinct from ''admin'' or new.status is distinct from ''approved'') and not (old.user_id<>''15month'' and private.is_founder() and new.is_owner=false and new.role in (''admin'',''member'',''guest'') and new.status=''approved'') then');
 execute definition;
end$$;

create function private.demote_highest_administrator(p_user_id text,p_role text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_founder() then raise exception '원래 사이트 소유자만 최고관리자를 강등할 수 있습니다.' using errcode='42501';end if;
 if p_user_id='15month' then raise exception '원래 사이트 소유자 권한은 변경할 수 없습니다.' using errcode='42501';end if;
 if p_role is null or p_role not in ('admin','member','guest') then raise exception '올바르지 않은 등급입니다.' using errcode='22023';end if;
 update public.profiles set is_owner=false,role=p_role where user_id=p_user_id and is_owner and status='approved';
 if not found then raise exception '강등할 최고관리자를 찾지 못했습니다.' using errcode='22023';end if;
end$$;
revoke all on function private.demote_highest_administrator(text,text) from public,anon;
grant execute on function private.demote_highest_administrator(text,text) to authenticated;
create function public.demote_highest_administrator(p_user_id text,p_role text) returns void
language sql security invoker set search_path='' as $$select private.demote_highest_administrator(p_user_id,p_role);$$;
revoke all on function public.demote_highest_administrator(text,text) from public,anon;
grant execute on function public.demote_highest_administrator(text,text) to authenticated;
