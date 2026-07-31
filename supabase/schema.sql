-- 포스티 무료 플랜용 초기 스키마
-- Supabase Dashboard → SQL Editor에서 한 번 실행하세요.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 4 and 40),
  content text not null check (char_length(content) between 1 and 150),
  emoji text not null check (emoji in ('🍀', '🍒', '🦋', '🌼', '🐈', '☁️', '🍓', '🫧')),
  position_x numeric(5,2) not null check (position_x between 3 and 75),
  position_y numeric(5,2) not null check (position_y between 4 and 80),
  rotation numeric(4,2) not null default 0 check (rotation between -4 and 4),
  likes_count integer not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;

-- 익명으로 생성된 authenticated 사용자도 목록을 볼 수 있고, 자기 글만 작성할 수 있습니다.
create policy "authenticated users can read posts"
  on public.posts for select to authenticated using (true);

create policy "authenticated users can create their posts"
  on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));

-- 좋아요 기록을 직접 수정하지 못하게 하고, 아래 함수로만 변경합니다.
create policy "users can read their likes"
  on public.post_likes for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.toggle_post_like(target_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  liked boolean;
  new_like_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1 from public.post_likes
    where post_id = target_post_id and user_id = auth.uid()
  ) into liked;

  if liked then
    delete from public.post_likes
    where post_id = target_post_id and user_id = auth.uid();

    update public.posts
    set likes_count = greatest(likes_count - 1, 0)
    where id = target_post_id
    returning likes_count into new_like_count;
  else
    insert into public.post_likes (post_id, user_id)
    values (target_post_id, auth.uid());

    update public.posts
    set likes_count = likes_count + 1
    where id = target_post_id
    returning likes_count into new_like_count;
  end if;

  if new_like_count is null then
    raise exception 'Post not found';
  end if;
  return new_like_count;
end;
$$;

revoke all on function public.toggle_post_like(uuid) from public;
grant execute on function public.toggle_post_like(uuid) to authenticated;

-- 포스트잇 위치만 옮길 수 있게 하고, 내용/닉네임/이모지는 절대 못 바꾸게 전용 함수로 제한합니다.
create or replace function public.update_post_position(target_post_id uuid, new_x numeric, new_y numeric, new_rotation numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.posts
  set position_x = new_x, position_y = new_y, rotation = new_rotation
  where id = target_post_id;

  if not found then
    raise exception 'Post not found';
  end if;
end;
$$;

revoke all on function public.update_post_position(uuid, numeric, numeric, numeric) from public;
grant execute on function public.update_post_position(uuid, numeric, numeric, numeric) to authenticated;
