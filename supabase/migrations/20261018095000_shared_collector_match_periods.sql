create table private.collector_match_periods(
 guild text not null, war_date date not null, period jsonb not null,
 primary key(guild,war_date)
);
alter table private.collector_match_periods enable row level security;
revoke all on private.collector_match_periods from public,anon,authenticated;
create function public.collector_sync_periods(p_periods jsonb default '[]') returns jsonb
language plpgsql security definer set search_path='' as $$
declare guilds text[]; p jsonb; t1 timestamptz; t2 timestamptz; d date; result jsonb;
begin
 if not private.is_approved_member() then raise exception '승인된 회원만 연결할 수 있습니다.' using errcode='42501'; end if;
 select array_agg(distinct btrim(x)) filter(where btrim(x)<>'') into guilds from public.profiles pr cross join lateral regexp_split_to_table(coalesce(pr.memo,''),',') x where pr.auth_user_id=auth.uid();
 if cardinality(guilds) is distinct from 1 then raise exception '회원 메모에 길드 하나를 지정해 주세요.' using errcode='22023';end if;
 if jsonb_typeof(p_periods)<>'array' or jsonb_array_length(p_periods)>60 then raise exception '매칭 정보 오류';end if;
 for p in select value from jsonb_array_elements(p_periods) loop
  if p->>'guild' is distinct from guilds[1] or coalesce(length(p->>'matchKey'),0) not between 1 and 100 or coalesce(length(p->>'opponent'),0) not between 1 and 80 then continue;end if;
  t1=(p->>'from')::timestamptz;t2=(p->>'until')::timestamptz;d=(p->>'warDate')::date;
  if t1 is null or t2 is null or d is null or t2<=t1 or t2-t1>interval '48 hours' or (t1 at time zone 'Asia/Seoul')::date<>d or t1>now()+interval '1 day' then raise exception '매칭 시각 오류';end if;
  if exists(select 1 from private.collector_match_periods m where m.guild=guilds[1] and m.war_date<>d and (m.period->>'from')::timestamptz<t2 and (m.period->>'until')::timestamptz>t1) then continue;end if;
  insert into private.collector_match_periods values(guilds[1],d,jsonb_build_object('guild',guilds[1],'warDate',d,'from',p->>'from','until',p->>'until','opponent',p->>'opponent','matchKey',p->>'matchKey')) on conflict do nothing;
 end loop;
 select coalesce(jsonb_agg(x.period order by x.war_date),'[]') into result from (select * from private.collector_match_periods where guild=guilds[1] order by war_date desc limit 60)x;
 return result;
end $$;
revoke all on function public.collector_sync_periods(jsonb) from public,anon;
grant execute on function public.collector_sync_periods(jsonb) to authenticated;
create function public.guild_war_history_labels(p_guild text) returns table(war_date date,opponent text)
language sql stable security invoker set search_path='' as $$
 select o.war_date,max(nullif(o.payload->>'opponentGuild','')) from public.guild_war_observations o where o.guild_name=p_guild group by o.war_date order by o.war_date desc
$$;
revoke all on function public.guild_war_history_labels(text) from public,anon;
grant execute on function public.guild_war_history_labels(text) to authenticated;
