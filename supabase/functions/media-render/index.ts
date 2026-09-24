import {
  authenticate,
  json,
  preflight,
  publicError,
  readJson,
  requirePost,
  type ServiceClient,
} from "../_shared/http.ts";
import { fetchPublicResource } from "../_shared/urls.ts";
import {
  decodeBase64,
  decodeTaskHandle,
  encodeTaskHandle,
  findGeminiMediaOutput,
  normalizeGeminiAudio,
  type GeminiInteraction,
  type MediaMaterial,
  type MediaProvider,
  type ProviderTask,
} from "./media.ts";

type Action = "start" | "status";

interface RenderRequest {
  action: Action;
  material: MediaMaterial;
  prompt?: string;
  referenceImageUrl?: string | null;
  taskId?: string;
  signature?: string;
}

interface RunwayTask {
  id: string;
  status:
    "PENDING" | "THROTTLED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  output?: string[];
}

interface StoredMedia {
  url: string;
  mimeType: string;
}

interface CreatedTask {
  task: ProviderTask;
  interaction?: GeminiInteraction;
}

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_VIDEO_MODEL =
  Deno.env.get("GEMINI_VIDEO_MODEL") || "gemini-omni-1.1-flash";
const GEMINI_PODCAST_MODEL =
  Deno.env.get("GEMINI_PODCAST_MODEL") || "gemini-3.1-flash-tts-preview";
const GEMINI_PODCAST_VOICE = Deno.env.get("GEMINI_PODCAST_VOICE") || "Kore";
const GEMINI_VIDEO_RESOLUTION =
  Deno.env.get("GEMINI_VIDEO_RESOLUTION") || "720p";

const RUNWAY_API = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";
const RUNWAY_VIDEO_MODEL = Deno.env.get("RUNWAY_VIDEO_MODEL") || "gen4.5";
const RUNWAY_PODCAST_MODEL =
  Deno.env.get("RUNWAY_PODCAST_MODEL") || "eleven_multilingual_v2";
const RUNWAY_PODCAST_VOICE = Deno.env.get("RUNWAY_PODCAST_VOICE") || "Maya";

const MAX_MEDIA_BYTES = 50_000_000;
const MAX_REFERENCE_IMAGE_BYTES = 10_000_000;

function env(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function isMediaMaterial(value: unknown): value is MediaMaterial {
  return value === "reel" || value === "video" || value === "podcast";
}

function normalizePrompt(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").trim().slice(0, limit);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8_192;
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function signTask(
  userId: string,
  taskId: string,
  material: MediaMaterial,
): Promise<string> {
  const secret =
    Deno.env.get("MEDIA_RENDER_SIGNING_SECRET") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${userId}:${material}:${taskId}`),
  );
  return base64Url(new Uint8Array(signature));
}

async function verifyTask(
  userId: string,
  taskId: string,
  material: MediaMaterial,
  signature: string,
): Promise<boolean> {
  const expected = await signTask(userId, taskId, material);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return diff === 0;
}

function providerError(status: number): Error {
  if (status === 402 || status === 403) {
    return new Error("media_provider_plan_required");
  }
  if (status === 429) return new Error("media_provider_rate_limited");
  return new Error("media_provider_failed");
}

async function geminiFetch(
  path: string,
  init: RequestInit,
  timeoutMs = 120_000,
): Promise<Response> {
  const apiKey = env("GEMINI_API_KEY");
  if (!apiKey) throw new Error("media_provider_not_configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${GEMINI_API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function optionalGeminiImage(
  referenceImageUrl?: string | null,
): Promise<{ type: "image"; data: string; mime_type: string } | null> {
  if (!referenceImageUrl) return null;
  try {
    const resource = await fetchPublicResource(referenceImageUrl, {
      accept: "image/*",
      maxBytes: MAX_REFERENCE_IMAGE_BYTES,
      timeoutMs: 15_000,
      maxRedirects: 3,
    });
    const mimeType =
      resource.response.headers.get("Content-Type")?.split(";", 1)[0] ?? "";
    if (!resource.response.ok || !mimeType.startsWith("image/")) {
      throw new Error("invalid_reference_image");
    }
    return {
      type: "image",
      data: bytesToBase64(resource.bytes),
      mime_type: mimeType,
    };
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "media_reference_omitted",
        code:
          error instanceof Error ? error.message : "invalid_reference_image",
      }),
    );
    return null;
  }
}

async function createGeminiTask(
  material: MediaMaterial,
  prompt: string,
  referenceImageUrl?: string | null,
): Promise<CreatedTask> {
  const isPodcast = material === "podcast";
  const referenceImage = isPodcast
    ? null
    : await optionalGeminiImage(referenceImageUrl);
  const input = referenceImage
    ? [referenceImage, { type: "text", text: prompt }]
    : prompt;
  const body = isPodcast
    ? {
        model: GEMINI_PODCAST_MODEL,
        input: prompt,
        response_format: { type: "audio" },
        generation_config: {
          speech_config: [{ voice: GEMINI_PODCAST_VOICE }],
        },
      }
    : {
        model: GEMINI_VIDEO_MODEL,
        input,
        response_format: {
          type: "video",
          aspect_ratio: material === "reel" ? "9:16" : "16:9",
          resolution: GEMINI_VIDEO_RESOLUTION,
          delivery: "uri",
        },
      };

  // The current TTS preview documents a rare transient 500 response. Retry only
  // TTS; retrying a video POST could create and bill a duplicate render.
  const attempts = isPodcast ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await geminiFetch("/interactions", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const payload = (await response
      .json()
      .catch(() => ({}))) as GeminiInteraction;
    if (response.ok && payload.id) {
      return {
        task: { provider: "gemini", id: payload.id },
        // TTS interactions are commonly unary: the POST already contains the
        // complete PCM audio. Preserve it so it can be stored before returning
        // instead of relying on a later GET to repeat the binary payload.
        interaction: payload,
      };
    }
    if (isPodcast && attempt === 0 && response.status >= 500) continue;
    throw providerError(response.status);
  }
  throw new Error("media_provider_failed");
}

async function getGeminiTask(taskId: string): Promise<GeminiInteraction> {
  const response = await geminiFetch(
    `/interactions/${encodeURIComponent(taskId)}`,
    { method: "GET" },
    60_000,
  );
  const payload = (await response
    .json()
    .catch(() => ({}))) as GeminiInteraction;
  if (!response.ok) throw providerError(response.status);
  return payload;
}

async function runwayFetch(path: string, init: RequestInit): Promise<Response> {
  const apiKey = env("RUNWAYML_API_SECRET");
  if (!apiKey) throw new Error("media_provider_not_configured");

  return fetch(`${RUNWAY_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": RUNWAY_VERSION,
      ...(init.headers ?? {}),
    },
  });
}

async function createRunwayTask(
  material: MediaMaterial,
  prompt: string,
  referenceImageUrl?: string | null,
): Promise<CreatedTask> {
  const isPodcast = material === "podcast";
  const body = isPodcast
    ? {
        model: RUNWAY_PODCAST_MODEL,
        promptText: prompt,
        voice: { type: "runway-preset", presetId: RUNWAY_PODCAST_VOICE },
      }
    : {
        model: RUNWAY_VIDEO_MODEL,
        promptText: prompt,
        ratio: material === "reel" ? "720:1280" : "1280:720",
        duration: material === "reel" ? 8 : 10,
        ...(referenceImageUrl ? { promptImage: referenceImageUrl } : {}),
      };

  const response = await runwayFetch(
    isPodcast ? "/text_to_speech" : "/image_to_video",
    { method: "POST", body: JSON.stringify(body) },
  );
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!response.ok) throw providerError(response.status);

  const id = typeof payload.id === "string" ? payload.id : "";
  if (!id) throw new Error("media_provider_invalid_response");
  return { task: { provider: "runway", id } };
}

async function getRunwayTask(taskId: string): Promise<RunwayTask> {
  const response = await runwayFetch(`/tasks/${encodeURIComponent(taskId)}`, {
    method: "GET",
  });
  const payload = (await response.json().catch(() => ({}))) as RunwayTask;
  if (!response.ok) throw providerError(response.status);
  return payload;
}

async function createTask(
  material: MediaMaterial,
  prompt: string,
  referenceImageUrl?: string | null,
): Promise<CreatedTask> {
  const attempts: Array<{
    provider: MediaProvider;
    configured: boolean;
    execute: () => Promise<CreatedTask>;
  }> = [
    {
      provider: "gemini",
      configured: Boolean(env("GEMINI_API_KEY")),
      execute: () => createGeminiTask(material, prompt, referenceImageUrl),
    },
    {
      provider: "runway",
      configured: Boolean(env("RUNWAYML_API_SECRET")),
      execute: () => createRunwayTask(material, prompt, referenceImageUrl),
    },
  ];
  const failures: Error[] = [];

  for (const attempt of attempts) {
    if (!attempt.configured) continue;
    try {
      return await attempt.execute();
    } catch (error) {
      const failure =
        error instanceof Error ? error : new Error("media_provider_failed");
      failures.push(failure);
      console.error(
        JSON.stringify({
          event: "media_render_start_failed",
          provider: attempt.provider,
          code: failure.message,
        }),
      );
    }
  }

  if (!attempts.some((attempt) => attempt.configured)) {
    throw new Error("media_provider_not_configured");
  }
  throw failures[0] ?? new Error("media_provider_failed");
}

function extensionFor(contentType: string, material: MediaMaterial): string {
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  return material === "podcast" ? "wav" : "mp4";
}

async function persistBytes(
  service: ServiceClient,
  userId: string,
  material: MediaMaterial,
  taskId: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<StoredMedia> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) {
    throw new Error("media_download_failed");
  }
  const extension = extensionFor(mimeType, material);
  const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 160);
  const path = `${userId}/generated/${material}/${safeTaskId}.${extension}`;

  const { error: uploadError } = await service.storage
    .from("campaign-assets")
    .upload(path, bytes, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { data, error: signedError } = await service.storage
    .from("campaign-assets")
    .createSignedUrl(path, 60 * 60);
  if (signedError || !data?.signedUrl) {
    throw signedError ?? new Error("media_sign_failed");
  }
  return { url: data.signedUrl, mimeType };
}

async function persistRunwayOutput(
  service: ServiceClient,
  userId: string,
  material: MediaMaterial,
  taskId: string,
  outputUrl: string,
): Promise<StoredMedia> {
  const source = await fetchPublicResource(outputUrl, {
    accept: material === "podcast" ? "audio/*" : "video/*",
    maxBytes: MAX_MEDIA_BYTES,
    timeoutMs: 60_000,
    maxRedirects: 4,
  });
  if (!source.response.ok) throw new Error("media_download_failed");
  const mimeType =
    source.response.headers.get("Content-Type") ||
    (material === "podcast" ? "audio/mpeg" : "video/mp4");
  return persistBytes(
    service,
    userId,
    material,
    taskId,
    source.bytes,
    mimeType,
  );
}

async function downloadGeminiOutput(uri: string): Promise<Uint8Array> {
  const url = new URL(uri);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "generativelanguage.googleapis.com" ||
    !url.pathname.startsWith("/v1beta/files/")
  ) {
    throw new Error("media_provider_invalid_response");
  }
  const response = await geminiFetch(
    `${url.pathname}${url.search}`,
    { method: "GET", headers: { Accept: "audio/*, video/*" } },
    60_000,
  );
  if (!response.ok) throw providerError(response.status);
  const declared = Number(response.headers.get("Content-Length") ?? 0);
  if (declared > MAX_MEDIA_BYTES) throw new Error("media_download_failed");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_MEDIA_BYTES)
    throw new Error("media_download_failed");
  return bytes;
}

async function persistGeminiOutput(
  service: ServiceClient,
  userId: string,
  material: MediaMaterial,
  taskId: string,
  interaction: GeminiInteraction,
): Promise<StoredMedia> {
  const kind = material === "podcast" ? "audio" : "video";
  const output = findGeminiMediaOutput(interaction, kind);
  if (!output) throw new Error("media_provider_invalid_response");

  if (kind === "audio" && output.data) {
    const normalized = normalizeGeminiAudio(output);
    return persistBytes(
      service,
      userId,
      material,
      taskId,
      normalized.bytes,
      normalized.mimeType,
    );
  }

  const bytes = output.data
    ? decodeBase64(output.data)
    : await downloadGeminiOutput(output.uri ?? "");
  const mimeType =
    output.mime_type ??
    output.mimeType ??
    (material === "podcast" ? "audio/wav" : "video/mp4");
  return persistBytes(service, userId, material, taskId, bytes, mimeType);
}

function geminiStatus(
  interaction: GeminiInteraction,
  kind: "audio" | "video",
): "queued" | "processing" | "ready" | "failed" {
  const status = interaction.status?.toLowerCase() ?? "";
  if (findGeminiMediaOutput(interaction, kind)) return "ready";
  if (interaction.error) return "failed";
  if (["failed", "cancelled", "canceled", "incomplete"].includes(status)) {
    return "failed";
  }
  if (status === "completed") return "ready";
  if (["pending", "queued"].includes(status)) return "queued";
  return "processing";
}

Deno.serve(async (req: Request) => {
  const options = preflight(req);
  if (options) return options;

  const methodError = requirePost(req);
  if (methodError) return methodError;

  try {
    const context = await authenticate(req);
    if (!context) return json(req, 401, { error: "unauthorized" });

    const body = await readJson<RenderRequest>(req, 48_000);
    if (!isMediaMaterial(body.material)) {
      return json(req, 400, { error: "invalid_material" });
    }

    if (body.action === "start") {
      const prompt = normalizePrompt(
        body.prompt,
        body.material === "podcast" ? 12_000 : 3_500,
      );
      if (!prompt) return json(req, 400, { error: "empty_media_prompt" });

      const image =
        typeof body.referenceImageUrl === "string" &&
        /^https:\/\//i.test(body.referenceImageUrl)
          ? body.referenceImageUrl.slice(0, 4_000)
          : null;
      const created = await createTask(body.material, prompt, image);
      const task = created.task;
      const taskId = encodeTaskHandle(task);
      const signature = await signTask(context.user.id, taskId, body.material);

      const kind = body.material === "podcast" ? "audio" : "video";
      if (
        task.provider === "gemini" &&
        created.interaction &&
        findGeminiMediaOutput(created.interaction, kind)
      ) {
        const stored = await persistGeminiOutput(
          context.service,
          context.user.id,
          body.material,
          task.id,
          created.interaction,
        );
        return json(req, 200, {
          taskId,
          signature,
          provider: task.provider,
          status: "ready",
          kind,
          url: stored.url,
          mimeType: stored.mimeType,
          generatedAt: new Date().toISOString(),
        });
      }

      return json(req, 202, {
        taskId,
        signature,
        provider: task.provider,
        status: "queued",
        kind,
      });
    }

    if (body.action !== "status") {
      return json(req, 400, { error: "invalid_action" });
    }

    const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
    const signature =
      typeof body.signature === "string" ? body.signature.trim() : "";
    if (
      !taskId ||
      !signature ||
      !(await verifyTask(context.user.id, taskId, body.material, signature))
    ) {
      return json(req, 403, { error: "invalid_task_handle" });
    }
    const task = decodeTaskHandle(taskId);
    if (!task) return json(req, 403, { error: "invalid_task_handle" });

    if (task.provider === "gemini") {
      const interaction = await getGeminiTask(task.id);
      const status = geminiStatus(
        interaction,
        body.material === "podcast" ? "audio" : "video",
      );
      if (status === "failed") {
        return json(req, 200, {
          taskId,
          provider: task.provider,
          status: "failed",
          error:
            "Não foi possível finalizar esta mídia. Tente gerar novamente.",
        });
      }
      if (status !== "ready") {
        return json(req, 200, { taskId, provider: task.provider, status });
      }
      const stored = await persistGeminiOutput(
        context.service,
        context.user.id,
        body.material,
        task.id,
        interaction,
      );
      return json(req, 200, {
        taskId,
        provider: task.provider,
        status: "ready",
        kind: body.material === "podcast" ? "audio" : "video",
        url: stored.url,
        mimeType: stored.mimeType,
        generatedAt: new Date().toISOString(),
      });
    }

    const runwayTask = await getRunwayTask(task.id);
    if (runwayTask.status === "FAILED" || runwayTask.status === "CANCELED") {
      return json(req, 200, {
        taskId,
        provider: task.provider,
        status: "failed",
        error: "Não foi possível finalizar esta mídia. Tente gerar novamente.",
      });
    }
    if (runwayTask.status !== "SUCCEEDED") {
      return json(req, 200, {
        taskId,
        provider: task.provider,
        status: runwayTask.status === "PENDING" ? "queued" : "processing",
      });
    }

    const outputUrl = runwayTask.output?.[0];
    if (!outputUrl) throw new Error("media_provider_invalid_response");
    const stored = await persistRunwayOutput(
      context.service,
      context.user.id,
      body.material,
      task.id,
      outputUrl,
    );
    return json(req, 200, {
      taskId,
      provider: task.provider,
      status: "ready",
      kind: body.material === "podcast" ? "audio" : "video",
      url: stored.url,
      mimeType: stored.mimeType,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : publicError(error);
    const publicCodes = new Set([
      "media_provider_not_configured",
      "media_provider_plan_required",
      "media_provider_rate_limited",
      "media_provider_failed",
      "media_download_failed",
      "media_sign_failed",
      "request_too_large",
      "invalid_json",
    ]);
    console.error(JSON.stringify({ event: "media_render_error", code }));
    return json(req, code === "media_provider_rate_limited" ? 429 : 503, {
      error: publicCodes.has(code) ? code : "media_render_failed",
    });
  }
});
