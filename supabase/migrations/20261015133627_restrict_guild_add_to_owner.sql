begin;
create or replace function private.add_guild_war_tab(p_name text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_owner() then raise exception '최고 관리자만 길드를 추가할 수 있습니다.' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80 or not exists(
    select 1 from public.profiles p cross join lateral regexp_split_to_table(coalesce(p.memo,''),',') x where btrim(x)=btrim(p_name)
  ) then raise exception '관리자 메모에 등록된 길드를 선택해 주세요.' using errcode='22023'; end if;
  insert into public.guild_war_tabs(name) values(btrim(p_name)) on conflict do nothing;
end $$;
commit;
