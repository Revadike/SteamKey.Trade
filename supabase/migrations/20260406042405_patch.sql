
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

    perform public.call_edge_function('steam-sync'::text, jsonb_build_object(
      'userId', v_library_user_id::text,
      'type', 'library'
    )::jsonb);
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

    perform public.call_edge_function('steam-sync'::text, jsonb_build_object(
      'userId', v_wishlist_user_id::text,
      'type', 'wishlist'
    )::jsonb);
  end if;
end;
$$ language plpgsql security definer;
