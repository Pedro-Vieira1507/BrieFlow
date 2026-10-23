import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import type { BuilderState } from "@/types/builder";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type LibraryAssetStatus = "draft" | "review" | "approved";

export interface SavedLibraryAsset {
  id: string;
  user_id: string;
  organization_id?: string | null;
  name: string;
  type: string;
  content: BuilderState;
  status: LibraryAssetStatus;
  experiment_group_id?: string | null;
  variant_label?: "A" | "B" | null;
  created_at: string;
  updated_at?: string;
}

export interface SavedAssetsCursor {
  createdAt: string;
  id: string;
}

export interface SavedAssetsPage {
  items: SavedLibraryAsset[];
  nextCursor: SavedAssetsCursor | null;
}

export interface AssetVersion {
  id: string;
  asset_id: string;
  user_id: string;
  version_number: number;
  name: string;
  type: string;
  content: BuilderState;
  status: LibraryAssetStatus | null;
  variant_label: "A" | "B" | null;
  created_at: string;
}

export interface SavedAssetVariantResult {
  source: SavedLibraryAsset;
  variant: SavedLibraryAsset;
}

export interface AssetExperimentMetrics {
  asset_id: string;
  user_id: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  source: "manual" | "integration";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetExperimentMetricsInput {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  notes?: string;
}

export interface AssetExperimentDecision {
  experiment_group_id: string;
  user_id: string;
  winner_asset_id: string;
  decision_note: string | null;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

export interface AssetExperimentData {
  variants: SavedLibraryAsset[];
  metrics: AssetExperimentMetrics[];
  decision: AssetExperimentDecision | null;
}

export interface BrandKit {
  id: string;
  user_id: string;
  name: string;
  brand_name: string | null;
  persona: string;
  tone: string;
  framework: string;
  product: string | null;
  offer: string | null;
  website_url: string | null;
  keywords: string[];
  forbidden_terms: string[];
  created_at: string;
  updated_at: string;
}

export interface BrandKitInput {
  name: string;
  brandName?: string;
  persona: string;
  tone: string;
  framework: string;
  product?: string;
  offer?: string;
  websiteUrl?: string;
  keywords?: string[];
  forbiddenTerms?: string[];
}

export class EdgeFunctionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "EdgeFunctionError";
  }
}

async function requireUser(): Promise<User> {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }
  return user;
}

export async function getAuthToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

type EdgeFunctionName =
  "ai-proxy" | "scrape-proxy" | "image-search" | "product-segment" | "billing";

export async function invokeEdgeFunction<T>(
  name: EdgeFunctionName,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new EdgeFunctionError(
      "Backend do BrieFlow não configurado.",
      503,
      "backend_not_configured",
    );
  }

  const token = await getAuthToken();
  if (!token) {
    throw new EdgeFunctionError(
      "Entre na sua conta para continuar.",
      401,
      "unauthorized",
    );
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
      "X-Client-Info": "brieflow-web/3",
    },
    body: JSON.stringify(body),
    signal,
  });

  const raw = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    payload = { error: "invalid_server_response" };
  }

  if (!response.ok) {
    const code = String(payload.error ?? "edge_function_failed");
    throw new EdgeFunctionError(
      String(payload.message ?? code),
      response.status,
      code,
      payload,
    );
  }

  return payload as T;
}

function normalizeLibraryLabel(name: string): string {
  return (
    Array.from(name)
      .map((character) => (character.charCodeAt(0) < 32 ? " " : character))
      .join("")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "Campanha sem nome"
  );
}

function normalizeAssetName(name: string, state: BuilderState): string {
  const requested = state.brandName ? `Campanha ${state.brandName}` : name;
  return normalizeLibraryLabel(requested);
}

export async function saveAssetToLibrary(
  name: string,
  state: BuilderState,
  existingAssetId?: string | null,
  expectedUserId?: string,
): Promise<SavedLibraryAsset> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  if (expectedUserId && user.id !== expectedUserId) {
    throw new Error(
      "A sessão mudou. Abra a campanha novamente antes de salvar.",
    );
  }

  const serialized = JSON.stringify(state);
  if (new TextEncoder().encode(serialized).byteLength > 2_000_000) {
    throw new Error(
      "Esta campanha contém arquivos incorporados muito grandes. Faça upload das imagens antes de salvar.",
    );
  }

  const payload = {
    name: normalizeAssetName(name, state),
    type: state.type,
    content: state,
  };
  const query = existingAssetId
    ? supabase
        .from("assets")
        .update(payload)
        .eq("id", existingAssetId)
        .eq("user_id", user.id)
    : supabase
        .from("assets")
        .insert({ user_id: user.id, ...payload, status: "draft" });
  const { data, error } = await query.select().single();

  if (error) {
    if (error.message.includes("asset_limit_reached")) {
      throw new Error(
        "Você atingiu o limite de campanhas salvas do seu plano.",
      );
    }
    if (error.message.includes("membership_inactive")) {
      throw new Error("Seu acesso a este workspace está suspenso.");
    }
    throw error;
  }
  return data as SavedLibraryAsset;
}

const STORAGE_MARKERS = [
  "/storage/v1/object/sign/campaign-assets/",
  "/storage/v1/object/public/campaign-assets/",
] as const;

function extractStoragePath(value: string): string | null {
  const marker = STORAGE_MARKERS.find((candidate) => value.includes(candidate));
  if (!marker) return null;
  const encodedPath = value.split(marker)[1]?.split("?")[0];
  if (!encodedPath) return null;
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

function collectStoragePaths(value: unknown, output: Set<string>): void {
  if (typeof value === "string") {
    const path = extractStoragePath(value);
    if (path) output.add(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStoragePaths(entry, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => collectStoragePaths(entry, output));
  }
}

function replaceStorageUrls(
  value: unknown,
  signedUrls: Map<string, string>,
): unknown {
  if (typeof value === "string") {
    const path = extractStoragePath(value);
    return path ? (signedUrls.get(path) ?? value) : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => replaceStorageUrls(entry, signedUrls));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceStorageUrls(entry, signedUrls),
      ]),
    );
  }
  return value;
}

async function refreshPrivateUrls(
  items: SavedLibraryAsset[],
): Promise<SavedLibraryAsset[]> {
  if (!supabase || items.length === 0) return items;
  const paths = new Set<string>();
  items.forEach((item) => collectStoragePaths(item.content, paths));
  if (paths.size === 0) return items;

  const requestedPaths = [...paths];
  const { data, error } = await supabase.storage
    .from("campaign-assets")
    .createSignedUrls(requestedPaths, 60 * 60);
  if (error || !data) return items;

  const signedUrls = new Map(
    data
      .filter(
        (entry): entry is typeof entry & { path: string; signedUrl: string } =>
          typeof entry.path === "string" && typeof entry.signedUrl === "string",
      )
      .map((entry) => [entry.path, entry.signedUrl] as const),
  );

  return items.map((item) => ({
    ...item,
    content: replaceStorageUrls(item.content, signedUrls) as BuilderState,
  }));
}

const SAVED_ASSET_COLUMNS =
  "id,user_id,organization_id,name,type,content,status,experiment_group_id,variant_label,created_at,updated_at";
const DEFAULT_LIBRARY_PAGE_SIZE = 12;
const MAX_LIBRARY_PAGE_SIZE = 100;

function normalizeAssetsCursor(cursor: SavedAssetsCursor): SavedAssetsCursor {
  const createdAt = new Date(cursor.createdAt);
  const normalizedId = cursor.id.toLowerCase();
  if (
    Number.isNaN(createdAt.getTime()) ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(normalizedId)
  ) {
    throw new Error("Cursor da biblioteca inválido.");
  }
  return { createdAt: createdAt.toISOString(), id: normalizedId };
}

export async function getSavedAssetsPage(options?: {
  cursor?: SavedAssetsCursor | null;
  limit?: number;
}): Promise<SavedAssetsPage> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const pageSize = Math.min(
    MAX_LIBRARY_PAGE_SIZE,
    Math.max(1, Math.floor(options?.limit ?? DEFAULT_LIBRARY_PAGE_SIZE)),
  );

  // Defesa em profundidade: as políticas RLS continuam sendo a autoridade e
  // impedem acesso cruzado mesmo se um cliente remover este filtro.
  let query = supabase
    .from("assets")
    .select(SAVED_ASSET_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);

  if (options?.cursor) {
    const cursor = normalizeAssetsCursor(options.cursor);
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;

  if (error) throw error;
  const rows = (data ?? []) as SavedLibraryAsset[];
  const pageRows = rows.slice(0, pageSize);
  const lastItem = pageRows.at(-1);
  const nextCursor =
    rows.length > pageSize && lastItem
      ? { createdAt: lastItem.created_at, id: lastItem.id }
      : null;

  return {
    items: await refreshPrivateUrls(pageRows),
    nextCursor,
  };
}

export async function getSavedAssets(): Promise<SavedLibraryAsset[]> {
  const page = await getSavedAssetsPage();
  return page.items;
}

export async function deleteSavedAsset(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function renameSavedAsset(
  id: string,
  name: string,
): Promise<SavedLibraryAsset> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const normalizedName = normalizeLibraryLabel(name);
  const { data, error } = await supabase
    .from("assets")
    .update({ name: normalizedName })
    .eq("id", id)
    .eq("user_id", user.id)
    .select(SAVED_ASSET_COLUMNS)
    .single();

  if (error) throw error;
  return data as SavedLibraryAsset;
}

const LIBRARY_ASSET_STATUSES = new Set<LibraryAssetStatus>([
  "draft",
  "review",
  "approved",
]);

export async function updateSavedAssetStatus(
  id: string,
  status: LibraryAssetStatus,
): Promise<SavedLibraryAsset> {
  if (!supabase) throw new Error("Supabase não configurado.");
  if (!LIBRARY_ASSET_STATUSES.has(status)) {
    throw new Error("Status de campanha inválido.");
  }
  const user = await requireUser();
  const { data, error } = await supabase
    .from("assets")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id)
    .select(SAVED_ASSET_COLUMNS)
    .single();

  if (error) throw error;
  return data as SavedLibraryAsset;
}

const ASSET_VERSION_COLUMNS =
  "id,asset_id,user_id,version_number,name,type,content,status,variant_label,created_at";

export async function getAssetVersions(
  assetId: string,
): Promise<AssetVersion[]> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const { data, error } = await supabase
    .from("asset_versions")
    .select(ASSET_VERSION_COLUMNS)
    .eq("asset_id", assetId)
    .eq("user_id", user.id)
    .order("version_number", { ascending: false })
    .limit(30);

  if (error) throw error;
  const versions = (data ?? []) as AssetVersion[];
  if (!versions.length) return versions;

  const refreshed = await refreshPrivateUrls(
    versions.map(
      (version) =>
        ({
          id: version.id,
          user_id: version.user_id,
          name: version.name,
          type: version.type,
          content: version.content,
          status: version.status ?? "draft",
          created_at: version.created_at,
        }) satisfies SavedLibraryAsset,
    ),
  );

  return versions.map((version, index) => ({
    ...version,
    content: refreshed[index]?.content ?? version.content,
  }));
}

export async function restoreAssetVersion(
  assetId: string,
  versionId: string,
): Promise<SavedLibraryAsset> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const { data: version, error: versionError } = await supabase
    .from("asset_versions")
    .select(ASSET_VERSION_COLUMNS)
    .eq("id", versionId)
    .eq("asset_id", assetId)
    .eq("user_id", user.id)
    .single();

  if (versionError) throw versionError;
  const snapshot = version as AssetVersion;

  const { data, error } = await supabase
    .from("assets")
    .update({ content: snapshot.content })
    .eq("id", assetId)
    .eq("user_id", user.id)
    .select(SAVED_ASSET_COLUMNS)
    .single();

  if (error) throw error;
  const [restored] = await refreshPrivateUrls([data as SavedLibraryAsset]);
  return restored ?? (data as SavedLibraryAsset);
}

export async function createSavedAssetVariant(
  assetId: string,
): Promise<SavedAssetVariantResult> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();

  const { data: sourceData, error: sourceError } = await supabase
    .from("assets")
    .select(SAVED_ASSET_COLUMNS)
    .eq("id", assetId)
    .eq("user_id", user.id)
    .single();
  if (sourceError) throw sourceError;

  let source = sourceData as SavedLibraryAsset;
  if (source.variant_label === "B") {
    throw new Error("Esta campanha já é a variação B.");
  }

  const experimentGroupId = source.experiment_group_id ?? source.id;
  const { data: existingVariant, error: existingError } = await supabase
    .from("assets")
    .select("id")
    .eq("user_id", user.id)
    .eq("experiment_group_id", experimentGroupId)
    .eq("variant_label", "B")
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingVariant) {
    throw new Error("Já existe uma variação B para esta campanha.");
  }

  if (
    source.experiment_group_id !== experimentGroupId ||
    source.variant_label !== "A"
  ) {
    const { data: updatedSource, error: updateError } = await supabase
      .from("assets")
      .update({
        experiment_group_id: experimentGroupId,
        variant_label: "A",
      })
      .eq("id", source.id)
      .eq("user_id", user.id)
      .select(SAVED_ASSET_COLUMNS)
      .single();
    if (updateError) throw updateError;
    source = updatedSource as SavedLibraryAsset;
  }

  const baseName = source.name.replace(/\s*[·-]\s*Variação\s+[AB]\s*$/i, "");
  const { data: variantData, error: variantError } = await supabase
    .from("assets")
    .insert({
      user_id: user.id,
      name: normalizeLibraryLabel(`${baseName} · Variação B`),
      type: source.type,
      content: source.content,
      status: "draft",
      experiment_group_id: experimentGroupId,
      variant_label: "B",
    })
    .select(SAVED_ASSET_COLUMNS)
    .single();

  if (variantError) {
    if (variantError.message.includes("asset_limit_reached")) {
      throw new Error(
        "Você atingiu o limite de campanhas salvas do seu plano.",
      );
    }
    throw variantError;
  }

  const refreshed = await refreshPrivateUrls([
    source,
    variantData as SavedLibraryAsset,
  ]);
  return {
    source: refreshed[0] ?? source,
    variant: refreshed[1] ?? (variantData as SavedLibraryAsset),
  };
}

const EXPERIMENT_METRIC_COLUMNS =
  "asset_id,user_id,impressions,clicks,conversions,revenue,source,notes,created_at,updated_at";
const EXPERIMENT_DECISION_COLUMNS =
  "experiment_group_id,user_id,winner_asset_id,decision_note,decided_at,created_at,updated_at";
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function normalizeExperimentId(value: string, label: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`${label} inválido.`);
  }
  return normalized;
}

function normalizeMetricCount(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(
      `${label} deve ser um número inteiro maior ou igual a zero.`,
    );
  }
  return value;
}

function normalizeMetricRevenue(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Receita deve ser um número maior ou igual a zero.");
  }
  return Math.round(value * 100) / 100;
}

function normalizeExperimentNote(value?: string): string | null {
  if (!value) return null;
  const normalized = Array.from(value)
    .map((character) => (character.charCodeAt(0) < 32 ? " " : character))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return normalized || null;
}

function normalizeExperimentMetricRow(
  row: Record<string, unknown>,
): AssetExperimentMetrics {
  return {
    asset_id: String(row.asset_id),
    user_id: String(row.user_id),
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

export async function getExperimentData(
  experimentGroupId: string,
): Promise<AssetExperimentData> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const groupId = normalizeExperimentId(
    experimentGroupId,
    "Grupo de experimento",
  );

  const { data: variantRows, error: variantsError } = await supabase
    .from("assets")
    .select(SAVED_ASSET_COLUMNS)
    .eq("user_id", user.id)
    .eq("experiment_group_id", groupId)
    .in("variant_label", ["A", "B"])
    .order("variant_label", { ascending: true });
  if (variantsError) throw variantsError;

  const variants = await refreshPrivateUrls(
    (variantRows ?? []) as SavedLibraryAsset[],
  );
  const assetIds = variants.map((variant) => variant.id);

  let metrics: AssetExperimentMetrics[] = [];
  if (assetIds.length) {
    const { data: metricRows, error: metricsError } = await supabase
      .from("asset_experiment_metrics")
      .select(EXPERIMENT_METRIC_COLUMNS)
      .eq("user_id", user.id)
      .in("asset_id", assetIds);
    if (metricsError) throw metricsError;
    metrics = (metricRows ?? []).map((row) =>
      normalizeExperimentMetricRow(row as Record<string, unknown>),
    );
  }

  const { data: decisionRow, error: decisionError } = await supabase
    .from("asset_experiment_decisions")
    .select(EXPERIMENT_DECISION_COLUMNS)
    .eq("experiment_group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (decisionError) throw decisionError;

  return {
    variants,
    metrics,
    decision: decisionRow ? (decisionRow as AssetExperimentDecision) : null,
  };
}

export async function saveExperimentMetrics(
  assetId: string,
  input: AssetExperimentMetricsInput,
): Promise<AssetExperimentMetrics> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const normalizedAssetId = normalizeExperimentId(assetId, "Campanha");
  const now = new Date().toISOString();
  const payload = {
    asset_id: normalizedAssetId,
    user_id: user.id,
    impressions: normalizeMetricCount(input.impressions, "Impressões"),
    clicks: normalizeMetricCount(input.clicks, "Cliques"),
    conversions: normalizeMetricCount(input.conversions, "Conversões"),
    revenue: normalizeMetricRevenue(input.revenue),
    source: "manual" as const,
    notes: normalizeExperimentNote(input.notes),
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("asset_experiment_metrics")
    .upsert(payload, { onConflict: "asset_id" })
    .select(EXPERIMENT_METRIC_COLUMNS)
    .single();
  if (error) throw error;
  return normalizeExperimentMetricRow(data as Record<string, unknown>);
}

export async function setExperimentWinner(
  experimentGroupId: string,
  winnerAssetId: string,
  note?: string,
): Promise<AssetExperimentDecision> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const groupId = normalizeExperimentId(
    experimentGroupId,
    "Grupo de experimento",
  );
  const winnerId = normalizeExperimentId(winnerAssetId, "Campanha vencedora");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("asset_experiment_decisions")
    .upsert(
      {
        experiment_group_id: groupId,
        user_id: user.id,
        winner_asset_id: winnerId,
        decision_note: normalizeExperimentNote(note),
        decided_at: now,
        updated_at: now,
      },
      { onConflict: "experiment_group_id" },
    )
    .select(EXPERIMENT_DECISION_COLUMNS)
    .single();
  if (error) throw error;
  return data as AssetExperimentDecision;
}

export async function clearExperimentWinner(
  experimentGroupId: string,
): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const groupId = normalizeExperimentId(
    experimentGroupId,
    "Grupo de experimento",
  );
  const { error } = await supabase
    .from("asset_experiment_decisions")
    .delete()
    .eq("experiment_group_id", groupId)
    .eq("user_id", user.id);
  if (error) throw error;
}

const BRAND_KIT_COLUMNS =
  "id,user_id,name,brand_name,persona,tone,framework,product,offer,website_url,keywords,forbidden_terms,created_at,updated_at";

function normalizeBrandKitText(
  value: string | undefined,
  maxLength: number,
): string | null {
  if (!value) return null;
  const normalized = Array.from(value)
    .map((character) => (character.charCodeAt(0) < 32 ? " " : character))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return normalized || null;
}

function normalizeBrandKitList(values: string[] | undefined): string[] {
  if (!values?.length) return [];
  return Array.from(
    new Set(
      values
        .map((value) => normalizeBrandKitText(value, 80))
        .filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, 24);
}

export async function getBrandKits(): Promise<BrandKit[]> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const { data, error } = await supabase
    .from("brand_kits")
    .select(BRAND_KIT_COLUMNS)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as BrandKit[];
}

export async function saveBrandKit(
  input: BrandKitInput,
  existingId?: string | null,
): Promise<BrandKit> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const payload = {
    name: normalizeLibraryLabel(input.name),
    brand_name: normalizeBrandKitText(input.brandName, 120),
    persona: normalizeBrandKitText(input.persona, 300) ?? "Público-alvo",
    tone: normalizeBrandKitText(input.tone, 300) ?? "Premium",
    framework: normalizeBrandKitText(input.framework, 120) ?? "AIDA",
    product: normalizeBrandKitText(input.product, 500),
    offer: normalizeBrandKitText(input.offer, 500),
    website_url: normalizeBrandKitText(input.websiteUrl, 500),
    keywords: normalizeBrandKitList(input.keywords),
    forbidden_terms: normalizeBrandKitList(input.forbiddenTerms),
    updated_at: new Date().toISOString(),
  };

  const query = existingId
    ? supabase
        .from("brand_kits")
        .update(payload)
        .eq("id", existingId)
        .eq("user_id", user.id)
    : supabase.from("brand_kits").insert({ user_id: user.id, ...payload });
  const { data, error } = await query.select(BRAND_KIT_COLUMNS).single();
  if (error) throw error;
  return data as BrandKit;
}

export async function deleteBrandKit(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();
  const { error } = await supabase
    .from("brand_kits")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function uploadCampaignAsset(
  file: File,
  pathFolder: string,
): Promise<string> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(
      "Formato de imagem não permitido. Use JPG, PNG, WebP ou GIF.",
    );
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("A imagem deve ter no máximo 10 MB.");
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "bin";
  const folder = pathFolder.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const uniqueName =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filePath = `${user.id}/${folder}/${uniqueName}.${extension}`;

  const { error } = await supabase.storage
    .from("campaign-assets")
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (error) throw error;

  const { data, error: signError } = await supabase.storage
    .from("campaign-assets")
    .createSignedUrl(filePath, 60 * 60);
  if (signError || !data?.signedUrl) {
    throw signError ?? new Error("Não foi possível assinar a imagem enviada.");
  }

  return data.signedUrl;
}
