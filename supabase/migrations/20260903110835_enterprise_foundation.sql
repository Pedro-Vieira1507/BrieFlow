-- BrieFlow enterprise foundation
-- Apply before deploying the Edge Functions in this repository.

begin;

create extension if not exists pgcrypto;

create table if not exists public.plan_catalog (
  id text primary key,
  label text not null,
  monthly_credits integer not null check (monthly_credits >= 0),
  max_members integer not null check (max_members > 0),
  max_saved_assets integer not null check (max_saved_assets > 0),
  rate_limit_per_minute integer not null default 20 check (rate_limit_per_minute > 0),
  allowed_formats text[] not null default '{}',
  generation_costs jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_catalog_id_check check (id in ('free', 'basic', 'pro', 'agency', 'enterprise'))
);

insert into public.plan_catalog (
  id, label, monthly_credits, max_members, max_saved_assets,
  rate_limit_per_minute, allowed_formats, generation_costs
)
values
  ('free', 'Gratuito', 20, 1, 20, 10,
    array['banner','email','social'],
    '{"banner":3,"email":3,"social":2,"chat":1,"discovery":1,"website_analysis":1,"image_search":1}'::jsonb),
  ('basic', 'Básico', 150, 1, 250, 20,
    array['banner','email','social','technical_sheet','blog','whatsapp'],
    '{"banner":3,"email":3,"social":2,"technical_sheet":4,"blog":4,"whatsapp":2,"chat":1,"discovery":1,"website_analysis":1,"image_search":1}'::jsonb),
  ('pro', 'Pro', 600, 5, 2000, 40,
    array['banner','email','social','technical_sheet','blog','whatsapp','reel','video','slides'],
    '{"banner":3,"email":3,"social":2,"technical_sheet":4,"blog":4,"whatsapp":2,"reel":6,"video":10,"slides":8,"chat":1,"discovery":1,"website_analysis":1,"image_search":1}'::jsonb),
  ('agency', 'Agência', 2500, 25, 10000, 80,
    array['banner','email','social','technical_sheet','blog','whatsapp','reel','video','slides','podcast'],
    '{"banner":3,"email":3,"social":2,"technical_sheet":4,"blog":4,"whatsapp":2,"reel":6,"video":10,"slides":8,"podcast":12,"chat":1,"discovery":1,"website_analysis":1,"image_search":1}'::jsonb),
  ('enterprise', 'Enterprise', 10000, 250, 100000, 200,
    array['banner','email','social','technical_sheet','blog','whatsapp','reel','video','slides','podcast'],
    '{"banner":3,"email":3,"social":2,"technical_sheet":4,"blog":4,"whatsapp":2,"reel":6,"video":10,"slides":8,"podcast":12,"chat":1,"discovery":1,"website_analysis":1,"image_search":1}'::jsonb)
on conflict (id) do update set
  label = excluded.label,
  monthly_credits = excluded.monthly_credits,
  max_members = excluded.max_members,
  max_saved_assets = excluded.max_saved_assets,
  rate_limit_per_minute = excluded.rate_limit_per_minute,
  allowed_formats = excluded.allowed_formats,
  generation_costs = excluded.generation_costs,
  updated_at = now();

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_organization_id uuid references public.organizations(id) on delete set null,
  display_name text check (display_name is null or char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  status text not null default 'active' check (status in ('invited','active','suspended')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_id text not null default 'free' references public.plan_catalog(id),
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled','incomplete')),
  credits_monthly integer not null default 20 check (credits_monthly >= 0),
  credits_remaining integer not null default 20 check (credits_remaining >= 0),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '1 month'),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  stripe_event_created bigint not null default 0,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions add column if not exists stripe_event_created bigint not null default 0;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  type text not null,
  content jsonb not null default '{}',
  status text not null default 'draft',
  size_bytes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.assets add column if not exists organization_id uuid;
alter table public.assets add column if not exists updated_at timestamptz not null default now();
alter table public.assets add column if not exists size_bytes integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assets_organization_id_fkey'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
end $$;

create table if not exists public.ai_usage_log (
  id bigint generated by default as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  action text not null,
  provider text not null default 'none',
  model text not null default 'none',
  prompt_tokens integer,
  completion_tokens integer,
  latency_ms integer,
  success boolean not null default false,
  error_code text,
  created_at timestamptz not null default now()
);

alter table public.ai_usage_log add column if not exists organization_id uuid;
alter table public.ai_usage_log add column if not exists request_id text;
alter table public.ai_usage_log add column if not exists action text;
alter table public.ai_usage_log add column if not exists provider text default 'none';
alter table public.ai_usage_log add column if not exists model text default 'none';
alter table public.ai_usage_log add column if not exists prompt_tokens integer;
alter table public.ai_usage_log add column if not exists completion_tokens integer;
alter table public.ai_usage_log add column if not exists latency_ms integer;
alter table public.ai_usage_log add column if not exists success boolean default false;
alter table public.ai_usage_log add column if not exists error_code text;
alter table public.ai_usage_log add column if not exists created_at timestamptz default now();

create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  entry_type text not null check (entry_type in ('debit','refund','grant','adjustment')),
  amount integer not null check (amount > 0),
  action text not null,
  balance_after integer not null check (balance_after >= 0),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, request_id, entry_type)
);

create table if not exists public.rate_limit_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (user_id, scope, window_started_at)
);

create table if not exists public.scrape_cache (
  url_hash text primary key,
  url text not null,
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  error_code text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.stripe_webhook_events add column if not exists attempt_count integer not null default 0;
alter table public.stripe_webhook_events add column if not exists updated_at timestamptz not null default now();

create index if not exists assets_user_created_idx on public.assets (user_id, created_at desc);
create index if not exists assets_user_created_id_idx on public.assets (user_id, created_at desc, id desc);
create index if not exists assets_organization_idx on public.assets (organization_id);
create index if not exists ai_usage_user_created_idx on public.ai_usage_log (user_id, created_at desc);
create index if not exists ai_usage_org_created_idx on public.ai_usage_log (organization_id, created_at desc);
create index if not exists credit_ledger_org_created_idx on public.credit_ledger (organization_id, created_at desc);
create index if not exists scrape_cache_expiry_idx on public.scrape_cache (expires_at);
create index if not exists rate_limit_started_idx on public.rate_limit_windows (window_started_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();

create or replace function public.protect_organization_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.owner_user_id is distinct from old.owner_user_id then
    raise exception using errcode = '42501', message = 'organization_identity_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_protect_identity on public.organizations;
create trigger organizations_protect_identity before update on public.organizations
for each row execute function public.protect_organization_identity();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists organization_members_set_updated_at on public.organization_members;
create trigger organization_members_set_updated_at before update on public.organization_members
for each row execute function public.set_updated_at();
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();
drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at before update on public.assets
for each row execute function public.set_updated_at();
drop trigger if exists stripe_webhook_events_set_updated_at on public.stripe_webhook_events;
create trigger stripe_webhook_events_set_updated_at before update on public.stripe_webhook_events
for each row execute function public.set_updated_at();

create or replace function public.provision_user_account(
  p_user_id uuid,
  p_email text default null,
  p_metadata jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_organization_id uuid;
  v_name text;
  v_slug text;
begin
  select default_organization_id into v_organization_id
  from public.profiles where user_id = p_user_id;

  if v_organization_id is not null then
    insert into public.organization_members (organization_id, user_id, role, status)
    select v_organization_id, p_user_id,
      case when o.owner_user_id = p_user_id then 'owner' else 'member' end,
      'active'
    from public.organizations o where o.id = v_organization_id
    on conflict (organization_id, user_id) do nothing;

    insert into public.subscriptions (
      organization_id, plan_id, status, credits_monthly, credits_remaining
    )
    select v_organization_id, id, 'active', monthly_credits, monthly_credits
    from public.plan_catalog where id = 'free'
    on conflict (organization_id) do nothing;
    return v_organization_id;
  end if;

  v_name := left(coalesce(
    nullif(p_metadata->>'company_name', ''),
    nullif(p_metadata->>'full_name', ''),
    nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
    'Meu workspace'
  ), 120);
  v_slug := 'bf-' || replace(p_user_id::text, '-', '');
  v_slug := left(v_slug, 63);

  insert into public.organizations (name, slug, owner_user_id)
  values (v_name, v_slug, p_user_id)
  on conflict (slug) do update set name = public.organizations.name
  returning id into v_organization_id;

  insert into public.profiles (user_id, default_organization_id, display_name)
  values (p_user_id, v_organization_id, left(nullif(p_metadata->>'full_name', ''), 120))
  on conflict (user_id) do update
    set default_organization_id = coalesce(public.profiles.default_organization_id, excluded.default_organization_id)
  returning default_organization_id into v_organization_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_organization_id, p_user_id, 'owner', 'active')
  on conflict (organization_id, user_id) do update set role = 'owner', status = 'active';

  insert into public.subscriptions (
    organization_id, plan_id, status, credits_monthly, credits_remaining
  )
  select v_organization_id, id, 'active', monthly_credits, monthly_credits
  from public.plan_catalog where id = 'free'
  on conflict (organization_id) do nothing;

  return v_organization_id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.provision_user_account(new.id, new.email, new.raw_user_meta_data);
  return new;
end;
$$;

-- Replace the legacy provisioning trigger so each signup runs exactly once.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_brieflow on auth.users;
create trigger on_auth_user_created_brieflow
after insert on auth.users for each row execute function public.handle_new_user();

do $$
declare
  v_user record;
begin
  for v_user in select id, email, raw_user_meta_data from auth.users loop
    perform public.provision_user_account(v_user.id, v_user.email, v_user.raw_user_meta_data);
  end loop;
end $$;

update public.assets a
set organization_id = p.default_organization_id,
    size_bytes = octet_length(a.content::text)
from public.profiles p
where a.user_id = p.user_id
  and (a.organization_id is null or a.size_bytes = 0);

alter table public.assets alter column organization_id set not null;

create or replace function public.prepare_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_assets integer;
  v_count integer;
  v_default_organization_id uuid;
begin
  if new.user_id is null then
    new.user_id := (select auth.uid());
  end if;
  if new.user_id is null then
    raise exception using errcode = '42501', message = 'asset_user_required';
  end if;

  select default_organization_id into v_default_organization_id
  from public.profiles where user_id = new.user_id;
  if v_default_organization_id is null then
    raise exception using errcode = '23502', message = 'asset_organization_required';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_default_organization_id
      and user_id = new.user_id
      and status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'membership_inactive';
  end if;

  if tg_op = 'INSERT' then
    if new.organization_id is not null and new.organization_id <> v_default_organization_id then
      raise exception using errcode = '42501', message = 'asset_organization_mismatch';
    end if;
    new.organization_id := v_default_organization_id;
  elsif new.organization_id is distinct from old.organization_id then
    raise exception using errcode = '42501', message = 'asset_organization_immutable';
  end if;

  new.name := left(regexp_replace(trim(new.name), '[[:cntrl:]]', ' ', 'g'), 120);
  new.size_bytes := octet_length(new.content::text);
  if new.size_bytes > 2000000 then
    raise exception using errcode = '22001', message = 'asset_payload_too_large';
  end if;

  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    select pc.max_saved_assets into v_max_assets
    from public.profiles p
    join public.subscriptions s on s.organization_id = p.default_organization_id
    join public.plan_catalog pc on pc.id = s.plan_id
    where p.user_id = new.user_id;

    select count(*) into v_count from public.assets where user_id = new.user_id;
    if v_count >= coalesce(v_max_assets, 20) then
      raise exception using errcode = 'P0001', message = 'asset_limit_reached';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists assets_prepare on public.assets;
create trigger assets_prepare before insert or update on public.assets
for each row execute function public.prepare_asset();

create or replace function public.enforce_organization_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_members integer;
  v_member_count integer;
begin
  if tg_op = 'INSERT' and exists (
    select 1 from public.organization_members
    where organization_id = new.organization_id and user_id = new.user_id
  ) then
    return new;
  end if;

  if new.status in ('invited', 'active') and (
    tg_op = 'INSERT'
    or old.status not in ('invited', 'active')
    or old.organization_id <> new.organization_id
    or old.user_id <> new.user_id
  ) then
    perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 1));
    select pc.max_members into v_max_members
    from public.subscriptions s
    join public.plan_catalog pc on pc.id = s.plan_id
    where s.organization_id = new.organization_id;

    if tg_op = 'INSERT' then
      select count(*) into v_member_count
      from public.organization_members
      where organization_id = new.organization_id and status in ('invited', 'active');
    else
      select count(*) into v_member_count
      from public.organization_members
      where organization_id = new.organization_id
        and status in ('invited', 'active')
        and (organization_id, user_id) <> (old.organization_id, old.user_id);
    end if;

    if v_member_count >= coalesce(v_max_members, 1) then
      raise exception using errcode = 'P0001', message = 'member_limit_reached';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists organization_members_enforce_limit on public.organization_members;
create trigger organization_members_enforce_limit
before insert or update of status, organization_id, user_id on public.organization_members
for each row execute function public.enforce_organization_member_limit();

-- The legacy RPC returned fewer columns, so it cannot be replaced in place.
drop function if exists public.get_user_plan();
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
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    return;
  end if;
  perform public.provision_user_account(v_user_id, null, '{}');

  return query
  select pc.id, s.credits_monthly, s.credits_remaining, s.status,
         pc.allowed_formats, pc.max_members, pc.max_saved_assets, s.organization_id
  from public.profiles p
  join public.organization_members om
    on om.organization_id = p.default_organization_id
   and om.user_id = p.user_id
   and om.status = 'active'
  join public.subscriptions s on s.organization_id = p.default_organization_id
  join public.plan_catalog pc on pc.id = s.plan_id
  where p.user_id = v_user_id;
end;
$$;

create or replace function public.is_organization_member(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = p_user_id
      and status = 'active'
  ) and p_user_id = (select auth.uid());
$$;

create or replace function public.is_organization_admin(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = p_user_id
      and status = 'active'
      and role in ('owner', 'admin')
  ) and p_user_id = (select auth.uid());
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
    select 1 from public.organization_members
    where organization_id = v_org_id
      and user_id = p_user_id
      and status = 'active'
  ) then
    return query select false, 'membership_inactive', 0, 0, 'free', '{}'::text[], v_org_id;
    return;
  end if;
  select * into v_subscription from public.subscriptions
  where subscriptions.organization_id = v_org_id for update;
  select * into v_plan from public.plan_catalog where id = v_subscription.plan_id and active;

  if v_plan.id is null then
    return query select false, 'plan_not_found', 0, 0, 'free', '{}'::text[], v_org_id;
    return;
  end if;

  if v_subscription.current_period_end <= now() then
    update public.subscriptions set
      credits_monthly = v_plan.monthly_credits,
      credits_remaining = v_plan.monthly_credits,
      current_period_start = now(),
      current_period_end = now() + interval '1 month'
    where id = v_subscription.id
    returning * into v_subscription;
  end if;

  select * into v_existing from public.credit_ledger
  where user_id = p_user_id and request_id = p_request_id and entry_type = 'debit';
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

  insert into public.rate_limit_windows (user_id, scope, window_started_at, request_count)
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

  update public.subscriptions
  set credits_remaining = credits_remaining - v_cost
  where id = v_subscription.id
  returning subscriptions.credits_remaining into v_subscription.credits_remaining;

  insert into public.credit_ledger (
    organization_id, user_id, request_id, entry_type, amount, action, balance_after, metadata
  ) values (
    v_org_id, p_user_id, p_request_id, 'debit', v_cost, p_action,
    v_subscription.credits_remaining, coalesce(p_metadata, '{}')
  );

  return query select true, 'authorized', v_subscription.credits_remaining,
    v_cost, v_plan.id, v_plan.allowed_formats, v_org_id;
end;
$$;

create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_scope text,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_window timestamptz := date_trunc('minute', now());
begin
  if p_user_id is null
     or p_scope is null
     or p_limit is null
     or p_scope !~ '^[a-z0-9_-]{1,40}$'
     or p_limit < 1
     or p_limit > 1000 then
    return false;
  end if;

  insert into public.rate_limit_windows (user_id, scope, window_started_at, request_count)
  values (p_user_id, p_scope, v_window, 1)
  on conflict (user_id, scope, window_started_at) do update
    set request_count = public.rate_limit_windows.request_count + 1
    where public.rate_limit_windows.request_count < p_limit
  returning request_count into v_count;

  return v_count is not null;
end;
$$;

create or replace function public.claim_stripe_webhook(
  p_event_id text,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if p_event_id is null
     or p_event_type is null
     or p_event_id !~ '^evt_[A-Za-z0-9]{8,250}$'
     or p_event_type !~ '^[a-z0-9._]{3,120}$' then
    raise exception using errcode = '22023', message = 'invalid_stripe_event';
  end if;

  insert into public.stripe_webhook_events (
    id, event_type, status, attempt_count, updated_at
  ) values (
    p_event_id, p_event_type, 'processing', 1, now()
  ) on conflict (id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then return true; end if;

  update public.stripe_webhook_events
  set event_type = p_event_type,
      status = 'processing',
      error_code = null,
      processed_at = null,
      attempt_count = attempt_count + 1,
      updated_at = now()
  where id = p_event_id
    and (
      status = 'failed'
      or (status = 'processing' and updated_at < now() - interval '10 minutes')
    );
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

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
  v_monthly integer;
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

  select monthly_credits into v_monthly
  from public.plan_catalog
  where id = p_plan_id and active;
  if v_monthly is null then
    raise exception using errcode = '22023', message = 'plan_mapping_failed';
  end if;

  update public.subscriptions s
  set plan_id = p_plan_id,
      status = p_status,
      credits_monthly = v_monthly,
      credits_remaining = case
        when (s.plan_id is distinct from p_plan_id
          and v_monthly > s.credits_monthly)
          or (p_reset_credits and s.current_period_start < p_period_start)
          then v_monthly
        else least(s.credits_remaining, v_monthly)
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
    select 1 from public.subscriptions where organization_id = p_organization_id
  ) then
    raise exception using errcode = 'P0002', message = 'subscription_not_found';
  end if;
  return false;
end;
$$;

create or replace function public.refund_generation(
  p_user_id uuid,
  p_request_id text,
  p_reason text default 'provider_failed'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debit public.credit_ledger%rowtype;
  v_balance integer;
  v_monthly integer;
begin
  select * into v_debit from public.credit_ledger
  where request_id = p_request_id and entry_type = 'debit' and user_id = p_user_id;
  if v_debit.id is null then return false; end if;
  if exists (
    select 1 from public.credit_ledger
    where user_id = p_user_id and request_id = p_request_id and entry_type = 'refund'
  ) then
    return true;
  end if;

  select credits_monthly into v_monthly from public.subscriptions
  where organization_id = v_debit.organization_id for update;
  update public.subscriptions
  set credits_remaining = least(credits_remaining + v_debit.amount, v_monthly)
  where organization_id = v_debit.organization_id
  returning credits_remaining into v_balance;

  insert into public.credit_ledger (
    organization_id, user_id, request_id, entry_type, amount, action, balance_after, metadata
  ) values (
    v_debit.organization_id, p_user_id, p_request_id, 'refund', v_debit.amount,
    v_debit.action, v_balance, jsonb_build_object('reason', left(p_reason, 200))
  );
  return true;
end;
$$;

-- The legacy brand knowledge table has no tenant key. Preserve its data, but
-- close direct Data API access until it is migrated to organization ownership.
do $brand_knowledge$
declare v_policy record;
begin
  if to_regclass('public.brand_knowledge') is not null then
    for v_policy in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'brand_knowledge'
    loop
      execute format('drop policy if exists %I on public.brand_knowledge', v_policy.policyname);
    end loop;
    execute 'alter table public.brand_knowledge enable row level security';
    execute 'revoke all on table public.brand_knowledge from public, anon, authenticated';
  end if;
end $brand_knowledge$;

-- Row-level access. Assets are deliberately personal even inside a shared organization.
alter table public.plan_catalog enable row level security;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.assets enable row level security;
alter table public.ai_usage_log enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.rate_limit_windows enable row level security;
alter table public.scrape_cache enable row level security;
alter table public.stripe_webhook_events enable row level security;

do $$
declare v_policy record;
begin
  for v_policy in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'assets'
  loop
    execute format('drop policy if exists %I on public.assets', v_policy.policyname);
  end loop;
end $$;

drop policy if exists plan_catalog_read on public.plan_catalog;
create policy plan_catalog_read on public.plan_catalog for select to authenticated using (active);

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using (user_id = (select auth.uid())) with check (
  user_id = (select auth.uid())
  and public.is_organization_member(default_organization_id, (select auth.uid()))
);

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations for select to authenticated using (
  public.is_organization_member(id, (select auth.uid()))
);
drop policy if exists organizations_admin_update on public.organizations;
create policy organizations_admin_update on public.organizations for update to authenticated using (
  public.is_organization_admin(id, (select auth.uid()))
);

drop policy if exists organization_members_member_read on public.organization_members;
create policy organization_members_member_read on public.organization_members for select to authenticated using (
  public.is_organization_member(organization_id, (select auth.uid()))
);

drop policy if exists subscriptions_member_read on public.subscriptions;
create policy subscriptions_member_read on public.subscriptions for select to authenticated using (
  public.is_organization_member(organization_id, (select auth.uid()))
);

create policy assets_select_own on public.assets for select to authenticated using (user_id = (select auth.uid()));
create policy assets_insert_own on public.assets for insert to authenticated with check (user_id = (select auth.uid()));
create policy assets_update_own on public.assets for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy assets_delete_own on public.assets for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists ai_usage_read_own on public.ai_usage_log;
create policy ai_usage_read_own on public.ai_usage_log for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists credit_ledger_read_own on public.credit_ledger;
create policy credit_ledger_read_own on public.credit_ledger for select to authenticated using (user_id = (select auth.uid()));

revoke all on table public.plan_catalog, public.organizations, public.profiles,
  public.organization_members, public.subscriptions, public.assets,
  public.ai_usage_log, public.credit_ledger, public.rate_limit_windows,
  public.scrape_cache, public.stripe_webhook_events from anon;
grant select on table public.plan_catalog to authenticated;
grant select, update on table public.organizations, public.profiles to authenticated;
grant select on table public.organization_members, public.subscriptions,
  public.ai_usage_log, public.credit_ledger to authenticated;
grant select, insert, update, delete on table public.assets to authenticated;

-- Private, user-scoped campaign media.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'campaign-assets', 'campaign-assets', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare v_policy record;
begin
  for v_policy in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%campaign-assets%'
        or coalesce(with_check, '') ilike '%campaign-assets%')
  loop
    execute format('drop policy if exists %I on storage.objects', v_policy.policyname);
  end loop;
end $$;

-- Remove only the two known policies from the legacy BrieFlow deployment.
-- The generic safety check below still blocks any other permissive policy.
drop policy if exists "Permitir leitura pública 8vmd40_0" on storage.objects;
drop policy if exists "Permitir upload de usuários logados 8vmd40_0" on storage.objects;

-- A generic permissive storage policy would be OR'ed with the bucket policies
-- below and silently defeat isolation. Fail deployment instead of accepting it.
do $$
declare v_policy record;
begin
  for v_policy in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and ('authenticated' = any(roles) or 'public' = any(roles))
      and (
        regexp_replace(coalesce(qual, ''), '[[:space:]()]', '', 'g') = 'true'
        or regexp_replace(coalesce(with_check, ''), '[[:space:]()]', '', 'g') = 'true'
      )
  loop
    raise exception using errcode = '42501',
      message = format('unsafe_storage_policy:%s', v_policy.policyname);
  end loop;
end $$;

drop policy if exists campaign_assets_select_own on storage.objects;
drop policy if exists campaign_assets_select_legacy_reference on storage.objects;
drop policy if exists campaign_assets_insert_own on storage.objects;
drop policy if exists campaign_assets_update_own on storage.objects;
drop policy if exists campaign_assets_delete_own on storage.objects;

-- Preserve legacy authenticated uploads. Files without owner metadata are
-- assigned only when exactly one historical user references the object.
with legacy_owners as (
  select o.id, min(a.user_id::text) as owner_id
  from storage.objects o
  join public.assets a on position(o.name in a.content::text) > 0
  where o.bucket_id = 'campaign-assets'
    and o.owner_id is null
    and (storage.foldername(o.name))[1] is distinct from a.user_id::text
  group by o.id
  having count(distinct a.user_id) = 1
)
update storage.objects o
set owner_id = legacy_owners.owner_id
from legacy_owners
where o.id = legacy_owners.id;

create policy campaign_assets_select_own on storage.objects for select to authenticated
using (bucket_id = 'campaign-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Backward compatibility for files uploaded before user-prefixed paths existed.
-- A legacy object is readable only by the authenticated owner recorded by Storage.
create policy campaign_assets_select_legacy_reference on storage.objects for select to authenticated
using (
  bucket_id = 'campaign-assets'
  and (storage.foldername(name))[1] is distinct from (select auth.uid())::text
  and owner_id = (select auth.uid())::text
);
create policy campaign_assets_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'campaign-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy campaign_assets_update_own on storage.objects for update to authenticated
using (bucket_id = 'campaign-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'campaign-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy campaign_assets_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'campaign-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Trigger functions do not need to be callable through the Data API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prepare_asset() from public, anon, authenticated;
revoke all on function public.enforce_organization_member_limit() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Lock down helpers left by the legacy schema without making fresh installs fail.
do $legacy_helpers$
begin
  if to_regprocedure('public.deduct_user_credit(integer)') is not null then
    execute 'revoke all on function public.deduct_user_credit(integer) from public, anon, authenticated';
    execute 'alter function public.deduct_user_credit(integer) set search_path = public, auth, pg_temp';
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $legacy_helpers$;

revoke all on function public.provision_user_account(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.authorize_generation(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.refund_generation(uuid, text, text) from public, anon, authenticated;
revoke all on function public.check_rate_limit(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.claim_stripe_webhook(text, text) from public, anon, authenticated;
revoke all on function public.sync_stripe_subscription(uuid, text, text, timestamptz, timestamptz, text, text, text, boolean, bigint, boolean) from public, anon, authenticated;
revoke all on function public.get_user_plan() from public, anon;
revoke all on function public.protect_organization_identity() from public, anon, authenticated;
revoke all on function public.is_organization_member(uuid, uuid) from public, anon;
revoke all on function public.is_organization_admin(uuid, uuid) from public, anon;
grant execute on function public.provision_user_account(uuid, text, jsonb) to service_role;
grant execute on function public.authorize_generation(uuid, text, text, jsonb) to service_role;
grant execute on function public.refund_generation(uuid, text, text) to service_role;
grant execute on function public.check_rate_limit(uuid, text, integer) to service_role;
grant execute on function public.claim_stripe_webhook(text, text) to service_role;
grant execute on function public.sync_stripe_subscription(uuid, text, text, timestamptz, timestamptz, text, text, text, boolean, bigint, boolean) to service_role;
grant execute on function public.get_user_plan() to authenticated;
grant execute on function public.is_organization_member(uuid, uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid, uuid) to authenticated;

commit;
