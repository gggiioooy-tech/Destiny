-- Names are linked to a stable profile within a guild, never globally by name.
create table private.member_nickname_aliases(
 guild text not null, nickname text not null,
 profile_id text not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(guild,nickname)
);
alter table private.member_nickname_aliases enable row level security;
revoke all on private.member_nickname_aliases from public,anon,authenticated;
create index member_nickname_aliases_profile_idx on private.member_nickname_aliases(profile_id);

create function private.resolve_battle_nicknames() returns trigger
language plpgsql security definer set search_path='' as $$
declare side text; side_guild text; canonical text;
begin
 if new.kind<>'battle' then return new;end if;
 foreach side in array array['attacker','defender'] loop
  side_guild=case when (new.payload->>'direction'='attack')=(side='attacker') then new.guild_name else new.payload->>'opponentGuild' end;
  select p.game_nickname into canonical from private.member_nickname_aliases a join public.profiles p on p.id=a.profile_id
   where a.guild=side_guild and a.nickname=normalize(btrim(new.payload#>>array[side,'nickname']),NFC);
  if canonical is not null and canonical is distinct from new.payload#>>array[side,'nickname'] then
   new.payload=jsonb_set(new.payload,array[side,'nickname'],to_jsonb(canonical));
  end if;
 end loop;
 return new;
end$$;
revoke all on function private.resolve_battle_nicknames() from public,anon,authenticated;
create trigger aa_resolve_battle_nicknames before insert or update of payload on public.guild_war_observations
 for each row execute function private.resolve_battle_nicknames();

create function private.change_member_nickname(p_nickname text,p_user_id text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller public.profiles; member public.profiles; next_name text=normalize(btrim(p_nickname),NFC);
 member_guild text; changed integer=0;
begin
 if not private.valid_session() then raise exception '다시 로그인해 주세요.' using errcode='42501';end if;
 select * into caller from public.profiles where auth_user_id=auth.uid();
 if caller.status is distinct from 'approved' or caller.must_change_password then raise exception '승인된 회원만 변경할 수 있습니다.' using errcode='42501';end if;
 if p_user_id is not null and p_user_id<>caller.user_id and not private.is_admin() then raise exception '다른 회원의 닉네임은 운영진만 변경할 수 있습니다.' using errcode='42501';end if;
 if next_name is null or char_length(next_name) not between 1 and 40 or next_name ~ '[[:cntrl:]]' then raise exception '닉네임을 1~40글자로 입력해 주세요.' using errcode='22023';end if;
 select * into member from public.profiles where user_id=coalesce(p_user_id,caller.user_id) for update;
 if not found then raise exception '회원을 찾을 수 없습니다.' using errcode='22023';end if;
 if next_name=member.game_nickname then return jsonb_build_object('nickname',next_name,'updatedRecords',0);end if;
 for member_guild in select distinct btrim(x) from regexp_split_to_table(coalesce(member.memo,''),',') x where btrim(x)<>'' order by 1 loop
  -- Serialize name reservations within each guild; never merge another member.
  perform pg_advisory_xact_lock(hashtextextended('member-nickname:'||member_guild,0));
  if exists(select 1 from private.member_nickname_aliases a where a.guild=member_guild and a.nickname in (next_name,normalize(btrim(member.game_nickname),NFC)) and a.profile_id<>member.id)
  or exists(select 1 from public.profiles p cross join lateral regexp_split_to_table(coalesce(p.memo,''),',') x
   where p.id<>member.id and btrim(x)=member_guild and normalize(btrim(p.game_nickname),NFC) in (next_name,normalize(btrim(member.game_nickname),NFC)))
  then raise exception '같은 길드의 다른 회원 닉네임 또는 이전 닉네임과 겹칩니다. 운영진에게 확인해 주세요.' using errcode='23505';end if;
  insert into private.member_nickname_aliases(guild,nickname,profile_id)
   select member_guild,n,member.id from unnest(array[normalize(btrim(member.game_nickname),NFC),next_name]) n where coalesce(n,'')<>''
   on conflict on constraint member_nickname_aliases_pkey do nothing;
 end loop;
 update public.profiles set game_nickname=next_name where id=member.id;
 -- Re-run the resolver only for this member's known guild/name aliases.
 update public.guild_war_observations o set payload=o.payload
 where o.kind='battle' and exists(select 1 from private.member_nickname_aliases a where a.profile_id=member.id and (
  (a.guild=o.guild_name and a.nickname=o.member_nickname)
  or (a.guild=o.payload->>'opponentGuild' and a.nickname=normalize(btrim(o.payload#>>array[case o.direction when 'attack' then 'defender' else 'attacker' end,'nickname']),NFC))
 ));
 get diagnostics changed=row_count;
 return jsonb_build_object('nickname',next_name,'updatedRecords',changed);
end$$;
revoke all on function private.change_member_nickname(text,text) from public,anon;
grant execute on function private.change_member_nickname(text,text) to authenticated;
create function public.change_member_nickname(p_nickname text,p_user_id text default null) returns jsonb
language sql security invoker set search_path='' as $$select private.change_member_nickname(p_nickname,p_user_id);$$;
revoke all on function public.change_member_nickname(text,text) from public,anon;
grant execute on function public.change_member_nickname(text,text) to authenticated;
-- All browser nickname edits must preserve the aliases/history transaction.
revoke update(game_nickname) on public.profiles from authenticated;
