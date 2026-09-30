begin;
create function private.counter_author_nicknames(team_id uuid)
returns table(counter_id uuid, nickname text)
language sql stable security definer set search_path='' as $$
  select r.counter_id,
    case when r.author_auth_id is null then '기록 없음'
         when p.id is null then '탈퇴한 회원'
         else coalesce(nullif(btrim(p.game_nickname),''),'닉네임 미등록') end
  from public.enemy_defense_teams t
  cross join lateral jsonb_array_elements(private.counter_array(t.counter_decks)) d
  join public.counter_deck_registry r on r.counter_id::text=d->>'counter_id' and r.enemy_team_id=t.id
  left join public.profiles p on p.auth_user_id=r.author_auth_id
  where t.id=team_id and private.is_approved_member()
    and (t.is_public is true or private.is_admin());
$$;
revoke all on function private.counter_author_nicknames(uuid) from public,anon;
grant execute on function private.counter_author_nicknames(uuid) to authenticated;
create function public.counter_author_nicknames(team_id uuid)
returns table(counter_id uuid,nickname text)
language sql stable security invoker set search_path='' as $$
  select * from private.counter_author_nicknames(team_id);
$$;
revoke all on function public.counter_author_nicknames(uuid) from public,anon;
grant execute on function public.counter_author_nicknames(uuid) to authenticated;
commit;
