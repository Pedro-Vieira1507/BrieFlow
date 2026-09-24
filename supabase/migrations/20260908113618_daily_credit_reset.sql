-- Replenish every active workspace to its plan limit at midnight in Sao Paulo.
-- Billing periods remain independent and continue to follow Stripe.

begin;

create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.subscriptions
  add column if not exists last_credit_reset_on date;

alter table public.subscriptions
  alter column last_credit_reset_on
  set default ((now() at time zone 'America/Sao_Paulo')::date);

-- Existing balances missed today's reset because the legacy job writes to
-- user_plans. Mark them as due so this migration repairs them immediately.
update public.subscriptions
set last_credit_reset_on =
  ((now() at time zone 'America/Sao_Paulo')::date - 1)
where last_credit_reset_on is null;

create index if not exists subscriptions_daily_reset_due_idx
  on public.subscriptions (last_credit_reset_on, id)
  where status in ('active', 'trialing');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subscriptions_credit_bounds_check'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_credit_bounds_check
      check (credits_remaining <= credits_monthly) not valid;
  end if;
end;
$$;

alter table public.subscriptions
  validate constraint subscriptions_credit_bounds_check;

create or replace function private.reset_daily_credits(
  p_as_of timestamptz default now(),
  p_organization_id uuid default null,
  p_actor_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reset_on date := (coalesce(p_as_of, now()) at time zone 'America/Sao_Paulo')::date;
  v_reset_count integer := 0;
  v_ledger_count integer := 0;
begin
  with eligible as materialized (
    select
      s.id as subscription_id,
      s.organization_id,
      s.credits_remaining as previous_balance,
      pc.monthly_credits as credit_limit,
      case
        when p_actor_user_id is not null and exists (
          select 1
          from public.organization_members as om
          where om.organization_id = s.organization_id
            and om.user_id = p_actor_user_id
            and om.status = 'active'
        ) then p_actor_user_id
        else o.owner_user_id
      end as actor_user_id
    from public.subscriptions as s
    join public.plan_catalog as pc
      on pc.id = s.plan_id
     and pc.active
    join public.organizations as o
      on o.id = s.organization_id
    where s.status in ('active', 'trialing')
      and s.last_credit_reset_on < v_reset_on
      and (p_organization_id is null or s.organization_id = p_organization_id)
    order by s.id
    for update of s skip locked
  ),
  updated as (
    update public.subscriptions as s
    set credits_monthly = e.credit_limit,
        credits_remaining = e.credit_limit,
        last_credit_reset_on = v_reset_on,
        updated_at = now()
    from eligible as e
    where s.id = e.subscription_id
    returning
      s.organization_id,
      e.actor_user_id,
      e.previous_balance,
      e.credit_limit,
      s.credits_remaining
  ),
  ledger_entries as (
    insert into public.credit_ledger (
      organization_id,
      user_id,
      request_id,
      entry_type,
      amount,
      action,
      balance_after,
      metadata
    )
    select
      u.organization_id,
      u.actor_user_id,
      'daily-reset:' || v_reset_on::text || ':' || u.organization_id::text,
      'grant',
      u.credit_limit - u.previous_balance,
      'daily_reset',
      u.credits_remaining,
      jsonb_build_object(
        'reset_date', v_reset_on,
        'timezone', 'America/Sao_Paulo',
        'previous_balance', u.previous_balance,
        'credit_limit', u.credit_limit
      )
    from updated as u
    where u.credit_limit > u.previous_balance
    on conflict (user_id, request_id, entry_type) do nothing
    returning 1
  )
  select
    (select count(*)::integer from updated),
    (select count(*)::integer from ledger_entries)
  into v_reset_count, v_ledger_count;

  return v_reset_count;
end;
$$;

comment on function private.reset_daily_credits(timestamptz, uuid, uuid) is
  'Idempotently replenishes active workspace credits once per Sao Paulo calendar day.';
comment on column public.subscriptions.last_credit_reset_on is
  'Most recent America/Sao_Paulo calendar date whose daily credit allowance was applied.';
comment on column public.subscriptions.credits_monthly is
  'Legacy API name retained for compatibility; stores the current daily credit limit.';
comment on column public.plan_catalog.monthly_credits is
  'Legacy API name retained for compatibility; stores the daily credit limit for a plan.';

revoke all on function private.reset_daily_credits(timestamptz, uuid, uuid)
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.reset_daily_credits(timestamptz, uuid, uuid)
  to service_role;

create or replace function public.get_user_plan()
returns table (
  plan text,
  credits_monthly integer,
  credits_remaining integer,
  subscription_status text,
  allowed_formats text[],
  max_members integer,
  max_saved_assets integer,
  organization_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_user_id is null then
    return;
  end if;

  v_organization_id := public.provision_user_account(v_user_id, null, '{}');
  perform private.reset_daily_credits(now(), v_organization_id, v_user_id);

  return query
  select pc.id, s.credits_monthly, s.credits_remaining, s.status,
         pc.allowed_formats, pc.max_members, pc.max_saved_assets, s.organization_id
  from public.profiles as p
  join public.organization_members as om
    on om.organization_id = p.default_organization_id
   and om.user_id = p.user_id
   and om.status = 'active'
  join public.subscriptions as s
    on s.organization_id = p.default_organization_id
  join public.plan_catalog as pc
    on pc.id = s.plan_id
  where p.user_id = v_user_id;
end;
$$;

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
set search_path = public, auth
as $$
declare
  v_org_id uuid;
  v_plan public.plan_catalog%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_cost integer;
  v_window timestamptz := date_trunc('minute', now());
  v_rate_count integer;
  v_existing public.credit_ledger%rowtype;
begin
  if p_user_id is null or p_request_id is null or char_length(p_request_id) > 128 then
    return query select false, 'invalid_request', 0, 0, 'free', '{}'::text[], null::uuid;
    return;
  end if;

  v_org_id := public.provision_user_account(p_user_id, null, '{}');
  if not exists (
    select 1
    from public.organization_members as om
    where om.organization_id = v_org_id
      and om.user_id = p_user_id
      and om.status = 'active'
  ) then
    return query select false, 'membership_inactive', 0, 0, 'free', '{}'::text[], v_org_id;
    return;
  end if;

  perform private.reset_daily_credits(now(), v_org_id, p_user_id);

  select * into v_subscription
  from public.subscriptions as s
  where s.organization_id = v_org_id
  for update;

  select * into v_plan
  from public.plan_catalog as pc
  where pc.id = v_subscription.plan_id
    and pc.active;

  if v_plan.id is null then
    return query select false, 'plan_not_found', 0, 0, 'free', '{}'::text[], v_org_id;
    return;
  end if;

  select * into v_existing
  from public.credit_ledger as cl
  where cl.user_id = p_user_id
    and cl.request_id = p_request_id
    and cl.entry_type = 'debit';

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

  update public.subscriptions as s
  set credits_remaining = s.credits_remaining - v_cost
  where s.id = v_subscription.id
  returning s.credits_remaining into v_subscription.credits_remaining;

  insert into public.credit_ledger (
    organization_id, user_id, request_id, entry_type, amount, action, balance_after, metadata
  )
  values (
    v_org_id, p_user_id, p_request_id, 'debit', v_cost, p_action,
    v_subscription.credits_remaining, coalesce(p_metadata, '{}')
  );

  return query select true, 'authorized', v_subscription.credits_remaining,
    v_cost, v_plan.id, v_plan.allowed_formats, v_org_id;
end;
$$;

revoke all on function public.get_user_plan() from public, anon;
grant execute on function public.get_user_plan() to authenticated;
revoke all on function public.authorize_generation(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.authorize_generation(uuid, text, text, jsonb)
  to service_role;

-- Apply the missed reset now before making the marker mandatory.
select private.reset_daily_credits(now(), null, null);

alter table public.subscriptions
  alter column last_credit_reset_on set not null;

-- The database runs in UTC. 03:00 UTC is 00:00 in America/Sao_Paulo.
do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'reset-daily-free-credits'
  ) then
    perform cron.unschedule('reset-daily-free-credits');
  end if;

  perform cron.schedule(
    'brieflow-reset-daily-credits',
    '0 3 * * *',
    'select private.reset_daily_credits();'
  );
end;
$$;

commit;
