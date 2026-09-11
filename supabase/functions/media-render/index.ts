import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  authenticate,
  json,
  preflight,
  publicError,
  readJson,
  requirePost,
  type ServiceClient,
} from "../_shared/http.ts";

type MediaMaterial = "reel" | "video" | "podcast";
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

const RUNWAY_API = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";
const VIDEO_MODEL = Deno.env.get("RUNWAY_VIDEO_MODEL") || "gen4.5";
const PODCAST_MODEL =
  Deno.env.get("RUNWAY_PODCAST_MODEL") || "eleven_multilingual_v2";
const PODCAST_VOICE = Deno.env.get("RUNWAY_PODCAST_VOICE") || "Maya";

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

async function runwayFetch(path: string, init: RequestInit): Promise<Response> {
  const apiKey = Deno.env.get("RUNWAYML_API_SECRET");
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

async function createTask(
  material: MediaMaterial,
  prompt: string,
  referenceImageUrl?: string | null,
): Promise<{ id: string }> {
  const isPodcast = material === "podcast";
  const body = isPodcast
    ? {
        model: PODCAST_MODEL,
        promptText: prompt,
        voice: { type: "runway-preset", presetId: PODCAST_VOICE },
      }
    : {
        model: VIDEO_MODEL,
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

  if (!response.ok) {
    console.error(
      JSON.stringify({
        event: "media_render_start_failed",
        status: response.status,
        providerCode: payload.error ?? payload.code ?? null,
      }),
    );
    if (response.status === 402 || response.status === 403) {
      throw new Error("media_provider_plan_required");
    }
    if (response.status === 429) throw new Error("media_provider_rate_limited");
    throw new Error("media_provider_failed");
  }

  const id = typeof payload.id === "string" ? payload.id : "";
  if (!id) throw new Error("media_provider_invalid_response");
  return { id };
}

async function getTask(taskId: string): Promise<RunwayTask> {
  const response = await runwayFetch(`/tasks/${encodeURIComponent(taskId)}`, {
    method: "GET",
  });
  const payload = (await response.json().catch(() => ({}))) as RunwayTask;
  if (!response.ok) {
    if (response.status === 429) throw new Error("media_provider_rate_limited");
    throw new Error("media_provider_failed");
  }
  return payload;
}

function extensionFor(contentType: string, material: MediaMaterial): string {
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("ogg")) return "ogg";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  return material === "podcast" ? "mp3" : "mp4";
}

async function persistOutput(
  service: ServiceClient,
  userId: string,
  material: MediaMaterial,
  taskId: string,
  outputUrl: string,
): Promise<{ url: string; mimeType: string }> {
  const source = await fetch(outputUrl);
  if (!source.ok) throw new Error("media_download_failed");

  const mimeType =
    source.headers.get("Content-Type") ||
    (material === "podcast" ? "audio/mpeg" : "video/mp4");
  const extension = extensionFor(mimeType, material);
  const path = `${userId}/generated/${material}/${taskId}.${extension}`;
  const bytes = await source.arrayBuffer();

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
      const task = await createTask(body.material, prompt, image);
      const signature = await signTask(context.user.id, task.id, body.material);

      return json(req, 202, {
        taskId: task.id,
        signature,
        status: "queued",
        kind: body.material === "podcast" ? "audio" : "video",
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

    const task = await getTask(taskId);
    if (task.status === "FAILED" || task.status === "CANCELED") {
      return json(req, 200, {
        taskId,
        status: "failed",
        error: "Não foi possível finalizar esta mídia. Tente gerar novamente.",
      });
    }

    if (task.status !== "SUCCEEDED") {
      return json(req, 200, {
        taskId,
        status: task.status === "PENDING" ? "queued" : "processing",
      });
    }

    const outputUrl = task.output?.[0];
    if (!outputUrl) throw new Error("media_provider_invalid_response");
    const stored = await persistOutput(
      context.service,
      context.user.id,
      body.material,
      taskId,
      outputUrl,
    );

    return json(req, 200, {
      taskId,
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
