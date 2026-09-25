-- Create vault entry type enum
create type vault_entry_type as enum (
  'key',
  'gift',
  'link',
  'curator'
);

-- Create vault_entries table
create table vault_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  app_id integer not null references apps(id) on delete cascade,
  trade_id uuid default null references trades(id) on delete cascade,
  type vault_entry_type not null,
  revealed_at timestamptz default null,
  updated_at timestamptz default null,
  created_at timestamptz default now()
);

-- Add table comment
comment on table vault_entries is 'Received and own vault entries';

-- Create trigger function to prevent id, user_id, app_id, trade_id changes
create or replace function vault_entries_prevent_changes()
returns trigger
set search_path = ''
as $$
begin
  if new.id != old.id or new.user_id != old.user_id or new.app_id != old.app_id or new.trade_id != old.trade_id then
    raise exception 'Cannot change id, user_id, app_id, or trade_id';
  end if;
  return new;
end;
$$ language plpgsql security invoker;

-- Create trigger function to handle notifications when vault entries are created
create or replace function vault_entries_handle_notifications()
returns trigger
set search_path = ''
as $$
begin
  -- Only process if trade_id is set
  if new.trade_id is not null then
    -- Only send notification if the user has enabled 'new_vault_entry' notifications
    if exists (
      select 1 from public.preferences
      where user_id = new.user_id
      and 'new_vault_entry' = ANY(enabled_notifications)
    ) then
      -- Create notification for the user who added the entry
      insert into public.notifications (user_id, type, link)
      values (new.user_id, 'new_vault_entry', '/vault?tab=received&appid=' || new.app_id);
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger function to sync master tradelist on vault entry delete
create or replace function vault_entries_sync_tradelist_on_delete()
returns trigger
set search_path = ''
as $$
declare
  v_master_tradelist_id text;
  v_count integer;
begin
  -- Check if user has any more available (tradeable) copies of this app
  select count(*) into v_count
  from public.vault_entries
  where user_id = old.user_id
    and app_id = old.app_id
    and trade_id is null;

  if v_count = 0 then
    -- Find the user's master tradelist
    select id into v_master_tradelist_id
    from public.collections
    where user_id = old.user_id and master = true and type = 'tradelist';

    if v_master_tradelist_id is not null then
      -- Remove from master tradelist if collection_apps entry is of type 'sync'
      delete from public.collection_apps
      where collection_id = v_master_tradelist_id
        and app_id = old.app_id
        and source = 'sync';
    end if;
  end if;

  return null;
end;
$$ language plpgsql security invoker;

-- Function: update_vault_count(p_user_id uuid, p_app_id integer, p_delta integer)
create or replace function update_vault_count(p_user_id uuid, p_app_id integer, p_delta integer)
returns void
set search_path = ''
as $$
declare
  v_track boolean;
  v_master_tradelist_id text;
  v_tag_id integer;
  v_existing_body text;
  v_new_count integer;
begin
  -- Check if user has track_vault_copies enabled
  select track_vault_copies into v_track from public.preferences where user_id = p_user_id;
  if not v_track then
    return;
  end if;

  -- Find master tradelist for user
  select id into v_master_tradelist_id from public.collections where user_id = p_user_id and master = true and type = 'tradelist';
  if v_master_tradelist_id is null then
    return;
  end if;

  -- Find tag id for 'Count' tag of type 'tradelist'
  select id into v_tag_id from public.tags where title = 'Count' and type = 'tradelist';
  if v_tag_id is null then
    -- Optionally, create the tag if not exists
    insert into public.tags (title, type) values ('Count', 'tradelist') returning id into v_tag_id;
  end if;

  -- Check if tag already exists for this app in master tradelist
  select body into v_existing_body from public.collection_tags where collection_id = v_master_tradelist_id and app_id = p_app_id and tag_id = v_tag_id;

  if v_existing_body is not null then
    -- Parse as integer, add delta
    v_new_count := coalesce((v_existing_body)::integer, 0) + p_delta;
    if v_new_count <= 0 then
      -- Remove tag if count is zero or less
      delete from public.collection_tags where collection_id = v_master_tradelist_id and app_id = p_app_id and tag_id = v_tag_id;
    else
      -- Update tag value
      update public.collection_tags set body = v_new_count::text where collection_id = v_master_tradelist_id and app_id = p_app_id and tag_id = v_tag_id;
    end if;
  else
    if p_delta > 0 then
      -- Insert new tag with value
      insert into public.collection_tags (collection_id, app_id, tag_id, body) values (v_master_tradelist_id, p_app_id, v_tag_id, p_delta::text);
    end if;
  end if;
end;
$$ language plpgsql security invoker;

-- Create trigger function to handle vault count tracking on insert/update/delete
create or replace function vault_entries_handle_vault_count()
returns trigger
set search_path = ''
as $$
begin
  -- On insert: only if trade_id is null
  if tg_op = 'INSERT' and new.trade_id is null then
    perform public.update_vault_count(new.user_id, new.app_id, 1);
  end if;

  -- On update: if trade_id changed from null to not null (became traded)
  if tg_op = 'UPDATE' and old.trade_id is null and new.trade_id is not null then
    perform public.update_vault_count(new.user_id, new.app_id, -1);
  end if;

  -- On delete: only if trade_id is null
  if tg_op = 'DELETE' and old.trade_id is null then
    perform public.update_vault_count(old.user_id, old.app_id, -1);
  end if;

  return null;
end;
$$ language plpgsql security invoker;

-- Create computed column showing if vault entry is sent by me
create or replace function is_sent(ve vault_entries)
returns boolean
set search_path = ''
as $$
  select
    -- if not traded yet, it's also not sent
    case
      when ve.trade_id is null then false
      -- exists a trade_app row for this trade+app where this entry is listed
      when exists (
        select 1
          from public.trade_apps ta
         where ta.trade_id = ve.trade_id
           and ta.app_id = ve.app_id
           and ve.id = any(ta.vault_entries)
           and ta.user_id = (select auth.uid())
      ) then true
      else false
    end
$$ language sql stable security invoker;

-- Create triggers
create trigger vault_entries_ensure_app_exists
before insert on vault_entries
for each row
execute function ensure_app_exists();

create trigger vault_entries_prevent_changes_trigger
before update on vault_entries
for each row
execute function vault_entries_prevent_changes();

create trigger vault_entries_handle_notifications_trigger
after insert on vault_entries
for each row
execute function vault_entries_handle_notifications();

create trigger vault_entries_sync_tradelist_on_delete_trigger
after delete on vault_entries
for each row
execute function vault_entries_sync_tradelist_on_delete();

create trigger vault_entries_handle_vault_count_insert
after insert on vault_entries
for each row
execute function vault_entries_handle_vault_count();

create trigger vault_entries_handle_vault_count_update
after update on vault_entries
for each row
execute function vault_entries_handle_vault_count();

create trigger vault_entries_handle_vault_count_delete
after delete on vault_entries
for each row
execute function vault_entries_handle_vault_count();

-- Add date management triggers
create trigger vault_entries_update_dates
before update on vault_entries
for each row
execute function update_dates();

create trigger vault_entries_insert_dates
before insert on vault_entries
for each row
execute function insert_dates();

-- Enable RLS
alter table vault_entries enable row level security;

-- Allow read access for own vault entries only
create policy vault_entries_select on vault_entries
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Allow creation for own vault entries only
create policy vault_entries_insert on vault_entries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- Allow update for my own vault entries only
create policy vault_entries_update on vault_entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Allow deletion for own vault entries only
create policy vault_entries_delete on vault_entries
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Destroy the current user's vault: reset their public key, remove their
-- stored credentials (encrypted private key), and delete every vault entry
-- they own. This is a destructive operation so it runs with the privileges of
-- the function owner (SECURITY DEFINER) to bypass RLS, and is locked down to
-- the authenticated user's own account via auth.uid().
create or replace function reset_vault()
returns void
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Destroy the user's stored credentials (encrypted private key).
  delete from public.credentials
  where user_id = v_user_id;

  -- Destroy every vault entry owned by the user. This removes their unsent,
  -- sent and received entries. Values already delivered to other vaults live
  -- on vault entries owned by the receiving users (created when a trade is
  -- completed), so they are left untouched.
  delete from public.vault_entries
  where user_id = v_user_id;

  -- Reset the user's public key so the vault can be set up again from scratch.
  update public.users
  set public_key = null
  where id = v_user_id;
end;
$$ language plpgsql security definer;

-- Restrict execution to authenticated users only. Supabase grants EXECUTE to
-- public, anon, authenticated and service_role by default, so revoke the broad
-- grants before re-granting to authenticated.
revoke execute on function public.reset_vault() from public;
revoke execute on function public.reset_vault() from anon;
grant execute on function public.reset_vault() to authenticated;
