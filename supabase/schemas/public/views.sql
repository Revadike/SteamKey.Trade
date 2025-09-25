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
with user_completed_trades as (
  select id, sender_id, receiver_id
  from trades
  where status = 'completed'
)
select
  u.id as user_id,

  -- last session refresh (proxy for "last active")
  (
    select max(s.refreshed_at)
    from auth.sessions s
    where s.user_id = u.id
  ) as last_active_at,

  -- master wishlist apps (recursive: master collection with master=true and type 'wishlist' and all its descendants)
  (
    select count(*)
    from collection_apps as ca
    where ca.collection_id in (
      with recursive rec as (
        select id
        from collections
        where
          master = true
          and user_id = u.id
          and type = 'wishlist'
        union all
        select cr.collection_id
        from collection_relations cr
        inner join rec r on cr.parent_id = r.id
      )
      select id from rec
    )
  ) as master_wishlist_apps,
  
  -- master tradelist apps
  (
    select count(*)
    from collection_apps as ca
    where ca.collection_id in (
      with recursive rec as (
        select id
        from collections
        where
          master = true
          and user_id = u.id
          and type = 'tradelist'
        union all
        select cr.collection_id
        from collection_relations cr
        inner join rec r on cr.parent_id = r.id
      )
      select id from rec
    )
  ) as master_tradelist_apps,
  
  -- master blacklist apps
  (
    select count(*)
    from collection_apps as ca
    where ca.collection_id in (
      with recursive rec as (
        select id
        from collections
        where
          master = true
          and user_id = u.id
          and type = 'blacklist'
        union all
        select cr.collection_id
        from collection_relations cr
        inner join rec r on cr.parent_id = r.id
      )
      select id from rec
    )
  ) as master_blacklist_apps,
  
  -- master library apps
  (
    select count(*)
    from collection_apps as ca
    where ca.collection_id in (
      with recursive rec as (
        select id
        from collections
        where
          master = true
          and user_id = u.id
          and type = 'library'
        union all
        select cr.collection_id
        from collection_relations cr
        inner join rec r on cr.parent_id = r.id
      )
      select id from rec
    )
  ) as master_library_apps,
  
  -- reviews statistics
  (
    select count(*)
    from reviews
    where subject_id = u.id
  ) as reviews_received,
  (
    select count(*)
    from reviews
    where user_id = u.id
  ) as reviews_given,
  (
    select count(*)
    from reviews
    where subject_id = u.id or user_id = u.id
  ) as total_reviews,
  (
    select avg(speed)
    from reviews
    where subject_id = u.id
  ) as avg_speed,
  (
    select avg(communication)
    from reviews
    where subject_id = u.id
  ) as avg_communication,
  (
    select avg(helpfulness)
    from reviews
    where subject_id = u.id
  ) as avg_helpfulness,
  (
    select avg(fairness)
    from reviews
    where subject_id = u.id
  ) as avg_fairness,
  (
    select id
    from reviews
    where user_id = u.id
    order by created_at desc
    limit 1
  ) as last_given_review_id,
  (
    select id
    from reviews
    where subject_id = u.id
    order by created_at desc
    limit 1
  ) as last_received_review_id,
  
  -- vault entries statistics
  (
    select count(*)
    from vault_entries ve
    left join user_completed_trades t on ve.trade_id = t.id
    where ve.user_id = u.id
      and (ve.trade_id is null or t.sender_id = u.id)
  ) as vault_entries_mine,
  (
    select count(*)
    from vault_entries ve
    join user_completed_trades t on ve.trade_id = t.id
    where ve.user_id = u.id
      and t.receiver_id = u.id
  ) as vault_entries_received,
  (
    select ve.app_id
    from vault_entries ve
    join user_completed_trades t on ve.trade_id = t.id
    where ve.user_id = u.id
      and t.receiver_id = u.id
    order by ve.created_at desc
    limit 1
  ) as latest_received_app_id,
  
  -- trade statistics for trades involving the user
  (
    select count(*)
    from trades
    where (sender_id = u.id or receiver_id = u.id)
      and status = 'pending'
  ) as trades_pending,
  (
    select count(*)
    from trades
    where (sender_id = u.id or receiver_id = u.id)
      and status = 'accepted'
  ) as trades_accepted,
  (
    select count(*)
    from trades
    where (sender_id = u.id or receiver_id = u.id)
      and status = 'declined'
  ) as trades_declined,
  (
    select count(*)
    from trades
    where (sender_id = u.id or receiver_id = u.id)
      and status = 'aborted'
  ) as trades_aborted,
  (
    select count(*)
    from trades
    where (sender_id = u.id or receiver_id = u.id)
      and status = 'completed'
      and (sender_disputed = false and receiver_disputed = false)
  ) as trades_completed,
  
  -- for completed trades, count distinct counterparties
  (
    select count(distinct case when sender_id = u.id then receiver_id else sender_id end)
    from trades
    where (sender_id = u.id or receiver_id = u.id)
      and status = 'completed'
  ) as completed_trades_distinct_users,
  
  -- total trades countered (trades with non-null original_id)
  (
    select count(*)
    from trades
    where (sender_id = u.id or receiver_id = u.id)
      and original_id is not null
  ) as trades_countered,
  
  -- total trades disputed (where either party flagged a dispute)
  (
    select count(*)
    from trades
    where (sender_id = u.id and receiver_disputed)
       or (receiver_id = u.id and sender_disputed)
  ) as trades_disputed,
  (
    select id
    from trades
    where (sender_id = u.id or receiver_id = u.id)
    order by created_at desc
    limit 1
  ) as latest_trade_id,
  
  -- total collections count
  (
    select count(*)
    from collections
    where user_id = u.id
  ) as total_collections
from users u;

-- Cron job to refresh the materialized view every 5 minutes
select cron.schedule('refresh_user_statistics', '*/5 * * * *', $$
  refresh materialized view user_statistics;
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