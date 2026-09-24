import { createClient } from "npm:@supabase/supabase-js@2.110.5";

import { authorize, authorizationStatus, refund } from "../_shared/credits.ts";
import {
  authenticate,
  json,
  preflight,
  readJson,
  requirePost,
  runInBackground,
  type RequestContext,
} from "../_shared/http.ts";
import { normalizeGeminiAudio } from "../media-render/media.ts";

type MultimodalAction =
  | "live_token"
  | "transcribe"
  | "translate_dub"
  | "index_asset"
  | "semantic_search";

interface MultimodalRequest {
  action?: MultimodalAction;
  requestId?: string;
  storagePath?: string;
  mimeType?: string;
  targetLanguage?: string;
  assetId?: string;
  query?: string;
}

interface GeminiInteraction {
  output_text?: string;
  output_audio?: { data?: string; mime_type?: string; mimeType?: string };
  steps?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
      data?: string;
      mime_type?: string;
      mimeType?: string;
    }>;
  }>;
}

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";
const NATIVE_AUDIO_MODEL =
  Deno.env.get("GEMINI_NATIVE_AUDIO_MODEL") ||
  "gemini-2.5-flash-native-audio-preview-12-2025";
const TRANSCRIBE_MODEL =
  Deno.env.get("GEMINI_TRANSCRIBE_MODEL") || "gemini-3.8-flash";
const TRANSLATE_MODEL =
  Deno.env.get("GEMINI_TRANSLATE_MODEL") || "gemini-3.8-flash";
const TTS_MODEL =
  Deno.env.get("GEMINI_PODCAST_MODEL") || "gemini-3.1-flash-tts-preview";
const TTS_VOICE = Deno.env.get("GEMINI_PODCAST_VOICE") || "Kore";
const EMBEDDING_MODEL =
  Deno.env.get("GEMINI_EMBEDDING_MODEL") || "gemini-embedding-2";

const MAX_INLINE_MEDIA_BYTES = 18 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARS = 24_000;
const ALLOWED_MEDIA_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const TARGET_LANGUAGES: Record<string, string> = {
  "pt-BR": "Português do Brasil",
  "en-US": "Inglês dos Estados Unidos",
  "es-ES": "Espanhol",
  "fr-FR": "Francês",
  "de-DE": "Alemão",
  "it-IT": "Italiano",
};

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("multimodal_provider_not_configured");
  return value;
}

function clean(value: unknown, limit: number): string {
  return typeof value === "string"
    ? value.replace(/\0/g, "").trim().slice(0, limit)
    : "";
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192));
  }
  return btoa(binary);
}

async function geminiRequest(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 120_000,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${GEMINI_API}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env("GEMINI_API_KEY"),
      },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok) {
      if (response.status === 429)
        throw new Error("multimodal_provider_rate_limited");
      throw new Error(`multimodal_provider_http_${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function interactionText(payload: GeminiInteraction): string {
  if (payload.output_text?.trim()) return payload.output_text.trim();
  for (const step of [...(payload.steps ?? [])].reverse()) {
    const text = (step.content ?? [])
      .filter((item) => item.type === "text" && item.text)
      .map((item) => item.text)
      .join("\n")
      .trim();
    if (text) return text;
  }
  throw new Error("multimodal_provider_invalid_response");
}

async function createTextInteraction(
  model: string,
  input: unknown,
): Promise<string> {
  const payload = (await geminiRequest("/interactions", {
    model,
    input,
  })) as GeminiInteraction;
  return interactionText(payload).slice(0, MAX_TRANSCRIPT_CHARS);
}

async function downloadUserMedia(
  context: RequestContext,
  storagePath: string,
  requestedMimeType: string,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (
    !storagePath.startsWith(`${context.user.id}/multimodal-inputs/`) ||
    storagePath.includes("..")
  ) {
    throw new Error("invalid_storage_path");
  }
  const mimeType = requestedMimeType.split(";", 1)[0].toLowerCase();
  if (!ALLOWED_MEDIA_TYPES.has(mimeType))
    throw new Error("unsupported_media_type");

  const { data, error } = await context.service.storage
    .from("campaign-assets")
    .download(storagePath);
  if (error || !data) throw new Error("media_input_not_found");
  if (data.size <= 0 || data.size > MAX_INLINE_MEDIA_BYTES)
    throw new Error("media_input_too_large");
  return { bytes: new Uint8Array(await data.arrayBuffer()), mimeType };
}

async function transcribeMedia(media: {
  bytes: Uint8Array;
  mimeType: string;
}): Promise<string> {
  const mediaType = media.mimeType.startsWith("video/") ? "video" : "audio";
  return createTextInteraction(TRANSCRIBE_MODEL, [
    {
      type: "text",
      text: [
        "Transcreva fielmente o conteúdo falado em português quando for o idioma original.",
        "Separe falantes quando houver mais de uma voz e use timestamps MM:SS em mudanças relevantes.",
        "Não invente trechos inaudíveis e não acrescente comentários fora da transcrição.",
      ].join(" "),
    },
    {
      type: mediaType,
      data: bytesToBase64(media.bytes),
      mime_type: media.mimeType,
    },
  ]);
}

async function translateText(
  transcript: string,
  targetLanguage: string,
): Promise<string> {
  const language = TARGET_LANGUAGES[targetLanguage];
  if (!language) throw new Error("invalid_target_language");
  return createTextInteraction(
    TRANSLATE_MODEL,
    [
      `Traduza a transcrição abaixo para ${language}.`,
      "Preserve sentido, nomes próprios, números e intenção; adapte expressões para soar natural em locução.",
      "Retorne somente o texto traduzido, sem títulos, notas ou explicações.",
      "TRANSCRIÇÃO:",
      transcript,
    ].join("\n\n"),
  );
}

async function synthesizeDub(
  context: RequestContext,
  translatedText: string,
  targetLanguage: string,
): Promise<{ url: string; storagePath: string; mimeType: string }> {
  const language = TARGET_LANGUAGES[targetLanguage];
  const payload = (await geminiRequest("/interactions", {
    model: TTS_MODEL,
    input: `Fale somente o texto após TRANSCRIÇÃO. Voz natural, clara e profissional em ${language}. Preserve pausas e intenção.\n\nTRANSCRIÇÃO:\n${translatedText}`,
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice: TTS_VOICE }] },
  })) as GeminiInteraction;
  if (!payload.output_audio)
    throw new Error("multimodal_provider_invalid_response");
  const audio = normalizeGeminiAudio(payload.output_audio);
  const storagePath = `${context.user.id}/generated/dubbing/${crypto.randomUUID()}.wav`;
  const { error: uploadError } = await context.service.storage
    .from("campaign-assets")
    .upload(storagePath, audio.bytes, {
      contentType: audio.mimeType,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) throw uploadError;
  const { data, error: signedError } = await context.service.storage
    .from("campaign-assets")
    .createSignedUrl(storagePath, 60 * 60);
  if (signedError || !data?.signedUrl) throw new Error("media_signing_failed");
  return { url: data.signedUrl, storagePath, mimeType: audio.mimeType };
}

async function createEmbedding(text: string): Promise<number[]> {
  const prepared = text.slice(0, 20_000);
  const payload = await geminiRequest(
    `/models/${encodeURIComponent(EMBEDDING_MODEL)}:embedContent`,
    {
      content: { parts: [{ text: prepared }] },
      output_dimensionality: 768,
    },
    45_000,
  );
  const embedding = payload.embedding as { values?: unknown } | undefined;
  const embeddings = payload.embeddings as
    Array<{ values?: unknown }> | undefined;
  const values = embedding?.values ?? embeddings?.[0]?.values;
  if (
    !Array.isArray(values) ||
    values.length !== 768 ||
    values.some((value) => typeof value !== "number" || !Number.isFinite(value))
  ) {
    throw new Error("multimodal_provider_invalid_embedding");
  }
  return values as number[];
}

function collectSearchableText(value: unknown, output: string[]): void {
  if (typeof value === "string") {
    const normalized = value.replace(/https?:\/\/\S+/g, " ").trim();
    if (normalized && normalized.length < 4_000) output.push(normalized);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectSearchableText(item, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      if (
        !["url", "productImageUrl", "productImages", "mediaRender"].includes(
          key,
        )
      )
        collectSearchableText(item, output);
    });
  }
}

async function indexAsset(
  context: RequestContext,
  assetId: string,
): Promise<boolean> {
  const { data: asset, error } = await context.service
    .from("assets")
    .select("id,user_id,organization_id,name,type,content,updated_at")
    .eq("id", assetId)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!asset?.organization_id) return false;

  const fragments = [asset.name, asset.type];
  collectSearchableText(asset.content, fragments);
  const sourceText = Array.from(new Set(fragments))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20_000);
  if (!sourceText) return false;
  const embedding = await createEmbedding(
    `title: ${asset.name} | text: ${sourceText}`,
  );
  const { error: upsertError } = await context.service
    .from("asset_embeddings")
    .upsert({
      asset_id: asset.id,
      user_id: asset.user_id,
      organization_id: asset.organization_id,
      source_text: sourceText,
      embedding: `[${embedding.join(",")}]`,
      updated_at: new Date().toISOString(),
    });
  if (upsertError) throw upsertError;
  return true;
}

async function indexRecentAssets(context: RequestContext): Promise<void> {
  const { data: assets, error } = await context.service
    .from("assets")
    .select("id,updated_at")
    .eq("user_id", context.user.id)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  const { data: indexed } = await context.service
    .from("asset_embeddings")
    .select("asset_id,updated_at")
    .eq("user_id", context.user.id);
  const indexedMap = new Map(
    (indexed ?? []).map((row) => [row.asset_id, row.updated_at]),
  );
  const pending = (assets ?? []).filter(
    (asset) =>
      !indexedMap.has(asset.id) ||
      new Date(indexedMap.get(asset.id) ?? 0) < new Date(asset.updated_at),
  );
  for (const asset of pending.slice(0, 8)) await indexAsset(context, asset.id);
}

async function semanticSearch(
  context: RequestContext,
  query: string,
): Promise<Array<{ assetId: string; similarity: number }>> {
  await indexRecentAssets(context);
  const embedding = await createEmbedding(
    `task: search result | query: ${query}`,
  );
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${context.token}` } },
  });
  const { data, error } = await userClient.rpc("search_asset_embeddings", {
    p_query_embedding: `[${embedding.join(",")}]`,
    p_match_count: 20,
  });
  if (error) throw error;
  return ((data ?? []) as Array<{ asset_id: string; similarity: number }>).map(
    (row) => ({ assetId: row.asset_id, similarity: Number(row.similarity) }),
  );
}

async function createLiveToken(): Promise<{ name: string }> {
  const expireTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();
  const payload = await geminiRequest("/auth_tokens", {
    uses: 1,
    expireTime,
    newSessionExpireTime,
    liveConnectConstraints: {
      model: `models/${NATIVE_AUDIO_MODEL}`,
      config: {
        responseModalities: ["AUDIO"],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    },
  });
  const name = clean(payload.name, 2_000);
  if (!name) throw new Error("multimodal_provider_invalid_response");
  return { name };
}

function publicCode(error: unknown): string {
  const code = error instanceof Error ? error.message : "internal_error";
  return [
    "invalid_action",
    "invalid_asset_id",
    "invalid_query",
    "invalid_storage_path",
    "invalid_target_language",
    "media_input_not_found",
    "media_input_too_large",
    "unsupported_media_type",
    "multimodal_provider_not_configured",
    "multimodal_provider_rate_limited",
  ].includes(code)
    ? code
    : "multimodal_operation_failed";
}

Deno.serve(async (req: Request) => {
  const optionsResponse = preflight(req);
  if (optionsResponse) return optionsResponse;
  const methodResponse = requirePost(req);
  if (methodResponse) return methodResponse;

  const startedAt = Date.now();
  let context: RequestContext | null = null;
  let requestId = "";
  let authorization: Awaited<ReturnType<typeof authorize>> | null = null;
  let action: MultimodalAction | "unknown" = "unknown";

  try {
    context = await authenticate(req);
    if (!context)
      return json(req, 401, {
        error: "unauthorized",
        message: "Sessão inválida.",
      });

    const body = await readJson<MultimodalRequest>(req, 32_000);
    action = body.action ?? "unknown";
    if (
      ![
        "live_token",
        "transcribe",
        "translate_dub",
        "index_asset",
        "semantic_search",
      ].includes(action)
    ) {
      return json(req, 400, { error: "invalid_action" });
    }

    if (action === "index_asset") {
      const assetId = clean(body.assetId, 64);
      if (!/^[0-9a-f-]{36}$/i.test(assetId))
        return json(req, 400, { error: "invalid_asset_id" });
      const indexed = await indexAsset(context, assetId);
      return json(req, 200, { indexed });
    }

    requestId = clean(body.requestId, 128) || crypto.randomUUID();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(requestId))
      return json(req, 400, { error: "invalid_request_id" });

    const creditAction =
      action === "live_token"
        ? "voice_briefing"
        : action === "transcribe"
          ? "transcription"
          : action === "translate_dub"
            ? "translation"
            : "semantic_search";
    authorization = await authorize(context, creditAction, requestId, {
      feature: action,
    });
    if (!authorization.ok) {
      return json(req, authorizationStatus(authorization.code), {
        error: authorization.code,
        remaining: authorization.credits_remaining,
      });
    }

    let payload: Record<string, unknown>;
    let model = TRANSCRIBE_MODEL;
    if (action === "live_token") {
      const token = await createLiveToken();
      model = NATIVE_AUDIO_MODEL;
      payload = { token: token.name, model, expiresInSeconds: 60 };
    } else if (action === "transcribe") {
      const storagePath = clean(body.storagePath, 512);
      const mimeType = clean(body.mimeType, 100);
      const media = await downloadUserMedia(context, storagePath, mimeType);
      const transcript = await transcribeMedia(media);
      payload = { transcript, model: TRANSCRIBE_MODEL };
    } else if (action === "translate_dub") {
      const storagePath = clean(body.storagePath, 512);
      const mimeType = clean(body.mimeType, 100);
      const targetLanguage = clean(body.targetLanguage, 10);
      const media = await downloadUserMedia(context, storagePath, mimeType);
      const transcript = await transcribeMedia(media);
      const translation = await translateText(transcript, targetLanguage);
      const dubbed = await synthesizeDub(context, translation, targetLanguage);
      model = `${TRANSLATE_MODEL}+${TTS_MODEL}`;
      payload = { transcript, translation, ...dubbed, model };
    } else {
      const query = clean(body.query, 500);
      if (query.length < 2) throw new Error("invalid_query");
      const matches = await semanticSearch(context, query);
      model = EMBEDDING_MODEL;
      payload = { matches, model };
    }

    runInBackground(
      "multimodal_usage_log",
      context.service.from("ai_usage_log").insert({
        organization_id: authorization.organization_id,
        user_id: context.user.id,
        request_id: requestId,
        action: creditAction,
        provider: "gemini",
        model,
        latency_ms: Date.now() - startedAt,
        success: true,
      }),
    );
    return json(req, 200, {
      ...payload,
      creditsRemaining: authorization.credits_remaining,
    });
  } catch (error) {
    const code = publicCode(error);
    if (context && requestId && authorization?.ok) {
      await refund(context, requestId, code);
      await context.service.from("ai_usage_log").insert({
        organization_id: authorization.organization_id,
        user_id: context.user.id,
        request_id: requestId,
        action,
        provider: "gemini",
        model: "none",
        latency_ms: Date.now() - startedAt,
        success: false,
        error_code: code,
      });
    }
    const status =
      code === "media_input_too_large"
        ? 413
        : code === "multimodal_provider_rate_limited"
          ? 429
          : code.startsWith("invalid_") || code === "unsupported_media_type"
            ? 400
            : 502;
    return json(req, status, { error: code });
  }
});
