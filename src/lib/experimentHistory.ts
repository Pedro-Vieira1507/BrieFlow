import { supabase } from "@/lib/supabase";

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
    .update({
      traffic_a_percent: trafficAPercent,
      updated_at: new Date().toISOString(),
    })
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
