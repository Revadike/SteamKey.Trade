drop function if exists public.get_collection_filtered_apps(text[], text[], boolean);

create or replace function public.get_collection_filtered_apps(
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
