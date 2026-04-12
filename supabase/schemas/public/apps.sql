-- Create app type enum
create type app_type as enum (
  'unknown',
  'advertising',
  'application',
  'beta',
  'comic',
  'config',
  'demo',
  'depotonly',
  'dlc',
  'driver',
  'episode',
  'franchise',
  'game',
  'guide',
  'hardware',
  'media',
  'mod',
  'movie',
  'music',
  'plugin',
  'series',
  'shortcut',
  'software',
  'tool',
  'video'
);

-- Create apps table
create table apps (
  id integer primary key,
  change_number integer default null,
  parent_id integer references apps(id) on delete set null default null,
  title text default null,
  alt_titles text[] default null,
  type app_type default 'unknown' not null,
  description text default null,
  developers text[] default null,
  publishers text[] default null,
  tags text[] default null,
  languages text[] default null,
  platforms text[] default null,
  website text default null,
  free boolean default null,
  plus_one boolean default null,
  exfgls boolean default null,
  steamdeck text default null,
  header text default null,
  screenshots text[] default null,
  videos text[] default null,
  positive_reviews integer default null,
  negative_reviews integer default null,
  cards integer default null,
  achievements integer default null,
  bundles integer default null,
  giveaways integer default null,
  libraries integer default null,
  wishlists integer default null,
  tradelists integer default null,
  blacklists integer default null,
  steam_packages integer default null,
  steam_bundles integer default null,
  retail_price numeric default null,
  discounted_price numeric default null,
  market_price numeric default null,
  historical_low numeric default null,
  removed_as text default null,
  removed_at timestamptz default null,
  released_at timestamptz default null,
  updated_at timestamptz default null,
  created_at timestamptz default now(),
  search_text text default null,
  wilson_score numeric default null
);

-- Add table comment
comment on table apps is 'Steam applications with metadata and statistics';

-- Create trigger function to ensure app exists
create or replace function ensure_app_exists()
returns trigger
set search_path = ''
as $$
declare
  key_value text;
  v_app_id integer;
begin
  -- Convert NEW record to JSONB and pick the first available key.
  key_value := coalesce(to_jsonb(new)->>'app_id', to_jsonb(new)->>'parent_id');

  if key_value is null then
    return new;
  end if;

  v_app_id := key_value::integer;

  -- If the app record does not exist in public.apps, insert a stub record
  if not exists (select 1 from public.apps where id = v_app_id) then
    insert into public.apps (id) values (v_app_id);
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Create trigger function to handle title changes
create or replace function apps_handle_title_change()
returns trigger
set search_path = ''
as $$
begin
  -- If title changed, append old title to alt_titles
  if new.title != old.title then
    new.alt_titles = array_remove(
      array(
        select distinct unnest(
          array_prepend(
            old.title,
            coalesce(old.alt_titles, array[]::text[])
          )
        )
      ),
      new.title
    );
  end if;
  return new;
end;
$$ language plpgsql security invoker;

-- Create trigger function to manage collections
create or replace function apps_manage_collections()
returns trigger
set search_path = ''
as $$
declare
  item text;
begin
  -- Remove old collections if values changed
  if tg_op = 'UPDATE' then
    -- Type collection
    if old.type is not null and (new.type is null or new.type != old.type) then
      perform public.remove_collection_app('type-' || public.slugify(old.type::text), new.id);
    end if;

    -- Developer collections
    if old.developers is not null then
      foreach item in array old.developers loop
        perform public.remove_collection_app('developer-' || public.slugify(item), new.id);
      end loop;
    end if;

    -- Publisher collections
    if old.publishers is not null then
      foreach item in array old.publishers loop
        perform public.remove_collection_app('publisher-' || public.slugify(item), new.id);
      end loop;
    end if;

    -- Tag collections
    if old.tags is not null then
      foreach item in array old.tags loop
        perform public.remove_collection_app('tag-' || public.slugify(item), new.id);
      end loop;
    end if;

    -- Language collections
    if old.languages is not null then
      foreach item in array old.languages loop
        perform public.remove_collection_app('language-' || public.slugify(item), new.id);
      end loop;
    end if;

    -- Platform collections
    if old.platforms is not null then
      foreach item in array old.platforms loop
        perform public.remove_collection_app('platform-' || public.slugify(item), new.id);
      end loop;
    end if;

    -- Other collections
    if (old.free is true or old.retail_price = 0) and
       (new.free is false and new.retail_price != 0) then
      perform public.remove_collection_app('free', new.id);
    end if;

    if old.plus_one is true and new.plus_one is false then
      perform public.remove_collection_app('plus-one', new.id);
    end if;

    if old.exfgls is true and new.exfgls is false then
      perform public.remove_collection_app('exfgls', new.id);
    end if;

    if old.steamdeck is not null and
       (new.steamdeck is null or new.steamdeck not in ('Playable', 'Verified')) then
      perform public.remove_collection_app('steamdeck', new.id);
    end if;

    if old.cards > 0 and (new.cards is null or new.cards = 0) then
      perform public.remove_collection_app('with-cards', new.id);
    end if;

    if old.achievements > 0 and (new.achievements is null or new.achievements = 0) then
      perform public.remove_collection_app('with-achievements', new.id);
    end if;

    if old.bundles > 0 and (new.bundles is null or new.bundles = 0) then
      perform public.remove_collection_app('bundled', new.id);
    end if;

    if old.giveaways > 0 and (new.giveaways is null or new.giveaways = 0) then
      perform public.remove_collection_app('givenaway', new.id);
    end if;

    if old.removed_at is not null and new.removed_at is null then
      perform public.remove_collection_app('removed', new.id);
    end if;

    if old.removed_as is not null and
       (new.removed_as is null or new.removed_as != old.removed_as) then
      perform public.remove_collection_app('removed-' || public.slugify(old.removed_as), new.id);
    end if;
  end if;

  -- Add new collections
  -- Type collection
  if new.type is not null then
    perform public.add_collection_app('type-' || public.slugify(new.type::text), new.id, initcap(new.type::text) || ' (type)');
  end if;

  -- Developer collections
  if new.developers is not null then
    foreach item in array new.developers loop
      perform public.add_collection_app('developer-' || public.slugify(item), new.id, initcap(item) || ' (developer)');
    end loop;
  end if;

  -- Publisher collections
  if new.publishers is not null then
    foreach item in array new.publishers loop
      perform public.add_collection_app('publisher-' || public.slugify(item), new.id, initcap(item) || ' (publisher)');
    end loop;
  end if;

  -- Tag collections
  if new.tags is not null then
    foreach item in array new.tags loop
      perform public.add_collection_app('tag-' || public.slugify(item), new.id, initcap(item) || ' (tag)');
    end loop;
  end if;

  -- Language collections
  if new.languages is not null then
    foreach item in array new.languages loop
      perform public.add_collection_app('language-' || public.slugify(item), new.id, initcap(item) || ' (language)');
    end loop;
  end if;

  -- Platform collections
  if new.platforms is not null then
    foreach item in array new.platforms loop
      perform public.add_collection_app('platform-' || public.slugify(item), new.id, initcap(item) || ' (platform)');
    end loop;
  end if;

  -- Other collections
  if new.free is true or new.retail_price = 0 then
    perform public.add_collection_app('free', new.id, 'Free');
  end if;

  if new.plus_one is true then
    perform public.add_collection_app('plus-one', new.id, 'Plus One');
  end if;

  if new.exfgls is true then
    perform public.add_collection_app('exfgls', new.id, 'Excluded from Library Sharing');
  end if;

  if new.steamdeck in ('Playable', 'Verified') then
    perform public.add_collection_app('steamdeck', new.id, 'SteamDeck Compatible');
  end if;

  if new.cards > 0 then
    perform public.add_collection_app('with-cards', new.id, 'With Cards');
  end if;

  if new.achievements > 0 then
    perform public.add_collection_app('with-achievements', new.id, 'With Achievements');
  end if;

  if new.bundles > 0 then
    perform public.add_collection_app('bundled', new.id, 'Bundled');
  end if;

  if new.giveaways > 0 then
    perform public.add_collection_app('givenaway', new.id, 'Givenaway');
  end if;

  if new.removed_at is not null then
    perform public.add_collection_app('removed', new.id, 'Removed');
  end if;

  if new.removed_as is not null then
    perform public.add_collection_app('removed-' || public.slugify(new.removed_as), new.id, initcap(new.removed_as));
  end if;

  return new;
end;
$$ language plpgsql security invoker;

-- Create trigger function to sync search columns
create or replace function public.apps_sync_search_columns()
returns trigger
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.title      is distinct from old.title
     or new.alt_titles is distinct from old.alt_titles
  then
    new.search_text := nullif(trim(
      coalesce(new.title, '') || ' ' ||
      coalesce(array_to_string(new.alt_titles, ' '), '')
    ), '');
  end if;

  if tg_op = 'INSERT'
     or new.positive_reviews is distinct from old.positive_reviews
     or new.negative_reviews is distinct from old.negative_reviews
  then
    new.wilson_score := public.wilson_lower_bound(
      new.positive_reviews,
      new.negative_reviews
    );
  end if;

  return new;
end;
$$ language plpgsql security invoker;

-- Create function to return app metadata dump
create or replace function get_apps_metadata()
returns jsonb
set search_path = ''
as $$
declare
  result jsonb;
begin
  if current_user != 'service_role' then
    raise exception 'access denied: service_role required';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'header', a.header,
      'title', a.title,
      'alt_titles', a.alt_titles
    )
    order by a.id
  )
  into result
  from public.apps a
  where a.title is not null;

  return result;
end;
$$ language plpgsql security invoker;

-- Create function to search apps with configurable weights
create or replace function public.wilson_lower_bound(
  p_positive integer,
  p_negative integer,
  p_z        numeric default 1.96
)
returns numeric
immutable parallel safe
set search_path = ''
as $$
declare
  v_n integer;
  v_p numeric;
begin
  v_n := coalesce(p_positive, 0) + coalesce(p_negative, 0);
  if v_n = 0 then
    return null;
  end if;
  v_p := coalesce(p_positive, 0)::numeric / v_n;
  return (
    v_p + (p_z ^ 2) / (2.0 * v_n)
    - p_z * sqrt(
        (v_p * (1.0 - v_p) + (p_z ^ 2) / (4.0 * v_n)) / v_n
      )
  ) / (1.0 + (p_z ^ 2) / v_n);
end;
$$ language plpgsql security invoker;

-- Create function to sanitize pgroonga queries
create or replace function public.pgroonga_sanitize_query(p_query text)
returns text
immutable parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(p_query, '["\+\-\*\(\)\~\\\:<>]', ' ', 'g'));
$$ language sql security invoker;

-- Create function to search apps with configurable weights
create or replace function public.search_apps(
  p_queries  text[],
  p_limit    integer default 20
)
returns table (
  query      text,
  id         integer,
  title      text,
  alt_titles text[],
  header     text,
  type       public.app_type,
  confidence numeric
)
stable
set search_path = public, extensions
as $$
declare
  v_query     text;
  v_sanitized text;
  v_clean     text;
  v_pg_query  text;
  v_is_cjk    boolean;
begin
  foreach v_query in array coalesce(p_queries, array[]::text[])
  loop
    v_sanitized := public.pgroonga_sanitize_query(v_query);
    continue when v_sanitized = '';

    v_clean  := trim(lower(v_query));

    -- detect CJK: Hiragana, Katakana, CJK Unified Ideographs, Hangul.
    -- TokenNgram breaks these into character n-grams natively, so partial
    -- matching already works without a trailing *.  appending * to a CJK
    -- string produces an invalid prefix query and returns nothing.
    v_is_cjk := v_sanitized ~ u&'[\3040-\30ff\4e00-\9fff\ac00-\d7af]';

    -- non-CJK: append * so a single index traversal covers both n-gram
    -- and prefix matching (e.g. "porta" → "Portal", "Portal 2").
    v_pg_query := case when v_is_cjk then v_sanitized else v_sanitized || '*' end;

    return query
    select
      v_query,
      a.id,
      a.title,
      a.alt_titles,
      a.header,
      a.type,
      -- confidence ∈ [0, 1)  strictly non-overlapping bands:
      --   exact  → [0.6667, 1.0)   title or alt_title equals query exactly
      --   prefix → [0.3333, 0.6667)   title starts with query
      --   fuzzy  → [0.0000, 0.3333)   pgroonga matched via ngram or fuzzy
      -- wilson_score ranks within each band; pg_score breaks remaining ties.
      round(
        (
          case
            when lower(a.title) = v_clean
              or exists (
                   select 1 from unnest(a.alt_titles) as t(v)
                   where lower(t.v) = v_clean
                 )
              then 2
            when lower(a.title) like v_sanitized || '%'
              then 1
            else 0
          end::numeric
          + least(coalesce(a.wilson_score, 0::numeric), 0.9999)
        ) / 3.0,
        4
      ) as confidence
    from public.apps a
    where
      a.search_text is not null
      and (
        -- primary path: prefix + ngram in one index traversal.
        a.search_text &@~ v_pg_query

        -- fuzzy fallback: catches transpositions and misspellings
        -- (e.g. "protal" → "Portal") using edit-distance ratio.
        -- only applied for non-CJK; CJK n-gram matching is already
        -- tolerant of partial input without needing fuzzy distance.
        -- 0.2 ratio ≈ 1 allowed error per 5 characters.
        -- both operators share the same pgroonga index.
        or (
          not v_is_cjk
          and a.search_text &@~ pgroonga_condition(
            v_sanitized,
            fuzzy_max_distance_ratio => 0.2
          )
        )
      )
    order by
      confidence desc,
      pgroonga_score(tableoid, ctid) desc
    limit p_limit;

  end loop;
end;
$$ language plpgsql security invoker;

-- Create function as a convenience wrapper for searching a single query
create or replace function public.search_app(
  p_query  text,
  p_limit  integer default 20
)
returns table (
  query      text,
  id         integer,
  title      text,
  alt_titles text[],
  header     text,
  type       public.app_type,
  confidence numeric
)
stable
set search_path = public, extensions
as $$
  select * from public.search_apps(array[p_query], p_limit);
$$ language sql security invoker;

-- Create triggers
create trigger apps_ensure_parent_exists
before insert on apps
for each row
execute function ensure_app_exists();

create trigger apps_handle_title_change_trigger
before update of title on apps
for each row
execute function apps_handle_title_change();

create trigger apps_manage_collections_trigger
after insert or update on apps
for each row
execute function apps_manage_collections();

create trigger apps_sync_search_columns_trigger
before insert or update of title, alt_titles, positive_reviews, negative_reviews
on public.apps
for each row
execute function public.apps_sync_search_columns();

-- Create indexes
create index if not exists idx_apps_search_pgroonga
  on public.apps using pgroonga (search_text)
  with (
    tokenizer  = 'TokenNgram("loose_symbol", true, "loose_blank", true)',
    normalizer = 'NormalizerNFKC100'
  )
  where search_text is not null;

create index if not exists idx_apps_wilson_score
  on public.apps (wilson_score desc nulls last);

-- Add date management triggers
create trigger apps_update_dates
before update on apps
for each row
execute function update_dates();

create trigger apps_insert_dates
before insert on apps
for each row
execute function insert_dates();

-- Enable RLS
alter table apps enable row level security;

-- Allow read access for all users
create policy apps_select on apps
for select
to authenticated, anon
using (true);

-- Disallow creation for all users
-- Disallow update for all users
-- Disallow deletion for all users
