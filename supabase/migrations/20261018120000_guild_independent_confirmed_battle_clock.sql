create function private.collector_periods_for(p_guild text) returns jsonb
language sql stable security definer set search_path='' as $$
with confirmed_clock as (
 select war_date,max(period->>'from') as start_at,max(period->>'until') as end_at
 from private.collector_match_periods
 where coalesce(period->>'matchKey','')<>'' 
 group by war_date
 having count(distinct ((period->>'from')::timestamptz,(period->>'until')::timestamptz))=1
), periods as (
 select war_date,period from private.collector_match_periods where guild=p_guild
 union all
 select c.war_date,jsonb_build_object('guild',p_guild,'warDate',c.war_date,'from',c.start_at,'until',c.end_at,'opponent','상대 길드 미확인','dateSource','confirmed-game-clock')
 from confirmed_clock c where not exists(select 1 from private.collector_match_periods m where m.guild=p_guild and m.war_date=c.war_date)
)
select coalesce(jsonb_agg(x.period order by x.war_date),'[]') from (select * from periods order by war_date desc limit 60)x;
$$;
revoke all on function private.collector_periods_for(text) from public,anon,authenticated;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.collector_sync_periods(jsonb)'::regprocedure) into definition;
 definition=replace(definition,'return result;','return private.collector_periods_for(guilds[1]);');
 execute definition;
 select pg_get_functiondef('private.collector_setup_profile()'::regprocedure) into definition;
 definition=replace(definition,'(select coalesce(jsonb_agg(m.period),''[]'') from (select period from private.collector_match_periods where guild=guilds[1] order by war_date desc limit 60)m)','private.collector_periods_for(guilds[1])');
 execute definition;
end $$;
