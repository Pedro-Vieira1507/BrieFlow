alter table public.assets
  add column if not exists experiment_group_id uuid,
  add column if not exists variant_label text;

alter table public.assets
  add constraint assets_variant_label_check
  check (variant_label is null or variant_label in ('A', 'B'));

create index if not exists assets_experiment_group_idx
  on public.assets (user_id, experiment_group_id, variant_label)
  where experiment_group_id is not null;

create unique index if not exists assets_experiment_variant_unique_idx
  on public.assets (user_id, experiment_group_id, variant_label)
  where experiment_group_id is not null and variant_label is not null;

create table if not exists public.asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  user_id uuid not null,
  organization_id uuid not null,
  version_number integer not null check (version_number > 0),
  name text not null,
  type text not null,
  content jsonb not null,
  status text,
  variant_label text,
  created_at timestamptz not null default now(),
  unique (asset_id, version_number)
);

create index if not exists asset_versions_user_asset_idx
  on public.asset_versions (user_id, asset_id, version_number desc);

alter table public.asset_versions enable row level security;

create policy asset_versions_select_own
  on public.asset_versions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.asset_versions from anon;
revoke insert, update, delete on table public.asset_versions from authenticated;
grant select on table public.asset_versions to authenticated;

create or replace function public.snapshot_asset_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version integer;
begin
  if tg_op = 'UPDATE' and new.content is not distinct from old.content then
    return new;
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_version
  from public.asset_versions
  where asset_id = new.id;

  insert into public.asset_versions (
    asset_id,
    user_id,
    organization_id,
    version_number,
    name,
    type,
    content,
    status,
    variant_label
  ) values (
    new.id,
    new.user_id,
    new.organization_id,
    v_next_version,
    new.name,
    new.type,
    new.content,
    new.status,
    new.variant_label
  );

  return new;
end;
$$;

drop trigger if exists assets_snapshot_content on public.assets;
create trigger assets_snapshot_content
after insert or update of content on public.assets
for each row execute function public.snapshot_asset_version();

insert into public.asset_versions (
  asset_id,
  user_id,
  organization_id,
  version_number,
  name,
  type,
  content,
  status,
  variant_label
)
select
  a.id,
  a.user_id,
  a.organization_id,
  1,
  a.name,
  a.type,
  a.content,
  a.status,
  a.variant_label
from public.assets a
where a.user_id is not null
  and not exists (
    select 1 from public.asset_versions v where v.asset_id = a.id
  );
