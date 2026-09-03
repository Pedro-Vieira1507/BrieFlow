import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import type { BuilderState } from "@/types/builder";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  string | undefined;

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

export interface SavedLibraryAsset {
  id: string;
  user_id: string;
  organization_id?: string | null;
  name: string;
  type: string;
  content: BuilderState;
  status: string;
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
  "ai-proxy" | "scrape-proxy" | "image-search" | "billing";

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
      // Supabase Edge Functions and the previous BrieFlow deployment already
      // allow this conventional header. Keeping it stable prevents CORS
      // failures while frontend and functions are rolled out independently.
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

function normalizeAssetName(name: string, state: BuilderState): string {
  const requested = state.brandName ? `Campanha ${state.brandName}` : name;
  return (
    Array.from(requested)
      .map((character) => (character.charCodeAt(0) < 32 ? " " : character))
      .join("")
      .trim()
      .slice(0, 120) || "Campanha sem nome"
  );
}

export async function saveAssetToLibrary(
  name: string,
  state: BuilderState,
): Promise<SavedLibraryAsset> {
  if (!supabase) throw new Error("Supabase não configurado.");
  const user = await requireUser();

  const serialized = JSON.stringify(state);
  if (new TextEncoder().encode(serialized).byteLength > 2_000_000) {
    throw new Error(
      "Esta campanha contém arquivos incorporados muito grandes. Faça upload das imagens antes de salvar.",
    );
  }

  const { data, error } = await supabase
    .from("assets")
    .insert({
      user_id: user.id,
      name: normalizeAssetName(name, state),
      type: state.type,
      content: state,
      status: "draft",
    })
    .select()
    .single();

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

// Keep reads compatible with the schema that existed before the enterprise
// migration. organization_id and updated_at are server-managed metadata and
// are not required to render or isolate the personal library.
const SAVED_ASSET_COLUMNS = "id,user_id,name,type,content,status,created_at";
const DEFAULT_LIBRARY_PAGE_SIZE = 50;
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
