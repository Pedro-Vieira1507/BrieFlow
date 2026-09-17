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

const ALLOWED_ASPECT_RATIOS = new Set([
  "16:9",
  "21:9",
  "4:3",
  "1:1",
  "4:5",
  "9:16",
]);
const ALLOWED_IMAGE_SIZES = new Set(["512", "1K", "2K"]);

function findGeneratedImage(value: unknown): GeneratedImage | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const directData =
    typeof record.b64_json === "string"
      ? record.b64_json
      : typeof record.data === "string"
        ? record.data
        : null;
  const mimeType =
    typeof record.mime_type === "string"
      ? record.mime_type
      : typeof record.mimeType === "string"
        ? record.mimeType
        : "image/png";
  const looksLikeImage =
    record.type === "image" ||
    mimeType.startsWith("image/") ||
    typeof record.b64_json === "string";

  if (directData && looksLikeImage && directData.length > 100) {
    return { data: directData, mimeType };
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

    const body = await readJson<ImageRenderBody>(req, 24_000);
    const rawPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (rawPrompt.length < 8 || rawPrompt.length > 8_000) {
      return json(req, 400, { error: "invalid_prompt" });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
    if (!geminiKey) {
      return json(req, 503, { error: "image_provider_not_configured" });
    }

    const model =
      Deno.env.get("GEMINI_IMAGE_MODEL")?.trim() || "gemini-3.1-flash-image";
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 110_000);
    let providerResponse: Response;
    try {
      providerResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiKey,
          },
          body: JSON.stringify({
            model,
            input: prompt,
            response_format: {
              type: "image",
              mime_type: "image/jpeg",
              aspect_ratio: aspectRatio,
              image_size: imageSize,
            },
          }),
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!providerResponse.ok) {
      console.warn(
        JSON.stringify({
          event: "image_provider_failed",
          provider: "gemini",
          model,
          status: providerResponse.status,
        }),
      );
      return json(req, 502, { error: "image_provider_failed" });
    }

    const payload = (await providerResponse.json()) as unknown;
    const generated = findGeneratedImage(payload);
    if (!generated) {
      console.warn(
        JSON.stringify({
          event: "image_provider_empty",
          provider: "gemini",
          model,
        }),
      );
      return json(req, 502, { error: "image_provider_empty" });
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
      model,
      aspect_ratio: aspectRatio,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "internal_error";
    const status = code === "invalid_json" ? 400 : code === "request_too_large" ? 413 : 500;
    return json(req, status, {
      error: ["invalid_json", "request_too_large"].includes(code)
        ? code
        : "image_render_failed",
    });
  }
});
