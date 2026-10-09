begin;
create table public.counter_transfer_receipts (
 transfer_key text primary key, source_site text not null, source_team_id uuid not null,
 destination_team_id uuid not null, counter_id uuid not null, source_author text not null,
 sender_nickname text not null, created_at timestamptz not null default now()
);
alter table public.counter_transfer_receipts enable row level security;
revoke all on public.counter_transfer_receipts from public,anon,authenticated;
grant all on public.counter_transfer_receipts to service_role;
create function private.transfer_team_key(value text) returns text
language sql immutable set search_path='' as $$
 select string_agg(v,'|' order by v) from (
 select lower(regexp_replace(x,'\s','','g')) v
 from regexp_split_to_table(coalesce(value,''),'[,\n\r]+') x
 where btrim(x)<>'') s;
$$;
create function private.transfer_decks(snapshot jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare decks jsonb:=snapshot->'counter_decks'; legacy jsonb;
begin
 if jsonb_typeof(decks)='string' then
  begin decks:=(decks#>>'{}')::jsonb; exception when others then decks:='[]'::jsonb; end;
 end if;
 if jsonb_typeof(decks)='array' and jsonb_array_length(decks)>0 then return decks; end if;
 if coalesce(snapshot->>'counter_heroes','')<>'' then
  legacy:=jsonb_build_object('title','카운터덱 1','power',coalesce(snapshot->>'counter_power',''),'heroes',coalesce(snapshot->>'counter_heroes',''),'rings',coalesce(snapshot->>'counter_rings',''),'pet',coalesce(snapshot->>'counter_pet',''),'formation',coalesce(snapshot->>'counter_formation',''),'speed_order',coalesce(snapshot->>'counter_speed_order',''),'team_speed',coalesce(snapshot->>'counter_team_speed',''),'skill_order',coalesce(snapshot->>'counter_skill_order',''),'gear_1',coalesce(snapshot->>'counter_gear_1',''),'gear_2',coalesce(snapshot->>'counter_gear_2',''),'gear_3',coalesce(snapshot->>'counter_gear_3',''),'note',coalesce(snapshot->>'counter_note',''));
  return jsonb_build_array(legacy);
 end if;
 return '[]'::jsonb;
end $$;
revoke all on function private.transfer_team_key(text),private.transfer_decks(jsonb) from public,anon,authenticated;
create function private.export_counter_for_transfer(team_id uuid,counter_match jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.enemy_defense_teams; d jsonb; sender text; author_name text;
begin
 if auth.uid() is null or not private.is_admin() or not exists(
 select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
 and (s.not_after is null or s.not_after>now())) then
 raise exception '관리자 로그인 후 이용해 주세요' using errcode='42501'; end if;
 select * into t from public.enemy_defense_teams where id=team_id;
 if not found then raise exception '원본 방어팀이 없습니다'; end if;
 select value into d from jsonb_array_elements(private.transfer_decks(to_jsonb(t)))
 where coalesce(value->>'title','')=coalesce(counter_match->>'title','') and coalesce(value->>'power','')=coalesce(counter_match->>'power','') and coalesce(value->>'heroes','')=coalesce(counter_match->>'heroes','') and coalesce(value->>'rings','')=coalesce(counter_match->>'rings','') and coalesce(value->>'pet','')=coalesce(counter_match->>'pet','') and coalesce(value->>'formation','')=coalesce(counter_match->>'formation','') and coalesce(value->>'speed_order','')=coalesce(counter_match->>'speed_order','') and coalesce(value->>'team_speed','')=coalesce(counter_match->>'team_speed','') and coalesce(value->>'skill_order','')=coalesce(counter_match->>'skill_order','') and coalesce(value->>'gear_1','')=coalesce(counter_match->>'gear_1','') and coalesce(value->>'gear_2','')=coalesce(counter_match->>'gear_2','') and coalesce(value->>'gear_3','')=coalesce(counter_match->>'gear_3','') and coalesce(value->>'note','')=coalesce(counter_match->>'note','') limit 1;
 if d is null or btrim(coalesce(d->>'heroes',''))='' then raise exception '원본이 변경되었습니다. 새로고침 후 다시 보내 주세요'; end if;
 select coalesce(nullif(game_nickname,''),'닉네임 미등록') into sender from public.profiles where auth_user_id=auth.uid();
 select nickname into author_name from private.counter_author_nicknames(team_id) a where a.counter_id::text=d->>'counter_id';
 return jsonb_build_object('source_site','destiny','source_team_id',t.id,
 'team',jsonb_build_object('title',t.title,'heroes',t.heroes,'note',t.note,'is_public',t.is_public,'is_temporary',t.is_temporary),
 'deck',d,'sender',sender,'author',coalesce(author_name,sender));
end $$;
revoke all on function private.export_counter_for_transfer(uuid,jsonb) from public,anon;
grant execute on function private.export_counter_for_transfer(uuid,jsonb) to authenticated;
create function public.export_counter_for_transfer(team_id uuid,counter_match jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.export_counter_for_transfer(team_id,counter_match); $$;
revoke all on function public.export_counter_for_transfer(uuid,jsonb) from public,anon;
grant execute on function public.export_counter_for_transfer(uuid,jsonb) to authenticated;
create function private.import_shared_counter(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target public.enemy_defense_teams; receipt public.counter_transfer_receipts;
 src text:=payload->>'source_site'; team jsonb:=payload->'team'; deck jsonb:=payload->'deck';
 fingerprint text; combo text; new_id uuid:=gen_random_uuid(); decks jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Server only' using errcode='42501'; end if;
 if src is distinct from 'seori' or jsonb_typeof(deck)<>'object'
 or btrim(coalesce(team->>'heroes',''))='' or btrim(coalesce(deck->>'heroes',''))='' or octet_length(payload::text)>262144
 then raise exception 'Invalid transfer'; end if;
 combo:=private.transfer_team_key(team->>'heroes');
 fingerprint:=src||':'||(payload->>'source_team_id')||':'||md5((deck-'counter_id')::text||team::text);
 perform pg_advisory_xact_lock(hashtextextended('counter-import:'||combo,0));
 select * into receipt from public.counter_transfer_receipts where transfer_key=fingerprint;
 if found then return jsonb_build_object('duplicate',true,'team_id',receipt.destination_team_id,'counter_id',receipt.counter_id); end if;
 select * into target from public.enemy_defense_teams
 where private.transfer_team_key(heroes)=combo
 and coalesce(is_public,true)=coalesce((team->>'is_public')::boolean,true)
 and coalesce(is_temporary,false)=coalesce((team->>'is_temporary')::boolean,false)
 order by created_at,id limit 1 for update;
 deck:=jsonb_build_object('title',coalesce(deck->>'title',''),'power',coalesce(deck->>'power',''),'heroes',coalesce(deck->>'heroes',''),'rings',coalesce(deck->>'rings',''),'pet',coalesce(deck->>'pet',''),'formation',coalesce(deck->>'formation',''),'speed_order',coalesce(deck->>'speed_order',''),'team_speed',coalesce(deck->>'team_speed',''),'skill_order',coalesce(deck->>'skill_order',''),'gear_1',coalesce(deck->>'gear_1',''),'gear_2',coalesce(deck->>'gear_2',''),'gear_3',coalesce(deck->>'gear_3',''),'note',coalesce(deck->>'note',''))||jsonb_build_object('counter_id',new_id);
 if target.id is null then
  insert into public.enemy_defense_teams(category,title,heroes,note,is_public,is_temporary,counter_decks,sort_order)
  values('enemy',coalesce(team->>'title',''),team->>'heroes',coalesce(team->>'note',''),
   coalesce((team->>'is_public')::boolean,true),coalesce((team->>'is_temporary')::boolean,false),
   to_jsonb(jsonb_build_array(deck)::text),1) returning * into target;
 else
  decks:=private.transfer_decks(to_jsonb(target))||jsonb_build_array(deck);
  update public.enemy_defense_teams set counter_decks=to_jsonb(decks::text),updated_at=now() where id=target.id;
 end if;
 insert into public.counter_transfer_receipts values(fingerprint,src,(payload->>'source_team_id')::uuid,target.id,new_id,
 coalesce(payload->>'author','닉네임 미등록'),coalesce(payload->>'sender','닉네임 미등록'),now());
 return jsonb_build_object('duplicate',false,'team_id',target.id,'counter_id',new_id);
end $$;
revoke all on function private.import_shared_counter(jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.import_shared_counter(jsonb) to service_role;
create function public.import_shared_counter(payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.import_shared_counter(payload); $$;
revoke all on function public.import_shared_counter(jsonb) from public,anon,authenticated;
grant execute on function public.import_shared_counter(jsonb) to service_role;

-- A service-authenticated append uses new registry IDs without counting an import as local writing.
do $patch$ declare definition text; begin
 definition:=pg_get_functiondef('private.track_counter_creation()'::regprocedure);
 definition:=replace(definition,
 'if auth.uid() is null or not private.is_admin() then',
 'if auth.role() is distinct from ''service_role'' and (auth.uid() is null or not private.is_admin()) then');
 definition:=replace(definition,
 'insert into public.counter_deck_registry(counter_id,enemy_team_id) values(cid,new.id)',
 'insert into public.counter_deck_registry(counter_id,enemy_team_id,is_legacy) values(cid,new.id,auth.role()=''service_role'')');
 definition:=replace(definition,
 'if length(trim(coalesce(deck->>''heroes'',''''))) > 0 then',
 'if auth.uid() is not null and length(trim(coalesce(deck->>''heroes'',''''))) > 0 then');
 execute definition;
 definition:=pg_get_functiondef('private.record_counter_edits()'::regprocedure);
 definition:=replace(definition,'begin', 'begin
 if auth.role() = ''service_role'' then
  if not (private.counter_array(new.counter_decks) @> private.counter_array(old.counter_decks)) then
   raise exception ''Transfer must only append counters'';
  end if;
  return new;
 end if;');
 execute definition;
 definition:=pg_get_functiondef('private.counter_author_nicknames(uuid)'::regprocedure);
 definition:=replace(definition,'then ''15월''','then coalesce((select tr.source_author from public.counter_transfer_receipts tr where tr.counter_id=r.counter_id limit 1),''15월'')');
 execute definition;
end $patch$;
commit;
