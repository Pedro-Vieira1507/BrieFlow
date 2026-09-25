-- Additive pivot. Historical graphical assets, subscriptions and credits are untouched.
create table public.social_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brief jsonb not null check (jsonb_typeof(brief) = 'object'),
  attachments jsonb not null default '[]' check (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 12),
  version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, user_id, organization_id)
);
create index social_campaigns_owner on public.social_campaigns(user_id, organization_id, updated_at desc, id);
create index social_campaigns_org on public.social_campaigns(organization_id);

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('linkedin','instagram','facebook','x','tiktok','reddit')),
  external_id text not null, label text not null,
  expires_at timestamptz, created_at timestamptz not null default now(),
  unique (user_id, organization_id, channel, external_id), unique (id, user_id, organization_id)
);
create index social_accounts_org on public.social_accounts(organization_id);
-- Separate service-only credential and OAuth tables: no secrets in browser-visible rows.
create table public.social_credentials (
  account_id uuid primary key references public.social_accounts(id) on delete cascade,
  ciphertext text not null, updated_at timestamptz not null default now()
);
create table public.social_oauth_states (
  state_hash text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null, verifier_ciphertext text not null,
  expires_at timestamptz not null default now() + interval '10 minutes'
);
create index social_oauth_expiry on public.social_oauth_states(expires_at);
create index social_oauth_owner on public.social_oauth_states(user_id, organization_id);
create index social_oauth_org on public.social_oauth_states(organization_id);

create table public.social_posts (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null,
  user_id uuid not null, organization_id uuid not null,
  channel text not null check (channel in ('linkedin','instagram','facebook','x','tiktok','reddit')),
  copy jsonb not null check (jsonb_typeof(copy) = 'object'),
  attachment_id uuid, version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','publishing','processing','published','failed','uncertain')),
  remote_id text, remote_url text, provider_job_id text, error text,
  account_id uuid references public.social_accounts(id), published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (campaign_id, channel), unique (id, user_id, organization_id),
  foreign key (campaign_id, user_id, organization_id) references public.social_campaigns(id, user_id, organization_id) on delete cascade,
  foreign key (account_id, user_id, organization_id) references public.social_accounts(id, user_id, organization_id)
);
create index social_posts_owner on public.social_posts(user_id, organization_id);
create index social_posts_org on public.social_posts(organization_id);
create index social_posts_account on public.social_posts(account_id, user_id, organization_id);
create table public.social_publish_attempts (
  id uuid primary key default gen_random_uuid(), post_id uuid not null unique references public.social_posts(id) on delete cascade,
  user_id uuid not null, organization_id uuid not null,
  approved_copy jsonb not null, approved_options jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (post_id, user_id, organization_id) references public.social_posts(id, user_id, organization_id) on delete cascade
);
create index social_attempts_owner on public.social_publish_attempts(user_id, organization_id);
create table public.social_metric_snapshots (
  id uuid primary key default gen_random_uuid(), post_id uuid not null,
  user_id uuid not null, organization_id uuid not null, channel text not null,
  "values" jsonb not null, notes jsonb not null default '[]', fetched_at timestamptz not null default now(),
  foreign key (post_id, user_id, organization_id) references public.social_posts(id, user_id, organization_id) on delete cascade
);
create index social_metrics_post_time on public.social_metric_snapshots(post_id, fetched_at desc);
create index social_metrics_owner on public.social_metric_snapshots(user_id, organization_id, fetched_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['social_campaigns','social_accounts','social_posts','social_publish_attempts','social_metric_snapshots','social_credentials','social_oauth_states'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
    if table_name not in ('social_credentials','social_oauth_states') then
      execute format('grant select on table public.%I to authenticated', table_name);
      execute format('create policy owner_active_member_select on public.%I for select to authenticated using (user_id = (select auth.uid()) and exists (select 1 from public.organization_members m where m.organization_id = %I.organization_id and m.user_id = (select auth.uid()) and m.status = ''active''))', table_name, table_name);
    end if;
  end loop;
end $$;

-- Service-only invoker functions retain transactions without SECURITY DEFINER escalation.
create function public.social_create_campaign(p_user_id uuid, p_brief jsonb)
returns public.social_campaigns language plpgsql security invoker set search_path = '' as $$
declare org uuid; lim integer; row public.social_campaigns;
begin
  select default_organization_id into org from public.profiles where user_id = p_user_id for update;
  if org is null or not exists(select 1 from public.organization_members where user_id=p_user_id and organization_id=org and status='active') then raise exception 'membership_inactive'; end if;
  select p.max_saved_assets into lim from public.plan_catalog p join public.subscriptions s on s.plan_id=p.id where s.organization_id=org and s.status in ('active','trialing');
  if lim is null then raise exception 'subscription_inactive'; end if;
  if (select count(*) from public.social_campaigns where organization_id=org) + (select count(*) from public.assets where organization_id=org) >= lim then raise exception 'campaign_limit'; end if;
  insert into public.social_campaigns(user_id,organization_id,brief) values(p_user_id,org,p_brief) returning * into row;
  return row;
end $$;
revoke all on function public.social_create_campaign(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.social_create_campaign(uuid,jsonb) to service_role;

create function public.social_claim_publish(p_user_id uuid, p_post_id uuid, p_version integer, p_account_id uuid, p_options jsonb)
returns public.social_posts language plpgsql security invoker set search_path = '' as $$
declare row public.social_posts;
begin
  select * into row from public.social_posts where id=p_post_id and user_id=p_user_id for update;
  if row.id is null or p_version is null or row.version <> p_version or row.status <> 'draft' then raise exception 'post_conflict'; end if;
  if not exists(select 1 from public.organization_members where user_id=p_user_id and organization_id=row.organization_id and status='active') then raise exception 'membership_inactive'; end if;
  if not exists(select 1 from public.social_accounts where id=p_account_id and user_id=p_user_id and organization_id=row.organization_id and channel=row.channel and (expires_at is null or expires_at>now())) then raise exception 'account_invalid'; end if;
  if p_options->>'consent' is distinct from 'true' then raise exception 'consent_required'; end if;
  insert into public.social_publish_attempts(post_id,user_id,organization_id,approved_copy,approved_options) values(row.id,p_user_id,row.organization_id,row.copy,p_options);
  update public.social_posts set status='publishing',account_id=p_account_id,version=version+1,updated_at=now() where id=row.id returning * into row;
  return row;
end $$;
revoke all on function public.social_claim_publish(uuid,uuid,integer,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.social_claim_publish(uuid,uuid,integer,uuid,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('social-briefs','social-briefs',false,26214400,array['image/jpeg','image/png','image/webp','video/mp4']);
create policy social_media_read on storage.objects for select to authenticated using (
  bucket_id='social-briefs' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.social_campaigns c where c.id::text=(storage.foldername(name))[2] and c.user_id=(select auth.uid()))
);
create policy social_media_insert on storage.objects for insert to authenticated with check (
  bucket_id='social-briefs' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.social_campaigns c where c.id::text=(storage.foldername(name))[2] and c.user_id=(select auth.uid()))
);
-- No upsert/delete of attached media: approved publications keep an immutable object path.
