-- Different opponent speeds remain separate so the imported counter retains its context.
do $patch$ declare definition text; begin
 definition:=pg_get_functiondef('private.import_shared_counter(jsonb)'::regprocedure);
 definition:=replace(definition,'where private.transfer_team_key(heroes)=combo',
 'where private.transfer_team_key(heroes)=combo and btrim(coalesce(note,''''))=btrim(coalesce(team->>''note'',''''))');
 execute definition;
 
end $patch$;
