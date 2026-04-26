-- Create widget type enum
create type widget as enum (
  'welcome', 'stats', 'trade_activity', 'users_online', 'bundles', 'changelog'
);

-- Create preferences table
create table preferences (
  user_id uuid primary key references users(id) on delete cascade,
  app_links jsonb default '[
    {"title":"Homepage","url":"{website}"},
    {"title":"Steam Store","url":"https://store.steampowered.com/app/{appid}"},
    {"title":"Steam Community","url":"https://steamcommunity.com/app/{appid}"},
    {"title":"SteamDB","url":"https://steamdb.info/app/{appid}/"},
    {"title":"GG.deals","url":"https://gg.deals/steam/app/{appid}/"}
  ]'::jsonb,
  app_columns text[] default array['title', 'type', 'retail_price', 'market_price', 'plus_one', 'cards', 'achievements', 'tradelists', 'wishlists']::text[],
  dark_mode boolean default true,
  dashboard_widgets widget[] default array['welcome', 'users_online', 'stats', 'trade_activity', 'bundles', 'changelog']::widget[],
  enabled_notifications notification[] default array['new_trade', 'accepted_trade', 'new_vault_entry', 'unread_messages', 'disputed_trade', 'resolved_trade']::notification[],
  track_vault_copies boolean default false,
  automatic_library_sync boolean default true,
  automatic_wishlist_sync boolean default true,
  incoming_criteria jsonb default '{
    "collections": {"only":[],"except":[]},
    "tags": {"only":[],"except":[]},
    "apps": {"only":[],"except":[]}
  }'::jsonb,
  updated_at timestamptz default null,
  created_at timestamptz default now()
);

-- Add table comment
comment on table preferences is 'User preferences and settings';

-- Create trigger function to validate app_columns columns
create or replace function preferences_validate_app_columns()
returns trigger
set search_path = ''
as $$
begin
  -- Check if all values in app_columns exist as column names in the apps table
  if exists (
    select 1
    from unnest(new.app_columns) as col
    where not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
      and table_name = 'apps'
      and column_name = col
    )
  ) then
    raise exception 'app_columns array contains invalid column names';
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger
create trigger preferences_validate_app_columns_trigger
before insert or update on preferences
for each row
execute function preferences_validate_app_columns();

-- Add date management triggers
create trigger preferences_update_dates
before update on preferences
for each row
execute function update_dates();

create trigger preferences_insert_dates
before insert on preferences
for each row
execute function insert_dates();

-- Function to sync vault counts when track_vault_copies is enabled/disabled
create or replace function sync_vault_counts_on_pref_update()
returns trigger
set search_path = ''
as $$
declare
  v_user_id uuid := new.user_id;
  v_master_tradelist_id text;
  v_tag_id integer;
  v_app_id integer;
  v_count integer;
  v_enabled boolean := new.track_vault_copies;
begin
  -- Find master tradelist for user
  select id into v_master_tradelist_id from public.collections where user_id = v_user_id and master = true and type = 'tradelist';
  if v_master_tradelist_id is null then
    return null;
  end if;

  -- Find tag id for 'Count' tag of type 'tradelist'
  select id into v_tag_id from public.tags where title = 'Count' and type = 'tradelist';
  if v_tag_id is null then
    insert into public.tags (title, type) values ('Count', 'tradelist') returning id into v_tag_id;
  end if;

  if v_enabled and not old.track_vault_copies then
    -- Enabled: set all counts
    for v_app_id, v_count in select app_id, count(*) from public.vault_entries where user_id = v_user_id and trade_id is null group by app_id loop
      -- Remove any existing tag first
      delete from public.collection_tags where collection_id = v_master_tradelist_id and app_id = v_app_id and tag_id = v_tag_id;
      -- Insert tag with count
      insert into public.collection_tags (collection_id, app_id, tag_id, body) values (v_master_tradelist_id, v_app_id, v_tag_id, v_count::text);
    end loop;
  elsif not v_enabled and old.track_vault_copies then
    -- Disabled: remove all tags for apps that exist in vault_entries
    for v_app_id in select distinct app_id from public.vault_entries where user_id = v_user_id loop
      delete from public.collection_tags where collection_id = v_master_tradelist_id and app_id = v_app_id and tag_id = v_tag_id;
    end loop;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger sync_vault_counts_on_pref_update_trigger
after update of track_vault_copies on preferences
for each row
when (old.track_vault_copies is distinct from new.track_vault_copies)
execute function sync_vault_counts_on_pref_update();

-- Enable RLS
alter table preferences enable row level security;

-- Allow read access for all
create policy preferences_select
on preferences
for select
to authenticated, anon
using (true);

-- Allow creation for yourself only
create policy preferences_insert
on preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- Allow update for yourself only
create policy preferences_update
on preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Disallow deletion for all users
