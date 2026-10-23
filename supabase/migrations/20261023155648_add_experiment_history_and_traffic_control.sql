create table if not exists public.asset_experiment_runs (
  experiment_group_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed')),
  traffic_a_percent smallint not null default 50 check (traffic_a_percent between 1 and 99),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists asset_experiment_runs_user_updated_idx
  on public.asset_experiment_runs (user_id, updated_at desc);

alter table public.asset_experiment_runs enable row level security;

create policy asset_experiment_runs_select_own
  on public.asset_experiment_runs
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy asset_experiment_runs_insert_own
  on public.asset_experiment_runs
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.user_id = (select auth.uid())
        and a.experiment_group_id = asset_experiment_runs.experiment_group_id
        and a.variant_label in ('A', 'B')
    )
  );

create policy asset_experiment_runs_update_own
  on public.asset_experiment_runs
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.user_id = (select auth.uid())
        and a.experiment_group_id = asset_experiment_runs.experiment_group_id
        and a.variant_label in ('A', 'B')
    )
  );

create policy asset_experiment_runs_delete_own
  on public.asset_experiment_runs
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.asset_experiment_runs from anon;
grant select, insert, update, delete on table public.asset_experiment_runs to authenticated;

create table if not exists public.asset_experiment_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  experiment_group_id uuid not null,
  asset_id uuid not null references public.assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  captured_on date not null,
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  conversions bigint not null default 0 check (conversions >= 0),
  revenue numeric(14,2) not null default 0 check (revenue >= 0),
  source text not null default 'manual' check (source in ('manual', 'integration')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, captured_on)
);

create index if not exists asset_experiment_metric_snapshots_group_date_idx
  on public.asset_experiment_metric_snapshots (experiment_group_id, captured_on asc, asset_id);
create index if not exists asset_experiment_metric_snapshots_user_date_idx
  on public.asset_experiment_metric_snapshots (user_id, captured_on desc);

alter table public.asset_experiment_metric_snapshots enable row level security;

create policy asset_experiment_metric_snapshots_select_own
  on public.asset_experiment_metric_snapshots
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = asset_id
        and a.user_id = (select auth.uid())
        and a.experiment_group_id = asset_experiment_metric_snapshots.experiment_group_id
        and a.variant_label in ('A', 'B')
    )
  );

create policy asset_experiment_metric_snapshots_insert_own
  on public.asset_experiment_metric_snapshots
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = asset_id
        and a.user_id = (select auth.uid())
        and a.experiment_group_id = asset_experiment_metric_snapshots.experiment_group_id
        and a.variant_label in ('A', 'B')
    )
  );

create policy asset_experiment_metric_snapshots_update_own
  on public.asset_experiment_metric_snapshots
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = asset_id
        and a.user_id = (select auth.uid())
        and a.experiment_group_id = asset_experiment_metric_snapshots.experiment_group_id
        and a.variant_label in ('A', 'B')
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = asset_id
        and a.user_id = (select auth.uid())
        and a.experiment_group_id = asset_experiment_metric_snapshots.experiment_group_id
        and a.variant_label in ('A', 'B')
    )
  );

create policy asset_experiment_metric_snapshots_delete_own
  on public.asset_experiment_metric_snapshots
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.asset_experiment_metric_snapshots from anon;
grant select, insert, update, delete on table public.asset_experiment_metric_snapshots to authenticated;

create or replace function public.capture_asset_experiment_metric_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_experiment_group_id uuid;
begin
  select a.experiment_group_id
    into v_experiment_group_id
  from public.assets a
  where a.id = new.asset_id
    and a.user_id = new.user_id
    and a.variant_label in ('A', 'B');

  if v_experiment_group_id is null then
    return new;
  end if;

  insert into public.asset_experiment_metric_snapshots (
    experiment_group_id,
    asset_id,
    user_id,
    captured_on,
    impressions,
    clicks,
    conversions,
    revenue,
    source,
    notes,
    updated_at
  ) values (
    v_experiment_group_id,
    new.asset_id,
    new.user_id,
    current_date,
    new.impressions,
    new.clicks,
    new.conversions,
    new.revenue,
    new.source,
    new.notes,
    now()
  )
  on conflict (asset_id, captured_on) do update set
    experiment_group_id = excluded.experiment_group_id,
    user_id = excluded.user_id,
    impressions = excluded.impressions,
    clicks = excluded.clicks,
    conversions = excluded.conversions,
    revenue = excluded.revenue,
    source = excluded.source,
    notes = excluded.notes,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.capture_asset_experiment_metric_snapshot() from public;
revoke all on function public.capture_asset_experiment_metric_snapshot() from anon;
revoke all on function public.capture_asset_experiment_metric_snapshot() from authenticated;

drop trigger if exists capture_asset_experiment_metric_snapshot_trigger
  on public.asset_experiment_metrics;
create trigger capture_asset_experiment_metric_snapshot_trigger
  after insert or update of impressions, clicks, conversions, revenue, source, notes
  on public.asset_experiment_metrics
  for each row
  execute function public.capture_asset_experiment_metric_snapshot();

insert into public.asset_experiment_runs (
  experiment_group_id,
  user_id,
  status,
  traffic_a_percent,
  started_at,
  updated_at
)
select
  a.experiment_group_id,
  a.user_id,
  'running',
  50,
  min(a.created_at),
  now()
from public.assets a
where a.experiment_group_id is not null
  and a.variant_label in ('A', 'B')
group by a.experiment_group_id, a.user_id
on conflict (experiment_group_id) do nothing;

insert into public.asset_experiment_metric_snapshots (
  experiment_group_id,
  asset_id,
  user_id,
  captured_on,
  impressions,
  clicks,
  conversions,
  revenue,
  source,
  notes,
  created_at,
  updated_at
)
select
  a.experiment_group_id,
  m.asset_id,
  m.user_id,
  m.updated_at::date,
  m.impressions,
  m.clicks,
  m.conversions,
  m.revenue,
  m.source,
  m.notes,
  m.created_at,
  m.updated_at
from public.asset_experiment_metrics m
join public.assets a on a.id = m.asset_id
where a.experiment_group_id is not null
  and a.variant_label in ('A', 'B')
on conflict (asset_id, captured_on) do nothing;
