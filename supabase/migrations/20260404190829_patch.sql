-- remove old cron job if it exists
select cron.unschedule('refresh_user_statistics');

drop materialized view if exists user_statistics;

create materialized view user_statistics as
with recursive master_collection_tree as (
  select
    c.user_id,
    c.type,
    c.id as collection_id,
    array[c.id] as path
  from collections c
  where
    master = true
    and user_id is not null
    and type in ('wishlist', 'tradelist', 'blacklist', 'library')

  union all

  select
    mct.user_id,
    mct.type,
    cr.collection_id,
    mct.path || cr.collection_id
  from master_collection_tree mct
  inner join collection_relations cr on cr.parent_id = mct.collection_id
  where not cr.collection_id = any(mct.path)
),
distinct_master_collections as (
  select distinct
    user_id,
    type,
    collection_id
  from master_collection_tree
),
master_collection_apps as (
  select
    dmc.user_id,
    count(*) filter (where dmc.type = 'wishlist') as master_wishlist_apps,
    count(*) filter (where dmc.type = 'tradelist') as master_tradelist_apps,
    count(*) filter (where dmc.type = 'blacklist') as master_blacklist_apps,
    count(*) filter (where dmc.type = 'library') as master_library_apps
  from distinct_master_collections dmc
  inner join collection_apps ca on ca.collection_id = dmc.collection_id
  group by dmc.user_id
),
sessions_agg as (
  select user_id, max(refreshed_at) as last_active_at
  from auth.sessions
  group by user_id
)
select
  u.id as user_id,
  sa.last_active_at,
  mca.master_wishlist_apps,
  mca.master_tradelist_apps,
  mca.master_blacklist_apps,
  mca.master_library_apps
from users u
left join sessions_agg sa on sa.user_id = u.id
left join master_collection_apps mca on mca.user_id = u.id
;

create or replace function refresh_user_statistics()
returns void
language plpgsql
as $$
begin
  if not pg_try_advisory_lock(4242, 9001) then
    raise notice 'refresh_user_statistics already running';
    return;
  end if;

  begin
    refresh materialized view concurrently user_statistics;
  exception when others then
    perform pg_advisory_unlock(4242, 9001);
    raise;
  end;

  perform pg_advisory_unlock(4242, 9001);
end;
$$;

select cron.schedule('refresh_user_statistics', '*/10 * * * *', $$
  select refresh_user_statistics();
$$);
