alter table public.profiles
  add column anime_theme_allowed boolean not null default false;

-- Existing profiles_admin_update RLS limits profile changes to approved administrators.
grant update (anime_theme_allowed) on public.profiles to authenticated;
