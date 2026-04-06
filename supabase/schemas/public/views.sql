-- Materialized view to store site-wide statistics
create materialized view site_statistics as
select
  -- Overall counts
  (select count(*) from users) as total_users,
  (select count(*) from trades) as total_trades,
  (select count(*) from vault_entries) as total_vault_entries,

  -- Total traded volume (sum of sender_total and receiver_total)
  (
    select sum(sender_total + receiver_total) from trades
    where status = 'completed'
  ) as total_traded_volume,

  -- Count of trades where a dispute occurred
  (
    select count(*) from trades
    where sender_disputed or receiver_disputed
  ) as disputed_trades,

  -- Trade counts by status
  (
    select count(*) from trades
    where status = 'pending'
  ) as trades_pending,
  (
    select count(*) from trades
    where status = 'accepted'
  ) as trades_accepted,
  (
    select count(*) from trades
    where status = 'declined'
  ) as trades_declined,
  (
    select count(*) from trades
    where status = 'aborted'
  ) as trades_aborted,
  (
    select count(*) from trades
    where status = 'completed'
  ) as trades_completed,

  -- Vault entry counts by type
  (
    select floor(count(*) / 2.0) from vault_entries
    where trade_id is not null
  ) as vault_entries_received,
  (
    select count(*) from vault_entries
    where trade_id is null
  ) as vault_entries_mine,

  -- Top regions by user count (most popular countries)
  (
    select region
    from (
      select
        region,
        count(*) as region_count
      from users
      where region is not null
      group by region
      order by region_count desc, region asc
      limit 1 offset 0
    ) as top_regions
  ) as top_region1,
  (
    select region
    from (
      select
        region,
        count(*) as region_count
      from users
      where region is not null
      group by region
      order by region_count desc, region asc
      limit 1 offset 1
    ) as top_regions
  ) as top_region2,
  (
    select region
    from (
      select
        region,
        count(*) as region_count
      from users
      where region is not null
      group by region
      order by region_count desc, region asc
      limit 1 offset 2
    ) as top_regions
  ) as top_region3,

  -- Average trades per user
  case
    when (select count(*) from users) > 0
      then (select count(*)::numeric from trades) / (select count(*) from users)
    else 0
  end as avg_trades;

-- Cron job to refresh the materialized view every 30 minutes
select cron.schedule('refresh_site_statistics', '*/30 * * * *', $$
  refresh materialized view site_statistics;
$$);

-- Materialized view for app facets (unique tags, languages, platforms, etc.)
create materialized view app_facets as
select
  -- Get unique tags from all apps
  array(
    select distinct unnest(tags)
    from apps
    where tags is not null
    order by unnest(tags)
  ) as tags,

  -- Get unique languages from all apps
  array(
    select distinct unnest(languages)
    from apps
    where languages is not null
    order by unnest(languages)
  ) as languages,

  -- Get unique platforms from all apps
  array(
    select distinct unnest(platforms)
    from apps
    where platforms is not null
    order by unnest(platforms)
  ) as platforms,

  -- Get unique steamdeck compatibility statuses
  array(
    select distinct steamdeck
    from apps
    where steamdeck is not null
    order by steamdeck
  ) as steamdeck,

  -- Get unique removal categories
  array(
    select distinct removed_as
    from apps
    where removed_as is not null
    order by removed_as
  ) as removed_as,

  -- Get unique developers
  array(
    select distinct unnest(developers)
    from apps
    where developers is not null
    order by unnest(developers)
  ) as developers,

  -- Get unique publishers
  array(
    select distinct unnest(publishers)
    from apps
    where publishers is not null
    order by unnest(publishers)
  ) as publishers;

-- Cron job to refresh the app_facets view every day at midnight
select cron.schedule('refresh_app_facets', '0 0 * * *', $$
  refresh materialized view app_facets;
$$);

-- Materialized view to store user-specific statistics
create materialized view user_statistics as
with recursive master_collection_tree as (
  select
    c.user_id,
    c.type,
    c.id as collection_id,
    array[c.id] as path
  from collections c
  where
    c.master = true
    and c.user_id is not null
    and c.type in ('wishlist', 'tradelist', 'blacklist', 'library')

  union all

  select
    mct.user_id,
    mct.type,
    cr.collection_id,
    mct.path || cr.collection_id
  from master_collection_tree mct
  inner join collection_relations cr
    on cr.parent_id = mct.collection_id
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
    count(*) filter (where dmc.type = 'wishlist')  as master_wishlist_apps,
    count(*) filter (where dmc.type = 'tradelist') as master_tradelist_apps,
    count(*) filter (where dmc.type = 'blacklist') as master_blacklist_apps,
    count(*) filter (where dmc.type = 'library')   as master_library_apps
  from distinct_master_collections dmc
  inner join collection_apps ca
    on ca.collection_id = dmc.collection_id
  group by dmc.user_id
),
sessions_agg as (
  select
    user_id,
    max(refreshed_at) as last_active_at
  from auth.sessions
  group by user_id
),
reviews_received_agg as (
  select
    subject_id as user_id,
    count(*) as reviews_received,
    avg(speed) as avg_speed,
    avg(communication) as avg_communication,
    avg(helpfulness) as avg_helpfulness,
    avg(fairness) as avg_fairness
  from reviews
  where subject_id is not null
  group by subject_id
),
reviews_given_agg as (
  select
    user_id,
    count(*) as reviews_given
  from reviews
  where user_id is not null
  group by user_id
),
reviews_total_agg as (
  select
    user_id,
    count(distinct review_id) as total_reviews
  from (
    select subject_id as user_id, id as review_id
    from reviews
    where subject_id is not null

    union all

    select user_id as user_id, id as review_id
    from reviews
    where user_id is not null
  ) r
  group by user_id
),
last_given_review as (
  select user_id, id as last_given_review_id
  from (
    select
      user_id,
      id,
      row_number() over (
        partition by user_id
        order by created_at desc, id desc
      ) as rn
    from reviews
    where user_id is not null
  ) x
  where rn = 1
),
last_received_review as (
  select user_id, id as last_received_review_id
  from (
    select
      subject_id as user_id,
      id,
      row_number() over (
        partition by subject_id
        order by created_at desc, id desc
      ) as rn
    from reviews
    where subject_id is not null
  ) x
  where rn = 1
),
completed_trades as (
  select id, sender_id, receiver_id
  from trades
  where status = 'completed'
),
vault_entries_agg as (
  select
    ve.user_id,
    count(*) filter (
      where ve.trade_id is null or ct.sender_id = ve.user_id
    ) as vault_entries_mine,
    count(*) filter (
      where ct.receiver_id = ve.user_id
    ) as vault_entries_received
  from vault_entries ve
  left join completed_trades ct
    on ct.id = ve.trade_id
  where ve.user_id is not null
  group by ve.user_id
),
latest_received_vault as (
  select user_id, app_id as latest_received_app_id
  from (
    select
      ve.user_id,
      ve.app_id,
      row_number() over (
        partition by ve.user_id
        order by ve.created_at desc, ve.id desc
      ) as rn
    from vault_entries ve
    inner join completed_trades ct
      on ct.id = ve.trade_id
    where ve.user_id is not null
      and ct.receiver_id = ve.user_id
  ) x
  where rn = 1
),
trade_participants as (
  select
    id as trade_id,
    sender_id as user_id,
    receiver_id as counterparty_id,
    status,
    sender_disputed,
    receiver_disputed,
    original_id,
    created_at,
    receiver_disputed as disputed_by_counterparty
  from trades
  where sender_id is not null

  union all

  select
    id as trade_id,
    receiver_id as user_id,
    sender_id as counterparty_id,
    status,
    sender_disputed,
    receiver_disputed,
    original_id,
    created_at,
    sender_disputed as disputed_by_counterparty
  from trades
  where receiver_id is not null
),
trade_stats as (
  select
    user_id,
    count(*) filter (where status = 'pending') as trades_pending,
    count(*) filter (where status = 'accepted') as trades_accepted,
    count(*) filter (where status = 'declined') as trades_declined,
    count(*) filter (where status = 'aborted') as trades_aborted,
    count(*) filter (
      where status = 'completed'
        and sender_disputed = false
        and receiver_disputed = false
    ) as trades_completed,
    count(distinct counterparty_id) filter (where status = 'completed') as completed_trades_distinct_users,
    count(*) filter (where original_id is not null) as trades_countered,
    count(*) filter (where disputed_by_counterparty) as trades_disputed
  from trade_participants
  group by user_id
),
latest_trade as (
  select user_id, trade_id as latest_trade_id
  from (
    select
      user_id,
      trade_id,
      row_number() over (
        partition by user_id
        order by created_at desc, trade_id desc
      ) as rn
    from trade_participants
  ) x
  where rn = 1
),
collections_agg as (
  select
    user_id,
    count(*) as total_collections
  from collections
  where user_id is not null
  group by user_id
)
select
  u.id as user_id,

  sa.last_active_at,

  mca.master_wishlist_apps,
  mca.master_tradelist_apps,
  mca.master_blacklist_apps,
  mca.master_library_apps,

  rra.reviews_received,
  rga.reviews_given,
  rta.total_reviews,
  rra.avg_speed,
  rra.avg_communication,
  rra.avg_helpfulness,
  rra.avg_fairness,
  lgr.last_given_review_id,
  lrr.last_received_review_id,

  va.vault_entries_mine,
  va.vault_entries_received,
  lrv.latest_received_app_id,

  ts.trades_pending,
  ts.trades_accepted,
  ts.trades_declined,
  ts.trades_aborted,
  ts.trades_completed,
  ts.completed_trades_distinct_users,
  ts.trades_countered,
  ts.trades_disputed,
  lt.latest_trade_id,

  ca.total_collections
from users u
left join sessions_agg sa
  on sa.user_id = u.id
left join master_collection_apps mca
  on mca.user_id = u.id
left join reviews_received_agg rra
  on rra.user_id = u.id
left join reviews_given_agg rga
  on rga.user_id = u.id
left join reviews_total_agg rta
  on rta.user_id = u.id
left join last_given_review lgr
  on lgr.user_id = u.id
left join last_received_review lrr
  on lrr.user_id = u.id
left join vault_entries_agg va
  on va.user_id = u.id
left join latest_received_vault lrv
  on lrv.user_id = u.id
left join trade_stats ts
  on ts.user_id = u.id
left join latest_trade lt
  on lt.user_id = u.id
left join collections_agg ca
  on ca.user_id = u.id;

-- Function to refresh the user_statistics materialized view with locking to prevent concurrent refreshes
create or replace function refresh_user_statistics()
returns void
set search_path = ''
as $$
begin
  if not pg_try_advisory_lock(4242, 9001) then
    raise notice 'refresh_user_statistics already running';
    return;
  end if;

  begin
    refresh materialized view concurrently public.user_statistics;
  exception when others then
    perform pg_advisory_unlock(4242, 9001);
    raise;
  end;

  perform pg_advisory_unlock(4242, 9001);
end;
$$ language plpgsql security definer;

-- Cron job to refresh the materialized view every 10 minutes
select cron.schedule('refresh_user_statistics', '*/10 * * * *', $$
  select refresh_user_statistics();
$$);

-- Materialized view to store trade partner statistics
create materialized view trade_partners as
select
  least(sender_id, receiver_id) as user_id,
  greatest(sender_id, receiver_id) as partner_id,
  count(*) as total_completed_trades
from trades
where status = 'completed'
group by least(sender_id, receiver_id), greatest(sender_id, receiver_id);

-- Cron job to refresh the materialized view every 5 minutes
select cron.schedule('refresh_trade_partners', '*/5 * * * *', $$
  refresh materialized view trade_partners;
$$);
