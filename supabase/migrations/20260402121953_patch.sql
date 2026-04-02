-- Drop call_edge_function
drop function if exists public.call_edge_function(p_name text, p_body jsonb);

-- Update users table avatar and background constraints with new allowed hosts
alter table public.users drop constraint if exists users_avatar_check;
alter table public.users add constraint users_avatar_check check (
  avatar is null or is_allowed_host(avatar, array[
    'localhost',
    '127.0.0.1',
    'avatars.steamstatic.com',
    '*.supabase.co',
    'steamkey.trade',
    'supabase.steamkey.trade'
  ])
);

alter table public.users drop constraint if exists users_background_check;
alter table public.users add constraint users_background_check check (
  background is null or is_allowed_host(background, array[
    'localhost',
    '127.0.0.1',
    '*.supabase.co',
    'steamkey.trade',
    'supabase.steamkey.trade'
  ])
);
