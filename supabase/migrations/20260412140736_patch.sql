-- pgroonga must be installed in the extensions schema to resolve the supabase warning.
-- if you enabled it via the dashboard in the public schema, disable it there first,
-- then re-enable it and select "extensions" as the schema, or run the line below.
-- if it is already in extensions this line is a no-op.
create extension if not exists pgroonga with schema extensions;

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


-- strips pgroonga query syntax operators from user input to prevent
-- parse errors and unintended operator injection
create or replace function public.pgroonga_sanitize_query(p_query text)
returns text
immutable parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(p_query, '["\+\-\*\(\)\~\\\:<>]', ' ', 'g'));
$$ language sql security invoker;


alter table public.apps
  add column if not exists search_text  text    default null,
  add column if not exists wilson_score numeric default null;


-- fires on inserts and on updates when the relevant columns actually changed.
-- each block is guarded independently so only affected fields are recomputed.
-- coalesce on alt_titles handles the common case where it is null —
-- search_text will simply contain the title only.
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

drop trigger if exists apps_sync_search_columns_trigger on public.apps;
create trigger apps_sync_search_columns_trigger
before insert or update of title, alt_titles, positive_reviews, negative_reviews
on public.apps
for each row
execute function public.apps_sync_search_columns();


-- pgroonga full-text index on the combined search_text field.
-- TokenNgram: character n-grams handle CJK natively and give partial/prefix matching.
-- loose_symbol/loose_blank: punctuation and spacing differences are tolerated.
-- NormalizerNFKC100: unicode normalisation, case folding, JP full/half-width, accents.
create index if not exists idx_apps_search_pgroonga
  on public.apps using pgroonga (search_text)
  with (
    tokenizer  = 'TokenNgram("loose_symbol", true, "loose_blank", true)',
    normalizer = 'NormalizerNFKC100'
  )
  where search_text is not null;

-- useful for direct wilson_score queries outside of search_apps,
-- e.g. leaderboard or admin queries. not used by search_apps itself
-- since confidence is a computed expression the planner cannot satisfy
-- with a simple btree on wilson_score.
create index if not exists idx_apps_wilson_score
  on public.apps (wilson_score desc nulls last);


create index if not exists idx_apps_search_pgroonga_fuzzy
  on public.apps using pgroonga (search_text)
  with (
    tokenizer  = 'TokenBigram',
    normalizer = 'NormalizerNFKC100'
  )
  where search_text is not null;

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

-- convenience wrapper for single-query callers.
-- identical signature to search_apps except p_query is scalar.
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
