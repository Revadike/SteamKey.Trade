create index if not exists sessions_user_id_refreshed_idx
on auth.sessions (user_id, refreshed_at desc);

create index if not exists reviews_subject_created_idx
on reviews (subject_id, created_at desc) include (id);

create index if not exists reviews_user_created_idx
on reviews (user_id, created_at desc) include (id);

create index if not exists collections_master_seed_idx
on collections (user_id, type, id)
where master = true;

create index if not exists trades_sender_status_created_idx
on trades (sender_id, status, created_at desc);

create index if not exists trades_receiver_status_created_idx
on trades (receiver_id, status, created_at desc);

create index if not exists vault_entries_user_trade_created_idx
on vault_entries (user_id, trade_id, created_at desc);

create unique index if not exists user_statistics_user_id_idx
on public.user_statistics(user_id);
