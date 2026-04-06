-- Migration: Add automatic Steam sync functionality

-- 1. Update updater_queue_type enum to include Steam sync types
alter type updater_queue_type add value if not exists 'steam_library_sync';
alter type updater_queue_type add value if not exists 'steam_wishlist_sync';

-- 2. Add automatic sync preferences to preferences table
alter table preferences
add column if not exists automatic_library_sync boolean default true,
add column if not exists automatic_wishlist_sync boolean default true;

-- 3. Create function to call a Supabase Edge Function (JWT verification disabled)
create or replace function call_edge_function(
  p_name text,
  p_body jsonb default '{}'::jsonb
)
returns void
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://supabase.steamkey.trade/functions/v1/' || p_name,
    body := p_body,
    headers := '{"content-type":"application/json"}'::jsonb,
    timeout_milliseconds := 3600000
  );
  return;
end;
$$ language plpgsql security definer;

-- 4. Create function to process automatic Steam syncs
create or replace function process_automatic_steam_syncs()
returns void
set search_path = ''
as $$
declare
  v_library_user_id uuid;
  v_wishlist_user_id uuid;
begin
  -- Enqueue users with automatic library sync enabled (not already in queue)
  insert into public.updater_queue (type, value)
  select 'steam_library_sync', u.id::text
  from public.users u
  inner join public.preferences p on p.user_id = u.id
  where p.automatic_library_sync = true
    and not exists (
      select 1 from public.updater_queue
      where type = 'steam_library_sync' and value = u.id::text
    )
  on conflict do nothing;

  -- Enqueue users with automatic wishlist sync enabled (not already in queue)
  insert into public.updater_queue (type, value)
  select 'steam_wishlist_sync', u.id::text
  from public.users u
  inner join public.preferences p on p.user_id = u.id
  where p.automatic_wishlist_sync = true
    and not exists (
      select 1 from public.updater_queue
      where type = 'steam_wishlist_sync' and value = u.id::text
    )
  on conflict do nothing;

  -- Dequeue and process one library sync
  select value::uuid into v_library_user_id
  from public.updater_queue
  where type = 'steam_library_sync'
  order by created_at asc
  limit 1;

  if v_library_user_id is not null then
    delete from public.updater_queue
    where type = 'steam_library_sync' and value = v_library_user_id::text;

    perform call_edge_function('steam-sync', jsonb_build_object(
      'userId', v_library_user_id::text,
      'type', 'library'
    ));
  end if;

  -- Dequeue and process one wishlist sync
  select value::uuid into v_wishlist_user_id
  from public.updater_queue
  where type = 'steam_wishlist_sync'
  order by created_at asc
  limit 1;

  if v_wishlist_user_id is not null then
    delete from public.updater_queue
    where type = 'steam_wishlist_sync' and value = v_wishlist_user_id::text;

    perform call_edge_function('steam-sync', jsonb_build_object(
      'userId', v_wishlist_user_id::text,
      'type', 'wishlist'
    ));
  end if;
end;
$$ language plpgsql security definer;

-- 5. Schedule the automatic Steam sync job to run every 5 minutes
select cron.schedule(
  'process_steam_syncs',
  '*/5 * * * *',
  $$select process_automatic_steam_syncs()$$
);
