-- Align the commercial catalog with the approved launch pricing model while
-- preserving daily replenishment. The free tier also receives a calendar-month
-- cap so automated abuse cannot create an unbounded acquisition cost.


alter table public.plan_catalog
  add column if not exists monthly_credit_cap integer;

alter table public.plan_catalog
  add column if not exists daily_credits integer
  generated always as (monthly_credits) stored;

alter table public.subscriptions
  add column if not exists daily_credit_limit integer
  generated always as (credits_monthly) stored;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plan_catalog_monthly_credit_cap_check'
      and conrelid = 'public.plan_catalog'::regclass
  ) then
    alter table public.plan_catalog
      add constraint plan_catalog_monthly_credit_cap_check
      check (monthly_credit_cap is null or monthly_credit_cap > 0);
  end if;
end;
$$;

update public.plan_catalog
set monthly_credits = case id
      when 'free' then 8
      when 'basic' then 60
      when 'pro' then 250
      when 'agency' then 800
      else monthly_credits
    end,
    monthly_credit_cap = case when id = 'free' then 120 else null end,
    generation_costs = generation_costs || '{"image_search":2}'::jsonb,
    updated_at = now()
where id in ('free', 'basic', 'pro', 'agency', 'enterprise');

-- A reduced allowance never grants credits in the middle of a day. Existing
-- balances are capped and the next normal midnight reset applies the new limit.
update public.subscriptions as subscription
set credits_monthly = catalog.monthly_credits,
    credits_remaining = least(
      subscription.credits_remaining,
      catalog.monthly_credits
    ),
    updated_at = now()
from public.plan_catalog as catalog
where catalog.id = subscription.plan_id;

comment on column public.plan_catalog.monthly_credit_cap is
  'Optional organization-wide net credit cap per America/Sao_Paulo calendar month.';
comment on column public.plan_catalog.daily_credits is
  'Canonical read-only alias for the legacy monthly_credits column, which stores a daily limit.';
comment on column public.subscriptions.daily_credit_limit is
  'Canonical read-only alias for the legacy credits_monthly column, which stores a daily limit.';

drop function if exists public.get_user_plan();

create function public.get_user_plan()
returns table (
  plan text,
  credits_monthly integer,
  credits_remaining integer,
  subscription_status text,
  allowed_formats text[],
  max_members integer,
  max_saved_assets integer,
  organization_id uuid,
  monthly_credit_cap integer,
  monthly_credits_used integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_month_started_at timestamptz :=
    date_trunc('month', now() at time zone 'America/Sao_Paulo')
      at time zone 'America/Sao_Paulo';
  v_next_month_started_at timestamptz :=
    (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month')
      at time zone 'America/Sao_Paulo';
begin
  if v_user_id is null then
    return;
  end if;

  v_organization_id := public.provision_user_account(v_user_id, null, '{}');
  perform private.reset_daily_credits(now(), v_organization_id, v_user_id);

  return query
  select
    catalog.id,
    subscription.credits_monthly,
    subscription.credits_remaining,
    subscription.status,
    catalog.allowed_formats,
    catalog.max_members,
    catalog.max_saved_assets,
    subscription.organization_id,
    catalog.monthly_credit_cap,
    case
      when catalog.monthly_credit_cap is null then null
      else usage.monthly_credits_used
    end
  from public.profiles as profile
  join public.organization_members as member
    on member.organization_id = profile.default_organization_id
   and member.user_id = profile.user_id
   and member.status = 'active'
  join public.subscriptions as subscription
    on subscription.organization_id = profile.default_organization_id
  join public.plan_catalog as catalog
    on catalog.id = subscription.plan_id
  left join lateral (
    select greatest(
      0,
      coalesce(sum(
        case
          when ledger.entry_type = 'debit' then ledger.amount
          when ledger.entry_type = 'refund' then -ledger.amount
          else 0
        end
      ), 0)
    )::integer as monthly_credits_used
    from public.credit_ledger as ledger
    where ledger.organization_id = subscription.organization_id
      and ledger.created_at >= v_month_started_at
      and ledger.created_at < v_next_month_started_at
  ) as usage on true
  where profile.user_id = v_user_id;
end;
$$;

revoke all on function public.get_user_plan() from public, anon;
grant execute on function public.get_user_plan() to authenticated;

create or replace function public.authorize_generation(
  p_user_id uuid,
  p_action text,
  p_request_id text,
  p_metadata jsonb default '{}'
)
returns table (
  ok boolean,
  code text,
  credits_remaining integer,
  credit_cost integer,
  plan text,
  allowed_formats text[],
  organization_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_plan public.plan_catalog%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_cost integer;
  v_window timestamptz := date_trunc('minute', now());
  v_rate_count integer;
  v_existing public.credit_ledger%rowtype;
  v_monthly_credits_used integer := 0;
  v_month_started_at timestamptz :=
    date_trunc('month', now() at time zone 'America/Sao_Paulo')
      at time zone 'America/Sao_Paulo';
  v_next_month_started_at timestamptz :=
    (date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month')
      at time zone 'America/Sao_Paulo';
begin
  if p_user_id is null or p_request_id is null or char_length(p_request_id) > 128 then
    return query select false, 'invalid_request', 0, 0, 'free', '{}'::text[], null::uuid;
    return;
  end if;

  v_org_id := public.provision_user_account(p_user_id, null, '{}');
  if not exists (
    select 1
    from public.organization_members as member
    where member.organization_id = v_org_id
      and member.user_id = p_user_id
      and member.status = 'active'
  ) then
    return query select false, 'membership_inactive', 0, 0, 'free', '{}'::text[], v_org_id;
    return;
  end if;

  perform private.reset_daily_credits(now(), v_org_id, p_user_id);

  select * into v_subscription
  from public.subscriptions as subscription
  where subscription.organization_id = v_org_id
  for update;

  select * into v_plan
  from public.plan_catalog as catalog
  where catalog.id = v_subscription.plan_id
    and catalog.active;

  if v_plan.id is null then
    return query select false, 'plan_not_found', 0, 0, 'free', '{}'::text[], v_org_id;
    return;
  end if;

  select * into v_existing
  from public.credit_ledger as ledger
  where ledger.user_id = p_user_id
    and ledger.request_id = p_request_id
    and ledger.entry_type = 'debit';

  if v_existing.id is not null then
    return query select false, 'duplicate_request', v_existing.balance_after,
      v_existing.amount, v_plan.id, v_plan.allowed_formats, v_org_id;
    return;
  end if;

  if v_subscription.status not in ('active', 'trialing') then
    return query select false, 'subscription_inactive', v_subscription.credits_remaining,
      0, v_plan.id, v_plan.allowed_formats, v_org_id;
    return;
  end if;

  if p_action in ('banner','email','social','technical_sheet','blog','whatsapp','reel','video','slides','podcast')
     and not (p_action = any(v_plan.allowed_formats)) then
    return query select false, 'format_not_allowed', v_subscription.credits_remaining,
      0, v_plan.id, v_plan.allowed_formats, v_org_id;
    return;
  end if;

  v_cost := coalesce((v_plan.generation_costs ->> p_action)::integer, 1);
  if v_cost < 0 or v_cost > 1000 then
    return query select false, 'invalid_credit_cost', v_subscription.credits_remaining,
      0, v_plan.id, v_plan.allowed_formats, v_org_id;
    return;
  end if;

  if v_plan.monthly_credit_cap is not null then
    select greatest(
      0,
      coalesce(sum(
        case
          when ledger.entry_type = 'debit' then ledger.amount
          when ledger.entry_type = 'refund' then -ledger.amount
          else 0
        end
      ), 0)
    )::integer
    into v_monthly_credits_used
    from public.credit_ledger as ledger
    where ledger.organization_id = v_org_id
      and ledger.created_at >= v_month_started_at
      and ledger.created_at < v_next_month_started_at;

    if v_monthly_credits_used + v_cost > v_plan.monthly_credit_cap then
      return query select false, 'monthly_credit_limit_exceeded',
        v_subscription.credits_remaining, v_cost, v_plan.id,
        v_plan.allowed_formats, v_org_id;
      return;
    end if;
  end if;

  insert into public.rate_limit_windows (
    user_id,
    scope,
    window_started_at,
    request_count
  )
  values (p_user_id, 'generation', v_window, 1)
  on conflict (user_id, scope, window_started_at) do update
    set request_count = public.rate_limit_windows.request_count + 1
    where public.rate_limit_windows.request_count < v_plan.rate_limit_per_minute
  returning request_count into v_rate_count;

  if v_rate_count is null then
    return query select false, 'rate_limit_exceeded', v_subscription.credits_remaining,
      v_cost, v_plan.id, v_plan.allowed_formats, v_org_id;
    return;
  end if;

  if v_subscription.credits_remaining < v_cost then
    return query select false, 'insufficient_credits', v_subscription.credits_remaining,
      v_cost, v_plan.id, v_plan.allowed_formats, v_org_id;
    return;
  end if;

  update public.subscriptions as subscription
  set credits_remaining = subscription.credits_remaining - v_cost
  where subscription.id = v_subscription.id
  returning subscription.credits_remaining into v_subscription.credits_remaining;

  insert into public.credit_ledger (
    organization_id, user_id, request_id, entry_type, amount, action,
    balance_after, metadata
  )
  values (
    v_org_id, p_user_id, p_request_id, 'debit', v_cost, p_action,
    v_subscription.credits_remaining, coalesce(p_metadata, '{}')
  );

  return query select true, 'authorized', v_subscription.credits_remaining,
    v_cost, v_plan.id, v_plan.allowed_formats, v_org_id;
end;
$$;

revoke all on function public.authorize_generation(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.authorize_generation(uuid, text, text, jsonb)
  to service_role;

