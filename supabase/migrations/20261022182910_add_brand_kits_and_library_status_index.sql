create table if not exists public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  brand_name text,
  persona text not null default 'Público-alvo',
  tone text not null default 'Premium',
  framework text not null default 'AIDA',
  product text,
  offer text,
  website_url text,
  keywords text[] not null default '{}'::text[],
  forbidden_terms text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_kits_user_updated_idx
  on public.brand_kits (user_id, updated_at desc);

create index if not exists assets_user_status_updated_idx
  on public.assets (user_id, status, updated_at desc);

alter table public.brand_kits enable row level security;

revoke all on table public.brand_kits from anon;
grant select, insert, update, delete on table public.brand_kits to authenticated;
grant select, insert, update, delete on table public.brand_kits to service_role;

drop policy if exists brand_kits_select_own on public.brand_kits;
create policy brand_kits_select_own
  on public.brand_kits for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists brand_kits_insert_own on public.brand_kits;
create policy brand_kits_insert_own
  on public.brand_kits for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists brand_kits_update_own on public.brand_kits;
create policy brand_kits_update_own
  on public.brand_kits for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists brand_kits_delete_own on public.brand_kits;
create policy brand_kits_delete_own
  on public.brand_kits for delete
  to authenticated
  using ((select auth.uid()) = user_id);
