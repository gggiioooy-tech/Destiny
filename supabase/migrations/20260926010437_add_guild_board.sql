-- 15월 (formerly Destiny): kqygrszkbuzxmmfndhye only.
begin;
create table public.guild_board_posts (
  id uuid primary key default gen_random_uuid(),
  author_auth_id uuid not null default auth.uid(),
  author_id text not null,
  author_nickname text not null,
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null default '' check (length(body) <= 30000),
  image_paths text[] not null default '{}' check (cardinality(image_paths) <= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(body)) > 0 or cardinality(image_paths) > 0)
);
create table public.guild_board_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.guild_board_posts(id) on delete cascade,
  author_auth_id uuid not null default auth.uid(),
  author_id text not null,
  author_nickname text not null,
  body text not null default '' check (length(body) <= 10000),
  image_paths text[] not null default '{}' check (cardinality(image_paths) <= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(body)) > 0 or cardinality(image_paths) > 0)
);
create index guild_board_posts_created_idx on public.guild_board_posts(created_at desc, id);
create index guild_board_posts_author_idx on public.guild_board_posts(author_auth_id);
create index guild_board_comments_post_idx on public.guild_board_comments(post_id, created_at, id);
create index guild_board_comments_author_idx on public.guild_board_comments(author_auth_id);
alter table public.guild_board_posts enable row level security;
alter table public.guild_board_comments enable row level security;
revoke all on public.guild_board_posts, public.guild_board_comments from anon, authenticated;
grant select, insert, delete on public.guild_board_posts, public.guild_board_comments to authenticated;
grant all on public.guild_board_posts, public.guild_board_comments to service_role;

-- Derive author identity from the signed-in profile; never trust client nickname/ID.
create function private.set_board_author() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p record; image_path text; expected_prefix text; post_owner uuid;
begin
  if not private.is_approved_member() then raise exception 'Approved membership required'; end if;
  select user_id,game_nickname into strict p from public.profiles where auth_user_id=auth.uid();
  new.author_auth_id := auth.uid();
  new.author_id := p.user_id;
  new.author_nickname := p.game_nickname;
  new.created_at := now(); new.updated_at := now();
  expected_prefix := auth.uid()::text || '/posts/';
  if tg_table_name='guild_board_comments' then
    select author_auth_id into strict post_owner from public.guild_board_posts where id=new.post_id;
    expected_prefix := auth.uid()::text || '/comments/' || post_owner::text || '/';
  end if;
  foreach image_path in array new.image_paths loop
    if image_path is null or not starts_with(image_path,expected_prefix) or image_path like '%..%' then
      raise exception 'Invalid attachment owner';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.set_board_author() from public,anon,authenticated;
create trigger board_posts_author before insert on public.guild_board_posts for each row execute function private.set_board_author();
create trigger board_comments_author before insert on public.guild_board_comments for each row execute function private.set_board_author();
create policy board_posts_read on public.guild_board_posts for select to authenticated using ((select private.is_approved_member()));
create policy board_posts_insert on public.guild_board_posts for insert to authenticated with check ((select private.is_approved_member()) and author_auth_id=(select auth.uid()));
create policy board_posts_delete on public.guild_board_posts for delete to authenticated using ((select private.is_approved_member()) and (author_auth_id=(select auth.uid()) or (select private.is_admin())));
create policy board_comments_read on public.guild_board_comments for select to authenticated using ((select private.is_approved_member()));
create policy board_comments_insert on public.guild_board_comments for insert to authenticated with check ((select private.is_approved_member()) and author_auth_id=(select auth.uid()));
create policy board_comments_delete on public.guild_board_comments for delete to authenticated using ((select private.is_approved_member()) and (author_auth_id=(select auth.uid()) or (select private.is_admin())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('guild-board-images','guild-board-images',false,10485760,array['image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif']);
create policy board_images_read on storage.objects for select to authenticated
using (bucket_id='guild-board-images' and (select private.is_approved_member()));
create policy board_images_insert on storage.objects for insert to authenticated
with check (bucket_id='guild-board-images' and (select private.is_approved_member()) and (storage.foldername(name))[1]=(select auth.uid())::text and (storage.foldername(name))[2] in ('posts','comments'));
-- The parent post author's UUID in comment paths allows cleanup after cascading post deletion.
create policy board_images_delete on storage.objects for delete to authenticated
using (bucket_id='guild-board-images' and (select private.is_approved_member()) and (
  (storage.foldername(name))[1]=(select auth.uid())::text or (select private.is_admin()) or
  ((storage.foldername(name))[2]='comments' and (storage.foldername(name))[3]=(select auth.uid())::text)
));
commit;
