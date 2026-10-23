from pathlib import Path

ROOT = Path('.')

migration = r'''create table if not exists public.asset_experiment_runs (
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
'''

history_lib = r'''import { supabase } from "@/lib/supabase";

export type ExperimentRunStatus = "running" | "completed";

export interface AssetExperimentRun {
  experiment_group_id: string;
  user_id: string;
  status: ExperimentRunStatus;
  traffic_a_percent: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetExperimentMetricSnapshot {
  id: string;
  experiment_group_id: string;
  asset_id: string;
  user_id: string;
  captured_on: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  source: "manual" | "integration";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExperimentHistoryData {
  run: AssetExperimentRun;
  snapshots: AssetExperimentMetricSnapshot[];
}

const RUN_COLUMNS =
  "experiment_group_id,user_id,status,traffic_a_percent,started_at,ended_at,created_at,updated_at";
const SNAPSHOT_COLUMNS =
  "id,experiment_group_id,asset_id,user_id,captured_on,impressions,clicks,conversions,revenue,source,notes,created_at,updated_at";
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function normalizeId(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error("Grupo de experimento inválido.");
  }
  return normalized;
}

async function requireExperimentUserId(): Promise<string> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }
  return user.id;
}

function normalizeRun(row: Record<string, unknown>): AssetExperimentRun {
  return {
    experiment_group_id: String(row.experiment_group_id),
    user_id: String(row.user_id),
    status: row.status === "completed" ? "completed" : "running",
    traffic_a_percent: Number(row.traffic_a_percent ?? 50),
    started_at: String(row.started_at),
    ended_at: typeof row.ended_at === "string" ? row.ended_at : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function normalizeSnapshot(
  row: Record<string, unknown>,
): AssetExperimentMetricSnapshot {
  return {
    id: String(row.id),
    experiment_group_id: String(row.experiment_group_id),
    asset_id: String(row.asset_id),
    user_id: String(row.user_id),
    captured_on: String(row.captured_on),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    conversions: Number(row.conversions ?? 0),
    revenue: Number(row.revenue ?? 0),
    source: row.source === "integration" ? "integration" : "manual",
    notes: typeof row.notes === "string" ? row.notes : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function ensureExperimentRun(
  experimentGroupId: string,
  userId: string,
): Promise<AssetExperimentRun> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data: existing, error: existingError } = await supabase
    .from("asset_experiment_runs")
    .select(RUN_COLUMNS)
    .eq("experiment_group_id", experimentGroupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return normalizeRun(existing as Record<string, unknown>);

  const { data: inserted, error: insertError } = await supabase
    .from("asset_experiment_runs")
    .insert({
      experiment_group_id: experimentGroupId,
      user_id: userId,
      status: "running",
      traffic_a_percent: 50,
    })
    .select(RUN_COLUMNS)
    .single();

  if (!insertError && inserted) {
    return normalizeRun(inserted as Record<string, unknown>);
  }
  if (insertError?.code !== "23505") throw insertError;

  const { data: concurrent, error: concurrentError } = await supabase
    .from("asset_experiment_runs")
    .select(RUN_COLUMNS)
    .eq("experiment_group_id", experimentGroupId)
    .eq("user_id", userId)
    .single();
  if (concurrentError) throw concurrentError;
  return normalizeRun(concurrent as Record<string, unknown>);
}

export async function getExperimentHistory(
  experimentGroupId: string,
): Promise<ExperimentHistoryData> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const userId = await requireExperimentUserId();
  const groupId = normalizeId(experimentGroupId);
  const run = await ensureExperimentRun(groupId, userId);

  const { data, error } = await supabase
    .from("asset_experiment_metric_snapshots")
    .select(SNAPSHOT_COLUMNS)
    .eq("experiment_group_id", groupId)
    .eq("user_id", userId)
    .order("captured_on", { ascending: true })
    .order("asset_id", { ascending: true });
  if (error) throw error;

  return {
    run,
    snapshots: (data ?? []).map((row) =>
      normalizeSnapshot(row as Record<string, unknown>),
    ),
  };
}

export async function saveExperimentTrafficSplit(
  experimentGroupId: string,
  trafficAPercent: number,
): Promise<AssetExperimentRun> {
  if (!supabase) throw new Error("Supabase não configurado.");
  if (
    !Number.isInteger(trafficAPercent) ||
    trafficAPercent < 1 ||
    trafficAPercent > 99
  ) {
    throw new Error("A divisão de tráfego deve deixar entre 1% e 99% para A.");
  }

  const userId = await requireExperimentUserId();
  const groupId = normalizeId(experimentGroupId);
  await ensureExperimentRun(groupId, userId);

  const { data, error } = await supabase
    .from("asset_experiment_runs")
    .update({ traffic_a_percent: trafficAPercent, updated_at: new Date().toISOString() })
    .eq("experiment_group_id", groupId)
    .eq("user_id", userId)
    .select(RUN_COLUMNS)
    .single();
  if (error) throw error;
  return normalizeRun(data as Record<string, unknown>);
}

export async function setExperimentRunStatus(
  experimentGroupId: string,
  status: ExperimentRunStatus,
): Promise<AssetExperimentRun> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const userId = await requireExperimentUserId();
  const groupId = normalizeId(experimentGroupId);
  await ensureExperimentRun(groupId, userId);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("asset_experiment_runs")
    .update({
      status,
      ended_at: status === "completed" ? now : null,
      updated_at: now,
    })
    .eq("experiment_group_id", groupId)
    .eq("user_id", userId)
    .select(RUN_COLUMNS)
    .single();
  if (error) throw error;
  return normalizeRun(data as Record<string, unknown>);
}
'''

history_component = r'''import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  Loader2,
  PlayCircle,
  Save,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getExperimentHistory,
  saveExperimentTrafficSplit,
  setExperimentRunStatus,
  type AssetExperimentMetricSnapshot,
  type ExperimentHistoryData,
} from "@/lib/experimentHistory";
import type {
  AssetExperimentMetrics,
  SavedLibraryAsset,
} from "@/lib/supabase";

interface ExperimentHistoryPanelProps {
  experimentGroupId: string;
  variants: SavedLibraryAsset[];
  metrics: AssetExperimentMetrics[];
}

interface TrendPoint {
  date: string;
  a: AssetExperimentMetricSnapshot | null;
  b: AssetExperimentMetricSnapshot | null;
}

const percent = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function formatDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

function rate(successes: number, total: number): number {
  return total > 0 ? (successes / total) * 100 : 0;
}

function chartPath(
  points: TrendPoint[],
  pick: (point: TrendPoint) => number | null,
  min: number,
  max: number,
): string {
  const width = 620;
  const top = 14;
  const bottom = 126;
  const span = max - min || 1;
  const coordinates = points
    .map((point, index) => {
      const value = pick(point);
      if (value === null) return null;
      const x =
        points.length <= 1 ? width / 2 : 10 + (index / (points.length - 1)) * 600;
      const y = bottom - ((value - min) / span) * (bottom - top);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter((value): value is string => Boolean(value));
  return coordinates.length ? `M ${coordinates.join(" L ")}` : "";
}

function HistoryChart({
  title,
  description,
  points,
  valueA,
  valueB,
  formatValue,
}: {
  title: string;
  description: string;
  points: TrendPoint[];
  valueA: (snapshot: AssetExperimentMetricSnapshot) => number;
  valueB: (snapshot: AssetExperimentMetricSnapshot) => number;
  formatValue: (value: number) => string;
}) {
  const values = points.flatMap((point) => [
    point.a ? valueA(point.a) : null,
    point.b ? valueB(point.b) : null,
  ]);
  const numericValues = values.filter((value): value is number => value !== null);
  const min = numericValues.length ? Math.min(...numericValues) : 0;
  const max = numericValues.length ? Math.max(...numericValues) : 1;
  const aPath = chartPath(
    points,
    (point) => (point.a ? valueA(point.a) : null),
    min,
    max,
  );
  const bPath = chartPath(
    points,
    (point) => (point.b ? valueB(point.b) : null),
    min,
    max,
  );
  const last = points.at(-1);
  const lastA = last?.a ? valueA(last.a) : null;
  const lastB = last?.b ? valueB(last.b) : null;

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-fg-primary">{title}</div>
          <div className="mt-1 text-[10px] leading-4 text-fg-muted">
            {description}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-fg-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-brand" /> A
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t border-dashed border-fg-secondary" /> B
          </span>
        </div>
      </div>

      {points.length ? (
        <>
          <svg
            className="mt-3 h-36 w-full overflow-visible"
            viewBox="0 0 640 150"
            role="img"
            aria-label={`${title}: evolução das variações A e B`}
          >
            <line
              x1="10"
              x2="610"
              y1="126"
              y2="126"
              className="stroke-border-strong"
            />
            {aPath ? (
              <path
                d={aPath}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-brand"
              />
            ) : null}
            {bPath ? (
              <path
                d={bPath}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="7 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-fg-secondary"
              />
            ) : null}
          </svg>
          <div className="mt-1 flex items-center justify-between text-[10px] text-fg-muted">
            <span>{formatDate(points[0].date)}</span>
            <span>{formatDate(points.at(-1)?.date ?? points[0].date)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-surface-2 px-3 py-2">
              <span className="text-fg-muted">A atual</span>
              <div className="mt-0.5 font-semibold tabular-nums text-fg-primary">
                {lastA === null ? "—" : formatValue(lastA)}
              </div>
            </div>
            <div className="rounded-xl bg-surface-2 px-3 py-2">
              <span className="text-fg-muted">B atual</span>
              <div className="mt-0.5 font-semibold tabular-nums text-fg-primary">
                {lastB === null ? "—" : formatValue(lastB)}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border-strong p-4 text-xs leading-5 text-fg-muted">
          O histórico começa quando as métricas do experimento são salvas. O
          BrieFlow mantém um snapshot cumulativo por dia e por variação.
        </div>
      )}
    </div>
  );
}

export function ExperimentHistoryPanel({
  experimentGroupId,
  variants,
  metrics,
}: ExperimentHistoryPanelProps) {
  const [history, setHistory] = useState<ExperimentHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTraffic, setSavingTraffic] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [trafficDraft, setTrafficDraft] = useState(50);

  const metricRevision = useMemo(
    () =>
      metrics
        .map((metric) => `${metric.asset_id}:${metric.updated_at}`)
        .sort()
        .join("|"),
    [metrics],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getExperimentHistory(experimentGroupId)
      .then((result) => {
        if (cancelled) return;
        setHistory(result);
        setTrafficDraft(result.run.traffic_a_percent);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error("Não foi possível carregar o histórico A/B", {
          description: error instanceof Error ? error.message : undefined,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [experimentGroupId, metricRevision]);

  const variantsByLabel = useMemo(
    () => new Map(variants.map((variant) => [variant.variant_label, variant])),
    [variants],
  );
  const a = variantsByLabel.get("A");
  const b = variantsByLabel.get("B");
  const metricsByAsset = useMemo(
    () => new Map(metrics.map((metric) => [metric.asset_id, metric])),
    [metrics],
  );
  const aMetric = a ? metricsByAsset.get(a.id) : undefined;
  const bMetric = b ? metricsByAsset.get(b.id) : undefined;
  const totalImpressions =
    (aMetric?.impressions ?? 0) + (bMetric?.impressions ?? 0);
  const observedA =
    totalImpressions > 0
      ? ((aMetric?.impressions ?? 0) / totalImpressions) * 100
      : null;

  const trendPoints = useMemo<TrendPoint[]>(() => {
    if (!history || !a || !b) return [];
    const byDate = new Map<string, TrendPoint>();
    for (const snapshot of history.snapshots) {
      const point = byDate.get(snapshot.captured_on) ?? {
        date: snapshot.captured_on,
        a: null,
        b: null,
      };
      if (snapshot.asset_id === a.id) point.a = snapshot;
      if (snapshot.asset_id === b.id) point.b = snapshot;
      byDate.set(snapshot.captured_on, point);
    }
    return [...byDate.values()]
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(-45);
  }, [a, b, history]);

  const saveTraffic = async () => {
    setSavingTraffic(true);
    try {
      const run = await saveExperimentTrafficSplit(
        experimentGroupId,
        trafficDraft,
      );
      setHistory((current) => (current ? { ...current, run } : current));
      toast.success("Divisão de tráfego salva");
    } catch (error) {
      toast.error("Não foi possível salvar o tráfego", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingTraffic(false);
    }
  };

  const toggleStatus = async () => {
    if (!history) return;
    setChangingStatus(true);
    try {
      const status = history.run.status === "running" ? "completed" : "running";
      const run = await setExperimentRunStatus(experimentGroupId, status);
      setHistory((current) => (current ? { ...current, run } : current));
      toast.success(
        status === "completed" ? "Experimento encerrado" : "Experimento reaberto",
      );
    } catch (error) {
      toast.error("Não foi possível alterar o experimento", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setChangingStatus(false);
    }
  };

  if (!a || !b) return null;

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-2/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-brand/20 bg-brand-muted text-brand">
            <TrendingUp className="size-4" />
          </span>
          <div>
            <h6 className="text-xs font-semibold text-fg-primary">
              Histórico do experimento
            </h6>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-tertiary">
              Snapshots cumulativos diários mostram como CTR, conversão e
              receita evoluem sem apagar os resultados anteriores.
            </p>
          </div>
        </div>
        {history ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              history.run.status === "running"
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : "border-border-strong bg-surface-1 text-fg-tertiary"
            }`}
          >
            {history.run.status === "running" ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <Flag className="size-3" />
            )}
            {history.run.status === "running" ? "Em andamento" : "Encerrado"}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 flex min-h-24 items-center justify-center text-xs text-fg-muted">
          <Loader2 className="mr-2 size-4 animate-spin" /> Carregando histórico…
        </div>
      ) : history ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-fg-primary">
                    Divisão planejada de tráfego
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-fg-muted">
                    Registre a distribuição usada na plataforma de mídia. O
                    BrieFlow compara o planejado com as impressões observadas.
                  </p>
                </div>
                <div className="rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold tabular-nums text-fg-primary">
                  A {trafficDraft}% · B {100 - trafficDraft}%
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                value={trafficDraft}
                aria-label="Percentual de tráfego destinado à variação A"
                onChange={(event) => setTrafficDraft(Number(event.target.value))}
                className="mt-4 w-full accent-current"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[10px] leading-4 text-fg-muted">
                  Observado:{" "}
                  {observedA === null
                    ? "sem impressões suficientes"
                    : `A ${percent.format(observedA)}% · B ${percent.format(100 - observedA)}%`}
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    savingTraffic ||
                    trafficDraft === history.run.traffic_a_percent
                  }
                  onClick={() => void saveTraffic()}
                  className="min-h-11 rounded-xl bg-brand px-4 text-xs font-semibold text-brand-fg hover:brightness-110"
                >
                  {savingTraffic ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 size-4" />
                  )}
                  Salvar divisão
                </Button>
              </div>
              {observedA !== null &&
              Math.abs(observedA - history.run.traffic_a_percent) >= 10 ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-[11px] leading-5 text-amber-100">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  As impressões observadas estão mais de 10 p.p. distantes da
                  divisão planejada. Verifique entrega, segmentação ou
                  configuração do experimento antes de interpretar a vencedora.
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
              <div className="text-xs font-semibold text-fg-primary">
                Janela do teste
              </div>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Início</dt>
                  <dd className="font-medium text-fg-primary">
                    {formatDateTime(history.run.started_at)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Fim</dt>
                  <dd className="font-medium text-fg-primary">
                    {formatDateTime(history.run.ended_at)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Snapshots</dt>
                  <dd className="font-medium tabular-nums text-fg-primary">
                    {history.snapshots.length}
                  </dd>
                </div>
              </dl>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={changingStatus}
                onClick={() => void toggleStatus()}
                className="mt-4 min-h-11 w-full rounded-xl border-border-strong bg-surface-2 text-xs text-fg-secondary hover:bg-surface-3 hover:text-fg-primary"
              >
                {changingStatus ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : history.run.status === "running" ? (
                  <Flag className="mr-1.5 size-4" />
                ) : (
                  <PlayCircle className="mr-1.5 size-4" />
                )}
                {history.run.status === "running"
                  ? "Encerrar experimento"
                  : "Reabrir experimento"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <HistoryChart
              title="CTR"
              description="Cliques ÷ impressões, acumulado até cada data."
              points={trendPoints}
              valueA={(snapshot) => rate(snapshot.clicks, snapshot.impressions)}
              valueB={(snapshot) => rate(snapshot.clicks, snapshot.impressions)}
              formatValue={(value) => `${percent.format(value)}%`}
            />
            <HistoryChart
              title="Conversão / impressão"
              description="Conversões ÷ impressões, a métrica principal do teste."
              points={trendPoints}
              valueA={(snapshot) =>
                rate(snapshot.conversions, snapshot.impressions)
              }
              valueB={(snapshot) =>
                rate(snapshot.conversions, snapshot.impressions)
              }
              formatValue={(value) => `${percent.format(value)}%`}
            />
            <HistoryChart
              title="Receita acumulada"
              description="Receita registrada em cada variação ao longo do teste."
              points={trendPoints}
              valueA={(snapshot) => snapshot.revenue}
              valueB={(snapshot) => snapshot.revenue}
              formatValue={(value) => currency.format(value)}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
'''

test_file = r'''import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261023155648_add_experiment_history_and_traffic_control.sql",
    import.meta.url,
  ),
  "utf8",
);
const historyLib = readFileSync(
  new URL("../src/lib/experimentHistory.ts", import.meta.url),
  "utf8",
);
const historyPanel = readFileSync(
  new URL(
    "../src/components/briefflow/ExperimentHistoryPanel.tsx",
    import.meta.url,
  ),
  "utf8",
);
const evidencePanel = readFileSync(
  new URL(
    "../src/components/briefflow/ExperimentEvidencePanel.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("experiment history migration protects snapshots and traffic settings with RLS", () => {
  assert.match(migration, /create table if not exists public\.asset_experiment_runs/);
  assert.match(
    migration,
    /create table if not exists public\.asset_experiment_metric_snapshots/,
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /asset_experiment_metric_snapshots_insert_own/);
  assert.match(migration, /capture_asset_experiment_metric_snapshot_trigger/);
  assert.match(
    migration,
    /revoke all on function public\.capture_asset_experiment_metric_snapshot\(\) from authenticated/,
  );
});

test("history queries stay scoped to the authenticated user and experiment", () => {
  assert.match(historyLib, /\.eq\("experiment_group_id", groupId\)/);
  assert.match(historyLib, /\.eq\("user_id", userId\)/);
  assert.match(historyLib, /trafficAPercent < 1/);
  assert.match(historyLib, /trafficAPercent > 99/);
});

test("history UI exposes traffic split, lifecycle and three trend views", () => {
  assert.match(historyPanel, /Divisão planejada de tráfego/);
  assert.match(historyPanel, /Encerrar experimento/);
  assert.match(historyPanel, /title="CTR"/);
  assert.match(historyPanel, /title="Conversão \/ impressão"/);
  assert.match(historyPanel, /title="Receita acumulada"/);
  assert.match(historyPanel, /mais de 10 p\.p\./);
});

test("statistical evidence panel includes experiment history", () => {
  assert.match(evidencePanel, /ExperimentHistoryPanel/);
  assert.match(evidencePanel, /experimentGroupId=\{a\.experiment_group_id\}/);
  assert.match(evidencePanel, /metrics=\{metrics\}/);
});
'''

migration_path = ROOT / 'supabase/migrations/20261023155648_add_experiment_history_and_traffic_control.sql'
migration_path.write_text(migration, encoding='utf-8')
(ROOT / 'src/lib/experimentHistory.ts').write_text(history_lib, encoding='utf-8')
(ROOT / 'src/components/briefflow/ExperimentHistoryPanel.tsx').write_text(history_component, encoding='utf-8')
(ROOT / 'tests/experiment-history.test.mjs').write_text(test_file, encoding='utf-8')

evidence_path = ROOT / 'src/components/briefflow/ExperimentEvidencePanel.tsx'
evidence = evidence_path.read_text(encoding='utf-8')
import_anchor = 'import { Button } from "@/components/ui/button";\n'
if 'ExperimentHistoryPanel' not in evidence:
    if import_anchor not in evidence:
        raise SystemExit('ExperimentEvidencePanel import anchor not found')
    evidence = evidence.replace(
        import_anchor,
        import_anchor + 'import { ExperimentHistoryPanel } from "./ExperimentHistoryPanel";\n',
        1,
    )

tail_anchor = '''      </section>\n    </div>\n  );\n}'''
history_markup = '''      </section>\n\n      {a?.experiment_group_id ? (\n        <ExperimentHistoryPanel\n          experimentGroupId={a.experiment_group_id}\n          variants={variants}\n          metrics={metrics}\n        />\n      ) : null}\n    </div>\n  );\n}'''
if 'experimentGroupId={a.experiment_group_id}' not in evidence:
    if tail_anchor not in evidence:
        raise SystemExit('ExperimentEvidencePanel tail anchor not found')
    evidence = evidence.replace(tail_anchor, history_markup, 1)

evidence_path.write_text(evidence, encoding='utf-8')
