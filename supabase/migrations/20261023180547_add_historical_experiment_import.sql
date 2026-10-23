alter table public.asset_experiment_metric_snapshots
  drop constraint if exists asset_experiment_metric_snapshots_source_check;

alter table public.asset_experiment_metric_snapshots
  add constraint asset_experiment_metric_snapshots_source_check
  check (source in ('manual', 'integration', 'csv', 'meta_ads', 'google_ads'));

create or replace function public.capture_asset_experiment_metric_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_experiment_group_id uuid;
begin
  if current_setting('brieflow.skip_experiment_snapshot', true) = 'on' then
    return new;
  end if;

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

create or replace function public.import_asset_experiment_history(
  p_experiment_group_id uuid,
  p_snapshots jsonb,
  p_source text,
  p_notes text default null
)
returns setof public.asset_experiment_metrics
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_snapshot_count integer;
  v_asset_count integer;
  v_group_asset_count integer;
  v_min_date date;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_source not in ('csv', 'meta_ads', 'google_ads') then
    raise exception 'invalid experiment history source';
  end if;

  if p_notes is not null and char_length(p_notes) > 500 then
    raise exception 'experiment import note is too long';
  end if;

  if jsonb_typeof(p_snapshots) is distinct from 'array' then
    raise exception 'snapshots must be a JSON array';
  end if;

  v_snapshot_count := jsonb_array_length(p_snapshots);
  if v_snapshot_count < 2 or v_snapshot_count > 1500 then
    raise exception 'historical import must contain between 2 and 1500 snapshots';
  end if;

  with incoming as (
    select
      (item->>'asset_id')::uuid as asset_id,
      (item->>'captured_on')::date as captured_on
    from jsonb_array_elements(p_snapshots) as payload(item)
  )
  select min(captured_on), count(distinct asset_id)
    into v_min_date, v_asset_count
  from incoming;

  if v_min_date is null then
    raise exception 'historical import has no valid dates';
  end if;

  select count(*)
    into v_group_asset_count
  from public.assets a
  where a.user_id = v_user_id
    and a.experiment_group_id = p_experiment_group_id
    and a.variant_label in ('A', 'B');

  if v_group_asset_count <> 2 or v_asset_count <> 2 then
    raise exception 'historical import requires both A and B variants';
  end if;

  if exists (
    with incoming as (
      select
        (item->>'asset_id')::uuid as asset_id,
        (item->>'captured_on')::date as captured_on,
        (item->>'impressions')::bigint as impressions,
        (item->>'clicks')::bigint as clicks,
        (item->>'conversions')::bigint as conversions,
        (item->>'revenue')::numeric(14,2) as revenue
      from jsonb_array_elements(p_snapshots) as payload(item)
    )
    select 1
    from incoming i
    left join public.assets a on a.id = i.asset_id
    where a.id is null
      or a.user_id <> v_user_id
      or a.experiment_group_id is distinct from p_experiment_group_id
      or a.variant_label not in ('A', 'B')
      or i.captured_on > current_date
      or i.impressions < 0
      or i.clicks < 0
      or i.conversions < 0
      or i.revenue < 0
  ) then
    raise exception 'historical import contains invalid or unauthorized snapshots';
  end if;

  if exists (
    with incoming as (
      select
        (item->>'asset_id')::uuid as asset_id,
        (item->>'captured_on')::date as captured_on
      from jsonb_array_elements(p_snapshots) as payload(item)
    )
    select 1
    from incoming
    group by asset_id, captured_on
    having count(*) > 1
  ) then
    raise exception 'historical import contains duplicate asset/date snapshots';
  end if;

  if exists (
    with incoming as (
      select
        (item->>'asset_id')::uuid as asset_id,
        (item->>'captured_on')::date as captured_on,
        (item->>'impressions')::bigint as impressions,
        (item->>'clicks')::bigint as clicks,
        (item->>'conversions')::bigint as conversions,
        (item->>'revenue')::numeric(14,2) as revenue
      from jsonb_array_elements(p_snapshots) as payload(item)
    ), ordered as (
      select
        incoming.*,
        lag(impressions) over (partition by asset_id order by captured_on) as previous_impressions,
        lag(clicks) over (partition by asset_id order by captured_on) as previous_clicks,
        lag(conversions) over (partition by asset_id order by captured_on) as previous_conversions,
        lag(revenue) over (partition by asset_id order by captured_on) as previous_revenue
      from incoming
    )
    select 1
    from ordered
    where (previous_impressions is not null and impressions < previous_impressions)
      or (previous_clicks is not null and clicks < previous_clicks)
      or (previous_conversions is not null and conversions < previous_conversions)
      or (previous_revenue is not null and revenue < previous_revenue)
  ) then
    raise exception 'historical snapshots must be cumulative and non-decreasing';
  end if;

  delete from public.asset_experiment_metric_snapshots s
  where s.user_id = v_user_id
    and s.experiment_group_id = p_experiment_group_id;

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
  )
  select
    p_experiment_group_id,
    (item->>'asset_id')::uuid,
    v_user_id,
    (item->>'captured_on')::date,
    (item->>'impressions')::bigint,
    (item->>'clicks')::bigint,
    (item->>'conversions')::bigint,
    (item->>'revenue')::numeric(14,2),
    p_source,
    nullif(left(concat_ws(' · ', nullif(p_notes, ''), nullif(item->>'notes', '')), 500), ''),
    now()
  from jsonb_array_elements(p_snapshots) as payload(item);

  perform set_config('brieflow.skip_experiment_snapshot', 'on', true);

  insert into public.asset_experiment_metrics (
    asset_id,
    user_id,
    impressions,
    clicks,
    conversions,
    revenue,
    source,
    notes,
    updated_at
  )
  select distinct on (asset_id)
    asset_id,
    v_user_id,
    impressions,
    clicks,
    conversions,
    revenue,
    'integration',
    nullif(left(p_notes, 500), ''),
    now()
  from (
    select
      (item->>'asset_id')::uuid as asset_id,
      (item->>'captured_on')::date as captured_on,
      (item->>'impressions')::bigint as impressions,
      (item->>'clicks')::bigint as clicks,
      (item->>'conversions')::bigint as conversions,
      (item->>'revenue')::numeric(14,2) as revenue
    from jsonb_array_elements(p_snapshots) as payload(item)
  ) as incoming
  order by asset_id, captured_on desc
  on conflict (asset_id) do update set
    user_id = excluded.user_id,
    impressions = excluded.impressions,
    clicks = excluded.clicks,
    conversions = excluded.conversions,
    revenue = excluded.revenue,
    source = excluded.source,
    notes = excluded.notes,
    updated_at = excluded.updated_at;

  insert into public.asset_experiment_runs as run (
    experiment_group_id,
    user_id,
    status,
    traffic_a_percent,
    started_at,
    updated_at
  ) values (
    p_experiment_group_id,
    v_user_id,
    'running',
    50,
    v_min_date::timestamptz,
    now()
  )
  on conflict (experiment_group_id) do update set
    started_at = least(run.started_at, excluded.started_at),
    updated_at = now();

  return query
  select m.*
  from public.asset_experiment_metrics m
  join public.assets a on a.id = m.asset_id
  where m.user_id = v_user_id
    and a.experiment_group_id = p_experiment_group_id
    and a.variant_label in ('A', 'B')
  order by a.variant_label;
end;
$$;

revoke all on function public.import_asset_experiment_history(uuid, jsonb, text, text) from public;
revoke all on function public.import_asset_experiment_history(uuid, jsonb, text, text) from anon;
grant execute on function public.import_asset_experiment_history(uuid, jsonb, text, text) to authenticated;
