-- Bound the growth of ephemeral rate-limit and scraping records. Financial,
-- credit, AI-usage and campaign records deliberately remain untouched.

begin;

create or replace function private.cleanup_ephemeral_data(
  p_as_of timestamptz default now(),
  p_batch_size integer default 50000
)
returns table (
  rate_limit_rows integer,
  scrape_cache_rows integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_as_of timestamptz := coalesce(p_as_of, now());
  v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 50000), 100000));
  v_rate_limit_rows integer := 0;
  v_scrape_cache_rows integer := 0;
begin
  with targets as materialized (
    select r.ctid as row_locator
    from public.rate_limit_windows as r
    where r.window_started_at < v_as_of - interval '2 days'
    order by r.window_started_at
    limit v_batch_size
    for update skip locked
  ), deleted as (
    delete from public.rate_limit_windows as r
    using targets as t
    where r.ctid = t.row_locator
    returning 1
  )
  select count(*)::integer into v_rate_limit_rows from deleted;

  with targets as materialized (
    select c.ctid as row_locator
    from public.scrape_cache as c
    where c.expires_at < v_as_of
    order by c.expires_at
    limit v_batch_size
    for update skip locked
  ), deleted as (
    delete from public.scrape_cache as c
    using targets as t
    where c.ctid = t.row_locator
    returning 1
  )
  select count(*)::integer into v_scrape_cache_rows from deleted;

  return query select v_rate_limit_rows, v_scrape_cache_rows;
end;
$$;

comment on function private.cleanup_ephemeral_data(timestamptz, integer) is
  'Deletes bounded batches of stale rate-limit windows and expired scrape cache entries.';

revoke all on function private.cleanup_ephemeral_data(timestamptz, integer)
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.cleanup_ephemeral_data(timestamptz, integer)
  to service_role;

do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'brieflow-clean-ephemeral-data'
  ) then
    perform cron.unschedule('brieflow-clean-ephemeral-data');
  end if;

  perform cron.schedule(
    'brieflow-clean-ephemeral-data',
    '17 * * * *',
    'select * from private.cleanup_ephemeral_data();'
  );
end;
$$;

select * from private.cleanup_ephemeral_data();

commit;
