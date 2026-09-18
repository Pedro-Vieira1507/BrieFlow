import {
  authenticate,
  json,
  preflight,
  readJson,
  requirePost,
} from "../_shared/http.ts";

interface ProductSegmentBody {
  image_url?: unknown;
}

const SEGMENTS_PER_MINUTE = 12;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 45_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isAllowedImageType(contentType: string): boolean {
  return /^image\/(?:jpeg|jpg|png|webp)$/i.test(contentType);
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
        p_scope: "product_segment",
        p_limit: SEGMENTS_PER_MINUTE,
      },
    );

    if (rateError) {
      console.error(
        JSON.stringify({
          event: "product_segment_rate_limit_failed",
          code: rateError.message,
        }),
      );
      return json(req, 500, { error: "rate_limit_failed" });
    }

    if (!rateAllowed) {
      return json(req, 429, { error: "rate_limit_exceeded" });
    }

    const body = await readJson<ProductSegmentBody>(req, 12_000);
    const imageUrl =
      typeof body.image_url === "string" ? body.image_url.trim() : "";

    if (!/^https:\/\//i.test(imageUrl) || imageUrl.length > 4_000) {
      return json(req, 400, { error: "invalid_image_url" });
    }

    const workerUrl = Deno.env.get("CLOUDFLARE_SEGMENT_WORKER_URL")?.trim();
    const sharedSecret = Deno.env
      .get("CLOUDFLARE_SEGMENT_SHARED_SECRET")
      ?.trim();

    if (!workerUrl || !sharedSecret) {
      return json(req, 503, {
        error: "product_segment_not_configured",
        message: "Segmentação premium ainda não configurada.",
      });
    }

    const source = await fetchWithTimeout(imageUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
      },
      redirect: "follow",
    });

    if (!source.ok) {
      return json(req, 502, {
        error: "product_source_fetch_failed",
        provider_status: source.status,
      });
    }

    const contentType = source.headers.get("content-type")?.split(";")[0] ?? "";
    if (!isAllowedImageType(contentType)) {
      return json(req, 415, {
        error: "unsupported_product_image",
        content_type: contentType,
      });
    }

    const contentLength = Number(source.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_SOURCE_BYTES) {
      return json(req, 413, { error: "product_image_too_large" });
    }

    const sourceBytes = new Uint8Array(await source.arrayBuffer());
    if (sourceBytes.byteLength > MAX_SOURCE_BYTES) {
      return json(req, 413, { error: "product_image_too_large" });
    }

    const segmented = await fetchWithTimeout(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "X-BrieFlow-Segment-Secret": sharedSecret,
      },
      body: sourceBytes,
    });

    if (!segmented.ok) {
      const providerMessage = (await segmented.text()).slice(0, 500);
      console.warn(
        JSON.stringify({
          event: "product_segment_provider_failed",
          status: segmented.status,
          message: providerMessage,
        }),
      );
      return json(req, 502, {
        error: "product_segment_provider_failed",
        provider_status: segmented.status,
        provider_message: providerMessage,
      });
    }

    const outputType =
      segmented.headers.get("content-type")?.split(";")[0] ?? "image/webp";
    const outputBytes = new Uint8Array(await segmented.arrayBuffer());

    if (
      outputBytes.byteLength < 128 ||
      outputBytes.byteLength > MAX_OUTPUT_BYTES
    ) {
      return json(req, 502, { error: "invalid_segmented_image" });
    }

    const extension = outputType.includes("png") ? "png" : "webp";
    const storagePath =
      `${context.user.id}/segmented/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await context.service.storage
      .from("campaign-assets")
      .upload(storagePath, outputBytes, {
        cacheControl: "31536000",
        contentType: outputType,
        upsert: false,
      });

    if (uploadError) {
      console.error(
        JSON.stringify({
          event: "product_segment_upload_failed",
          code: uploadError.message,
        }),
      );
      return json(req, 500, { error: "product_segment_upload_failed" });
    }

    const { data: signed, error: signError } = await context.service.storage
      .from("campaign-assets")
      .createSignedUrl(storagePath, 60 * 60 * 24);

    if (signError || !signed?.signedUrl) {
      return json(req, 500, { error: "product_segment_sign_failed" });
    }

    return json(req, 200, {
      url: signed.signedUrl,
      path: storagePath,
      provider: "cloudflare-images-birefnet",
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "internal_error";
    const status =
      code === "invalid_json"
        ? 400
        : code === "request_too_large"
          ? 413
          : code === "AbortError"
            ? 504
            : 500;

    return json(req, status, {
      error: ["invalid_json", "request_too_large"].includes(code)
        ? code
        : "product_segment_failed",
    });
  }
});
