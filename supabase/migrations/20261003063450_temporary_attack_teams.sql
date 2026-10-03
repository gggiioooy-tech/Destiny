alter table public.enemy_defense_teams add column if not exists is_temporary boolean not null default false;
alter table public.attack_teams add column if not exists is_temporary boolean not null default false;
