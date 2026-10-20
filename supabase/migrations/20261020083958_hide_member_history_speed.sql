-- Remove initiative information from the anonymous API projections.
do $$
declare definition text; target regprocedure; needle text;
begin
 target='private.search_battle_history(jsonb,text[],text[],text,integer,integer)'::regprocedure;
 definition=pg_get_functiondef(target);
 needle=',''firstSkillSide'',o.payload->''firstSkillSide''';
 if position(needle in definition)=0 then raise exception 'Unexpected search history definition';end if;
 execute replace(definition,needle,'');
 target='private.anonymous_battle_history(integer,integer)'::regprocedure;
 definition=pg_get_functiondef(target);
 needle=',''firstSkillSide'',d.payload->''firstSkillSide''';
 if position(needle in definition)=0 then raise exception 'Unexpected anonymous history definition';end if;
 execute replace(definition,needle,'');
end$$;
