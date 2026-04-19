-- Create collection_apps_source enum
create type collection_apps_source as enum (
  'user',
  'sync'
);

-- Create collection_apps table
create table collection_apps (
  collection_id text not null references collections(id) on delete cascade,
  app_id integer not null references apps(id) on delete cascade,
  source collection_apps_source not null default 'user',
  primary key (collection_id, app_id)
);

-- Add table comment
comment on table collection_apps is 'Apps included in collections';

-- Add indexes
create index collection_apps_collection_id_idx on public.collection_apps using btree (collection_id);

-- Function to add collection app
create or replace function add_collection_app(p_collection_id text, p_app_id integer, p_title text)
returns void
set search_path = ''
as $$
begin
  -- Check if collection_id exists in collections, if not insert it
  if not exists (select 1 from public.collections where id = p_collection_id) then
    insert into public.collections (id, private, user_id, type, title, description)
    values (p_collection_id, false, null, 'app', p_title, 'Auto-generated');
  end if;

  -- Insert into collection_apps
  insert into public.collection_apps (collection_id, app_id, source)
  values (p_collection_id, p_app_id, 'sync')
  on conflict do nothing;
end;
$$ language plpgsql security invoker;

-- Function to remove collection app
create or replace function remove_collection_app(p_collection_id text, p_app_id integer)
returns void
set search_path = ''
as $$
begin
  delete from public.collection_apps
  where app_id = p_app_id
  and collection_id = p_collection_id;
end;
$$ language plpgsql security invoker;

-- Create function to bulk remove apps from collections
create or replace function bulk_remove_collection_apps(p_collection_id text, p_apps integer[])
returns void
set search_path = ''
as $$
begin
  delete from public.collection_apps
  where collection_id = p_collection_id
  and app_id = any(p_apps);
end;
$$ language plpgsql security invoker;

-- Create function to get all apps in a user's master collections
create or replace function get_master_collections_apps(
  p_user_id uuid,
  p_source collection_apps_source default null
)
returns table (
  tradelist json,
  wishlist json,
  library json,
  blacklist json
)
set search_path = ''
as $$
with recursive collection_hierarchy as (
  -- Find the user's master collections for the specified types
  select id, type
  from public.collections
  where user_id = p_user_id
    and master = true
    and type in ('tradelist', 'wishlist', 'library', 'blacklist')

  union all

  -- Recursively find all child collections through collection_relations
  select cr.collection_id, ch.type
  from public.collection_relations cr
  inner join collection_hierarchy ch on cr.parent_id = ch.id
)
select
  -- Aggregate app_ids for each type into a JSON array, filtered by source if provided
  (select json_agg(app_id) from public.collection_apps
   where collection_id in (select id from collection_hierarchy where type = 'tradelist')
     and (p_source is null or source = p_source)) as tradelist,
  (select json_agg(app_id) from public.collection_apps
   where collection_id in (select id from collection_hierarchy where type = 'wishlist')
     and (p_source is null or source = p_source)) as wishlist,
  (select json_agg(app_id) from public.collection_apps
   where collection_id in (select id from collection_hierarchy where type = 'library')
     and (p_source is null or source = p_source)) as library,
  (select json_agg(app_id) from public.collection_apps
   where collection_id in (select id from collection_hierarchy where type = 'blacklist')
     and (p_source is null or source = p_source)) as blacklist;
$$ language sql stable security invoker;

-- Get apps filtered by collection inclusion/exclusion rules.
create or replace function get_collection_filtered_apps(
  p_only_collection_ids text[] default null,
  p_exclude_collection_ids text[] default null,
  p_any_collections boolean default false,
  p_include_app_ids integer[] default null
)
returns setof public.apps
set search_path = ''
as $$
with recursive
only_scope as (
  select distinct
    c.id as collection_id,
    array[c.id]::text[] as path
  from unnest(coalesce(p_only_collection_ids, array[]::text[])) as root(id)
  inner join public.collections c on c.id = root.id

  union all

  select
    rel.collection_id,
    os.path || rel.collection_id
  from public.collection_relations rel
  inner join only_scope os on rel.parent_id = os.collection_id
  where not rel.collection_id = any(os.path)
),
exclude_scope as (
  select distinct
    c.id as collection_id,
    array[c.id]::text[] as path
  from unnest(coalesce(p_exclude_collection_ids, array[]::text[])) as root(id)
  inner join public.collections c on c.id = root.id

  union all

  select
    rel.collection_id,
    es.path || rel.collection_id
  from public.collection_relations rel
  inner join exclude_scope es on rel.parent_id = es.collection_id
  where not rel.collection_id = any(es.path)
),
only_scope_distinct as (
  select distinct collection_id
  from only_scope
),
exclude_scope_distinct as (
  select distinct collection_id
  from exclude_scope
),
only_apps_any as (
  select distinct ca.app_id
  from public.collection_apps ca
  inner join only_scope_distinct os on os.collection_id = ca.collection_id
),
only_apps_all as (
  select ca.app_id
  from public.collection_apps ca
  inner join only_scope_distinct os on os.collection_id = ca.collection_id
  group by ca.app_id
  having count(distinct ca.collection_id) = (select count(*) from only_scope_distinct)
),
excluded_apps as (
  select distinct ca.app_id
  from public.collection_apps ca
  inner join exclude_scope_distinct es on es.collection_id = ca.collection_id
),
included_apps as (
  select distinct app_id
  from unnest(coalesce(p_include_app_ids, array[]::integer[])) as app_id
)
select a.*
from public.apps a
where (
  (
    (select count(*) from only_scope_distinct) = 0
    or (p_any_collections and a.id in (select app_id from only_apps_any))
    or ((not p_any_collections) and a.id in (select app_id from only_apps_all))
    or a.id in (select app_id from included_apps)
  )
  and (
    (select count(*) from exclude_scope_distinct) = 0
    or a.id not in (select app_id from excluded_apps)
  )
);
$$ language sql stable security invoker;

-- Create function to clean app collections
create or replace function clean_app_collections(
  p_do_counts boolean DEFAULT true,
  p_do_collections boolean DEFAULT true
)
returns void
set search_path = ''
as $$
declare
  v_app public.apps%rowtype;
  item text;
begin
  perform pg_advisory_lock(4203596817983697560);

  -- Reset counter fields for all apps
  if p_do_counts then
    update public.apps
    set libraries = 0,
        wishlists = 0,
        tradelists = 0,
        blacklists = 0,
        bundles = 0,
        giveaways = 0,
        steam_packages = 0,
        steam_bundles = 0;

    -- Update counters based on collection_apps data
    with app_counts as (
      select
        ca.app_id,
        count(*) filter (where c.type = 'library' and c.master)      as libraries,
        count(*) filter (where c.type = 'wishlist' and c.master)     as wishlists,
        count(*) filter (where c.type = 'tradelist' and c.master)    as tradelists,
        count(*) filter (where c.type = 'blacklist' and c.master)    as blacklists,
        count(*) filter (where c.type = 'bundle' and c.user_id is null)       as bundles,
        count(*) filter (where c.type = 'giveaway' and c.user_id is null)     as giveaways,
        count(*) filter (where c.type = 'steampackage' and c.user_id is null) as steam_packages,
        count(*) filter (where c.type = 'steambundle' and c.user_id is null)  as steam_bundles
      from public.collection_apps ca
      join public.collections c on ca.collection_id = c.id
      group by ca.app_id
    )
    update public.apps a
    set
      libraries      = ac.libraries,
      wishlists      = ac.wishlists,
      tradelists     = ac.tradelists,
      blacklists     = ac.blacklists,
      bundles        = ac.bundles,
      giveaways      = ac.giveaways,
      steam_packages = ac.steam_packages,
      steam_bundles  = ac.steam_bundles
    from app_counts ac
    where a.id = ac.app_id
      and (
        a.libraries      is distinct from ac.libraries or
        a.wishlists      is distinct from ac.wishlists or
        a.tradelists     is distinct from ac.tradelists or
        a.blacklists     is distinct from ac.blacklists or
        a.bundles        is distinct from ac.bundles or
        a.giveaways      is distinct from ac.giveaways or
        a.steam_packages is distinct from ac.steam_packages or
        a.steam_bundles  is distinct from ac.steam_bundles
      );
  end if;

  if p_do_collections then
    -- Remove all app-type collections
    delete from public.collection_apps
    where collection_id in (
      select id from public.collections
      where type = 'app'
      and user_id is null
    );

    -- Recreate app collections for each app
    for v_app in select * from public.apps loop
      -- Type collection
      if v_app.type is not null then
        perform public.add_collection_app('type-' || public.slugify(v_app.type::text), v_app.id, initcap(v_app.type::text) || ' (type)');
      end if;

      -- Developer collections
      if v_app.developers is not null then
        foreach item in array v_app.developers loop
          perform public.add_collection_app('developer-' || public.slugify(item), v_app.id, initcap(item) || ' (developer)');
        end loop;
      end if;

      -- Publisher collections
      if v_app.publishers is not null then
        foreach item in array v_app.publishers loop
          perform public.add_collection_app('publisher-' || public.slugify(item), v_app.id, initcap(item) || ' (publisher)');
        end loop;
      end if;

      -- Tag collections
      if v_app.tags is not null then
        foreach item in array v_app.tags loop
          perform public.add_collection_app('tag-' || public.slugify(item), v_app.id, initcap(item) || ' (tag)');
        end loop;
      end if;

      -- Language collections
      if v_app.languages is not null then
        foreach item in array v_app.languages loop
          perform public.add_collection_app('language-' || public.slugify(item), v_app.id, initcap(item) || ' (language)');
        end loop;
      end if;

      -- Platform collections
      if v_app.platforms is not null then
        foreach item in array v_app.platforms loop
          perform public.add_collection_app('platform-' || public.slugify(item), v_app.id, initcap(item) || ' (platform)');
        end loop;
      end if;

      -- Other collections
      if v_app.free is true or v_app.retail_price = 0 then
        perform public.add_collection_app('free', v_app.id, 'Free');
      end if;

      if v_app.plus_one is true then
        perform public.add_collection_app('plus-one', v_app.id, 'Plus One');
      end if;

      if v_app.exfgls is true then
        perform public.add_collection_app('exfgls', v_app.id, 'Excluded from Library Sharing');
      end if;

      if v_app.steamdeck in ('Playable', 'Verified') then
        perform public.add_collection_app('steamdeck', v_app.id, 'SteamDeck Compatible');
      end if;

      if v_app.cards > 0 then
        perform public.add_collection_app('with-cards', v_app.id, 'With Cards');
      end if;

      if v_app.achievements > 0 then
        perform public.add_collection_app('with-achievements', v_app.id, 'With Achievements');
      end if;

      if v_app.bundles > 0 then
        perform public.add_collection_app('bundled', v_app.id, 'Bundled');
      end if;

      if v_app.giveaways > 0 then
        perform public.add_collection_app('givenaway', v_app.id, 'Givenaway');
      end if;

      if v_app.removed_at is not null then
        perform public.add_collection_app('removed', v_app.id, 'Removed');
      end if;

      if v_app.removed_as is not null then
        perform public.add_collection_app('removed-' || public.slugify(v_app.removed_as), v_app.id, initcap(v_app.removed_as));
      end if;
    end loop;
  end if;

  perform pg_advisory_unlock(4203596817983697560);
end;
$$ language plpgsql security definer
set statement_timeout TO '3600s';

-- Create trigger
create trigger collection_apps_ensure_app_exists
before insert on collection_apps
for each row
execute function ensure_app_exists();

-- Create trigger function to update app statistics on collection changes
create or replace function collection_apps_update_app_stats()
returns trigger
set search_path = ''
as $$
declare
  v_collection_data record;
  increment integer;
  collection_type_map jsonb;
  column_name text;
begin
  -- Determine if we're incrementing (insert) or decrementing (delete)
  increment := case when tg_op = 'INSERT' then 1 else -1 end;

  -- Get the collection type and master status in a single query
  select type, master, user_id into v_collection_data
  from public.collections
  where id = case when tg_op = 'INSERT' then new.collection_id else old.collection_id end;

  -- Define the mapping of collection types to column names
  collection_type_map := '{
    "library": "libraries",
    "wishlist": "wishlists",
    "tradelist": "tradelists",
    "blacklist": "blacklists",
    "bundle": "bundles",
    "giveaway": "giveaways",
    "steampackage": "steam_packages",
    "steambundle": "steam_bundles"
  }'::jsonb;

  -- Update statistics for:
  -- 1. Master collections of specific types (library, wishlist, tradelist, blacklist)
  -- 2. System collections for bundle types (bundle, giveaway, steampackage, steambundle)
  if (v_collection_data.type in ('library', 'wishlist', 'tradelist', 'blacklist') and v_collection_data.master = true) or
     (v_collection_data.type in ('bundle', 'giveaway', 'steampackage', 'steambundle') and v_collection_data.user_id is null) then

    -- Get the column name from the mapping
    column_name := collection_type_map->>v_collection_data.type::text;

    -- Update the appropriate counter in the apps table
    execute format('
      update public.apps
      set %I = coalesce(%I, 0) + %L
      where id = %L
      and coalesce(%I, 0) + %L >= 0', -- Ensure count doesn't go below zero
      column_name, column_name, increment,
      case when tg_op = 'INSERT' then new.app_id else old.app_id end,
      column_name, increment
    );
  end if;

  return null; -- This is an AFTER trigger, so the return value is ignored
end;
$$ language plpgsql security definer;

-- Create triggers to update app stats on collection app changes
create trigger collection_apps_after_insert
after insert on collection_apps
for each row
execute function collection_apps_update_app_stats();

create trigger collection_apps_after_delete
after delete on collection_apps
for each row
execute function collection_apps_update_app_stats();

-- Enable RLS
alter table collection_apps enable row level security;

-- Allow read access for public collections and own collections
create policy collection_apps_select on collection_apps
for select
to authenticated, anon
using (
  exists (
    select 1 from collections
    where
      id = collection_id
      and (
        not private
        or user_id = (select auth.uid())
      )
  )
);

-- Allow creation for own collections only
create policy collection_apps_insert on collection_apps
for insert
to authenticated
with check (
  exists (
    select 1 from collections
    where
      id = collection_id
      and user_id = (select auth.uid())
  )
);

-- Disallow update for all users

-- Allow deletion for own collections only
create policy collection_apps_delete on collection_apps
for delete
to authenticated
using (
  exists (
    select 1 from collections
    where
      id = collection_id
      and user_id = (select auth.uid())
  )
);
