import {
  authenticate,
  json,
  preflight,
  readJson,
  requirePost,
} from "../_shared/http.ts";

interface ImageRenderBody {
  prompt?: unknown;
  aspect_ratio?: unknown;
  image_size?: unknown;
}

interface GeneratedImage {
  data: string;
  mimeType: string;
}

interface ProviderFailure {
  model: string;
  status: number;
  code: string;
  message: string;
}

const ALLOWED_ASPECT_RATIOS = new Set([
  "16:9",
  "21:9",
  "4:3",
  "1:1",
  "4:5",
  "9:16",
]);
const IMAGE_RENDERS_PER_MINUTE = 8;
const CLOUDFLARE_PRIMARY_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const CLOUDFLARE_FALLBACK_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const SCHNELL_MAX_PROMPT = 2_048;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.replace(/^data:[^;]+;base64,/, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

function aspectRatioToDimensions(aspectRatio: string): {
  width: number;
  height: number;
} {
  switch (aspectRatio) {
    case "21:9":
      return { width: 1344, height: 576 };
    case "4:3":
      return { width: 1152, height: 864 };
    case "1:1":
      return { width: 1024, height: 1024 };
    case "4:5":
      return { width: 896, height: 1120 };
    case "9:16":
      return { width: 768, height: 1365 };
    case "16:9":
    default:
      return { width: 1344, height: 768 };
  }
}

function safeProviderMessage(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, 500);
}

function providerFailureFromPayload(
  payload: unknown,
  model: string,
  status: number,
): ProviderFailure {
  if (!payload || typeof payload !== "object") {
    return {
      model,
      status,
      code: "provider_error",
      message: "Cloudflare Workers AI returned an invalid response.",
    };
  }

  const record = payload as Record<string, unknown>;
  const errors = Array.isArray(record.errors) ? record.errors : [];
  const first =
    errors[0] && typeof errors[0] === "object"
      ? (errors[0] as Record<string, unknown>)
      : undefined;

  return {
    model,
    status,
    code:
      typeof first?.code === "number" || typeof first?.code === "string"
        ? String(first.code)
        : "provider_error",
    message:
      safeProviderMessage(first?.message) ||
      "Cloudflare Workers AI could not generate the image.",
  };
}

async function providerFailure(
  response: Response,
  model: string,
): Promise<ProviderFailure> {
  const raw = await response.text();
  try {
    return providerFailureFromPayload(
      raw ? (JSON.parse(raw) as unknown) : {},
      model,
      response.status,
    );
  } catch {
    return {
      model,
      status: response.status,
      code: "provider_error",
      message: safeProviderMessage(raw) || "Cloudflare Workers AI request failed.",
    };
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 75_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function extractCloudflareImage(payload: unknown): GeneratedImage | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const result =
    record.result && typeof record.result === "object"
      ? (record.result as Record<string, unknown>)
      : record;
  const image = typeof result.image === "string" ? result.image : null;
  if (!image || image.length < 100) return null;
  return { data: image, mimeType: "image/jpeg" };
}

function compactPrompt(rawPrompt: string): string {
  const suffix =
    "\n\nCommercial advertising key visual only. No words, letters, numbers, logos, watermarks, UI, captions or labels. Clean premium composition, one clear focal idea, realistic materials and lighting, usable negative space for external typography. The application adds final typography and any real product cutout separately.";
  const available = Math.max(400, SCHNELL_MAX_PROMPT - suffix.length - 1);
  const normalized = rawPrompt.replace(/\s+/g, " ").trim();
  return `${normalized.slice(0, available)}${suffix}`;
}

async function tryFlux2Klein(input: {
  accountId: string;
  apiToken: string;
  prompt: string;
  aspectRatio: string;
}): Promise<{ image?: GeneratedImage; failure?: ProviderFailure }> {
  const { width, height } = aspectRatioToDimensions(input.aspectRatio);
  const form = new FormData();
  form.append("prompt", input.prompt);
  form.append("width", String(width));
  form.append("height", String(height));
  form.append("guidance", "3.5");

  const response = await fetchWithTimeout(
    `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/ai/run/${CLOUDFLARE_PRIMARY_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiToken}`,
      },
      body: form,
    },
  );

  if (!response.ok) {
    return { failure: await providerFailure(response, CLOUDFLARE_PRIMARY_MODEL) };
  }

  const payload = (await response.json()) as unknown;
  const image = extractCloudflareImage(payload);
  if (image) return { image };

  return {
    failure: providerFailureFromPayload(
      payload,
      CLOUDFLARE_PRIMARY_MODEL,
      502,
    ),
  };
}

async function tryFlux1Schnell(input: {
  accountId: string;
  apiToken: string;
  prompt: string;
}): Promise<{ image?: GeneratedImage; failure?: ProviderFailure }> {
  const response = await fetchWithTimeout(
    `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/ai/run/${CLOUDFLARE_FALLBACK_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: input.prompt.slice(0, SCHNELL_MAX_PROMPT),
        steps: 4,
      }),
    },
  );

  if (!response.ok) {
    return { failure: await providerFailure(response, CLOUDFLARE_FALLBACK_MODEL) };
  }

  const payload = (await response.json()) as unknown;
  const image = extractCloudflareImage(payload);
  if (image) return { image };

  return {
    failure: providerFailureFromPayload(
      payload,
      CLOUDFLARE_FALLBACK_MODEL,
      502,
    ),
  };
}

function quotaFailure(failures: ProviderFailure[]): boolean {
  return failures.some((failure) => {
    const detail = `${failure.code} ${failure.message}`.toLowerCase();
    return (
      failure.status === 429 ||
      /quota|neuron|usage limit|daily limit|billing/.test(detail)
    );
  });
}

function authFailure(failures: ProviderFailure[]): boolean {
  return failures.some((failure) => {
    const detail = `${failure.code} ${failure.message}`.toLowerCase();
    return (
      failure.status === 401 ||
      failure.status === 403 ||
      /authentication|authorization|permission|token/.test(detail)
    );
  });
}

Deno.serve(async (req: Request) => {
  const optionsResponse = preflight(req);
  if (optionsResponse) return optionsResponse;

  const methodResponse = requirePost(req);
  if (methodResponse) return methodResponse;

  try {
    const context = await authenticate(req);
    if (!context) {
      return json(req, 401, {
        error: "unauthorized",
        message: "Sessão inválida.",
      });
    }

    const { data: rateAllowed, error: rateError } = await context.service.rpc(
      "check_rate_limit",
      {
        p_user_id: context.user.id,
        p_scope: "image_render",
        p_limit: IMAGE_RENDERS_PER_MINUTE,
      },
    );
    if (rateError) {
      console.error(
        JSON.stringify({
          event: "image_render_rate_limit_failed",
          code: rateError.message,
        }),
      );
      return json(req, 500, { error: "rate_limit_failed" });
    }
    if (!rateAllowed) {
      return json(req, 429, { error: "rate_limit_exceeded" });
    }

    const body = await readJson<ImageRenderBody>(req, 24_000);
    const rawPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (rawPrompt.length < 8 || rawPrompt.length > 8_000) {
      return json(req, 400, { error: "invalid_prompt" });
    }

    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID")?.trim();
    const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN")?.trim();
    if (!accountId || !apiToken) {
      return json(req, 503, { error: "image_provider_not_configured" });
    }

    const requestedAspect =
      typeof body.aspect_ratio === "string" ? body.aspect_ratio : "16:9";
    const aspectRatio = ALLOWED_ASPECT_RATIOS.has(requestedAspect)
      ? requestedAspect
      : "16:9";
    const providerPrompt = compactPrompt(rawPrompt);

    const failures: ProviderFailure[] = [];
    let generated: GeneratedImage | undefined;
    let selectedModel = "";

    try {
      const primary = await tryFlux2Klein({
        accountId,
        apiToken,
        prompt: providerPrompt,
        aspectRatio,
      });
      if (primary.image) {
        generated = primary.image;
        selectedModel = CLOUDFLARE_PRIMARY_MODEL;
      } else if (primary.failure) {
        failures.push(primary.failure);
      }
    } catch (error) {
      failures.push({
        model: CLOUDFLARE_PRIMARY_MODEL,
        status: 504,
        code:
          error instanceof DOMException && error.name === "AbortError"
            ? "TIMEOUT"
            : "NETWORK_ERROR",
        message:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Cloudflare primary model request failed.",
      });
    }

    if (!generated) {
      try {
        const fallback = await tryFlux1Schnell({
          accountId,
          apiToken,
          prompt: providerPrompt,
        });
        if (fallback.image) {
          generated = fallback.image;
          selectedModel = CLOUDFLARE_FALLBACK_MODEL;
        } else if (fallback.failure) {
          failures.push(fallback.failure);
        }
      } catch (error) {
        failures.push({
          model: CLOUDFLARE_FALLBACK_MODEL,
          status: 504,
          code:
            error instanceof DOMException && error.name === "AbortError"
              ? "TIMEOUT"
              : "NETWORK_ERROR",
          message:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Cloudflare fallback model request failed.",
        });
      }
    }

    if (!generated) {
      const lastFailure = failures.at(-1);
      const error = quotaFailure(failures)
        ? "image_provider_quota_unavailable"
        : authFailure(failures)
          ? "image_provider_auth_failed"
          : "image_provider_failed";
      console.warn(
        JSON.stringify({
          event: error,
          provider: "cloudflare-workers-ai",
          failures,
        }),
      );
      return json(req, 502, {
        error,
        provider_status: lastFailure?.status ?? 502,
        provider_code: lastFailure?.code ?? "provider_error",
        provider_message:
          lastFailure?.message ?? "Cloudflare Workers AI image generation failed.",
        models_tried: failures.map((failure) => failure.model),
      });
    }

    const bytes = decodeBase64(generated.data);
    if (bytes.byteLength > 12 * 1024 * 1024) {
      return json(req, 502, { error: "image_too_large" });
    }

    const extension = extensionForMime(generated.mimeType);
    const storagePath = `${context.user.id}/generated/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await context.service.storage
      .from("campaign-assets")
      .upload(storagePath, bytes, {
        cacheControl: "31536000",
        contentType: generated.mimeType,
        upsert: false,
      });
    if (uploadError) {
      console.error(
        JSON.stringify({
          event: "generated_image_upload_failed",
          code: uploadError.message,
        }),
      );
      return json(req, 500, { error: "image_upload_failed" });
    }

    const { data: signed, error: signedError } = await context.service.storage
      .from("campaign-assets")
      .createSignedUrl(storagePath, 60 * 60 * 24);
    if (signedError || !signed?.signedUrl) {
      return json(req, 500, { error: "image_sign_failed" });
    }

    return json(req, 200, {
      url: signed.signedUrl,
      path: storagePath,
      model: selectedModel,
      provider: "cloudflare-workers-ai",
      aspect_ratio: aspectRatio,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "internal_error";
    const status =
      code === "invalid_json" ? 400 : code === "request_too_large" ? 413 : 500;
    return json(req, status, {
      error: ["invalid_json", "request_too_large"].includes(code)
        ? code
        : "image_render_failed",
    });
  }
});
