drop materialized view if exists "public"."user_statistics";

create materialized view "public"."user_statistics" as  WITH user_completed_trades AS (
         SELECT trades.id,
            trades.sender_id,
            trades.receiver_id
           FROM trades
          WHERE (trades.status = 'completed'::trade_status)
        )
 SELECT u.id AS user_id,
    ( SELECT max(s.refreshed_at) AS max
           FROM auth.sessions s
          WHERE (s.user_id = u.id)) AS last_active_at,
    ( SELECT count(*) AS count
           FROM collection_apps ca
          WHERE (ca.collection_id IN ( WITH RECURSIVE rec AS (
                         SELECT collections.id
                           FROM collections
                          WHERE ((collections.master = true) AND (collections.user_id = u.id) AND (collections.type = 'wishlist'::collection_type))
                        UNION ALL
                         SELECT cr.collection_id
                           FROM (collection_relations cr
                             JOIN rec r ON ((cr.parent_id = r.id)))
                        )
                 SELECT rec.id
                   FROM rec))) AS master_wishlist_apps,
    ( SELECT count(*) AS count
           FROM collection_apps ca
          WHERE (ca.collection_id IN ( WITH RECURSIVE rec AS (
                         SELECT collections.id
                           FROM collections
                          WHERE ((collections.master = true) AND (collections.user_id = u.id) AND (collections.type = 'tradelist'::collection_type))
                        UNION ALL
                         SELECT cr.collection_id
                           FROM (collection_relations cr
                             JOIN rec r ON ((cr.parent_id = r.id)))
                        )
                 SELECT rec.id
                   FROM rec))) AS master_tradelist_apps,
    ( SELECT count(*) AS count
           FROM collection_apps ca
          WHERE (ca.collection_id IN ( WITH RECURSIVE rec AS (
                         SELECT collections.id
                           FROM collections
                          WHERE ((collections.master = true) AND (collections.user_id = u.id) AND (collections.type = 'blacklist'::collection_type))
                        UNION ALL
                         SELECT cr.collection_id
                           FROM (collection_relations cr
                             JOIN rec r ON ((cr.parent_id = r.id)))
                        )
                 SELECT rec.id
                   FROM rec))) AS master_blacklist_apps,
    ( SELECT count(*) AS count
           FROM collection_apps ca
          WHERE (ca.collection_id IN ( WITH RECURSIVE rec AS (
                         SELECT collections.id
                           FROM collections
                          WHERE ((collections.master = true) AND (collections.user_id = u.id) AND (collections.type = 'library'::collection_type))
                        UNION ALL
                         SELECT cr.collection_id
                           FROM (collection_relations cr
                             JOIN rec r ON ((cr.parent_id = r.id)))
                        )
                 SELECT rec.id
                   FROM rec))) AS master_library_apps,
    ( SELECT count(*) AS count
           FROM reviews
          WHERE (reviews.subject_id = u.id)) AS reviews_received,
    ( SELECT count(*) AS count
           FROM reviews
          WHERE (reviews.user_id = u.id)) AS reviews_given,
    ( SELECT count(*) AS count
           FROM reviews
          WHERE ((reviews.subject_id = u.id) OR (reviews.user_id = u.id))) AS total_reviews,
    ( SELECT avg(reviews.speed) AS avg
           FROM reviews
          WHERE (reviews.subject_id = u.id)) AS avg_speed,
    ( SELECT avg(reviews.communication) AS avg
           FROM reviews
          WHERE (reviews.subject_id = u.id)) AS avg_communication,
    ( SELECT avg(reviews.helpfulness) AS avg
           FROM reviews
          WHERE (reviews.subject_id = u.id)) AS avg_helpfulness,
    ( SELECT avg(reviews.fairness) AS avg
           FROM reviews
          WHERE (reviews.subject_id = u.id)) AS avg_fairness,
    ( SELECT reviews.id
           FROM reviews
          WHERE (reviews.user_id = u.id)
          ORDER BY reviews.created_at DESC
         LIMIT 1) AS last_given_review_id,
    ( SELECT reviews.id
           FROM reviews
          WHERE (reviews.subject_id = u.id)
          ORDER BY reviews.created_at DESC
         LIMIT 1) AS last_received_review_id,
    ( SELECT count(*) AS count
           FROM (vault_entries ve
             LEFT JOIN user_completed_trades t ON ((ve.trade_id = t.id)))
          WHERE ((ve.user_id = u.id) AND ((ve.trade_id IS NULL) OR (t.sender_id = u.id)))) AS vault_entries_mine,
    ( SELECT count(*) AS count
           FROM (vault_entries ve
             JOIN user_completed_trades t ON ((ve.trade_id = t.id)))
          WHERE ((ve.user_id = u.id) AND (t.receiver_id = u.id))) AS vault_entries_received,
    ( SELECT ve.app_id
           FROM (vault_entries ve
             JOIN user_completed_trades t ON ((ve.trade_id = t.id)))
          WHERE ((ve.user_id = u.id) AND (t.receiver_id = u.id))
          ORDER BY ve.created_at DESC
         LIMIT 1) AS latest_received_app_id,
    ( SELECT count(*) AS count
           FROM trades
          WHERE (((trades.sender_id = u.id) OR (trades.receiver_id = u.id)) AND (trades.status = 'pending'::trade_status))) AS trades_pending,
    ( SELECT count(*) AS count
           FROM trades
          WHERE (((trades.sender_id = u.id) OR (trades.receiver_id = u.id)) AND (trades.status = 'accepted'::trade_status))) AS trades_accepted,
    ( SELECT count(*) AS count
           FROM trades
          WHERE (((trades.sender_id = u.id) OR (trades.receiver_id = u.id)) AND (trades.status = 'declined'::trade_status))) AS trades_declined,
    ( SELECT count(*) AS count
           FROM trades
          WHERE (((trades.sender_id = u.id) OR (trades.receiver_id = u.id)) AND (trades.status = 'aborted'::trade_status))) AS trades_aborted,
    ( SELECT count(*) AS count
           FROM trades
          WHERE (((trades.sender_id = u.id) OR (trades.receiver_id = u.id)) AND (trades.status = 'completed'::trade_status) AND ((trades.sender_disputed = false) AND (trades.receiver_disputed = false)))) AS trades_completed,
    ( SELECT count(DISTINCT
                CASE
                    WHEN (trades.sender_id = u.id) THEN trades.receiver_id
                    ELSE trades.sender_id
                END) AS count
           FROM trades
          WHERE (((trades.sender_id = u.id) OR (trades.receiver_id = u.id)) AND (trades.status = 'completed'::trade_status))) AS completed_trades_distinct_users,
    ( SELECT count(*) AS count
           FROM trades
          WHERE (((trades.sender_id = u.id) OR (trades.receiver_id = u.id)) AND (trades.original_id IS NOT NULL))) AS trades_countered,
    ( SELECT count(*) AS count
           FROM trades
          WHERE (((trades.sender_id = u.id) AND trades.receiver_disputed) OR ((trades.receiver_id = u.id) AND trades.sender_disputed))) AS trades_disputed,
    ( SELECT trades.id
           FROM trades
          WHERE ((trades.sender_id = u.id) OR (trades.receiver_id = u.id))
          ORDER BY trades.created_at DESC
         LIMIT 1) AS latest_trade_id,
    ( SELECT count(*) AS count
           FROM collections
          WHERE (collections.user_id = u.id)) AS total_collections
   FROM users u;



