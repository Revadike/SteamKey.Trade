-- Add 'bundles' to widget enum type
alter type widget add value if not exists 'bundles';

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
