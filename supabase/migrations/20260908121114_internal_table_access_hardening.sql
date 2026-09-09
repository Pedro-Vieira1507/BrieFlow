-- Internal operational tables are accessed only by SECURITY DEFINER routines
-- or service-role Edge Functions. Keep them outside direct Data API access.

begin;

revoke all on table
  public.rate_limit_windows,
  public.scrape_cache,
  public.stripe_webhook_events
from public, anon, authenticated;

do $brand_knowledge$
begin
  if to_regclass('public.brand_knowledge') is not null then
    execute 'revoke all on table public.brand_knowledge from public, anon, authenticated';
  end if;
end $brand_knowledge$;

commit;
