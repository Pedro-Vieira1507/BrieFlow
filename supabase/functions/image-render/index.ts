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
const ALLOWED_IMAGE_SIZES = new Set(["512", "1K", "2K"]);
const IMAGE_RENDERS_PER_MINUTE = 8;
const INTERACTIONS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/interactions";
const LEGACY_IMAGE_MODEL = "gemini-2.5-flash-image";

function uniqueModels(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
  );
}

function imageModels(): string[] {
  const configured = (Deno.env.get("GEMINI_IMAGE_MODELS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return uniqueModels([
    Deno.env.get("GEMINI_IMAGE_MODEL"),
    ...configured,
    "gemini-3.1-flash-image",
    "gemini-3.1-flash-lite-image",
  ]);
}

function findGeneratedImage(value: unknown): GeneratedImage | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const explicitMimeType =
    typeof record.mime_type === "string"
      ? record.mime_type
      : typeof record.mimeType === "string"
        ? record.mimeType
        : null;
  const base64Json =
    typeof record.b64_json === "string" ? record.b64_json : null;
  const inlineData =
    typeof record.data === "string" &&
    (record.type === "image" || explicitMimeType?.startsWith("image/"))
      ? record.data
      : null;
  const directData = base64Json ?? inlineData;

  if (directData && directData.length > 100) {
    return {
      data: directData,
      mimeType: explicitMimeType?.startsWith("image/")
        ? explicitMimeType
        : "image/png",
    };
  }

  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const nested = findGeneratedImage(item);
        if (nested) return nested;
      }
      continue;
    }
    const nested = findGeneratedImage(child);
    if (nested) return nested;
  }

  return null;
}

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

function safeProviderMessage(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]").slice(0, 500);
}

async function providerFailure(
  response: Response,
  model: string,
): Promise<ProviderFailure> {
  const raw = await response.text();
  let code = "provider_error";
  let message = raw.slice(0, 500);
  try {
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const nested =
      parsed.error && typeof parsed.error === "object"
        ? (parsed.error as Record<string, unknown>)
        : parsed;
    if (typeof nested.status === "string") code = nested.status;
    else if (typeof nested.code === "string") code = nested.code;
    else if (typeof nested.code === "number") code = String(nested.code);
    if (typeof nested.message === "string") message = nested.message;
  } catch {
    // Keep the compact raw response when the provider did not return JSON.
  }
  return {
    model,
    status: response.status,
    code: safeProviderMessage(code) || "provider_error",
    message: safeProviderMessage(message),
  };
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

async function tryInteractionsModel(input: {
  apiKey: string;
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
}): Promise<{ image?: GeneratedImage; failure?: ProviderFailure }> {
  const response = await fetchWithTimeout(INTERACTIONS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    body: JSON.stringify({
      model: input.model,
      input: input.prompt,
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        aspect_ratio: input.aspectRatio,
        image_size: input.imageSize,
      },
    }),
  });

  if (!response.ok) {
    return { failure: await providerFailure(response, input.model) };
  }

  const payload = (await response.json()) as unknown;
  const image = findGeneratedImage(payload);
  if (!image) {
    return {
      failure: {
        model: input.model,
        status: 502,
        code: "EMPTY_IMAGE_RESPONSE",
        message: "The provider returned no image payload.",
      },
    };
  }
  return { image };
}

async function tryLegacyModel(input: {
  apiKey: string;
  prompt: string;
  aspectRatio: string;
}): Promise<{ image?: GeneratedImage; failure?: ProviderFailure }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${LEGACY_IMAGE_MODEL}:generateContent`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: input.prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: input.aspectRatio },
      },
    }),
  });

  if (!response.ok) {
    return { failure: await providerFailure(response, LEGACY_IMAGE_MODEL) };
  }

  const payload = (await response.json()) as unknown;
  const image = findGeneratedImage(payload);
  if (!image) {
    return {
      failure: {
        model: LEGACY_IMAGE_MODEL,
        status: 502,
        code: "EMPTY_IMAGE_RESPONSE",
        message: "The legacy provider returned no image payload.",
      },
    };
  }
  return { image };
}

function quotaFailure(failures: ProviderFailure[]): boolean {
  return failures.some((failure) => {
    const detail = `${failure.code} ${failure.message}`.toLowerCase();
    return (
      failure.status === 429 ||
      /resource_exhausted|quota|billing|paid tier|free tier|limit:\s*0|limit 0/.test(detail)
    );
  });
}

function authFailure(failures: ProviderFailure[]): boolean {
  return failures.some(
    (failure) =>
      failure.status === 401 ||
      /api key not valid|permission_denied|unauthenticated/i.test(
        `${failure.code} ${failure.message}`,
      ),
  );
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

    const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
    if (!geminiKey) {
      return json(req, 503, { error: "image_provider_not_configured" });
    }

    const requestedAspect =
      typeof body.aspect_ratio === "string" ? body.aspect_ratio : "16:9";
    const requestedSize =
      typeof body.image_size === "string" ? body.image_size : "1K";
    const aspectRatio = ALLOWED_ASPECT_RATIOS.has(requestedAspect)
      ? requestedAspect
      : "16:9";
    const imageSize = ALLOWED_IMAGE_SIZES.has(requestedSize)
      ? requestedSize
      : "1K";

    const prompt = `${rawPrompt}\n\nCommercial advertising key visual. Do not render any words, letters, numbers, logos, watermarks, UI, captions or labels. Keep the composition clean, photorealistic when appropriate, with a single clear focal idea and usable negative space for external typography. The final typography and real product cutout will be added separately by the application.`;

    const failures: ProviderFailure[] = [];
    let generated: GeneratedImage | undefined;
    let selectedModel = "";

    for (const model of imageModels()) {
      try {
        const attempt = await tryInteractionsModel({
          apiKey: geminiKey,
          model,
          prompt,
          aspectRatio,
          imageSize,
        });
        if (attempt.image) {
          generated = attempt.image;
          selectedModel = model;
          break;
        }
        if (attempt.failure) failures.push(attempt.failure);
      } catch (error) {
        failures.push({
          model,
          status: 504,
          code: error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
          message: error instanceof Error ? error.message.slice(0, 500) : "Provider request failed.",
        });
      }
    }

    if (!generated) {
      try {
        const legacy = await tryLegacyModel({
          apiKey: geminiKey,
          prompt,
          aspectRatio,
        });
        if (legacy.image) {
          generated = legacy.image;
          selectedModel = LEGACY_IMAGE_MODEL;
        } else if (legacy.failure) {
          failures.push(legacy.failure);
        }
      } catch (error) {
        failures.push({
          model: LEGACY_IMAGE_MODEL,
          status: 504,
          code: error instanceof DOMException && error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
          message: error instanceof Error ? error.message.slice(0, 500) : "Legacy provider request failed.",
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
          provider: "gemini",
          failures,
        }),
      );
      return json(req, 502, {
        error,
        provider_status: lastFailure?.status ?? 502,
        provider_code: lastFailure?.code ?? "provider_error",
        provider_message: lastFailure?.message ?? "Image generation failed.",
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
