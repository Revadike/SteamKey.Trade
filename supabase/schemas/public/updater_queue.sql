-- Create updater queue type enum
create type updater_queue_type as enum (
  'app_names_check',
  'app_types_check',
  'app_cards_check',
  'app_removals_check',
  'app_list_check',
  'change_number',
  'ggdeals_deals_check',
  'ggdeals_bundles_check',
  'app_update',
  'steam_library_sync',
  'steam_wishlist_sync'
);

-- Create updater_queue table
create table updater_queue (
  id uuid primary key default gen_random_uuid(),
  type updater_queue_type not null,
  value text default null,
  created_at timestamptz default now(),
  unique (type, value)
);

-- Add table comment
comment on table updater_queue is 'Queue for background update tasks';

-- Add date management triggers
create trigger updater_queue_update_dates
before update on updater_queue
for each row
execute function update_dates();

create trigger updater_queue_insert_dates
before insert on updater_queue
for each row
execute function insert_dates();

-- Function to add new apps to the updater queue
create or replace function updater_enqueue(p_appids int[])
returns void
set search_path = ''
as $$
begin
  insert into public.updater_queue (type, value)
  select 'app_update', unnest(p_appids)::text
  on conflict do nothing;
end;
$$ language plpgsql security invoker
set statement_timeout to '300s';

-- Function to extract apps from the updater queue
create or replace function updater_dequeue(p_count int)
returns int[]
set search_path = ''
as $$
with to_delete as (
  select id, value
  from public.updater_queue
  where type = 'app_update'
  order by created_at asc
  limit p_count
),
deleted as (
  delete from public.updater_queue
  where id in (select id from to_delete)
  returning value
),
additional as (
  select id::text as value
  from public.apps
  where id not in (select value::int from deleted)
  order by updated_at asc nulls first
  limit p_count - (select count(*) from deleted)
)
select coalesce(array_agg(value::int), array[]::int[])
from (
  select value from deleted
  union all
  select value from additional
) combined;
$$ language sql security invoker;

-- Enable RLS
alter table updater_queue enable row level security;

-- Disallow read for all users

-- Allow authenticated users to queue app updates only for existing apps not updated in past 24h
create policy updater_queue_insert on updater_queue
for insert
to authenticated
with check (
  -- Only allow 'app_update' type
  type = 'app_update'
  -- Ensure app exists and hasn't been updated in past 24h
  and exists (
    select 1
    from apps
    where id = value::integer
      and (updated_at is null or updated_at < now() - interval '24 hours')
  )
);

-- Disallow update for all users
-- Disallow deletion for all users
