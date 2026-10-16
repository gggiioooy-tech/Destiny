begin;
create or replace function private.submit_guild_war_observation(p_kind text,p_source_key text,p_occurred_at timestamptz,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare names text[]; guild text; registered boolean; inserted_id uuid; side_name text;
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
  if p_payload ? 'sourceGuild' and (guild is null or p_payload->>'sourceGuild' is distinct from guild) then raise exception 'PC 수집 길드와 회원 메모의 길드가 다릅니다.' using errcode='42501'; end if;
  insert into public.guild_war_observations(guild_name,reporter_id,kind,source_key,occurred_at,payload)
  values(guild,auth.uid(),p_kind,p_source_key,p_occurred_at,p_payload)
  on conflict do nothing returning id into inserted_id;
  if inserted_id is null and p_kind='battle' and guild is not null then
    foreach side_name in array array['attacker','defender'] loop
      if jsonb_typeof(p_payload->side_name->'skills')='array' then
        if jsonb_array_length(p_payload->side_name->'skills') between 1 and 3 then
          update public.guild_war_observations o
          set payload=jsonb_set(o.payload,array[side_name,'skills'],p_payload->side_name->'skills')
          where o.guild_name=guild and o.kind=p_kind and o.source_key=p_source_key
            and o.payload->side_name->'heroIds'=p_payload->side_name->'heroIds'
            and coalesce(o.payload->side_name->'skills','[]'::jsonb)='[]'::jsonb;
        end if;
      end if;
    end loop;
  end if;
  select exists(select 1 from public.guild_war_tabs where name=guild) into registered;
  return jsonb_build_object('status',case when inserted_id is null then 'duplicate' when registered then 'recorded' else 'held' end,'guild',guild);
end $$;


commit;
