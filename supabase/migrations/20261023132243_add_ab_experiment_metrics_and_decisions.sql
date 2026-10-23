create table if not exists public.asset_experiment_metrics (
  asset_id uuid primary key references public.assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  conversions bigint not null default 0 check (conversions >= 0),
  revenue numeric(14,2) not null default 0 check (revenue >= 0),
  source text not null default 'manual' check (source in ('manual', 'integration')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists asset_experiment_metrics_user_updated_idx
  on public.asset_experiment_metrics (user_id, updated_at desc);

alter table public.asset_experiment_metrics enable row level security;

create policy asset_experiment_metrics_select_own
  on public.asset_experiment_metrics
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = asset_id and a.user_id = (select auth.uid())
    )
  );

create policy asset_experiment_metrics_insert_own
  on public.asset_experiment_metrics
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = asset_id and a.user_id = (select auth.uid())
    )
  );

create policy asset_experiment_metrics_update_own
  on public.asset_experiment_metrics
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = asset_id and a.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = asset_id and a.user_id = (select auth.uid())
    )
  );

create policy asset_experiment_metrics_delete_own
  on public.asset_experiment_metrics
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = asset_id and a.user_id = (select auth.uid())
    )
  );

revoke all on table public.asset_experiment_metrics from anon;
grant select, insert, update, delete on table public.asset_experiment_metrics to authenticated;

create table if not exists public.asset_experiment_decisions (
  experiment_group_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  winner_asset_id uuid not null references public.assets(id) on delete cascade,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists asset_experiment_decisions_winner_idx
  on public.asset_experiment_decisions (winner_asset_id);
create index if not exists asset_experiment_decisions_user_updated_idx
  on public.asset_experiment_decisions (user_id, updated_at desc);

alter table public.asset_experiment_decisions enable row level security;

create policy asset_experiment_decisions_select_own
  on public.asset_experiment_decisions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy asset_experiment_decisions_insert_own
  on public.asset_experiment_decisions
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = winner_asset_id
        and a.user_id = (select auth.uid())
        and a.experiment_group_id = asset_experiment_decisions.experiment_group_id
        and a.variant_label in ('A', 'B')
    )
  );

create policy asset_experiment_decisions_update_own
  on public.asset_experiment_decisions
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.assets a
      where a.id = winner_asset_id
        and a.user_id = (select auth.uid())
        and a.experiment_group_id = asset_experiment_decisions.experiment_group_id
        and a.variant_label in ('A', 'B')
    )
  );

create policy asset_experiment_decisions_delete_own
  on public.asset_experiment_decisions
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.asset_experiment_decisions from anon;
grant select, insert, update, delete on table public.asset_experiment_decisions to authenticated;
