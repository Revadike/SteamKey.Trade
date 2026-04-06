set check_function_bodies=off;

-- Enable cron extension
create extension pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Function to bulk upsert records into a table
create or replace function bulk_upsert(
  p_table text,
  p_records jsonb,
  p_update_fields text[],
  p_conflict_fields text[]
)
returns integer
set search_path = ''
as $$
declare
  v_row_count integer;
  v_sql text;
  v_update_clause text := '';
  v_columns_list text := '';
  v_columns_def text := '';
  v_all_fields text[];
  v_upd_only text[];
  v_schema_name text;
  v_table_name text;
  v_conflict_target text;
  r_column_type text;
begin
  -- 1) validate input arrays
  if array_length(p_conflict_fields,1) is null or array_length(p_conflict_fields,1) = 0 then
    raise exception 'bulk_upsert: p_conflict_fields cannot be empty';
  end if;
  if array_length(p_update_fields,1) is null or array_length(p_update_fields,1) = 0 then
    raise exception 'bulk_upsert: p_update_fields cannot be empty';
  end if;

  -- 2) split schema and table
  if p_table like '%.%' then
    v_schema_name := split_part(p_table, '.', 1);
    v_table_name := split_part(p_table, '.', 2);
  else
    v_schema_name := 'public';
    v_table_name := p_table;
  end if;

  -- 3) combine and dedupe fields
  v_all_fields := (
    select array_agg(distinct f)
    from unnest(p_update_fields || p_conflict_fields) as f
  );

  -- 4) build columns_list and definitions with data types from pg_catalog
  for i in 1..array_length(v_all_fields, 1) loop
    select format_type(a.atttypid, null) into r_column_type
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on c.relnamespace = n.oid
    where n.nspname = v_schema_name
      and c.relname = v_table_name
      and a.attname = v_all_fields[i]
      and a.attnum > 0
      and not a.attisdropped;

    if r_column_type is null then
      raise exception 'bulk_upsert: column "%" not found in table "%.%": variant or typo?',
        v_all_fields[i], v_schema_name, v_table_name;
    end if;

    if i > 1 then
      v_columns_list := v_columns_list || ', ';
      v_columns_def := v_columns_def || ', ';
    end if;

    v_columns_list := v_columns_list || quote_ident(v_all_fields[i]);
    v_columns_def := v_columns_def || quote_ident(v_all_fields[i]) || ' ' || r_column_type;
  end loop;

  -- 5) build conflict_target
  v_conflict_target := array_to_string(
    array(
      select quote_ident(c)
      from unnest(p_conflict_fields) as c
    ), ', ');
  if v_conflict_target = '' then
    raise exception 'bulk_upsert: conflict_target ended up empty; inputs: %',
      array_to_string(p_conflict_fields, ', ');
  end if;
  raise notice 'bulk_upsert: conflict_target = %', v_conflict_target;

  -- 6) filter update_fields to exclude conflict_fields
  v_upd_only := (
    select array_agg(f)
    from unnest(p_update_fields) as f
    where not (f = any(p_conflict_fields))
  );

  -- 7) build update_clause if applicable
  if array_length(v_upd_only, 1) is not null then
    for i in 1..array_length(v_upd_only, 1) loop
      if i > 1 then
        v_update_clause := v_update_clause || ', ';
      end if;
      v_update_clause := v_update_clause || quote_ident(v_upd_only[i]) || ' = excluded.' || quote_ident(v_upd_only[i]);
    end loop;
  end if;

  -- 8) assemble final sql
  if v_update_clause <> '' then
    v_sql := format('
      insert into %I.%I (%s)
      select %s
      from jsonb_array_elements($1) with ordinality as items(elem, ordinality)
      left join lateral jsonb_to_record(items.elem) as x(%s) on true
      order by items.ordinality
      on conflict (%s) do update set %s',
      v_schema_name,
      v_table_name,
      v_columns_list,
      v_columns_list,
      v_columns_def,
      v_conflict_target,
      v_update_clause
    );
  else
    v_sql := format('
      insert into %I.%I (%s)
      select %s
      from jsonb_array_elements($1) with ordinality as items(elem, ordinality)
      left join lateral jsonb_to_record(items.elem) as x(%s) on true
      order by items.ordinality
      on conflict (%s) do nothing',
      v_schema_name,
      v_table_name,
      v_columns_list,
      v_columns_list,
      v_columns_def,
      v_conflict_target
    );
  end if;

  -- 9) execute and return affected row count
  execute v_sql using p_records;
  get diagnostics v_row_count = row_count;
  return v_row_count;
end;
$$ language plpgsql security invoker
set statement_timeout TO '300s';

-- Function to bulk insert records into a table
create or replace function bulk_insert(p_table text, p_records jsonb)
returns void
set search_path = ''
as $$
declare
  v_schema_name text;
  v_table_name text;
begin
  -- Split schema and table name
  if p_table like '%.%' then
    v_schema_name := split_part(p_table, '.', 1);
    v_table_name := split_part(p_table, '.', 2);
  else
    v_schema_name := 'public';
    v_table_name := p_table;
  end if;

  -- Execute dynamic SQL for bulk insert
  execute format(
    'insert into %I.%I select * from jsonb_populate_recordset(null::%I.%I, %L)',
    v_schema_name, v_table_name, v_schema_name, v_table_name, p_records
  );
end;
$$ language plpgsql security invoker
set statement_timeout TO '300s';

-- Function to automatically update timestamps on row updates
create or replace function update_dates()
returns trigger
set search_path = ''
as $$
declare
  column_exists boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_name = tg_table_name
      and column_name = 'updated_at'
  ) into column_exists;

  if column_exists then
    new.updated_at = now();
  end if;
  new.created_at = old.created_at;

  return new;
end;
$$ language plpgsql security invoker;

-- Function to set initial timestamps on row inserts
create or replace function insert_dates()
returns trigger
set search_path = ''
as $$
declare
  column_exists boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_name = tg_table_name
      and column_name = 'updated_at'
  ) into column_exists;

  if current_user != 'service_role' then
    new.created_at = now();
  end if;

  if column_exists then
    new.updated_at = null;
  end if;

  return new;
end;
$$ language plpgsql security invoker;

-- Enable unaccent extension
create extension unaccent with schema extensions;

-- Function to slugify a string
create or replace function slugify(v text)
returns text
set search_path = ''
as $$
begin
  return regexp_replace(
    regexp_replace(
      -- Lowercase and remove accents in one step
      lower(extensions.unaccent(v)),
      -- Replace non-alphanumeric characters with hyphens
      '[^a-z0-9\\-_]+', '-', 'gi'
    ),
    -- Remove leading and trailing hyphens
    '(^-+|-+$)', '', 'g'
  );
end
$$ language plpgsql strict immutable security invoker;

-- Function to call a Supabase Edge Function (JWT verification disabled)
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

-- Function to check if url host is allowed
create or replace function is_allowed_host(url text, allowed_hosts text[])
returns boolean
set search_path = ''
as $$
declare
  raw_host text;
  host text;
  pattern text;
  regex_pattern text;
begin
  if url !~ '^https?://' then
    return false;
  end if;

  raw_host := substring(url from '^https?://([^/]+)');
  raw_host := regexp_replace(raw_host, '^[^@]+@', '');
  host := regexp_replace(raw_host, ':\d+$', '');

  foreach pattern in array allowed_hosts loop
    regex_pattern := '^' || replace(pattern, '*', '.*') || '$';
    if host ~ regex_pattern then
      return true;
    end if;
  end loop;

  return false;
end;
$$ language plpgsql strict immutable security invoker;

-- Function to process automatic Steam syncs
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

-- Schedule the automatic Steam sync job to run every 5 minutes
select cron.schedule(
  'process_steam_syncs',
  '*/5 * * * *',
  $$select process_automatic_steam_syncs()$$
);
