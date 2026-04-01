CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS user_statistics_user_id_idx
ON public.user_statistics(user_id);
