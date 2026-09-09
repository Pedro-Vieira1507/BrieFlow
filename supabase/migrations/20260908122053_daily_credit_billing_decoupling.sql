-- Stripe controls subscription status and plan selection. Credit replenishment
-- is exclusively daily; p_reset_credits remains only for RPC compatibility.

begin;

create or replace function public.sync_stripe_subscription(
  p_organization_id uuid,
  p_plan_id text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_stripe_price_id text,
  p_cancel_at_period_end boolean,
  p_event_created bigint,
  p_reset_credits boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_limit integer;
  v_updated uuid;
begin
  if p_organization_id is null
     or p_plan_id is null
     or p_status not in ('active','trialing','past_due','canceled','incomplete')
     or p_period_start is null
     or p_period_end is null
     or p_period_end <= p_period_start
     or p_event_created is null
     or p_event_created <= 0 then
    raise exception using errcode = '22023', message = 'invalid_subscription_sync';
  end if;

  select monthly_credits into v_daily_limit
  from public.plan_catalog
  where id = p_plan_id and active;
  if v_daily_limit is null then
    raise exception using errcode = '22023', message = 'plan_mapping_failed';
  end if;

  update public.subscriptions as s
  set plan_id = p_plan_id,
      status = p_status,
      credits_monthly = v_daily_limit,
      credits_remaining = case
        -- An upgrade can use the larger daily allowance immediately. Stripe
        -- period renewals never replenish an already consumed allowance.
        when s.plan_id is distinct from p_plan_id
          and v_daily_limit > s.credits_monthly
          then v_daily_limit
        else least(s.credits_remaining, v_daily_limit)
      end,
      current_period_start = p_period_start,
      current_period_end = p_period_end,
      stripe_customer_id = p_stripe_customer_id,
      stripe_subscription_id = p_stripe_subscription_id,
      stripe_price_id = p_stripe_price_id,
      stripe_event_created = p_event_created,
      cancel_at_period_end = coalesce(p_cancel_at_period_end, false)
  where s.organization_id = p_organization_id
    and s.stripe_event_created <= p_event_created
  returning s.organization_id into v_updated;

  if v_updated is not null then return true; end if;
  if not exists (
    select 1
    from public.subscriptions
    where organization_id = p_organization_id
  ) then
    raise exception using errcode = 'P0002', message = 'subscription_not_found';
  end if;
  return false;
end;
$$;

comment on function public.sync_stripe_subscription(
  uuid, text, text, timestamptz, timestamptz, text, text, text,
  boolean, bigint, boolean
) is 'Synchronizes Stripe state without granting a second, billing-period credit reset.';

revoke all on function public.sync_stripe_subscription(
  uuid, text, text, timestamptz, timestamptz, text, text, text,
  boolean, bigint, boolean
) from public, anon, authenticated;
grant execute on function public.sync_stripe_subscription(
  uuid, text, text, timestamptz, timestamptz, text, text, text,
  boolean, bigint, boolean
) to service_role;

commit;
